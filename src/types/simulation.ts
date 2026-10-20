/**
 * Types and interfaces for the Immersive Multi-Domain Decision-Making Trainer (SIH26248)
 */

export type Domain = 'land' | 'air' | 'cyber' | 'ew' | 'joint';

export type DeliveryStatus = 
  | 'pending'
  | 'delivered'
  | 'delayed'
  | 'dropped'
  | 'unverified'
  | 'contradictory'
  | 'acknowledged';

export type VerificationStatus = 'verified' | 'unverified' | 'contested' | 'suspect';

export type SeverityLevel = 'informational' | 'warning' | 'critical';

export type DifficultyLevel = 'easy' | 'medium' | 'difficult';

export type SessionStatus = 'configuring' | 'running' | 'paused' | 'ended';

export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'completed';

export interface Report {
  id: string;
  domain: Domain;
  source: string;
  title: string;
  content: string;
  incompleteContent?: string;
  isIncomplete?: boolean;
  contradictsReportId?: string;
  contradictionNote?: string;
  isContradictory?: boolean;
  eventTime: string;
  sentTime: string;
  receivedTime?: string;
  deliveryStatus: DeliveryStatus;
  verificationStatus: VerificationStatus;
  isDropped?: boolean;
  delaySeconds?: number;
  scheduledDeliveryTime?: number;
  locationReference?: string;
  acknowledgedByTrainee?: boolean;
  acknowledgedAt?: string;
  coordinates?: { x: number; y: number; grid: string };
}

export interface ScenarioCondition {
  id: string;
  title: string;
  description: string;
  domain: Domain;
  actualState: string;
  traineePerceivedState: string;
  severity: 'nominal' | 'degraded' | 'critical';
  updatedAt: string;
  location?: string;
}

export interface ScenarioRestriction {
  id: string;
  title: string;
  domain: Domain;
  category: 'safety' | 'roe' | 'emcon' | 'containment' | 'verification';
  ruleText: string;
  rationale: string;
  severity: SeverityLevel;
  triggerKeywords: string[];
  restrictedLocations: string[];
  restrictedActions: string[];
  active: boolean;
}

export interface RestrictionAlert {
  id: string;
  restrictionId: string;
  ruleTitle: string;
  severity: SeverityLevel;
  reason: string;
  decisionId: string;
  decisionSummary: string;
  timestamp: string;
  status: 'active' | 'reconsidered' | 'mitigated' | 'overridden_by_instructor';
  traineeResponse?: string;
  traineeResponseTime?: string;
  instructorNote?: string;
}

export interface DecisionEvaluation {
  informationGroundingScore: number; // 0-100
  reasoningQualityScore: number;     // 0-100
  restrictionComplianceScore: number;// 0-100
  adaptabilityScore: number;         // 0-100
  rubricExplanation: string;
}

export interface TraineeDecision {
  id: string;
  timestamp: string;
  action: string;
  rationale: string;
  supportingReportIds: string[];
  confidence: 'low' | 'medium' | 'high';
  targetLocation?: string;
  domain: Domain;
  syncStatus: 'pending' | 'syncing' | 'synced';
  availableReportsAtDecision: string[]; // Report IDs visible to trainee at decision timestamp
  revisionNumber: number;
  previousDecisionId?: string;
  conflictAlerts: RestrictionAlert[];
  evaluationBreakdown?: DecisionEvaluation;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  domain: Domain;
  status: TaskStatus;
  assignedTime: string;
  completedTime?: string;
  lastObservation?: string;
  requiredRestrictions: string[];
  progressPercent: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  simSecond: number;
  type: 
    | 'report_sent' 
    | 'report_delivered' 
    | 'report_delayed' 
    | 'report_dropped'
    | 'decision_submitted'
    | 'decision_revised'
    | 'alert_triggered'
    | 'alert_resolved'
    | 'task_updated'
    | 'condition_changed'
    | 'connection_changed'
    | 'instructor_override';
  actor: 'instructor' | 'trainee' | 'simulation_engine' | 'network';
  domain?: Domain;
  summary: string;
  details?: string;
  refId?: string;
}

export interface OverallEvaluation {
  informationGroundingScore: number;
  reasoningQualityScore: number;
  restrictionComplianceScore: number;
  adaptabilityScore: number;
  overallScore: number;
  instructorScoreOverride?: number;
  instructorFeedbackNotes?: string;
  aiDebriefSummary?: string;
  reflectionQuestions?: string[];
}

export interface TrainingScenario {
  id: string;
  title: string;
  region: string;
  description: string;
  briefing: string;
  objectives: string[];
  initialSituation: string;
  defaultDurationMinutes: number;
  restrictions: ScenarioRestriction[];
  initialTasks: Task[];
  initialConditions: ScenarioCondition[];
  baselineReports: Report[];
}

export interface SimulationSession {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  scenarioDescription: string;
  briefing: string;
  objectives: string[];
  difficulty: DifficultyLevel;
  status: SessionStatus;
  startTime?: string;
  endTime?: string;
  currentSimSecond: number;
  reports: Report[];
  conditions: ScenarioCondition[];
  restrictions: ScenarioRestriction[];
  tasks: Task[];
  decisions: TraineeDecision[];
  alerts: RestrictionAlert[];
  timeline: TimelineEvent[];
  evaluation: OverallEvaluation;
  simulatedCommsStatus: 'nominal' | 'intermittent' | 'jammed' | 'blackout';
  isNetworkOnline: boolean;
  instructorNotes: string;
}

export interface OfflineQueueItem {
  id: string;
  timestamp: string;
  type: 'decision' | 'decision_revision' | 'task_update' | 'report_ack' | 'alert_response';
  payload: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
}
