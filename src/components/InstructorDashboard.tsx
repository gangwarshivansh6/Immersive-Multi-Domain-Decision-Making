import React, { useState } from 'react';
import {
  SimulationSession,
  Report,
  DifficultyLevel,
  Domain,
  ScenarioCondition,
} from '../types/simulation';
import {
  Sliders,
  Play,
  Pause,
  StopCircle,
  PlusCircle,
  AlertTriangle,
  Clock,
  Send,
  EyeOff,
  Radio,
  FileText,
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';

interface InstructorDashboardProps {
  session: SimulationSession;
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
}

export const InstructorDashboard: React.FC<InstructorDashboardProps> = ({
  session,
  onUpdateSessionStatus,
  onInitSession,
  onReportAction,
  onInjectReport,
  onUpdateCondition,
  onSaveAnnotation,
}) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'conditions' | 'monitoring' | 'annotations'>('reports');
  const [isInjectingReport, setIsInjectingReport] = useState(false);
  const [injectDomain, setInjectDomain] = useState<Domain>('land');
  const [injectSource, setInjectSource] = useState('Tactical Sensor Outpost 3');
  const [injectTitle, setInjectTitle] = useState('');
  const [injectContent, setInjectContent] = useState('');
  const [injectLocation, setInjectLocation] = useState('Route Obsidian');

  const [instructorNotes, setInstructorNotes] = useState(session.instructorNotes || '');
  const [scoreOverride, setScoreOverride] = useState<number | undefined>(session.evaluation?.instructorScoreOverride);

  const handleDifficultyChange = async (diff: DifficultyLevel) => {
    if (confirm(`Reset and initialize exercise with ${diff.toUpperCase()} difficulty?`)) {
      await onInitSession(diff);
    }
  };

  const handleSaveNotes = async () => {
    await onSaveAnnotation(instructorNotes, scoreOverride);
  };

  const handleFormInject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!injectTitle || !injectContent) return;
    await onInjectReport({
      domain: injectDomain,
      source: injectSource,
      title: injectTitle,
      content: injectContent,
      locationReference: injectLocation,
    });
    setInjectTitle('');
    setInjectContent('');
    setIsInjectingReport(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col h-full overflow-hidden">
      {/* Station Control Bar */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Session Status & Playback */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Session Status:</span>
          <span
            className={`font-mono uppercase font-bold px-2 py-0.5 rounded text-[11px] ${
              session.status === 'running'
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                : session.status === 'paused'
                ? 'bg-amber-950/60 text-amber-400 border border-amber-800'
                : 'bg-rose-950/60 text-rose-400 border border-rose-800'
            }`}
          >
            {session.status}
          </span>

          <div className="flex items-center gap-1 ml-2">
            {session.status === 'running' ? (
              <button
                onClick={() => onUpdateSessionStatus('paused')}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded font-medium transition-colors"
              >
                <Pause className="w-3 h-3" /> Pause
              </button>
            ) : (
              <button
                onClick={() => onUpdateSessionStatus('running')}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-medium transition-colors"
              >
                <Play className="w-3 h-3" /> Resume
              </button>
            )}

            <button
              onClick={() => onUpdateSessionStatus('ended')}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition-colors"
            >
              <StopCircle className="w-3 h-3" /> End Exercise
            </button>
          </div>
        </div>

        {/* Difficulty Controls */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Difficulty:</span>
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
            {(['easy', 'medium', 'difficult'] as DifficultyLevel[]).map((diff) => (
              <button
                key={diff}
                onClick={() => handleDifficultyChange(diff)}
                className={`px-2.5 py-0.5 text-xs font-medium rounded capitalize transition-colors ${
                  session.difficulty === diff
                    ? 'bg-slate-800 text-cyan-300 font-bold border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1 font-medium rounded transition-colors whitespace-nowrap ${
              activeTab === 'reports' ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Intel Reports ({session.reports.length})
          </button>
          <button
            onClick={() => setActiveTab('conditions')}
            className={`px-3 py-1 font-medium rounded transition-colors whitespace-nowrap ${
              activeTab === 'conditions' ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Scenario Conditions ({session.conditions.length})
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-3 py-1 font-medium rounded transition-colors whitespace-nowrap ${
              activeTab === 'monitoring' ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Trainee Decisions ({session.decisions.length})
          </button>
          <button
            onClick={() => setActiveTab('annotations')}
            className={`px-3 py-1 font-medium rounded transition-colors whitespace-nowrap ${
              activeTab === 'annotations' ? 'bg-slate-800 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Instructor Notes & Scoring
          </button>
        </div>

        {activeTab === 'reports' && (
          <button
            onClick={() => setIsInjectingReport(!isInjectingReport)}
            className="flex items-center gap-1 px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded text-[11px] font-medium transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{isInjectingReport ? 'Close Injector' : '+ Inject New Intel'}</span>
          </button>
        )}
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* NEW INTEL INJECTOR FORM */}
        {isInjectingReport && activeTab === 'reports' && (
          <form onSubmit={handleFormInject} className="p-3 bg-slate-950 border border-cyan-800/60 rounded text-xs space-y-2.5 shadow-lg mb-3">
            <div className="flex items-center justify-between text-cyan-300 font-semibold border-b border-slate-800 pb-1.5">
              <span>Inject Synthetic Intelligence Report to Trainee Feed</span>
              <span className="font-mono text-[10px] text-slate-400">SIH26248 Simulation Net</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Domain</label>
                <select
                  value={injectDomain}
                  onChange={(e) => setInjectDomain(e.target.value as Domain)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                >
                  <option value="land">Land Domain</option>
                  <option value="air">Air Domain</option>
                  <option value="cyber">Cyber Domain</option>
                  <option value="ew">Electronic Warfare</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Source Tag</label>
                <input
                  type="text"
                  value={injectSource}
                  onChange={(e) => setInjectSource(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Location / Axis</label>
                <input
                  type="text"
                  value={injectLocation}
                  onChange={(e) => setInjectLocation(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Report Headline</label>
              <input
                type="text"
                required
                placeholder="e.g. Unconfirmed Radio Intercept: Convoy Ambush Alert"
                value={injectTitle}
                onChange={(e) => setInjectTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Report Body</label>
              <textarea
                required
                rows={2}
                placeholder="Synthetic observation details..."
                value={injectContent}
                onChange={(e) => setInjectContent(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsInjectingReport(false)}
                className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium"
              >
                Dispatch to Trainee Workspace
              </button>
            </div>
          </form>
        )}

        {/* REPORTS CONTROL VIEW */}
        {activeTab === 'reports' && (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Full Instructor View: Controls delivery, delays, contradictions, and dropped packets.</span>
              <span className="font-mono text-cyan-400">Total: {session.reports.length}</span>
            </div>

            {session.reports.map((report) => (
              <div
                key={report.id}
                className="p-3 bg-slate-950/90 border border-slate-800 rounded text-xs space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-200">{report.id}</span>
                    <span className="text-slate-600">·</span>
                    <span className="font-semibold uppercase text-cyan-400">{report.domain}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">{report.source}</span>
                  </div>

                  {/* Delivery Status indicator for instructor */}
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span
                      className={`font-semibold capitalize ${
                        report.deliveryStatus === 'delivered'
                          ? 'text-emerald-400'
                          : report.deliveryStatus === 'dropped'
                          ? 'text-rose-400'
                          : report.deliveryStatus === 'delayed'
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      Status: {report.deliveryStatus}
                    </span>
                    {report.acknowledgedByTrainee && (
                      <span className="text-emerald-400 font-medium">✓ Trainee Ack'd</span>
                    )}
                  </div>
                </div>

                <div className="font-semibold text-slate-100">{report.title}</div>
                <div className="text-slate-300 text-[11px] leading-relaxed">
                  {report.isIncomplete && report.incompleteContent ? report.incompleteContent : report.content}
                </div>

                {report.isContradictory && (
                  <div className="p-1.5 bg-amber-950/30 border border-amber-800/50 rounded text-[11px] text-amber-300">
                    <strong>Contradiction Active:</strong> {report.contradictionNote || 'Discrepant intel intended to test trainee verification.'}
                  </div>
                )}

                {/* Instructor Action Controls */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-850 text-[11px]">
                  <span className="text-slate-500 mr-1">Instructor Actions:</span>

                  {report.deliveryStatus !== 'delivered' && (
                    <button
                      onClick={() => onReportAction(report.id, 'release_now')}
                      className="px-2 py-0.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded font-medium"
                    >
                      Release Now
                    </button>
                  )}

                  {report.deliveryStatus !== 'pending' && (
                    <button
                      onClick={() => onReportAction(report.id, 'hold')}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                    >
                      Hold
                    </button>
                  )}

                  <button
                    onClick={() => onReportAction(report.id, 'delay', 30)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded"
                  >
                    +30s Delay
                  </button>

                  <button
                    onClick={() => onReportAction(report.id, 'drop')}
                    className="px-2 py-0.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded font-medium"
                  >
                    Drop Report
                  </button>

                  <button
                    onClick={() => onReportAction(report.id, 'make_incomplete')}
                    className={`px-2 py-0.5 rounded font-medium ${
                      report.isIncomplete
                        ? 'bg-purple-800 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {report.isIncomplete ? 'Restore Text' : 'Corrupt / Incomplete'}
                  </button>

                  <button
                    onClick={() => onReportAction(report.id, 'add_contradiction')}
                    className="px-2 py-0.5 bg-amber-900/60 hover:bg-amber-800 text-amber-200 rounded font-medium"
                  >
                    Trigger Contradiction
                  </button>

                  <button
                    onClick={() => onReportAction(report.id, 'mark_unverified')}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded"
                  >
                    Toggle Unverified
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CONDITIONS VIEW */}
        {activeTab === 'conditions' && (
          <div className="space-y-2.5">
            <div className="text-[11px] text-slate-400">
              Change ground truth vs perceived trainee situation to simulate environmental friction or unexpected tactical developments.
            </div>

            {session.conditions.map((condition) => (
              <div
                key={condition.id}
                className="p-3 bg-slate-950 border border-slate-800 rounded text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-cyan-400">{condition.id}</span>
                    <span className="font-semibold text-slate-200">{condition.title}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">{condition.location}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-emerald-400 font-semibold block mb-0.5">Engine Ground Truth (Actual):</span>
                    <span className="text-slate-200">{condition.actualState}</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-sky-400 font-semibold block mb-0.5">Trainee Perception (Reported):</span>
                    <span className="text-slate-300">{condition.traineePerceivedState}</span>
                  </div>
                </div>

                {/* Quick Toggle for Bridge Charlie */}
                {condition.id === 'COND-01' && (
                  <div className="flex items-center gap-2 pt-1 text-[11px]">
                    <span className="text-slate-400">Quick Change:</span>
                    <button
                      onClick={() =>
                        onUpdateCondition(
                          condition.id,
                          'Demolition charges neutralized by Combat Engineers; span rated for 60T armor.',
                          'nominal'
                        )
                      }
                      className="px-2.5 py-0.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 rounded font-medium"
                    >
                      Clear Bridge (Intact)
                    </button>
                    <button
                      onClick={() =>
                        onUpdateCondition(
                          condition.id,
                          'Rigged with remote C4 charges by hostile recon; underdeck compromised (<10T capacity).',
                          'critical'
                        )
                      }
                      className="px-2.5 py-0.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded font-medium"
                    >
                      Rig Bridge with Demolitions
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* MONITORING VIEW */}
        {activeTab === 'monitoring' && (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-400">
              Live Trainee Audit Feed: Submissions, written rationales, cited intelligence, and rule violation alerts.
            </div>

            {session.decisions.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                Awaiting first trainee decision submission...
              </div>
            ) : (
              session.decisions.map((dec) => (
                <div key={dec.id} className="p-3 bg-slate-950 border border-slate-800 rounded text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-200">{dec.id}</span>
                      <span className="text-slate-500">·</span>
                      <span className="font-medium text-cyan-400 uppercase">{dec.domain}</span>
                      {dec.revisionNumber > 1 && (
                        <span className="text-amber-400 font-mono">(Rev #{dec.revisionNumber})</span>
                      )}
                    </div>
                    <span className="font-mono text-slate-400">{dec.timestamp}</span>
                  </div>

                  <div className="font-semibold text-slate-100">{dec.action}</div>
                  <div className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/50 p-2 rounded border border-slate-800/60">
                    <strong className="text-slate-400">Trainee Rationale: </strong>
                    {dec.rationale}
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Confidence: <strong className="text-slate-200 capitalize">{dec.confidence}</strong></span>
                    <span>Citations: {dec.supportingReportIds?.join(', ') || 'None cited'}</span>
                    <span>Available Reports at Decision: {dec.availableReportsAtDecision?.length || 0}</span>
                  </div>

                  {dec.conflictAlerts && dec.conflictAlerts.length > 0 && (
                    <div className="p-2 bg-rose-950/30 border border-rose-900/50 rounded text-rose-300 text-[11px]">
                      <strong>Rule Conflict:</strong> {dec.conflictAlerts.map((a) => a.ruleTitle).join('; ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ANNOTATIONS & SCORING VIEW */}
        {activeTab === 'annotations' && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Instructor Debrief Notes & Annotations
              </label>
              <textarea
                rows={4}
                value={instructorNotes}
                onChange={(e) => setInstructorNotes(e.target.value)}
                placeholder="Record qualitative observations regarding trainee risk assessment, reasoning transparency, or adherence to RoE..."
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Manual Final Score Override (0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scoreOverride ?? ''}
                  onChange={(e) => setScoreOverride(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder={`Current Calculated Score: ${session.evaluation?.overallScore ?? 75}`}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveNotes}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium text-xs transition-colors"
              >
                Save Instructor Annotations
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
