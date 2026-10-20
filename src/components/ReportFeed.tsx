import React, { useState } from 'react';
import { Report, Domain } from '../types/simulation';
import { Volume2, VolumeX, CheckCircle2, AlertOctagon, HelpCircle, FileText, Filter } from 'lucide-react';
import { playAudioBroadcast, stopAudioPlayback } from '../utils/speechUtils';

interface ReportFeedProps {
  reports: Report[];
  onAcknowledgeReport: (reportId: string) => void;
  onReferenceInDecision?: (reportId: string) => void;
  selectedReportIds?: string[];
  isInstructor?: boolean;
}

export const ReportFeed: React.FC<ReportFeedProps> = ({
  reports,
  onAcknowledgeReport,
  onReferenceInDecision,
  selectedReportIds = [],
  isInstructor = false,
}) => {
  const [filterDomain, setFilterDomain] = useState<Domain | 'all'>('all');
  const [playingReportId, setPlayingReportId] = useState<string | null>(null);

  // Trainee must ONLY see reports that have been delivered or acknowledged.
  // Dropped or pending reports are completely hidden from the trainee!
  const visibleReports = isInstructor
    ? reports
    : reports.filter((r) => r.deliveryStatus === 'delivered' || r.deliveryStatus === 'acknowledged');

  const filteredReports = visibleReports.filter(
    (r) => filterDomain === 'all' || r.domain === filterDomain
  );

  const handleTogglePlay = (report: Report) => {
    if (playingReportId === report.id) {
      stopAudioPlayback();
      setPlayingReportId(null);
    } else {
      const speechText = `${report.domain} report from ${report.source}. ${report.title}. ${report.isIncomplete && report.incompleteContent ? report.incompleteContent : report.content}`;
      setPlayingReportId(report.id);
      playAudioBroadcast(
        speechText,
        () => setPlayingReportId(report.id),
        () => setPlayingReportId(null)
      );
    }
  };

  const domainColors: Record<Domain, { text: string; bg: string; border: string }> = {
    land: { text: 'text-amber-400', bg: 'bg-amber-950/20', border: 'border-amber-900/40' },
    air: { text: 'text-sky-400', bg: 'bg-sky-950/20', border: 'border-sky-900/40' },
    cyber: { text: 'text-purple-400', bg: 'bg-purple-950/20', border: 'border-purple-900/40' },
    ew: { text: 'text-rose-400', bg: 'bg-rose-950/20', border: 'border-rose-900/40' },
    joint: { text: 'text-emerald-400', bg: 'bg-emerald-950/20', border: 'border-emerald-900/40' },
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col h-full overflow-hidden">
      {/* Header & Filter Controls */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-200">Incoming Multi-Domain Intel Feed</span>
          <span className="text-xs text-slate-500 font-mono">({filteredReports.length} available)</span>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          {(['all', 'land', 'air', 'cyber', 'ew'] as const).map((domain) => (
            <button
              key={domain}
              onClick={() => setFilterDomain(domain)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterDomain === domain
                  ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {domain.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-800/60">
        {filteredReports.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            No intel reports received for the selected domain filter. Tactical radio traffic is quiet.
          </div>
        ) : (
          filteredReports.map((report) => {
            const isPlaying = playingReportId === report.id;
            const isSelected = selectedReportIds.includes(report.id);
            const isAcknowledged = report.acknowledgedByTrainee || report.deliveryStatus === 'acknowledged';

            return (
              <div
                key={report.id}
                className={`pt-2.5 first:pt-0 transition-colors rounded p-2 ${
                  isSelected ? 'bg-cyan-950/20 border border-cyan-800/50' : 'hover:bg-slate-800/30'
                }`}
              >
                {/* Meta line */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-400 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-semibold text-slate-200">{report.id}</span>
                    <span className="text-slate-600">·</span>
                    <span className={`font-medium ${domainColors[report.domain]?.text || 'text-slate-300'}`}>
                      {report.domain.toUpperCase()}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="truncate max-w-[160px] text-slate-300">{report.source}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
                    <span>Recv: {report.receivedTime || report.sentTime}</span>
                    <span className="text-slate-700">|</span>
                    {/* Verification Status */}
                    {report.verificationStatus === 'verified' ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 inline" /> Verified
                      </span>
                    ) : report.verificationStatus === 'suspect' ? (
                      <span className="text-rose-400 flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3 inline" /> Suspect
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3 inline" /> Unverified
                      </span>
                    )}
                  </div>
                </div>

                {/* Report Title */}
                <h4 className="text-xs font-semibold text-slate-100 mb-1">
                  {report.title}
                </h4>

                {/* Contradiction Warning Banner */}
                {report.isContradictory && (
                  <div className="mb-2 p-1.5 bg-amber-950/40 border border-amber-800/60 rounded text-[11px] text-amber-300 flex items-start gap-1.5">
                    <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <span className="font-semibold">CONTRADICTORY INTELLIGENCE DETECTED: </span>
                      <span>{report.contradictionNote || `Discrepant with report ${report.contradictsReportId}. Reconcile before committing units.`}</span>
                    </div>
                  </div>
                )}

                {/* Incomplete / Telemetry Loss Warning */}
                {report.isIncomplete && (
                  <div className="mb-1.5 p-1 bg-purple-950/30 border border-purple-800/40 rounded text-[10px] text-purple-300 font-mono">
                    [SIGNAL CORRUPTION / INCOMPLETE PACKETS DETECTED VIA EW INTERFERENCE]
                  </div>
                )}

                {/* Report Content */}
                <p className="text-xs text-slate-300 leading-relaxed font-sans mb-2">
                  {report.isIncomplete && report.incompleteContent ? report.incompleteContent : report.content}
                </p>

                {/* Action Bar: Audio TTS, Reference in Decision, Acknowledge */}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/60 text-xs">
                  <div className="flex items-center gap-2">
                    {/* Audio Playback Button */}
                    <button
                      onClick={() => handleTogglePlay(report)}
                      title={isPlaying ? 'Stop Audio Playback' : 'Listen to Report Audio'}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        isPlaying
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isPlaying ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      <span>{isPlaying ? 'Stop' : 'Audio'}</span>
                    </button>

                    {/* Reference in Decision Button */}
                    {onReferenceInDecision && (
                      <button
                        onClick={() => onReferenceInDecision(report.id)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          isSelected
                            ? 'bg-cyan-900/60 text-cyan-200 border border-cyan-700'
                            : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {isSelected ? '✓ Referenced' : '+ Cite in Decision'}
                      </button>
                    )}
                  </div>

                  {/* Acknowledge Button */}
                  <div className="flex items-center gap-2">
                    {isAcknowledged ? (
                      <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Acknowledged
                      </span>
                    ) : (
                      <button
                        onClick={() => onAcknowledgeReport(report.id)}
                        className="px-2.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium border border-slate-700 transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
