import React, { useState } from 'react';
import {
  SimulationSession,
  Domain,
  TaskStatus,
  Report,
} from '../types/simulation';
import { TacticalMap } from './TacticalMap';
import { ReportFeed } from './ReportFeed';
import { DecisionConsole } from './DecisionConsole';
import { TaskPanel } from './TaskPanel';
import { Radio, AlertOctagon, Activity, Info, ShieldAlert } from 'lucide-react';

interface TraineeWorkspaceProps {
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
  isOnline: boolean;
}

export const TraineeWorkspace: React.FC<TraineeWorkspaceProps> = ({
  session,
  onSubmitDecision,
  onReviseDecision,
  onUpdateTask,
  onAcknowledgeReport,
  onRespondToAlert,
  isOnline,
}) => {
  const [selectedMapLocation, setSelectedMapLocation] = useState<string>('');
  const [citedReportIds, setCitedReportIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'workspace' | 'briefing' | 'timeline'>('workspace');

  // Trainee only receives reports that are delivered or acknowledged
  const deliveredReports = session.reports.filter(
    (r) => r.deliveryStatus === 'delivered' || r.deliveryStatus === 'acknowledged'
  );

  const handleCitationToggle = (reportId: string) => {
    setCitedReportIds((prev) =>
      prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId]
    );
  };

  return (
    <div className="flex flex-col h-full space-y-3 p-3 sm:p-4 text-slate-100 max-w-[1700px] mx-auto w-full">
      {/* Trainee Status Sub-Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-200">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Trainee Command Station</span>
          </div>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 font-mono">
            Comms Status: <strong className="text-slate-200 capitalize">{session.simulatedCommsStatus}</strong>
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 font-mono">
            Delivered Intel: <strong className="text-slate-200">{deliveredReports.length} reports</strong>
          </span>
        </div>

        {/* Workspace Sub-tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setActiveTab('workspace')}
            className={`px-3 py-1 font-medium rounded transition-colors whitespace-nowrap ${
              activeTab === 'workspace' ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tactical Workspace
          </button>
          <button
            onClick={() => setActiveTab('briefing')}
            className={`px-3 py-1 font-medium rounded transition-colors whitespace-nowrap ${
              activeTab === 'briefing' ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mission Briefing
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1 font-medium rounded transition-colors whitespace-nowrap ${
              activeTab === 'timeline' ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Event Timeline ({session.timeline.length})
          </button>
        </div>
      </div>

      {/* OFFLINE NOTICE BANNER */}
      {!isOnline && (
        <div className="bg-rose-950/40 border border-rose-800/80 rounded-lg p-2.5 px-4 text-xs text-rose-200 flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <strong>NETWORK LINK DISCONNECTED (CONTINUING IN LOCAL OFFLINE MODE):</strong> Submissions and task updates will be stored locally with unique timestamps and synchronized idempotently upon link restoration. Preloaded restriction rules remain active.
            </div>
          </div>
        </div>
      )}

      {/* TAB: MISSION BRIEFING */}
      {activeTab === 'briefing' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 text-xs">
          <div>
            <h2 className="text-base font-bold text-white mb-1">{session.scenarioTitle}</h2>
            <div className="text-slate-400">{session.scenarioDescription}</div>
          </div>

          <div className="p-4 bg-slate-950 rounded border border-slate-800 space-y-2">
            <span className="font-semibold text-cyan-400 block uppercase font-mono tracking-wider">
              Tactical Operational Briefing:
            </span>
            <p className="text-slate-300 whitespace-pre-line leading-relaxed font-sans">{session.briefing}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Core Training Objectives</h3>
            <ul className="space-y-1.5 text-slate-300">
              {session.objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono text-cyan-400 font-bold">{i + 1}.</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* TAB: EVENT TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-semibold text-white">Activity & Change Timeline</h3>
            <span className="text-slate-500 font-mono">Recorded Chronological History</span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {session.timeline.map((evt) => (
              <div key={evt.id} className="p-2.5 bg-slate-950 rounded border border-slate-850 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono text-cyan-400 uppercase font-semibold">
                    {evt.type.replace('_', ' ')}
                  </span>
                  <span className="font-mono text-slate-500">{evt.timestamp}</span>
                </div>
                <div className="text-slate-200 font-medium">{evt.summary}</div>
                {evt.details && <div className="text-slate-400 text-[11px]">{evt.details}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: PRIMARY TACTICAL WORKSPACE (4-ZONE GRID) */}
      {activeTab === 'workspace' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-[650px]">
          {/* LEFT COLUMN: Map (Top) + Intel Feed (Bottom) */}
          <div className="lg:col-span-7 flex flex-col gap-3 h-full">
            {/* Top-Left: Situation Display (Tactical Map) */}
            <div className="h-[360px] shrink-0">
              <TacticalMap
                conditions={session.conditions}
                deliveredReports={deliveredReports}
                onSelectLocation={(loc) => setSelectedMapLocation(loc)}
                selectedLocation={selectedMapLocation}
                isInstructorView={false}
              />
            </div>

            {/* Bottom-Left: Delivered Report Feed */}
            <div className="flex-1 min-h-[300px]">
              <ReportFeed
                reports={session.reports}
                onAcknowledgeReport={onAcknowledgeReport}
                onReferenceInDecision={handleCitationToggle}
                selectedReportIds={citedReportIds}
                isInstructor={false}
              />
            </div>
          </div>

          {/* RIGHT COLUMN: Objectives/Tasks/Alerts (Top) + Decision Console (Bottom) */}
          <div className="lg:col-span-5 flex flex-col gap-3 h-full">
            {/* Top-Right: Task Panel & Restrictions */}
            <div className="h-[280px] shrink-0">
              <TaskPanel
                tasks={session.tasks}
                restrictions={session.restrictions}
                alerts={session.alerts}
                onUpdateTask={onUpdateTask}
                onRespondToAlert={onRespondToAlert}
              />
            </div>

            {/* Bottom-Right: Decision Submission Console */}
            <div className="flex-1 min-h-[380px]">
              <DecisionConsole
                deliveredReports={deliveredReports}
                activeRestrictions={session.restrictions}
                currentConditions={session.conditions}
                decisions={session.decisions}
                onSubmitDecision={onSubmitDecision}
                onReviseDecision={onReviseDecision}
                selectedLocation={selectedMapLocation}
                externalSelectedReportIds={citedReportIds}
                onClearSelectedReports={() => setCitedReportIds([])}
                isOnline={isOnline}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
