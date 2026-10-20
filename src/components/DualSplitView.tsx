import React from 'react';
import { SimulationSession, Domain, TaskStatus, DifficultyLevel } from '../types/simulation';
import { InstructorDashboard } from './InstructorDashboard';
import { TraineeWorkspace } from './TraineeWorkspace';

interface DualSplitViewProps {
  session: SimulationSession;
  onSubmitDecision: (data: {
    action: string;
    rationale: string;
    supportingReportIds: string[];
    confidence: 'low' | 'medium' | 'high';
    targetLocation?: string;
    domain: Domain;
  }) => Promise<void>;
  onReviseDecision: (data: {
    originalDecisionId: string;
    revisedAction: string;
    revisedRationale: string;
    confidence: 'low' | 'medium' | 'high';
  }) => Promise<void>;
  onUpdateTask: (taskId: string, status: TaskStatus, observation?: string, progressPercent?: number) => Promise<void>;
  onAcknowledgeReport: (reportId: string) => Promise<void>;
  onRespondToAlert: (alertId: string, responseText: string, actionType: 'reconsider' | 'mitigate') => Promise<void>;
  onUpdateSessionStatus: (status: 'running' | 'paused' | 'ended') => Promise<void>;
  onInitSession: (difficulty: DifficultyLevel) => Promise<void>;
  onReportAction: (reportId: string, action: string, delaySeconds?: number) => Promise<void>;
  onInjectReport: (reportData: {
    domain: Domain;
    source: string;
    title: string;
    content: string;
    locationReference?: string;
  }) => Promise<void>;
  onUpdateCondition: (conditionId: string, actualState: string, severity?: 'nominal' | 'degraded' | 'critical') => Promise<void>;
  onSaveAnnotation: (notes: string, scoreOverride?: number) => Promise<void>;
  isOnline: boolean;
}

export const DualSplitView: React.FC<DualSplitViewProps> = ({
  session,
  onSubmitDecision,
  onReviseDecision,
  onUpdateTask,
  onAcknowledgeReport,
  onRespondToAlert,
  onUpdateSessionStatus,
  onInitSession,
  onReportAction,
  onInjectReport,
  onUpdateCondition,
  onSaveAnnotation,
  isOnline,
}) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-3 max-w-[2100px] mx-auto w-full flex-1">
      {/* LEFT: Instructor Station */}
      <div className="flex flex-col h-[820px] bg-slate-950/40 p-2 rounded-lg border border-slate-800">
        <div className="text-xs font-semibold text-cyan-400 font-mono mb-1.5 flex items-center justify-between">
          <span>INSTRUCTOR CONTROL STATION (OBSERVER & INJECTOR)</span>
          <span className="text-slate-500 text-[10px]">UNFILTERED GROUND TRUTH</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <InstructorDashboard
            session={session}
            onUpdateSessionStatus={onUpdateSessionStatus}
            onInitSession={onInitSession}
            onReportAction={onReportAction}
            onInjectReport={onInjectReport}
            onUpdateCondition={onUpdateCondition}
            onSaveAnnotation={onSaveAnnotation}
          />
        </div>
      </div>

      {/* RIGHT: Trainee Workspace */}
      <div className="flex flex-col h-[820px] bg-slate-950/40 p-2 rounded-lg border border-slate-800">
        <div className="text-xs font-semibold text-cyan-400 font-mono mb-1.5 flex items-center justify-between">
          <span>TRAINEE OPERATIONAL WORKSPACE (TACTICAL OPERATOR)</span>
          <span className="text-slate-500 text-[10px]">FILTERED DELIVERED INTEL ONLY</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <TraineeWorkspace
            session={session}
            onSubmitDecision={onSubmitDecision}
            onReviseDecision={onReviseDecision}
            onUpdateTask={onUpdateTask}
            onAcknowledgeReport={onAcknowledgeReport}
            onRespondToAlert={onRespondToAlert}
            isOnline={isOnline}
          />
        </div>
      </div>
    </div>
  );
};
