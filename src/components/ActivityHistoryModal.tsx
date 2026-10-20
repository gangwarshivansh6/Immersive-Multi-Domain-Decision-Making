import React from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Clock, Activity, CheckCircle2, RefreshCw, Send, ShieldAlert, Award } from 'lucide-react';

interface ActivityHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, activities } = useAuth();

  if (!isOpen) return null;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'decision_submitted':
        return <Send className="w-3.5 h-3.5 text-cyan-400" />;
      case 'decision_revised':
        return <RefreshCw className="w-3.5 h-3.5 text-amber-400" />;
      case 'task_updated':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'aar_completed':
        return <Award className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl flex flex-col max-h-[85vh] text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Firebase Activity Stream</h2>
              <div className="text-[11px] text-slate-400">
                Logged to Cloud Firestore: <span className="font-mono text-cyan-400">{user?.email || 'Anonymous'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of activities */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {!user ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Sign in with your Firebase account to view and synchronize your simulation activity history across sessions.
            </div>
          ) : activities.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No simulation activities recorded in Firestore yet. Submitting decisions, revising plans, and updating tasks will automatically stream events here.
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act.id || act.timestamp}
                className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-lg text-xs space-y-1 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    {getActivityIcon(act.actionType)}
                    <span className="font-semibold text-slate-200">{act.title}</span>
                    <span className="text-slate-600">·</span>
                    <span className="uppercase text-[10px] font-mono text-cyan-400">{act.domain}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">
                    {new Date(act.timestamp).toLocaleTimeString()} · {new Date(act.timestamp).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-slate-300 text-[11px] leading-relaxed pl-5 font-sans">
                  {act.description}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Synced with Firestore Collection: users/{user?.uid?.slice(0, 8)}.../activities</span>
          <span>{activities.length} total event(s)</span>
        </div>
      </div>
    </div>
  );
};
