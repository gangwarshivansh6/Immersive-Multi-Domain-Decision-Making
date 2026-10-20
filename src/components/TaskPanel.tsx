import React, { useState } from 'react';
import { Task, ScenarioRestriction, RestrictionAlert, TaskStatus } from '../types/simulation';
import { CheckSquare, ShieldCheck, AlertTriangle, ShieldAlert, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface TaskPanelProps {
  tasks: Task[];
  restrictions: ScenarioRestriction[];
  alerts: RestrictionAlert[];
  onUpdateTask: (taskId: string, status: TaskStatus, observation?: string, progressPercent?: number) => Promise<void>;
  onRespondToAlert: (alertId: string, responseText: string, actionType: 'reconsider' | 'mitigate') => Promise<void>;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({
  tasks,
  restrictions,
  alerts,
  onUpdateTask,
  onRespondToAlert,
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'restrictions' | 'alerts'>('tasks');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [observationInput, setObservationInput] = useState('');
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [alertResponseText, setAlertResponseText] = useState('');

  const activeAlerts = alerts.filter((a) => a.status === 'active');

  const handleTaskStatusChange = (taskId: string, newStatus: TaskStatus) => {
    let progress = 0;
    if (newStatus === 'in_progress') progress = 50;
    if (newStatus === 'completed') progress = 100;
    if (newStatus === 'blocked') progress = 25;
    onUpdateTask(taskId, newStatus, observationInput, progress);
    setObservationInput('');
  };

  const handleSendAlertResponse = async (alertId: string, type: 'reconsider' | 'mitigate') => {
    if (!alertResponseText.trim()) return;
    await onRespondToAlert(alertId, alertResponseText, type);
    setAlertResponseText('');
    setActiveAlertId(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col h-full overflow-hidden">
      {/* Header Tabs */}
      <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1 font-medium rounded transition-colors whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tasks ({tasks.length})
          </button>

          <button
            onClick={() => setActiveTab('restrictions')}
            className={`px-3 py-1 font-medium rounded transition-colors whitespace-nowrap ${
              activeTab === 'restrictions'
                ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Restrictions ({restrictions.length})
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3 py-1 font-medium rounded transition-colors whitespace-nowrap relative ${
              activeTab === 'alerts'
                ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                : activeAlerts.length > 0
                ? 'text-rose-400 hover:text-rose-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Alerts
            {activeAlerts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px]">
                {activeAlerts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* TASKS VIEW */}
        {activeTab === 'tasks' && (
          <div className="space-y-2">
            {tasks.map((task) => {
              const isSelected = selectedTask === task.id;

              return (
                <div
                  key={task.id}
                  className={`p-2.5 rounded border transition-colors ${
                    task.status === 'completed'
                      ? 'bg-emerald-950/10 border-emerald-900/30'
                      : task.status === 'blocked'
                      ? 'bg-rose-950/20 border-rose-900/40'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-500 mr-1.5">
                        [{task.domain}]
                      </span>
                      <span className="text-xs font-semibold text-slate-200">{task.title}</span>
                    </div>

                    {/* Status Pill Badge Alternative: unboxed text */}
                    <span
                      className={`text-[11px] font-mono capitalize ${
                        task.status === 'completed'
                          ? 'text-emerald-400 font-semibold'
                          : task.status === 'blocked'
                          ? 'text-rose-400 font-semibold'
                          : task.status === 'in_progress'
                          ? 'text-cyan-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed mb-2">{task.description}</p>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full transition-all duration-300 ${
                        task.status === 'completed'
                          ? 'bg-emerald-500'
                          : task.status === 'blocked'
                          ? 'bg-rose-500'
                          : 'bg-cyan-500'
                      }`}
                      style={{ width: `${task.progressPercent}%` }}
                    />
                  </div>

                  {/* Observation if recorded */}
                  {task.lastObservation && (
                    <div className="mb-2 p-1.5 bg-slate-900 rounded text-[11px] text-slate-300">
                      <strong className="text-slate-400">Latest Observation:</strong> {task.lastObservation}
                    </div>
                  )}

                  {/* Actions to update status */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-800/80 text-[11px]">
                    <span className="text-slate-500 mr-1">Update Status:</span>
                    {(['not_started', 'in_progress', 'blocked', 'completed'] as TaskStatus[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleTaskStatusChange(task.id, st)}
                        className={`px-2 py-0.5 rounded transition-colors capitalize ${
                          task.status === st
                            ? 'bg-slate-700 text-white font-medium'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* RESTRICTIONS VIEW */}
        {activeTab === 'restrictions' && (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-400 mb-2">
              Rules are inspected in real time by the Restriction Engine. Any proposed action conflicting with these constraints triggers an alert.
            </div>

            {restrictions.map((rule) => (
              <div
                key={rule.id}
                className="p-2.5 bg-slate-950/80 border border-slate-800 rounded text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-cyan-400">{rule.id}</span>
                    <span className="text-slate-600">·</span>
                    <span className="font-semibold text-slate-200">{rule.title}</span>
                  </div>
                  <span
                    className={`font-mono uppercase text-[10px] font-semibold ${
                      rule.severity === 'critical'
                        ? 'text-rose-400'
                        : rule.severity === 'warning'
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}
                  >
                    {rule.severity}
                  </span>
                </div>

                <div className="text-slate-300 leading-relaxed text-[11px] bg-slate-900/60 p-2 rounded border border-slate-800/60 font-mono">
                  {rule.ruleText}
                </div>

                <div className="text-[11px] text-slate-400">
                  <span className="text-slate-500 font-semibold">Operational Rationale: </span>
                  {rule.rationale}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RESTRICTION ALERTS VIEW */}
        {activeTab === 'alerts' && (
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No active restriction violation alerts. Trainee actions comply with all scenario directives.
              </div>
            ) : (
              alerts.map((alert) => {
                const isActive = alert.status === 'active';
                const isReplying = activeAlertId === alert.id;

                return (
                  <div
                    key={alert.id}
                    className={`p-2.5 rounded border text-xs space-y-1.5 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-950/20 border-rose-900/60'
                        : 'bg-amber-950/20 border-amber-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert
                          className={`w-3.5 h-3.5 ${
                            alert.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
                          }`}
                        />
                        <span className="font-semibold text-white">[{alert.severity.toUpperCase()}] {alert.ruleTitle}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{alert.timestamp}</span>
                    </div>

                    <div className="text-slate-200 text-[11px] leading-relaxed">
                      {alert.reason}
                    </div>

                    {alert.decisionSummary && (
                      <div className="text-[10px] text-slate-400 font-mono bg-slate-950/60 p-1.5 rounded">
                        Flagged Decision: "{alert.decisionSummary}"
                      </div>
                    )}

                    {alert.traineeResponse && (
                      <div className="p-1.5 bg-slate-900/80 rounded text-[11px] text-cyan-300">
                        <strong>Trainee Response ({alert.status}):</strong> {alert.traineeResponse}
                      </div>
                    )}

                    {/* Mitigation / Reconsideration Workflow */}
                    {isActive && (
                      <div className="pt-2 border-t border-slate-800">
                        {isReplying ? (
                          <div className="space-y-1.5">
                            <textarea
                              rows={2}
                              value={alertResponseText}
                              onChange={(e) => setAlertResponseText(e.target.value)}
                              placeholder="Explain your mitigating safeguards or explain why you are proceeding..."
                              className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                            />
                            <div className="flex items-center justify-end gap-2 text-[11px]">
                              <button
                                onClick={() => setActiveAlertId(null)}
                                className="px-2 py-0.5 text-slate-400 hover:text-slate-200"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSendAlertResponse(alert.id, 'reconsider')}
                                className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium"
                              >
                                Reconsider & Acknowledge
                              </button>
                              <button
                                onClick={() => handleSendAlertResponse(alert.id, 'mitigate')}
                                className="px-2.5 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium"
                              >
                                Submit Mitigating Justification
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setActiveAlertId(alert.id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition-colors"
                          >
                            Respond to Restriction Warning
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
