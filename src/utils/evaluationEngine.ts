import { TraineeDecision, Report, OverallEvaluation, RestrictionAlert, Task } from '../types/simulation';

/**
 * Fair Decision Evaluation Engine.
 * Evaluates decisions STRICTLY based on information delivered to the trainee
 * at the moment of the decision. Future or delayed reports do not penalize past choices.
 */
export function evaluateSessionPerformance(
  decisions: TraineeDecision[],
  reports: Report[],
  alerts: RestrictionAlert[],
  tasks: Task[],
  instructorOverride?: number,
  instructorFeedback?: string
): OverallEvaluation {
  if (decisions.length === 0) {
    return {
      informationGroundingScore: 70,
      reasoningQualityScore: 70,
      restrictionComplianceScore: 100,
      adaptabilityScore: 70,
      overallScore: 75,
      instructorScoreOverride: instructorOverride,
      instructorFeedbackNotes: instructorFeedback,
      reflectionQuestions: [
        'How did communication latency affect your decision confidence?',
        'What criteria did you use to evaluate contradictory reports?',
        'How did scenario restrictions guide or constrain your tactical choices?',
      ],
    };
  }

  // 1. Information Grounding (Did the trainee reference delivered reports? Were they justified by what was known?)
  let totalGrounding = 0;
  for (const dec of decisions) {
    let decScore = 50; // baseline
    if (dec.supportingReportIds && dec.supportingReportIds.length > 0) {
      // Check if all cited reports were actually delivered at decision time
      const validCitations = dec.supportingReportIds.filter(id => 
        dec.availableReportsAtDecision.includes(id)
      );
      if (validCitations.length === dec.supportingReportIds.length) {
        decScore += 35; // All citations were verified delivered
      } else {
        decScore += 15; // Partial citation validity
      }
      if (dec.supportingReportIds.length >= 2) {
        decScore += 15; // Cross-domain multi-source grounding
      }
    } else {
      // No reports cited
      decScore = 40;
    }
    totalGrounding += Math.min(100, decScore);
  }
  const avgGrounding = Math.round(totalGrounding / decisions.length);

  // 2. Reasoning Quality (Word count, explanation of uncertainties, mention of restrictions, clear rationale)
  let totalReasoning = 0;
  for (const dec of decisions) {
    let rScore = 40;
    const words = dec.rationale.trim().split(/\s+/).filter(Boolean).length;
    if (words >= 15) rScore += 20;
    if (words >= 35) rScore += 20;
    
    const lower = dec.rationale.toLowerCase();
    // Bonus for acknowledging uncertainty / incomplete intel
    if (lower.includes('uncertain') || lower.includes('unverified') || lower.includes('risk') || lower.includes('contingency') || lower.includes('caution')) {
      rScore += 10;
    }
    // Bonus for mentioning restrictions
    if (lower.includes('restriction') || lower.includes('roe') || lower.includes('rule') || lower.includes('hospital') || lower.includes('bridge') || lower.includes('emcon')) {
      rScore += 10;
    }
    totalReasoning += Math.min(100, rScore);
  }
  const avgReasoning = Math.round(totalReasoning / decisions.length);

  // 3. Restriction Compliance (Based on alerts triggered and how trainee responded)
  let complianceScore = 100;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  // Penalize unresolved critical alerts
  for (const alert of criticalAlerts) {
    if (alert.status === 'reconsidered' || alert.status === 'mitigated') {
      complianceScore -= 8; // Small penalty because trainee adapted/explained
    } else {
      complianceScore -= 25; // Large penalty for unaddressed critical violation
    }
  }

  // Penalize warnings
  for (const alert of warningAlerts) {
    if (alert.status === 'reconsidered' || alert.status === 'mitigated') {
      complianceScore -= 4;
    } else {
      complianceScore -= 12;
    }
  }
  const finalCompliance = Math.max(20, Math.min(100, complianceScore));

  // 4. Adaptability (Responses to contradictory reports or revising decisions when new intel arrived)
  let adaptabilityScore = 70;
  const revisedDecisions = decisions.filter(d => d.revisionNumber > 1 || d.previousDecisionId);
  if (revisedDecisions.length > 0) {
    adaptabilityScore += 20; // Actively revised in response to new facts
  }
  const acknowledgedReportsCount = reports.filter(r => r.acknowledgedByTrainee).length;
  if (acknowledgedReportsCount >= 3) {
    adaptabilityScore += 10;
  }
  const finalAdaptability = Math.min(100, adaptabilityScore);

  // Overall Weighted Score: 30% Grounding + 25% Reasoning + 25% Compliance + 20% Adaptability
  const calculatedOverall = Math.round(
    avgGrounding * 0.30 +
    avgReasoning * 0.25 +
    finalCompliance * 0.25 +
    finalAdaptability * 0.20
  );

  const finalScore = instructorOverride !== undefined ? instructorOverride : calculatedOverall;

  return {
    informationGroundingScore: avgGrounding,
    reasoningQualityScore: avgReasoning,
    restrictionComplianceScore: finalCompliance,
    adaptabilityScore: finalAdaptability,
    overallScore: finalScore,
    instructorScoreOverride: instructorOverride,
    instructorFeedbackNotes: instructorFeedback,
    reflectionQuestions: [
      'How did you detect and resolve the discrepancy between the aerial UAV report (REP-A-201) and ground combat engineer demolition findings (REP-L-102)?',
      'When communication links were degraded, what secondary indicators guided your assessment of Substation Delta and Ridge 12?',
      'If forced to divert to Route Amber under fog conditions, what specific mitigation measures should protect the logistical convoy?',
      'How did the presence of Sector Kestrel Civilian Hospital influence the allowable tactics and sensor emissions in adjacent grids?',
    ],
  };
}
