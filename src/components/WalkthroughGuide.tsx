import React, { useState } from 'react';
import { SimulationSession, DifficultyLevel } from '../types/simulation';
import { CheckCircle2, ChevronRight, ChevronLeft, Play, ArrowRight, ShieldAlert, WifiOff, Wifi, Award } from 'lucide-react';

interface WalkthroughGuideProps {
  session: SimulationSession;
  currentStep: number;
  onSetStep: (step: number) => void;
  onSelectRole: (role: 'instructor' | 'trainee' | 'split' | 'aar') => void;
  onExecuteDemoStep: (stepNumber: number) => Promise<void>;
  isOffline: boolean;
  onToggleSimulatedOffline: () => void;
  isInstructor?: boolean;
}

export const WalkthroughGuide: React.FC<WalkthroughGuideProps> = ({
  session,
  currentStep,
  onSetStep,
  onSelectRole,
  onExecuteDemoStep,
  isOffline,
  onToggleSimulatedOffline,
  isInstructor = false,
}) => {
  const [isRunningStep, setIsRunningStep] = useState(false);

  const steps = [
    {
      step: 1,
      title: 'Configure Scenario & Difficulty',
      role: 'Instructor Station',
      targetStation: 'instructor' as const,
      description: 'Instructor selects training scenario and difficulty (Medium). This sets baseline network latency, report schedules, and EW friction.',
      actionLabel: 'Initialize Medium Exercise',
    },
    {
      step: 2,
      title: 'Review Briefing, Map & Restrictions',
      role: 'Trainee Station',
      targetStation: 'trainee' as const,
      description: 'Trainee inspects initial briefing for Sector Kestrel, tactical grid schematic (River Kestrel / Bridge Charlie), and explicit restrictions (R-01 Hospital RoE, R-02 Bridge Load limit).',
      actionLabel: 'Acknowledge Briefing & Rules',
    },
    {
      step: 3,
      title: 'Release Initial Vanguard Report',
      role: 'Instructor Station',
      targetStation: 'instructor' as const,
      description: 'Instructor releases Report REP-L-101 (Recon vanguard approaching Bridge Charlie via Highway 4).',
      actionLabel: 'Release Report REP-L-101',
    },
    {
      step: 4,
      title: 'Submit Initial Decision with Rationale',
      role: 'Trainee Station',
      targetStation: 'trainee' as const,
      description: 'Trainee receives REP-L-101 and submits a cautious directive: "Advance scout vanguard to Staging Alpha; hold main column pending aerial survey."',
      actionLabel: 'Submit Scout Hold Decision',
    },
    {
      step: 5,
      title: 'Inject Contradictory Bridge Intel',
      role: 'Instructor Station',
      targetStation: 'instructor' as const,
      description: 'Instructor delays cyber report REP-CY-401 by 45s, and releases contradictory ground engineer report REP-L-102 stating Bridge Charlie is rigged with C4 demolition charges (contradicting UAV Falcon-4 aerial report REP-A-201).',
      actionLabel: 'Inject Contradiction (REP-L-102)',
    },
    {
      step: 6,
      title: 'Trainee Reconsiders Course of Action',
      role: 'Trainee Station',
      targetStation: 'trainee' as const,
      description: 'Trainee observes contradictory alert on Bridge Charlie in the intel feed, acknowledges discrepancy, and prepares to evaluate alternate mountain pass (Route Amber).',
      actionLabel: 'Acknowledge Contradiction Alert',
    },
    {
      step: 7,
      title: 'Submit Prohibited Action (Triggers Rule R-02)',
      role: 'Trainee Station',
      targetStation: 'trainee' as const,
      description: 'Trainee tests system by ordering: "Order 3rd Heavy Armored Column (MBTs) to cross Bridge Charlie immediately along Route Obsidian".',
      actionLabel: 'Trigger Rule R-02 Conflict',
    },
    {
      step: 8,
      title: 'Restriction Validation Warning',
      role: 'System / Both Stations',
      targetStation: 'split' as const,
      description: 'The Restriction Engine immediately blocks/warns on the decision, explaining that Rule R-02 prohibits heavy armor on Bridge Charlie while demolition charges remain unverified.',
      actionLabel: 'Inspect Conflict Alert',
    },
    {
      step: 9,
      title: 'Trainee Revises Action to Comply',
      role: 'Trainee Station',
      targetStation: 'trainee' as const,
      description: 'Trainee submits revised decision: "Divert heavy armor to Route Amber via Checkpoint Echo to avoid compromised Bridge Charlie span."',
      actionLabel: 'Submit Mitigating Route Revision',
    },
    {
      step: 10,
      title: 'Simulate Communication Loss (Offline Mode)',
      role: 'Network / Trainee Station',
      targetStation: 'trainee' as const,
      description: 'Simulate severe network disconnection. Trainee workspace enters offline mode; local rule validation continues operating using preloaded rules.',
      actionLabel: 'Trigger Disconnect / Offline',
    },
    {
      step: 11,
      title: 'Submit Offline Action & Restore Connection',
      role: 'Trainee Station',
      targetStation: 'trainee' as const,
      description: 'Trainee submits decision while disconnected (stored locally in queue with UUID). Connection is restored and events synchronize idempotently without duplicate records.',
      actionLabel: 'Submit Offline & Sync Queue',
    },
    {
      step: 12,
      title: 'Exercise End & After-Action Review (AAR)',
      role: 'Instructor Station',
      targetStation: 'aar' as const,
      description: 'Exercise concludes. System opens comprehensive AAR showing the information available at each decision, explainable score breakdown, timeline scrubber, and AI debrief.',
      actionLabel: 'Launch Comprehensive AAR',
    },
  ];

  const current = steps.find((s) => s.step === currentStep) || steps[0];

  const handleRun = async () => {
    setIsRunningStep(true);
    try {
      onSelectRole(current.targetStation);
      await onExecuteDemoStep(current.step);
      if (currentStep < 12) {
        onSetStep(currentStep + 1);
      }
    } catch (err) {
      console.error('Walkthrough step error', err);
    } finally {
      setIsRunningStep(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wide">
            SIH26248 Problem Statement Walkthrough Guide
          </div>
          <h2 className="text-base font-bold text-white">
            12-Step Demonstration Scenario: Decision-Making Under Multi-Domain Friction
          </h2>
        </div>

        {/* Step Navigation Pill alternative: clean segmented buttons */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 text-xs">
          <button
            onClick={() => onSetStep(Math.max(1, currentStep - 1))}
            disabled={currentStep <= 1}
            className="p-1 rounded text-slate-400 hover:text-slate-200 disabled:text-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono px-2 text-slate-300 font-semibold">
            Step {currentStep} / 12
          </span>
          <button
            onClick={() => onSetStep(Math.min(12, currentStep + 1))}
            disabled={currentStep >= 12}
            className="p-1 rounded text-slate-400 hover:text-slate-200 disabled:text-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Dots / Steps Strip */}
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
        {steps.map((s) => {
          const isDone = s.step < currentStep;
          const isCurrent = s.step === currentStep;

          return (
            <button
              key={s.step}
              onClick={() => {
                onSetStep(s.step);
                if (isInstructor || (s.targetStation !== 'instructor' && s.targetStation !== 'split')) {
                  onSelectRole(s.targetStation);
                }
              }}
              className={`p-1.5 rounded text-center text-[10px] font-mono transition-all ${
                isCurrent
                  ? 'bg-cyan-600 text-white font-bold ring-2 ring-cyan-400/50 shadow-md'
                  : isDone
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-800'
              }`}
            >
              #{s.step}
            </button>
          );
        })}
      </div>

      {/* Current Step Card */}
      <div className="p-4 bg-slate-950 rounded border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-cyan-400 font-bold">STEP {current.step}:</span>
            <span className="font-bold text-white text-sm">{current.title}</span>
          </div>
          <span className="font-mono text-slate-400 text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            Station: {current.role}
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-sans">{current.description}</p>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="text-[11px] text-slate-500 font-mono">
            Target View: <span className="text-slate-300 uppercase">{current.targetStation}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectRole(current.targetStation)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition-colors"
            >
              Switch to Station View
            </button>

            <button
              onClick={handleRun}
              disabled={isRunningStep}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isRunningStep ? 'Executing Step...' : `1-Click Execute: ${current.actionLabel}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
