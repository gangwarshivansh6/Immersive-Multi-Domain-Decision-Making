/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  SimulationSession,
  Domain,
  TaskStatus,
  DifficultyLevel,
} from './types/simulation';
import { Header } from './components/Header';
import { TraineeWorkspace } from './components/TraineeWorkspace';
import { InstructorDashboard } from './components/InstructorDashboard';
import { DualSplitView } from './components/DualSplitView';
import { WalkthroughGuide } from './components/WalkthroughGuide';
import { AfterActionReview } from './components/AfterActionReview';
import { AuthModal } from './components/AuthModal';
import { ActivityHistoryModal } from './components/ActivityHistoryModal';
import { AccessDeniedModal } from './components/AccessDeniedModal';
import { useAuth } from './context/AuthContext';
import { auth, saveUserActivity, saveTrainingRecord, testFirestoreConnection } from './services/firebase';
import {
  getOfflineQueue,
  enqueueOfflineItem,
  syncOfflineQueueWithServer,
} from './utils/offlineQueue';
import { validateDecisionRestrictions } from './utils/restrictionEngine';
import { evaluateSessionPerformance } from './utils/evaluationEngine';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

export default function App() {
  const { user, profile, isInstructor, isAdmin } = useAuth();
  const [session, setSession] = useState<SimulationSession | null>(null);
  const [currentStation, setCurrentStation] = useState<
    'walkthrough' | 'trainee' | 'instructor' | 'split' | 'aar'
  >('walkthrough');
  const [walkthroughStep, setWalkthroughStep] = useState<number>(1);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [isBrowserOnline, setIsBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isActivitiesModalOpen, setIsActivitiesModalOpen] = useState(false);

  // Role-Based Access Control (RBAC) Alert States
  const [isAccessDeniedOpen, setIsAccessDeniedOpen] = useState(false);
  const [accessDeniedTarget, setAccessDeniedTarget] = useState('Instructor Station');
  const [accessDeniedAlertBanner, setAccessDeniedAlertBanner] = useState<string | null>(null);

  useEffect(() => {
    testFirestoreConnection().catch(() => {});
  }, []);

  // Overall effective online state
  const isOnline = isBrowserOnline && !isSimulatedOffline;

  // Retrieve cryptographically signed Firebase ID token for authenticated server requests
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!auth.currentUser) return {};
    try {
      const token = await auth.currentUser.getIdToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch (err) {
      console.warn('Could not retrieve auth token:', err);
      return {};
    }
  }, []);

  // Sync state from server (includes Bearer token so server delivers full or sanitized intel based on role)
  const fetchSession = useCallback(async () => {
    if (!isOnline) return;
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/session', {
        headers: {
          ...authHeaders,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
      }
    } catch (err) {
      console.warn('Could not fetch active session from server:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, getAuthHeaders]);

  // Initial fetch and polling every 1.5s
  useEffect(() => {
    fetchSession();
    const interval = setInterval(() => {
      fetchSession();
      // Update pending queue count
      setPendingSyncCount(getOfflineQueue().length);
    }, 1500);

    return () => clearInterval(interval);
  }, [fetchSession]);

  // Online / Offline window events
  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOnline(true);
      // Auto sync when reconnected
      syncOfflineQueueWithServer().then(() => {
        setPendingSyncCount(getOfflineQueue().length);
        fetchSession();
      });
    };

    const handleOffline = () => {
      setIsBrowserOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchSession]);

  // Enforce Role-Based Access Control upon station navigation attempts
  const handleSelectStation = useCallback(
    (targetStation: 'walkthrough' | 'trainee' | 'instructor' | 'split' | 'aar') => {
      if (targetStation === 'instructor' || targetStation === 'split') {
        // Only users with instructor or admin role are permitted
        if (!isInstructor && !isAdmin) {
          setAccessDeniedTarget(
            targetStation === 'instructor'
              ? 'Instructor Station'
              : 'Dual Split View (Instructor Station)'
          );
          setIsAccessDeniedOpen(true);
          setAccessDeniedAlertBanner(
            'Access Denied: The Instructor Station is restricted to authorized instructors.'
          );
          setCurrentStation('trainee');
          window.location.hash = '#trainee';
          return;
        }
      }

      setAccessDeniedAlertBanner(null);
      setCurrentStation(targetStation);
      window.location.hash = `#${targetStation}`;
    },
    [isInstructor, isAdmin]
  );

  // Monitor URL Hash navigation (e.g. manual address bar entry, bookmarks, or browser back/forward)
  useEffect(() => {
    const syncHashToStation = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash === 'instructor' || hash === 'split') {
        if (!isInstructor && !isAdmin) {
          setAccessDeniedTarget(
            hash === 'instructor'
              ? 'Instructor Station'
              : 'Dual Split View (Instructor Station)'
          );
          setIsAccessDeniedOpen(true);
          setAccessDeniedAlertBanner(
            'Access Denied: The Instructor Station is restricted to authorized instructors.'
          );
          setCurrentStation('trainee');
          window.location.hash = '#trainee';
          return;
        }
        setAccessDeniedAlertBanner(null);
        setCurrentStation(hash as any);
      } else if (hash === 'trainee' || hash === 'walkthrough' || hash === 'aar') {
        setAccessDeniedAlertBanner(null);
        setCurrentStation(hash as any);
      }
    };

    syncHashToStation();
    window.addEventListener('hashchange', syncHashToStation);
    return () => window.removeEventListener('hashchange', syncHashToStation);
  }, [isInstructor, isAdmin]);

  // Immediate protection: If role changes to trainee while on instructor station, boot out immediately
  useEffect(() => {
    if (
      (currentStation === 'instructor' || currentStation === 'split') &&
      !isInstructor &&
      !isAdmin
    ) {
      setAccessDeniedTarget(
        currentStation === 'instructor'
          ? 'Instructor Station'
          : 'Dual Split View (Instructor Station)'
      );
      setIsAccessDeniedOpen(true);
      setAccessDeniedAlertBanner(
        'Access Denied: The Instructor Station is restricted to authorized instructors.'
      );
      setCurrentStation('trainee');
      window.location.hash = '#trainee';
    }
  }, [currentStation, isInstructor, isAdmin]);

  // Toggle simulated offline mode
  const handleToggleSimulatedOffline = () => {
    setIsSimulatedOffline((prev) => {
      const next = !prev;
      if (!next) {
        // Turning back online -> trigger auto-sync
        setTimeout(() => {
          syncOfflineQueueWithServer().then(() => {
            setPendingSyncCount(getOfflineQueue().length);
            fetchSession();
          });
        }, 100);
      }
      return next;
    });
  };

  // Manual Trigger for Syncing Offline Queue
  const handleManualSync = async () => {
    const result = await syncOfflineQueueWithServer();
    setPendingSyncCount(getOfflineQueue().length);
    await fetchSession();
  };

  // Trainee submits decision (handles both online & offline locally)
  const handleSubmitDecision = async (data: {
    action: string;
    rationale: string;
    supportingReportIds: string[];
    confidence: 'low' | 'medium' | 'high';
    targetLocation?: string;
    domain: Domain;
  }) => {
    if (isOnline) {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/trainee/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        setSession(result.session);
      }
    } else {
      // OFFLINE MODE: Enqueue in local persistent storage & perform local rule validation
      if (!session) return;
      const decisionId = `DEC-OFFLINE-${Date.now()}`;

      // Local rule check
      const check = validateDecisionRestrictions({
        decisionId,
        actionText: data.action,
        rationaleText: data.rationale,
        targetLocation: data.targetLocation,
        domain: data.domain,
        selectedReportIds: data.supportingReportIds,
        activeRestrictions: session.restrictions,
        currentConditions: session.conditions,
        deliveredReports: session.reports.filter(
          (r) => r.deliveryStatus === 'delivered' || r.deliveryStatus === 'acknowledged'
        ),
      });

      const offlineDecision = {
        id: decisionId,
        timestamp: new Date().toLocaleTimeString(),
        action: data.action,
        rationale: data.rationale,
        supportingReportIds: data.supportingReportIds,
        confidence: data.confidence,
        targetLocation: data.targetLocation,
        domain: data.domain,
        syncStatus: 'pending' as const,
        availableReportsAtDecision: session.reports
          .filter((r) => r.deliveryStatus === 'delivered' || r.deliveryStatus === 'acknowledged')
          .map((r) => r.id),
        revisionNumber: 1,
        conflictAlerts: check.alerts,
      };

      enqueueOfflineItem('decision', {
        id: decisionId,
        ...data,
        timestamp: new Date().toLocaleTimeString(),
      });
      setPendingSyncCount(getOfflineQueue().length);

      // Optimistically update local session state
      setSession((prev) => {
        if (!prev) return null;
        const newDecisions = [offlineDecision, ...prev.decisions];
        const newAlerts = check.hasConflicts ? [...check.alerts, ...prev.alerts] : prev.alerts;
        const newTimeline = [
          {
            id: `EVT-OFF-DEC-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            simSecond: prev.currentSimSecond,
            type: 'decision_submitted' as const,
            actor: 'trainee' as const,
            domain: data.domain,
            summary: `[OFFLINE QUEUED] Trainee decision: "${data.action.slice(0, 50)}"`,
          },
          ...prev.timeline,
        ];

        return {
          ...prev,
          decisions: newDecisions,
          alerts: newAlerts,
          timeline: newTimeline,
          evaluation: evaluateSessionPerformance(
            newDecisions,
            prev.reports,
            newAlerts,
            prev.tasks,
            prev.evaluation.instructorScoreOverride,
            prev.instructorNotes
          ),
        };
      });
    }

    // Persist to user's Firebase activity history
    saveUserActivity({
      actionType: 'decision_submitted',
      title: `Submitted Decision: ${data.action.slice(0, 45)}...`,
      description: data.rationale,
      domain: data.domain,
      metadata: { targetLocation: data.targetLocation, confidence: data.confidence },
    }).catch(() => {});
  };

  // Trainee revises existing decision
  const handleReviseDecision = async (data: {
    originalDecisionId: string;
    revisedAction: string;
    revisedRationale: string;
    confidence: 'low' | 'medium' | 'high';
  }) => {
    if (isOnline) {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/trainee/decision/revise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        setSession(result.session);
      }
    } else {
      enqueueOfflineItem('decision_revision', data);
      setPendingSyncCount(getOfflineQueue().length);
    }

    saveUserActivity({
      actionType: 'decision_revised',
      title: `Revised Decision ${data.originalDecisionId}`,
      description: data.revisedRationale,
      domain: 'joint',
    }).catch(() => {});
  };

  // Trainee updates task progress
  const handleUpdateTask = async (
    taskId: string,
    status: TaskStatus,
    observation?: string,
    progressPercent?: number
  ) => {
    if (isOnline) {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/trainee/task/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ taskId, status, observation, progressPercent }),
      });
      if (res.ok) {
        const result = await res.json();
        setSession(result.session);
      }
    } else {
      enqueueOfflineItem('task_update', { taskId, status, observation, progressPercent });
      setPendingSyncCount(getOfflineQueue().length);
    }

    saveUserActivity({
      actionType: 'task_updated',
      title: `Updated Task: ${taskId} (${status})`,
      description: observation || `Task progress updated to ${progressPercent ?? 0}%`,
      domain: 'land',
    }).catch(() => {});
  };

  // Trainee acknowledges report
  const handleAcknowledgeReport = async (reportId: string) => {
    if (isOnline) {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/trainee/report/ack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ reportId }),
      });
      fetchSession();
    } else {
      enqueueOfflineItem('report_ack', { reportId, timestamp: new Date().toLocaleTimeString() });
      setPendingSyncCount(getOfflineQueue().length);
    }

    // Save to Firebase Activity stream
    saveUserActivity({
      actionType: 'report_acknowledged',
      title: `Acknowledged Intel: ${reportId}`,
      description: `Trainee verified and acknowledged incoming intel dispatch ${reportId}`,
      domain: 'joint',
    }).catch(() => {});
  };

  // Trainee responds to alert
  const handleRespondToAlert = async (
    alertId: string,
    responseText: string,
    actionType: 'reconsider' | 'mitigate'
  ) => {
    if (isOnline) {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/trainee/alert/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ alertId, responseText, actionType }),
      });
      if (res.ok) {
        const result = await res.json();
        setSession(result.session);
      }
    } else {
      enqueueOfflineItem('alert_response', { alertId, responseText, actionType });
      setPendingSyncCount(getOfflineQueue().length);
    }
  };

  // Instructor session status (start, pause, end) - Protected with Server-Side Verification
  const handleUpdateSessionStatus = async (status: 'running' | 'paused' | 'ended') => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/session/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ status }),
    });

    if (res.status === 401 || res.status === 403) {
      setAccessDeniedTarget('Exercise Status Control API');
      setIsAccessDeniedOpen(true);
      setAccessDeniedAlertBanner(
        'Access Denied: The Instructor Station is restricted to authorized instructors.'
      );
      setCurrentStation('trainee');
      window.location.hash = '#trainee';
      return;
    }

    if (res.ok) {
      const result = await res.json();
      setSession(result.session);
      if (status === 'ended') {
        if (result.session) {
          saveTrainingRecord({
            scenarioTitle: result.session.scenarioTitle,
            difficulty: result.session.difficulty,
            overallScore: result.session.evaluation?.overallScore ?? 75,
            decisionsCount: result.session.decisions?.length ?? 0,
            alertsCount: result.session.alerts?.length ?? 0,
          }).catch(() => {});

          saveUserActivity({
            actionType: 'aar_completed',
            title: `Completed Exercise: ${result.session.scenarioTitle}`,
            description: `Composite Score: ${result.session.evaluation?.overallScore ?? 75}/100 with ${result.session.decisions?.length ?? 0} decision(s) logged`,
            domain: 'joint',
          }).catch(() => {});
        }
        setCurrentStation('aar');
      }
    }
  };

  // Instructor re-initializes session - Protected with Server-Side Verification
  const handleInitSession = async (difficulty: DifficultyLevel) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/session/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ difficulty }),
    });

    if (res.status === 401 || res.status === 403) {
      setAccessDeniedTarget('Scenario Initialization API');
      setIsAccessDeniedOpen(true);
      setAccessDeniedAlertBanner(
        'Access Denied: The Instructor Station is restricted to authorized instructors.'
      );
      setCurrentStation('trainee');
      window.location.hash = '#trainee';
      return;
    }

    if (res.ok) {
      const result = await res.json();
      setSession(result.session);
    }
  };

  // Instructor report action - Protected with Server-Side Verification
  const handleReportAction = async (reportId: string, action: string, delaySeconds?: number) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/instructor/report/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ reportId, action, delaySeconds }),
    });

    if (res.status === 401 || res.status === 403) {
      setAccessDeniedTarget('Instructor Intel Control API');
      setIsAccessDeniedOpen(true);
      setAccessDeniedAlertBanner(
        'Access Denied: The Instructor Station is restricted to authorized instructors.'
      );
      setCurrentStation('trainee');
      window.location.hash = '#trainee';
      return;
    }

    if (res.ok) {
      const result = await res.json();
      setSession(result.session);
    }
  };

  // Instructor injects new synthetic report - Protected with Server-Side Verification
  const handleInjectReport = async (reportData: {
    domain: Domain;
    source: string;
    title: string;
    content: string;
    locationReference?: string;
  }) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/instructor/report/inject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(reportData),
    });

    if (res.status === 401 || res.status === 403) {
      setAccessDeniedTarget('Instructor Report Injection API');
      setIsAccessDeniedOpen(true);
      setAccessDeniedAlertBanner(
        'Access Denied: The Instructor Station is restricted to authorized instructors.'
      );
      setCurrentStation('trainee');
      window.location.hash = '#trainee';
      return;
    }

    if (res.ok) {
      const result = await res.json();
      setSession(result.session);
    }
  };

  // Instructor updates scenario condition - Protected with Server-Side Verification
  const handleUpdateCondition = async (
    conditionId: string,
    actualState: string,
    severity?: 'nominal' | 'degraded' | 'critical'
  ) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/instructor/condition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ conditionId, actualState, severity }),
    });

    if (res.status === 401 || res.status === 403) {
      setAccessDeniedTarget('Instructor Scenario Condition API');
      setIsAccessDeniedOpen(true);
      setAccessDeniedAlertBanner(
        'Access Denied: The Instructor Station is restricted to authorized instructors.'
      );
      setCurrentStation('trainee');
      window.location.hash = '#trainee';
      return;
    }

    if (res.ok) {
      const result = await res.json();
      setSession(result.session);
    }
  };

  // Instructor saves annotation & score override - Protected with Server-Side Verification
  const handleSaveAnnotation = async (notes: string, scoreOverride?: number) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/instructor/annotation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ notes, scoreOverride }),
    });

    if (res.status === 401 || res.status === 403) {
      setAccessDeniedTarget('Instructor Annotation API');
      setIsAccessDeniedOpen(true);
      setAccessDeniedAlertBanner(
        'Access Denied: The Instructor Station is restricted to authorized instructors.'
      );
      setCurrentStation('trainee');
      window.location.hash = '#trainee';
      return;
    }

    if (res.ok) {
      const result = await res.json();
      setSession(result.session);
    }
  };

  // AI Debrief Generation
  const handleGenerateAiDebrief = async (): Promise<string> => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/ai/aar-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
    if (res.ok) {
      const data = await res.json();
      await fetchSession();
      return data.debrief;
    }
    return 'Debrief generation failed. Please try again.';
  };

  // 12-Step Walkthrough Demonstration Automation Handler
  const handleExecuteDemoStep = async (stepNum: number) => {
    if (!session) return;

    switch (stepNum) {
      case 1: // Initialize Medium Exercise
        await handleInitSession('medium');
        break;

      case 2: // Trainee acknowledges initial situation & task
        await handleUpdateTask(
          'TASK-01',
          'in_progress',
          'Vanguard staged at Alpha. Reviewing Route Obsidian vs Route Amber.',
          30
        );
        break;

      case 3: // Release initial vanguard report REP-L-101
        await handleReportAction('REP-L-101', 'release_now');
        break;

      case 4: // Trainee submits initial cautious hold decision
        await handleSubmitDecision({
          action: 'Advance scout vanguard to Staging Alpha; hold main supply column pending Falcon-4 aerial survey of Bridge Charlie.',
          rationale: 'Initial intelligence REP-L-101 reports Highway 4 approach clear, but heavy armor crossing requires dual-source recon verification per Rule R-05.',
          supportingReportIds: ['REP-L-101'],
          confidence: 'high',
          targetLocation: 'Staging Area Alpha',
          domain: 'land',
        });
        break;

      case 5: // Instructor injects contradiction: REP-L-102 (demolition charges on Bridge Charlie)
        await handleReportAction('REP-L-102', 'add_contradiction');
        await handleReportAction('REP-CY-401', 'delay', 45);
        break;

      case 6: // Trainee acknowledges contradiction alert in report feed
        await handleAcknowledgeReport('REP-L-102');
        break;

      case 7: // Trainee submits decision that violates Rule R-02 (Bridge Load Limit)
        await handleSubmitDecision({
          action: 'Order 3rd Heavy Armored Column (Main Battle Tanks) to cross Bridge Charlie along Route Obsidian at maximum speed.',
          rationale: 'Relying on Falcon-4 UAV aerial report REP-A-201 to force the crossing.',
          supportingReportIds: ['REP-A-201'],
          confidence: 'medium',
          targetLocation: 'Bridge Charlie',
          domain: 'land',
        });
        break;

      case 8: // Inspect alert (no action required, UI highlights the alert)
        break;

      case 9: // Trainee revises decision to divert to Route Amber and avoid Bridge Charlie
        {
          const lastDec = session.decisions[0];
          if (lastDec) {
            await handleReviseDecision({
              originalDecisionId: lastDec.id,
              revisedAction: 'Halt all heavy armor before Bridge Charlie and divert supply column via Route Amber (Checkpoint Echo).',
              revisedRationale: 'Combat Engineer Report REP-L-102 verified demolition charges wired under Bridge Charlie. In compliance with Rule R-02, diverting to mountain pass Route Amber despite fog conditions.',
              confidence: 'high',
            });
          }
        }
        break;

      case 10: // Simulate Comms Outage
        setIsSimulatedOffline(true);
        break;

      case 11: // Submit decision while offline, then reconnect and batch sync
        {
          await handleSubmitDecision({
            action: 'Execute EMCON Alpha protocols: shut down active high-power search radars near Ridge 12 to avoid hostile SIGINT triangulation.',
            rationale: 'Following Rule R-03 while navigating through degraded comms zone.',
            supportingReportIds: ['REP-EW-301'],
            confidence: 'high',
            targetLocation: 'Ridge 12',
            domain: 'ew',
          });
          // Restore connection
          setIsSimulatedOffline(false);
          // Auto sync
          setTimeout(async () => {
            await syncOfflineQueueWithServer();
            setPendingSyncCount(getOfflineQueue().length);
            await fetchSession();
          }, 400);
        }
        break;

      case 12: // End exercise & open AAR
        await handleUpdateSessionStatus('ended');
        setCurrentStation('aar');
        break;
    }
  };

  if (isLoading || !session) {
    return (
      <div className="min-h-screen bg-[#070d19] text-slate-100 flex flex-col items-center justify-center p-6 space-y-3 font-sans">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-sm font-semibold text-slate-200">
          Initializing Multi-Domain Simulation Engine...
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Loading Sector Kestrel Tactical Assets (SIH26248)
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070d19] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Bar Header with Strict RBAC Navigation */}
      <Header
        currentStation={currentStation}
        onSelectStation={handleSelectStation}
        isOnline={isOnline}
        onToggleSimulatedOffline={handleToggleSimulatedOffline}
        pendingSyncCount={pendingSyncCount}
        onManualSync={handleManualSync}
        onEndExercise={() => handleUpdateSessionStatus('ended')}
        sessionStatus={session.status}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenActivities={() => setIsActivitiesModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-2 sm:p-4">
        {/* Prominent Access Denied Security Banner */}
        {accessDeniedAlertBanner && (
          <div className="max-w-6xl mx-auto w-full mb-3 p-3 bg-rose-950/90 border-2 border-rose-600 rounded-xl flex items-center justify-between text-xs text-rose-200 shadow-xl animate-fade-in">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
              <div>
                <span className="font-bold text-white block text-sm">
                  Access Denied: The Instructor Station is restricted to authorized instructors.
                </span>
                <span className="text-[11px] text-rose-300 font-mono">
                  Your current account role is{' '}
                  <span className="font-bold uppercase text-white">
                    {profile?.role || 'Trainee (Unauthenticated)'}
                  </span>
                  . Only authenticated instructors or administrators can access instructor tools.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-1.5 bg-rose-900 hover:bg-rose-800 border border-rose-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Sign In as Instructor
              </button>
              <button
                type="button"
                onClick={() => setAccessDeniedAlertBanner(null)}
                className="text-rose-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Demo Scenario Walkthrough View */}
        {currentStation === 'walkthrough' && (
          <div className="max-w-6xl mx-auto w-full space-y-4">
            <WalkthroughGuide
              session={session}
              currentStep={walkthroughStep}
              onSetStep={setWalkthroughStep}
              onSelectRole={handleSelectStation}
              onExecuteDemoStep={handleExecuteDemoStep}
              isOffline={!isOnline}
              onToggleSimulatedOffline={handleToggleSimulatedOffline}
              isInstructor={isInstructor || isAdmin}
            />

            {/* Live Preview of Trainee Workspace below the walkthrough guide */}
            <div className="border-t border-slate-800 pt-3">
              <div className="text-xs font-mono text-slate-400 mb-2 uppercase flex items-center justify-between">
                <span>Active Simulator Preview</span>
                <span>Role: Trainee Operator</span>
              </div>
              <TraineeWorkspace
                session={session}
                onSubmitDecision={handleSubmitDecision}
                onReviseDecision={handleReviseDecision}
                onUpdateTask={handleUpdateTask}
                onAcknowledgeReport={handleAcknowledgeReport}
                onRespondToAlert={handleRespondToAlert}
                isOnline={isOnline}
              />
            </div>
          </div>
        )}

        {/* Trainee Workspace View */}
        {currentStation === 'trainee' && (
          <TraineeWorkspace
            session={session}
            onSubmitDecision={handleSubmitDecision}
            onReviseDecision={handleReviseDecision}
            onUpdateTask={handleUpdateTask}
            onAcknowledgeReport={handleAcknowledgeReport}
            onRespondToAlert={handleRespondToAlert}
            isOnline={isOnline}
          />
        )}

        {/* Instructor Station View (Strict Role Enforcement) */}
        {currentStation === 'instructor' && (isInstructor || isAdmin) && (
          <div className="max-w-6xl mx-auto w-full h-[850px] p-2">
            <InstructorDashboard
              session={session}
              onUpdateSessionStatus={handleUpdateSessionStatus}
              onInitSession={handleInitSession}
              onReportAction={handleReportAction}
              onInjectReport={handleInjectReport}
              onUpdateCondition={handleUpdateCondition}
              onSaveAnnotation={handleSaveAnnotation}
            />
          </div>
        )}

        {/* Dual Split View (Strict Role Enforcement) */}
        {currentStation === 'split' && (isInstructor || isAdmin) && (
          <DualSplitView
            session={session}
            onSubmitDecision={handleSubmitDecision}
            onReviseDecision={handleReviseDecision}
            onUpdateTask={handleUpdateTask}
            onAcknowledgeReport={handleAcknowledgeReport}
            onRespondToAlert={handleRespondToAlert}
            onUpdateSessionStatus={handleUpdateSessionStatus}
            onInitSession={handleInitSession}
            onReportAction={handleReportAction}
            onInjectReport={handleInjectReport}
            onUpdateCondition={handleUpdateCondition}
            onSaveAnnotation={handleSaveAnnotation}
            isOnline={isOnline}
          />
        )}

        {/* AAR Debrief Screen */}
        {currentStation === 'aar' && (
          <AfterActionReview
            session={session}
            onReturnToSimulation={() => setCurrentStation('trainee')}
            onGenerateAiDebrief={handleGenerateAiDebrief}
          />
        )}
      </main>

      {/* Firebase Auth Modal with Instant Demo Credentials */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* User Activity Stream Modal */}
      <ActivityHistoryModal
        isOpen={isActivitiesModalOpen}
        onClose={() => setIsActivitiesModalOpen(false)}
      />

      {/* Strict Access Denied Modal */}
      <AccessDeniedModal
        isOpen={isAccessDeniedOpen}
        onClose={() => setIsAccessDeniedOpen(false)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        currentRole={profile?.role}
        attemptedStation={accessDeniedTarget}
      />
    </div>
  );
}
