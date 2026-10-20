import { ScenarioRestriction, RestrictionAlert, Domain, Report, ScenarioCondition } from '../types/simulation';

export interface RestrictionCheckInput {
  decisionId?: string;
  actionText: string;
  rationaleText: string;
  targetLocation?: string;
  domain: Domain;
  selectedReportIds: string[];
  activeRestrictions: ScenarioRestriction[];
  currentConditions: ScenarioCondition[];
  deliveredReports: Report[];
}

export interface RestrictionCheckResult {
  hasConflicts: boolean;
  alerts: RestrictionAlert[];
}

/**
 * Deterministic, rule-based Restriction Validation Engine.
 * Evaluates proposed trainee actions and rationales against explicit scenario constraints.
 */
export function validateDecisionRestrictions(input: RestrictionCheckInput): RestrictionCheckResult {
  const {
    decisionId = `DEC-${Date.now()}`,
    actionText,
    rationaleText,
    targetLocation = '',
    domain,
    selectedReportIds,
    activeRestrictions,
    currentConditions,
    deliveredReports,
  } = input;

  const combinedText = `${actionText} ${rationaleText} ${targetLocation}`.toLowerCase();
  const alerts: RestrictionAlert[] = [];

  for (const restriction of activeRestrictions) {
    if (!restriction.active) continue;

    // Rule R-01: Civilian Hospital Sanctuary / Airspace RoE
    if (restriction.id === 'R-01') {
      const touchesHospital = 
        combinedText.includes('hospital') || 
        combinedText.includes('44-88') || 
        targetLocation.toLowerCase().includes('hospital') ||
        targetLocation.toLowerCase().includes('44-88');

      const isKineticOrAir = 
        combinedText.includes('strike') || 
        combinedText.includes('bomb') || 
        combinedText.includes('kinetic') || 
        combinedText.includes('artillery') || 
        combinedText.includes('fire mission') || 
        combinedText.includes('low altitude') ||
        combinedText.includes('uav strike') ||
        combinedText.includes('engage');

      if (touchesHospital && isKineticOrAir) {
        alerts.push({
          id: `ALERT-${Date.now()}-${restriction.id}`,
          restrictionId: restriction.id,
          ruleTitle: restriction.title,
          severity: 'critical',
          reason: 'CRITICAL ROE VIOLATION WARNING: Proposed action involves kinetic strike or low-altitude air operations within the designated 5km exclusion perimeter of Sector Kestrel Civilian Hospital (Grid 44-88). This sanctuary is protected by international humanitarian law and strict scenario RoE.',
          decisionId,
          decisionSummary: actionText.slice(0, 100),
          timestamp: new Date().toLocaleTimeString(),
          status: 'active',
        });
      }
    }

    // Rule R-02: Bridge Charlie Structural Load Limit
    if (restriction.id === 'R-02') {
      const mentionsBridgeOrObsidian = 
        combinedText.includes('bridge charlie') || 
        combinedText.includes('route obsidian') || 
        targetLocation.toLowerCase().includes('bridge charlie') ||
        targetLocation.toLowerCase().includes('route obsidian');

      const commitsHeavyArmor = 
        combinedText.includes('heavy armor') || 
        combinedText.includes('mbt') || 
        combinedText.includes('tank') || 
        combinedText.includes('mechanized column') || 
        combinedText.includes('armored column') ||
        combinedText.includes('send 3rd armor') ||
        combinedText.includes('cross bridge charlie') ||
        combinedText.includes('commit column');

      if (mentionsBridgeOrObsidian && commitsHeavyArmor) {
        // Check if combat engineer verification report REP-L-102 has been received and cleared
        const hasEngineerReport = deliveredReports.some(r => r.id === 'REP-L-102');
        const citesEngineerReport = selectedReportIds.includes('REP-L-102');

        const conditionBridge = currentConditions.find(c => c.id === 'COND-01');
        const isCompromised = conditionBridge?.actualState.includes('demolition charges') || conditionBridge?.actualState.includes('compromised');

        // If bridge is compromised in scenario engine, or if trainee didn't verify structural integrity:
        alerts.push({
          id: `ALERT-${Date.now()}-${restriction.id}`,
          restrictionId: restriction.id,
          ruleTitle: restriction.title,
          severity: 'critical',
          reason: `CRITICAL LOAD RESTRICTION WARNING: Rule R-02 strictly prohibits committing vehicles over 30 tons across Bridge Charlie without verified structural clearance. ${
            hasEngineerReport 
              ? 'Delivered Combat Engineer Report REP-L-102 confirms demolition explosives are rigged under Bridge Charlie. Advancing heavy armor will trigger catastrophic span collapse!'
              : 'Structural integrity of Bridge Charlie remains UNVERIFIED by physical combat engineering inspection. Optical aerial reconnaissance is insufficient for sub-deck loads.'
          }`,
          decisionId,
          decisionSummary: actionText.slice(0, 100),
          timestamp: new Date().toLocaleTimeString(),
          status: 'active',
        });
      }
    }

    // Rule R-03: EMCON Alpha - Radio & Radar Emission Control
    if (restriction.id === 'R-03') {
      const breaksEMCON = 
        combinedText.includes('active radar') || 
        combinedText.includes('high-power') || 
        combinedText.includes('high power') || 
        combinedText.includes('wideband') || 
        combinedText.includes('unencrypted') ||
        combinedText.includes('search radar') ||
        combinedText.includes('broadcast open');

      const inEWSector = 
        combinedText.includes('ridge 12') || 
        combinedText.includes('sector 4') || 
        combinedText.includes('staging alpha') ||
        targetLocation.toLowerCase().includes('ridge 12');

      if (breaksEMCON || (inEWSector && combinedText.includes('transmit'))) {
        alerts.push({
          id: `ALERT-${Date.now()}-${restriction.id}`,
          restrictionId: restriction.id,
          ruleTitle: restriction.title,
          severity: 'warning',
          reason: 'EMISSION CONTROL (EMCON) WARNING: Proposed action activates high-power active radar or unencrypted wideband transmission within line-of-sight of hostile EW Emitter Ridge 12. Hostile SIGINT will triangulate friendly coordinates and cue counter-battery barrage.',
          decisionId,
          decisionSummary: actionText.slice(0, 100),
          timestamp: new Date().toLocaleTimeString(),
          status: 'active',
        });
      }
    }

    // Rule R-04: SCADA Substation Delta Cyber Isolation Protocol
    if (restriction.id === 'R-04') {
      const connectsSubstation = 
        combinedText.includes('connect substation') || 
        combinedText.includes('link scada') || 
        combinedText.includes('integrate delta') || 
        combinedText.includes('sync tactical grid') || 
        combinedText.includes('connect delta') ||
        (combinedText.includes('substation delta') && combinedText.includes('link'));

      const mentionsAirgap = 
        combinedText.includes('air-gap') || 
        combinedText.includes('airgap') || 
        combinedText.includes('isolate') || 
        combinedText.includes('quarantine') ||
        combinedText.includes('sandbox');

      if (connectsSubstation && !mentionsAirgap) {
        alerts.push({
          id: `ALERT-${Date.now()}-${restriction.id}`,
          restrictionId: restriction.id,
          ruleTitle: restriction.title,
          severity: 'warning',
          reason: 'CYBER CONTAINMENT PROTOCOL WARNING: Rule R-04 mandates fiber-optic air-gap isolation before linking Substation Delta telemetry to the Primary Tactical Grid. Unverified frequency fluctuation indicates potential zero-day payload injection.',
          decisionId,
          decisionSummary: actionText.slice(0, 100),
          timestamp: new Date().toLocaleTimeString(),
          status: 'active',
        });
      }
    }

    // Rule R-05: Dual-Source Target Verification Mandate
    if (restriction.id === 'R-05') {
      const isHighImpactAction = 
        combinedText.includes('divert all') || 
        combinedText.includes('commit column') || 
        combinedText.includes('full retreat') || 
        combinedText.includes('authorize interdiction') ||
        combinedText.includes('advance entire force');

      if (isHighImpactAction && selectedReportIds.length < 2) {
        alerts.push({
          id: `ALERT-${Date.now()}-${restriction.id}`,
          restrictionId: restriction.id,
          ruleTitle: restriction.title,
          severity: 'informational',
          reason: 'VERIFICATION ADVISORY: High-impact route commitment or force diversion is supported by fewer than 2 independent intelligence sources. In a contested EW environment with sensory deception, cross-referencing multiple domains is strongly recommended.',
          decisionId,
          decisionSummary: actionText.slice(0, 100),
          timestamp: new Date().toLocaleTimeString(),
          status: 'active',
        });
      }
    }
  }

  return {
    hasConflicts: alerts.length > 0,
    alerts,
  };
}
