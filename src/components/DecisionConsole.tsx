import React, { useState, useEffect } from 'react';
import { Domain, Report, ScenarioRestriction, ScenarioCondition, TraineeDecision, RestrictionAlert } from '../types/simulation';
import { Mic, MicOff, Send, ShieldAlert, AlertTriangle, History, Check, RefreshCw, Sparkles, MessageSquare } from 'lucide-react';
import { VoiceDictationService, isSpeechRecognitionSupported } from '../utils/speechUtils';
import { validateDecisionRestrictions } from '../utils/restrictionEngine';

interface DecisionConsoleProps {
  deliveredReports: Report[];
  activeRestrictions: ScenarioRestriction[];
  currentConditions: ScenarioCondition[];
  decisions: TraineeDecision[];
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
  selectedLocation?: string;
  externalSelectedReportIds?: string[];
  onClearSelectedReports?: () => void;
  isOnline: boolean;
}

export const DecisionConsole: React.FC<DecisionConsoleProps> = ({
  deliveredReports,
  activeRestrictions,
  currentConditions,
  decisions,
  onSubmitDecision,
  onReviseDecision,
  selectedLocation,
  externalSelectedReportIds = [],
  onClearSelectedReports,
  isOnline,
}) => {
  const [actionText, setActionText] = useState('');
  const [rationaleText, setRationaleText] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<Domain>('land');
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium');
  const [supportingReportIds, setSupportingReportIds] = useState<string[]>([]);
  const [locationTarget, setLocationTarget] = useState(selectedLocation || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revisingDecision, setRevisingDecision] = useState<TraineeDecision | null>(null);

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [voiceService] = useState(() => new VoiceDictationService());
  const speechSupported = isSpeechRecognitionSupported();

  // Sync external selected report from feed/map
  useEffect(() => {
    if (externalSelectedReportIds.length > 0) {
      setSupportingReportIds((prev) => Array.from(new Set([...prev, ...externalSelectedReportIds])));
    }
  }, [externalSelectedReportIds]);

  useEffect(() => {
    if (selectedLocation) {
      setLocationTarget(selectedLocation);
    }
  }, [selectedLocation]);

  // Real-time pre-submission restriction check
  const preCheck = validateDecisionRestrictions({
    actionText,
    rationaleText,
    targetLocation: locationTarget,
    domain: selectedDomain,
    selectedReportIds: supportingReportIds,
    activeRestrictions,
    currentConditions,
    deliveredReports,
  });

  const handleToggleVoiceDictation = () => {
    if (isListening) {
      voiceService.stop();
      setIsListening(false);
    } else {
      setSpeechError(null);
      const success = voiceService.start({
        onStart: () => setIsListening(true),
        onResult: (transcript) => {
          setRationaleText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        },
        onError: (err) => {
          setSpeechError(err);
          setIsListening(false);
        },
        onEnd: () => setIsListening(false),
      });
      if (!success) setIsListening(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionText.trim() || !rationaleText.trim()) return;

    setIsSubmitting(true);
    try {
      if (revisingDecision) {
        await onReviseDecision({
          originalDecisionId: revisingDecision.id,
          revisedAction: actionText,
          revisedRationale: rationaleText,
          confidence,
        });
        setRevisingDecision(null);
      } else {
        await onSubmitDecision({
          action: actionText,
          rationale: rationaleText,
          supportingReportIds,
          confidence,
          targetLocation: locationTarget,
          domain: selectedDomain,
        });
      }

      // Reset form
      setActionText('');
      setRationaleText('');
      setSupportingReportIds([]);
      onClearSelectedReports?.();
    } catch (err) {
      console.error('Decision submission error', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRevision = (dec: TraineeDecision) => {
    setRevisingDecision(dec);
    setActionText(dec.action);
    setRationaleText(`[REVISION RATIONALE]: Revising decision ${dec.id} in response to updated ground intel: `);
    setConfidence(dec.confidence);
    setSelectedDomain(dec.domain);
    if (dec.targetLocation) setLocationTarget(dec.targetLocation);
    if (dec.supportingReportIds) setSupportingReportIds(dec.supportingReportIds);
  };

  const toggleReportCitation = (reportId: string) => {
    setSupportingReportIds((prev) =>
      prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId]
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col h-full overflow-hidden">
      {/* Console Header */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-200">
            {revisingDecision ? `Revising Decision (${revisingDecision.id})` : 'Tactical Decision & Rationale Console'}
          </span>
        </div>

        {revisingDecision && (
          <button
            type="button"
            onClick={() => {
              setRevisingDecision(null);
              setActionText('');
              setRationaleText('');
            }}
            className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-800"
          >
            Cancel Revision
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Action Domain & Confidence Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">Domain Axis</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value as Domain)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="land">Land (Maneuver / Armor / Supply)</option>
                <option value="air">Air (UAV Recon / Airspace RoE)</option>
                <option value="cyber">Cyber (SCADA / Terminal Network)</option>
                <option value="ew">EW (Emission Control / Counter-Jam)</option>
                <option value="joint">Joint Multi-Domain</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">Target Location / Route</label>
              <input
                type="text"
                placeholder="e.g. Bridge Charlie or Route Amber"
                value={locationTarget}
                onChange={(e) => setLocationTarget(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">Decision Confidence</label>
              <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-950 rounded border border-slate-800 text-[11px]">
                {(['low', 'medium', 'high'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setConfidence(lvl)}
                    className={`py-1 rounded text-center capitalize transition-colors ${
                      confidence === lvl
                        ? 'bg-slate-800 text-cyan-300 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action / Proposed Order */}
          <div>
            <label className="block text-[11px] text-slate-300 mb-1 font-medium flex items-center justify-between">
              <span>Proposed Decision / Directive</span>
              <span className="text-[10px] text-slate-500 font-mono">Explicit Action Directive</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Hold 3rd Armored Column at Checkpoint Alpha pending physical inspection of Bridge Charlie."
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 placeholder:text-slate-600 font-medium"
            />
          </div>

          {/* Written Rationale with Voice Dictation */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-300 font-medium flex items-center gap-1.5">
                <span>Written Rationale & Uncertainty Assessment</span>
                <span className="text-rose-400">*</span>
              </label>

              {/* Spoken Voice Input Toggle */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={handleToggleVoiceDictation}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  <span>{isListening ? 'Stop Recording' : 'Dictate Rationale'}</span>
                </button>
              )}
            </div>

            <textarea
              required
              rows={3}
              placeholder="Explain what is verified, what remains uncertain, which restrictions you evaluated (e.g. RoE R-01, Bridge load R-02, EMCON), and why this course of action is justified..."
              value={rationaleText}
              onChange={(e) => setRationaleText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 placeholder:text-slate-600 leading-relaxed"
            />

            {speechError && (
              <div className="mt-1 text-[11px] text-amber-400 bg-amber-950/20 px-2 py-1 rounded border border-amber-900/30">
                {speechError}
              </div>
            )}
          </div>

          {/* Supporting Intel Citations (Delivered reports) */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">
              Ground Decision in Delivered Reports (Rule R-05 recommends $\ge 2$ independent sources):
            </label>
            <div className="max-h-24 overflow-y-auto p-1.5 bg-slate-950 rounded border border-slate-800 space-y-1">
              {deliveredReports.length === 0 ? (
                <div className="text-[11px] text-slate-600 p-1">No reports delivered yet.</div>
              ) : (
                deliveredReports.map((report) => {
                  const isChecked = supportingReportIds.includes(report.id);
                  return (
                    <label
                      key={report.id}
                      className="flex items-center gap-2 p-1 rounded hover:bg-slate-900 text-[11px] cursor-pointer text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleReportCitation(report.id)}
                        className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                      />
                      <span className="font-mono text-slate-400">{report.id}</span>
                      <span className="text-slate-500">[{report.domain.toUpperCase()}]</span>
                      <span className="truncate flex-1 text-slate-300">{report.title}</span>
                      {report.isContradictory && (
                        <span className="text-[10px] text-amber-400 font-mono">Discrepant</span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Pre-submission Restriction Alert Warning */}
          {preCheck.hasConflicts && (
            <div className="p-2.5 bg-rose-950/30 border border-rose-800/60 rounded text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>RESTRICTION ENGINE WARNING DETECTED PRIOR TO SUBMISSION</span>
              </div>
              {preCheck.alerts.map((alert, idx) => (
                <div key={idx} className="text-rose-200 text-[11px] pl-5 leading-relaxed">
                  <strong>[{alert.severity.toUpperCase()}] {alert.ruleTitle}:</strong> {alert.reason}
                </div>
              ))}
              <div className="text-[10px] text-rose-400 pl-5">
                You may revise your action above to comply, or submit with explicit mitigating justification in the rationale.
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-500 font-mono">
              {!isOnline && <span className="text-amber-400 font-semibold">Offline Mode: Queuing locally</span>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !actionText.trim() || !rationaleText.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium rounded text-xs transition-colors whitespace-nowrap shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{revisingDecision ? 'Submit Revised Decision' : 'Submit Tactical Decision'}</span>
            </button>
          </div>
        </form>

        {/* History of Decisions */}
        <div className="pt-3 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>Decision Audit Trail ({decisions.length})</span>
          </div>

          {decisions.length === 0 ? (
            <div className="text-xs text-slate-500 p-2 text-center">
              No decisions submitted yet. Formulate and submit your first tactical course of action above.
            </div>
          ) : (
            <div className="space-y-2">
              {decisions.map((dec) => (
                <div
                  key={dec.id}
                  className="p-2.5 bg-slate-950/80 border border-slate-800 rounded text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-slate-200">{dec.id}</span>
                      {dec.revisionNumber > 1 && (
                        <span className="text-amber-400 font-mono font-medium">(Rev #{dec.revisionNumber})</span>
                      )}
                      <span className="text-slate-600">·</span>
                      <span className="uppercase text-cyan-400 font-medium">{dec.domain}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span>{dec.timestamp}</span>
                      <span className="text-slate-600">|</span>
                      <span className={dec.syncStatus === 'synced' ? 'text-emerald-400' : 'text-amber-400'}>
                        {dec.syncStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="text-slate-100 font-medium">{dec.action}</div>
                  <div className="text-slate-400 text-[11px] leading-relaxed">
                    <span className="text-slate-500 font-semibold">Rationale: </span>
                    {dec.rationale}
                  </div>

                  {dec.supportingReportIds && dec.supportingReportIds.length > 0 && (
                    <div className="text-[10px] text-slate-500 font-mono">
                      Citations: {dec.supportingReportIds.join(', ')}
                    </div>
                  )}

                  {/* Alerts triggered */}
                  {dec.conflictAlerts && dec.conflictAlerts.length > 0 && (
                    <div className="p-1.5 bg-rose-950/20 border border-rose-900/40 rounded text-[11px] text-rose-300">
                      <strong>Restriction Warning:</strong> {dec.conflictAlerts.map((a) => a.ruleTitle).join('; ')}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-500">
                      Confidence: <strong className="capitalize text-slate-300">{dec.confidence}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartRevision(dec)}
                      className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Revise Course of Action</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
