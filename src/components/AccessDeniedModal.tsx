import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, LogIn, Lock } from 'lucide-react';

interface AccessDeniedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
  currentRole?: string | null;
  attemptedStation?: string;
}

export const AccessDeniedModal: React.FC<AccessDeniedModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
  currentRole,
  attemptedStation = 'Instructor Station',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-rose-600/80 rounded-xl p-6 text-slate-100 shadow-2xl">
        {/* Header Icon & Alert Badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-rose-400">
            <ShieldAlert className="w-6 h-6 text-rose-500 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-900/60 text-rose-300 border border-rose-700 rounded">
                Security Restriction
              </span>
              <span className="text-[10px] font-mono text-slate-400">SIH26248 RBAC</span>
            </div>
            <h2 className="text-base font-bold text-white mt-1">
              Access Denied: The Instructor Station is restricted to authorized instructors.
            </h2>
          </div>
        </div>

        {/* Informative Body */}
        <div className="space-y-3 text-xs text-slate-300 bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 mb-5 font-mono">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">
                Unauthorized Endpoint Access Prevented
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Target Resource: <span className="text-slate-200">{attemptedStation}</span>
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-850 text-[11px] text-slate-400 leading-relaxed">
            {currentRole ? (
              <p>
                You are currently authenticated as{' '}
                <span className="text-cyan-300 font-semibold uppercase">{currentRole}</span>.
                Trainee accounts are strictly prohibited from viewing instructor scenario controls,
                pending intelligence reports, or live exercise overrides.
              </p>
            ) : (
              <p>
                You are not currently authenticated. The Instructor Station requires valid
                server-verified Instructor or Administrator credentials.
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Return to Trainee Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAuth();
            }}
            className="w-full sm:w-auto py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In as Instructor</span>
          </button>
        </div>
      </div>
    </div>
  );
};
