import { OfflineQueueItem } from '../types/simulation';

const STORAGE_KEY = 'sih26248_offline_event_queue';
const SYNC_HISTORY_KEY = 'sih26248_sync_history';

export interface SyncResult {
  syncedCount: number;
  failedCount: number;
  duplicateCount: number;
  items: OfflineQueueItem[];
}

/**
 * Get all queued offline items
 */
export function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read offline queue from localStorage', err);
    return [];
  }
}

/**
 * Enqueue an item while offline or pending
 */
export function enqueueOfflineItem(
  type: OfflineQueueItem['type'],
  payload: any
): OfflineQueueItem {
  const item: OfflineQueueItem = {
    id: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    type,
    payload,
    status: 'pending',
    retryCount: 0,
  };

  const queue = getOfflineQueue();
  // Prevent duplicate if an exact event ID already exists
  if (!queue.some(q => q.id === item.id)) {
    queue.push(item);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.error('Failed to write offline queue to localStorage', err);
    }
  }

  return item;
}

/**
 * Remove an item from the queue
 */
export function removeOfflineItem(id: string): void {
  const queue = getOfflineQueue().filter(q => q.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to update offline queue', err);
  }
}

/**
 * Clear all queue
 */
export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear offline queue', err);
  }
}

/**
 * Batch synchronize offline queue with the server endpoint
 */
export async function syncOfflineQueueWithServer(): Promise<SyncResult> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, failedCount: 0, duplicateCount: 0, items: [] };
  }

  // Mark all pending as 'syncing'
  const updatedQueue = queue.map(item => ({
    ...item,
    status: 'syncing' as const,
  }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueue));
  } catch (e) {}

  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: updatedQueue }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Clear successfully synced items from local queue
    const remainingQueue = getOfflineQueue().filter(q => 
      !data.syncedIds?.includes(q.id)
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingQueue));

    // Append to sync history for audit log
    recordSyncHistory({
      syncedAt: new Date().toISOString(),
      syncedIds: data.syncedIds || [],
      duplicateIds: data.duplicateIds || [],
      count: data.syncedCount || 0,
    });

    return {
      syncedCount: data.syncedCount || 0,
      failedCount: remainingQueue.length,
      duplicateCount: data.duplicateCount || 0,
      items: data.syncedItems || [],
    };
  } catch (error) {
    console.warn('Sync failed, items retained in offline queue for retry', error);
    // Revert status to 'pending' with incremented retry count
    const reverted = getOfflineQueue().map(item => ({
      ...item,
      status: 'pending' as const,
      retryCount: item.retryCount + 1,
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reverted));
    } catch (e) {}
    return {
      syncedCount: 0,
      failedCount: reverted.length,
      duplicateCount: 0,
      items: [],
    };
  }
}

export function recordSyncHistory(entry: any) {
  try {
    const raw = localStorage.getItem(SYNC_HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(entry);
    localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  } catch (e) {}
}

export function getSyncHistory(): any[] {
  try {
    const raw = localStorage.getItem(SYNC_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
