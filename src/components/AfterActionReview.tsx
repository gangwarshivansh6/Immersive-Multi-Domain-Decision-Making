import React, { useState } from 'react';
import { SimulationSession, TraineeDecision, Report } from '../types/simulation';
import {
  Award,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Brain,
  Sparkles,
  ChevronRight,
  Printer,
  FileCheck,
  CheckCircle2,
  Sliders,
  History,
} from 'lucide-react';

interface AfterActionReviewProps {
  session: SimulationSession;
  onReturnToSimulation: () => void;
  onGenerateAiDebrief: () => Promise<string>;
}

export const AfterActionReview: React.FC<AfterActionReviewProps> = ({
  session,
  onReturnToSimulation,
  onGenerateAiDebrief,
}) => {
  const [replayIndex, setReplayIndex] = useState<number>(session.timeline.length - 1);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState(session.evaluation?.aiDebriefSummary || '');

  const evaluation = session.evaluation;
  const decisions = session.decisions;
  const alerts = session.alerts;

  const handleGenerateAi = async () => {
    setIsGeneratingAi(true);
    try {
      const summary = await onGenerateAiDebrief();
      setAiSummary(summary);
    } catch (err) {
      console.error('Failed to generate AI AAR summary', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Timeline events sorted chronologically for replay
  const chronologicalTimeline = [...session.timeline].reverse();
  const currentReplayEvent = chronologicalTimeline[replayIndex] || chronologicalTimeline[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6 text-slate-100 print:text-black">
      {/* AAR Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4 print:border-none print:p-0">
        <div>
          <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            After-Action Review & Comprehensive Evaluation (SIH26248)
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {session.scenarioTitle}
          </h1>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
            <span>Difficulty: <strong className="text-slate-200 capitalize">{session.difficulty}</strong></span>
            <span>·</span>
            <span>Decisions Evaluated: <strong className="text-slate-200">{decisions.length}</strong></span>
            <span>·</span>
            <span>Alerts Recorded: <strong className="text-slate-200">{alerts.length}</strong></span>
            <span>·</span>
            <span>Final Status: <strong className="text-slate-200 capitalize">{session.status}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition-colors border border-slate-700"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Export AAR
          </button>
          <button
            onClick={onReturnToSimulation}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition-colors"
          >
            Back to Simulation Console
          </button>
        </div>
      </div>

      {/* Score Overview & Explainable Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* Overall Composite Score */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between md:col-span-1">
          <span className="text-xs text-slate-400 font-medium">Overall Composite Score</span>
          <div className="my-2">
            <span className="text-4xl font-extrabold text-cyan-400 font-mono tabular-nums">
              {evaluation.overallScore}
            </span>
            <span className="text-sm text-slate-500 font-mono">/100</span>
          </div>
          <span className="text-[11px] text-slate-500">
            {evaluation.instructorScoreOverride
              ? 'Score manually verified with instructor override'
              : 'Weighted algorithmic evaluation based on recorded evidence'}
          </span>
        </div>

        {/* 4 Rubric Component Scores */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 md:col-span-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-2.5 bg-slate-950 rounded border border-slate-850">
            <div className="text-[11px] text-slate-400 mb-1">Info Grounding (30%)</div>
            <div className="text-2xl font-bold text-slate-100 font-mono tabular-nums">
              {evaluation.informationGroundingScore}%
            </div>
            <div className="text-[10px] text-slate-500 mt-1 leading-snug">
              Citations strictly matched against intel delivered at decision time.
            </div>
          </div>

          <div className="p-2.5 bg-slate-950 rounded border border-slate-850">
            <div className="text-[11px] text-slate-400 mb-1">Reasoning Depth (25%)</div>
            <div className="text-2xl font-bold text-slate-100 font-mono tabular-nums">
              {evaluation.reasoningQualityScore}%
            </div>
            <div className="text-[10px] text-slate-500 mt-1 leading-snug">
              Explanation of unknowns, risk mitigations, and restriction checks.
            </div>
          </div>

          <div className="p-2.5 bg-slate-950 rounded border border-slate-850">
            <div className="text-[11px] text-slate-400 mb-1">Restriction Adherence (25%)</div>
            <div className="text-2xl font-bold text-slate-100 font-mono tabular-nums">
              {evaluation.restrictionComplianceScore}%
            </div>
            <div className="text-[10px] text-slate-500 mt-1 leading-snug">
              Compliance with RoE R-01, Bridge R-02, and EMCON Alpha directives.
            </div>
          </div>

          <div className="p-2.5 bg-slate-950 rounded border border-slate-850">
            <div className="text-[11px] text-slate-400 mb-1">Operational Adaptability (20%)</div>
            <div className="text-2xl font-bold text-slate-100 font-mono tabular-nums">
              {evaluation.adaptabilityScore}%
            </div>
            <div className="text-[10px] text-slate-500 mt-1 leading-snug">
              Revisions initiated upon receiving contradictory or updated intel.
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Timeline Replay Scrubber */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-slate-200">Interactive Timeline Replay Scrubber</span>
            <span className="text-slate-500 font-mono">
              (Event {replayIndex + 1} of {chronologicalTimeline.length})
            </span>
          </div>
          <span className="font-mono text-cyan-400 text-xs">
            {currentReplayEvent ? currentReplayEvent.timestamp : ''}
          </span>
        </div>

        {/* Scrubber slider */}
        <input
          type="range"
          min="0"
          max={chronologicalTimeline.length - 1}
          value={replayIndex}
          onChange={(e) => setReplayIndex(Number(e.target.value))}
          className="w-full accent-cyan-500 cursor-pointer"
        />

        {/* Current Replay Event Inspector */}
        {currentReplayEvent && (
          <div className="p-3 bg-slate-950 rounded border border-slate-800 text-xs space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono uppercase font-semibold text-cyan-400">
                {currentReplayEvent.type.replace('_', ' ')}
              </span>
              <span>Actor: {currentReplayEvent.actor.toUpperCase()}</span>
            </div>
            <div className="font-semibold text-slate-100">{currentReplayEvent.summary}</div>
            {currentReplayEvent.details && (
              <div className="text-slate-400 text-[11px]">{currentReplayEvent.details}</div>
            )}
          </div>
        )}
      </div>

      {/* Decisions vs Available Information Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-sm font-semibold text-white">
            Decisions vs Information Available Matrix (Fairness Audit)
          </h3>
          <span className="text-xs text-slate-500 font-mono">Evaluated against delivered intel only</span>
        </div>

        <div className="space-y-3">
          {decisions.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              No decisions submitted during this session.
            </div>
          ) : (
            decisions.map((dec, idx) => (
              <div
                key={dec.id}
                className="p-3 bg-slate-950 border border-slate-800 rounded text-xs space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">Decision #{idx + 1} ({dec.id})</span>
                    {dec.revisionNumber > 1 && (
                      <span className="text-amber-400 font-mono">(Revision #{dec.revisionNumber})</span>
                    )}
                    <span className="text-slate-600">·</span>
                    <span className="uppercase text-cyan-400 font-medium">{dec.domain}</span>
                  </div>
                  <span className="font-mono text-slate-400">{dec.timestamp}</span>
                </div>

                <div className="font-semibold text-slate-100">{dec.action}</div>
                <div className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded">
                  <strong className="text-slate-400">Trainee Rationale:</strong> {dec.rationale}
                </div>

                {/* Audit: What intel was delivered vs what was cited */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-0.5">
                      Reports Actually Delivered to Trainee at Decision Time:
                    </span>
                    <span className="text-slate-300 font-mono">
                      {dec.availableReportsAtDecision && dec.availableReportsAtDecision.length > 0
                        ? dec.availableReportsAtDecision.join(', ')
                        : 'None delivered yet'}
                    </span>
                  </div>

                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-0.5">
                      Intel Cited by Trainee:
                    </span>
                    <span className="text-slate-300 font-mono">
                      {dec.supportingReportIds && dec.supportingReportIds.length > 0
                        ? dec.supportingReportIds.join(', ')
                        : 'No reports referenced'}
                    </span>
                  </div>
                </div>

                {/* Conflict alerts for this decision */}
                {dec.conflictAlerts && dec.conflictAlerts.length > 0 && (
                  <div className="p-2 bg-rose-950/20 border border-rose-900/40 rounded text-rose-300 text-[11px]">
                    <strong>Flagged Restriction Warning:</strong> {dec.conflictAlerts.map((a) => a.ruleTitle).join('; ')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Assistance: Grounded Debrief & Reflection Questions */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">
              AI Grounded Debrief Assessment & Reflection Inquiries
            </h3>
          </div>

          <button
            onClick={handleGenerateAi}
            disabled={isGeneratingAi}
            className="flex items-center gap-1.5 px-3 py-1 bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded text-xs font-medium transition-colors"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>{isGeneratingAi ? 'Analyzing Session Logs...' : 'Generate AI Debrief Summary'}</span>
          </button>
        </div>

        {aiSummary ? (
          <div className="p-3 bg-slate-950 rounded border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed font-sans">
            {aiSummary}
          </div>
        ) : (
          <div className="p-4 text-center text-slate-500 text-xs">
            Click "Generate AI Debrief Summary" to produce a grounded evaluation debrief and Socratic reflection questions based on the recorded session logs.
          </div>
        )}
      </div>

      {/* Socratic Reflection Questions for Trainee */}
      {evaluation.reflectionQuestions && evaluation.reflectionQuestions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-white mb-2">
            Key Debrief Questions for Trainee Self-Reflection
          </h3>
          <div className="space-y-1.5 text-xs text-slate-300">
            {evaluation.reflectionQuestions.map((q, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-slate-950 rounded border border-slate-800">
                <span className="font-mono text-cyan-400 font-bold">{idx + 1}.</span>
                <span>{q}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructor Qualitative Notes */}
      {session.instructorNotes && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-1.5">
          <h3 className="text-sm font-semibold text-white">
            Official Instructor Feedback & Certification Notes
          </h3>
          <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 leading-relaxed font-sans">
            {session.instructorNotes}
          </p>
        </div>
      )}
    </div>
  );
};
