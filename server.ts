import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { PRIMARY_SCENARIO, BASELINE_REPORTS, SCENARIO_RESTRICTIONS, SCENARIO_CONDITIONS, INITIAL_TASKS } from './src/data/mockScenario.ts';
import { SimulationSession, Report, TraineeDecision, RestrictionAlert, TimelineEvent } from './src/types/simulation.ts';
import { validateDecisionRestrictions } from './src/utils/restrictionEngine.ts';
import { evaluateSessionPerformance } from './src/utils/evaluationEngine.ts';

import fs from 'fs';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase Config for server-side cryptographic and role verification
let firebaseConfig: any = null;
try {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('Notice: Could not load firebase-applet-config.json on server:', e);
}

// Cryptographically verify Firebase ID token and fetch authoritative role from Firestore
async function verifyTokenAndRole(
  idToken: string
): Promise<{ uid: string; email: string; role: 'trainee' | 'instructor' | 'admin' } | null> {
  if (!idToken || !firebaseConfig?.apiKey) return null;

  try {
    const tokenRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!tokenRes.ok) {
      return null;
    }

    const tokenData = (await tokenRes.json()) as any;
    const userRecord = tokenData.users?.[0];
    if (!userRecord) return null;

    const uid = userRecord.localId;
    const email = userRecord.email || '';

    // Hardcoded developer / system owner account bypass
    if (email === 'aditiwari026@gmail.com') {
      return { uid, email, role: 'admin' };
    }

    // Query Firestore REST API directly on the server to get authoritative role
    let role: 'trainee' | 'instructor' | 'admin' = 'trainee';
    try {
      const projectId = firebaseConfig.projectId;
      const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/users/${uid}`;
      const firestoreRes = await fetch(firestoreUrl, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (firestoreRes.ok) {
        const docJson = (await firestoreRes.json()) as any;
        const roleVal = docJson.fields?.role?.stringValue;
        if (roleVal === 'instructor' || roleVal === 'admin') {
          role = roleVal;
        }
      }
    } catch (fsErr) {
      console.warn('Server Firestore role lookup notice:', fsErr);
    }

    return { uid, email, role };
  } catch (err) {
    console.error('Server error during token verification:', err);
    return null;
  }
}

// Strict Server-Side Instructor Role Enforcement Middleware
async function requireInstructorAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Access Denied: Authentication required. Please sign in with an authorized Instructor account.',
      code: 'UNAUTHENTICATED',
    });
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) {
    return res.status(401).json({
      error: 'Access Denied: Authentication token missing.',
      code: 'UNAUTHENTICATED',
    });
  }

  const verified = await verifyTokenAndRole(idToken);
  if (!verified) {
    return res.status(401).json({
      error: 'Access Denied: Invalid or expired session token. Please re-authenticate.',
      code: 'INVALID_TOKEN',
    });
  }

  if (verified.role !== 'instructor' && verified.role !== 'admin') {
    return res.status(403).json({
      error: 'Access Denied: The Instructor Station is restricted to authorized instructors.',
      code: 'FORBIDDEN',
      currentRole: verified.role,
      requiredRole: 'instructor',
    });
  }

  (req as any).user = verified;
  next();
}

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory active session state
let currentSession: SimulationSession = createInitialSession('medium');

function createInitialSession(difficulty: 'easy' | 'medium' | 'difficult'): SimulationSession {
  // Adjust reports based on difficulty
  const clonedReports: Report[] = JSON.parse(JSON.stringify(BASELINE_REPORTS));

  if (difficulty === 'easy') {
    // Easy: Reports arrive earlier, 1 contradiction, minimal jamming delay
    clonedReports.forEach((r) => {
      if (r.id === 'REP-L-101') r.deliveryStatus = 'delivered';
      if (r.id === 'REP-A-201') r.deliveryStatus = 'delivered';
      if (r.id === 'REP-L-103') r.deliveryStatus = 'delivered';
      if (r.id === 'REP-EW-301') r.deliveryStatus = 'delivered';
      if (r.id === 'REP-CY-401') {
        r.deliveryStatus = 'delayed';
        r.delaySeconds = 15;
      }
    });
  } else if (difficulty === 'medium') {
    // Medium: Standard tactical training setup
    clonedReports.forEach((r) => {
      if (r.id === 'REP-L-101' || r.id === 'REP-A-201' || r.id === 'REP-L-103' || r.id === 'REP-EW-301') {
        r.deliveryStatus = 'delivered';
      }
      if (r.id === 'REP-CY-401') {
        r.deliveryStatus = 'delayed';
        r.delaySeconds = 30;
      }
      if (r.id === 'REP-L-102') {
        r.deliveryStatus = 'pending'; // Instructor controls when to drop the contradictory bomb
      }
    });
  } else {
    // Difficult: Severe EW friction, multiple incomplete reports, initial delay on critical intel
    clonedReports.forEach((r) => {
      if (r.id === 'REP-CY-401') {
        r.isIncomplete = true;
        r.deliveryStatus = 'delayed';
        r.delaySeconds = 60;
      }
      if (r.id === 'REP-EW-301') {
        r.deliveryStatus = 'delivered';
      }
      if (r.id === 'REP-L-102') {
        r.deliveryStatus = 'pending';
      }
    });
  }

  const initialTimeline: TimelineEvent[] = [
    {
      id: `EVT-INIT-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      simSecond: 0,
      type: 'condition_changed',
      actor: 'simulation_engine',
      summary: `Training Session Initialized: ${PRIMARY_SCENARIO.title} (${difficulty.toUpperCase()} difficulty)`,
      details: 'Communications degraded across VHF and satellite links. Trainee and instructor stations active.',
    },
    {
      id: `EVT-REP1-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      simSecond: 25,
      type: 'report_delivered',
      actor: 'simulation_engine',
      domain: 'land',
      summary: 'Report REP-L-101 Delivered: Approach to Bridge Charlie clear of overt hostile positions.',
      refId: 'REP-L-101',
    },
  ];

  return {
    id: `SESSION-${Date.now()}`,
    scenarioId: PRIMARY_SCENARIO.id,
    scenarioTitle: PRIMARY_SCENARIO.title,
    scenarioDescription: PRIMARY_SCENARIO.description,
    briefing: PRIMARY_SCENARIO.briefing,
    objectives: PRIMARY_SCENARIO.objectives,
    difficulty,
    status: 'running',
    startTime: new Date().toISOString(),
    currentSimSecond: 0,
    reports: clonedReports,
    conditions: JSON.parse(JSON.stringify(SCENARIO_CONDITIONS)),
    restrictions: JSON.parse(JSON.stringify(SCENARIO_RESTRICTIONS)),
    tasks: JSON.parse(JSON.stringify(INITIAL_TASKS)),
    decisions: [],
    alerts: [],
    timeline: initialTimeline,
    evaluation: evaluateSessionPerformance([], clonedReports, [], INITIAL_TASKS),
    simulatedCommsStatus: difficulty === 'difficult' ? 'jammed' : 'intermittent',
    isNetworkOnline: true,
    instructorNotes: '',
  };
}

// Track processed offline event IDs for idempotency
const processedEventIds = new Set<string>();

// ---------------- API ROUTES ----------------

// Verify role and authentication status
app.get('/api/auth/verify-role', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ authenticated: false, error: 'No authorization token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  const verified = await verifyTokenAndRole(idToken);
  if (!verified) {
    return res.status(401).json({ authenticated: false, error: 'Invalid or expired token' });
  }

  res.json({
    authenticated: true,
    uid: verified.uid,
    email: verified.email,
    role: verified.role,
    isInstructor: verified.role === 'instructor' || verified.role === 'admin',
    isAdmin: verified.role === 'admin',
  });
});

// Get current session - role-aware filtering to prevent trainee from seeing instructor controls & pending reports
app.get('/api/session', async (req, res) => {
  const authHeader = req.headers.authorization;
  let isInstructorOrAdmin = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (idToken) {
      const verified = await verifyTokenAndRole(idToken);
      if (verified && (verified.role === 'instructor' || verified.role === 'admin')) {
        isInstructorOrAdmin = true;
      }
    }
  }

  if (isInstructorOrAdmin) {
    // Instructor sees full session including pending/dropped reports and notes
    return res.json(currentSession);
  }

  // Trainee or unauthenticated: sanitize to hide dropped or pending instructor reports
  const sanitizedReports = currentSession.reports.filter(
    (r) => r.deliveryStatus === 'delivered' || r.deliveryStatus === 'acknowledged'
  );

  const sanitizedSession: SimulationSession = {
    ...currentSession,
    reports: sanitizedReports,
    // Do not leak instructor private notes to trainee during exercise
    instructorNotes: currentSession.status === 'ended' ? currentSession.instructorNotes : '',
  };

  res.json(sanitizedSession);
});

// Reset / Initialize session (Restricted to Instructor role)
app.post('/api/session/init', requireInstructorAuth, (req, res) => {
  const { difficulty = 'medium' } = req.body;
  currentSession = createInitialSession(difficulty);
  res.json({ success: true, session: currentSession });
});

// Update session status (running, paused, ended)
app.post('/api/session/status', async (req, res) => {
  const { status } = req.body;

  // Running and Pausing the exercise are strictly instructor operations
  if (status === 'running' || status === 'paused') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access Denied: Authentication required. Only instructors can change exercise status.',
        code: 'UNAUTHENTICATED',
      });
    }
    const idToken = authHeader.split('Bearer ')[1]?.trim();
    const verified = await verifyTokenAndRole(idToken);
    if (!verified || (verified.role !== 'instructor' && verified.role !== 'admin')) {
      return res.status(403).json({
        error: 'Access Denied: The Instructor Station is restricted to authorized instructors.',
        code: 'FORBIDDEN',
      });
    }
  }

  if (['running', 'paused', 'ended'].includes(status)) {
    currentSession.status = status;
    if (status === 'ended' && !currentSession.endTime) {
      currentSession.endTime = new Date().toISOString();
      currentSession.evaluation = evaluateSessionPerformance(
        currentSession.decisions,
        currentSession.reports,
        currentSession.alerts,
        currentSession.tasks,
        currentSession.evaluation.instructorScoreOverride,
        currentSession.instructorNotes
      );
    }
    currentSession.timeline.unshift({
      id: `EVT-STATUS-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      simSecond: currentSession.currentSimSecond,
      type: 'condition_changed',
      actor: 'instructor',
      summary: `Exercise status updated to ${status.toUpperCase()}`,
    });
    res.json({ success: true, session: currentSession });
  } else {
    res.status(400).json({ error: 'Invalid session status' });
  }
});

// Instructor Report Actions: release, hold, delay, drop, contradict, make_incomplete, mark_unverified (Restricted to Instructor role)
app.post('/api/instructor/report/action', requireInstructorAuth, (req, res) => {
  const { reportId, action, delaySeconds } = req.body;
  const report = currentSession.reports.find((r) => r.id === reportId);

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  let summary = '';

  switch (action) {
    case 'release_now':
      report.deliveryStatus = 'delivered';
      report.receivedTime = new Date().toLocaleTimeString();
      report.isDropped = false;
      summary = `Report ${report.id} released immediately by instructor to trainee.`;
      currentSession.timeline.unshift({
        id: `EVT-REL-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        simSecond: currentSession.currentSimSecond,
        type: 'report_delivered',
        actor: 'instructor',
        domain: report.domain,
        summary,
        refId: report.id,
      });
      break;

    case 'hold':
      report.deliveryStatus = 'pending';
      summary = `Report ${report.id} put on hold by instructor. Trainee will not receive it.`;
      currentSession.timeline.unshift({
        id: `EVT-HOLD-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        simSecond: currentSession.currentSimSecond,
        type: 'condition_changed',
        actor: 'instructor',
        domain: report.domain,
        summary,
        refId: report.id,
      });
      break;

    case 'delay':
      report.deliveryStatus = 'delayed';
      report.delaySeconds = delaySeconds || 30;
      summary = `Report ${report.id} delayed by ${report.delaySeconds} seconds.`;
      currentSession.timeline.unshift({
        id: `EVT-DELAY-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        simSecond: currentSession.currentSimSecond,
        type: 'report_delayed',
        actor: 'instructor',
        domain: report.domain,
        summary,
        refId: report.id,
      });
      break;

    case 'drop':
      report.deliveryStatus = 'dropped';
      report.isDropped = true;
      summary = `Report ${report.id} DROPPED by instructor. Trainee workspace will never receive this report.`;
      currentSession.timeline.unshift({
        id: `EVT-DROP-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        simSecond: currentSession.currentSimSecond,
        type: 'report_dropped',
        actor: 'instructor',
        domain: report.domain,
        summary,
        refId: report.id,
      });
      break;

    case 'make_incomplete':
      report.isIncomplete = !report.isIncomplete;
      summary = `Report ${report.id} marked as ${report.isIncomplete ? 'INCOMPLETE / CORRUPTED' : 'COMPLETE'}.`;
      break;

    case 'mark_unverified':
      report.verificationStatus = report.verificationStatus === 'unverified' ? 'verified' : 'unverified';
      summary = `Report ${report.id} verification status set to ${report.verificationStatus}.`;
      break;

    case 'add_contradiction':
      report.isContradictory = true;
      report.deliveryStatus = 'delivered';
      report.receivedTime = new Date().toLocaleTimeString();
      summary = `CONTRADICTORY INTEL RELEASED: Report ${report.id} delivered to challenge earlier assumptions.`;
      currentSession.timeline.unshift({
        id: `EVT-CONTRA-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        simSecond: currentSession.currentSimSecond,
        type: 'report_delivered',
        actor: 'instructor',
        domain: report.domain,
        summary,
        refId: report.id,
      });
      break;

    default:
      return res.status(400).json({ error: 'Unknown action' });
  }

  res.json({ success: true, report, session: currentSession });
});

// Inject new custom report (Restricted to Instructor role)
app.post('/api/instructor/report/inject', requireInstructorAuth, (req, res) => {
  const { domain, source, title, content, locationReference, deliveryStatus = 'delivered' } = req.body;

  const newReport: Report = {
    id: `REP-INJ-${Date.now().toString().slice(-4)}`,
    domain: domain || 'land',
    source: source || 'Instructor Injection Tactical Net',
    title: title || 'Tactical Update',
    content,
    eventTime: new Date().toLocaleTimeString(),
    sentTime: new Date().toLocaleTimeString(),
    receivedTime: deliveryStatus === 'delivered' ? new Date().toLocaleTimeString() : undefined,
    deliveryStatus,
    verificationStatus: 'unverified',
    locationReference,
  };

  currentSession.reports.unshift(newReport);
  currentSession.timeline.unshift({
    id: `EVT-INJ-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    simSecond: currentSession.currentSimSecond,
    type: 'report_delivered',
    actor: 'instructor',
    domain: newReport.domain,
    summary: `Instructor injected new ${newReport.domain.toUpperCase()} report: "${newReport.title}"`,
    refId: newReport.id,
  });

  res.json({ success: true, report: newReport, session: currentSession });
});

// Inject or modify scenario condition (Restricted to Instructor role)
app.post('/api/instructor/condition', requireInstructorAuth, (req, res) => {
  const { conditionId, actualState, perceivedState, severity } = req.body;
  const condition = currentSession.conditions.find((c) => c.id === conditionId);

  if (condition) {
    if (actualState) condition.actualState = actualState;
    if (perceivedState) condition.traineePerceivedState = perceivedState;
    if (severity) condition.severity = severity;
    condition.updatedAt = new Date().toLocaleTimeString();

    currentSession.timeline.unshift({
      id: `EVT-COND-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      simSecond: currentSession.currentSimSecond,
      type: 'condition_changed',
      actor: 'instructor',
      summary: `Scenario condition changed: ${condition.title} [Actual: ${condition.actualState}]`,
      refId: condition.id,
    });

    res.json({ success: true, condition, session: currentSession });
  } else {
    res.status(404).json({ error: 'Condition not found' });
  }
});

// Instructor annotations & overrides (Restricted to Instructor role)
app.post('/api/instructor/annotation', requireInstructorAuth, (req, res) => {
  const { notes, scoreOverride } = req.body;
  if (notes !== undefined) currentSession.instructorNotes = notes;
  if (scoreOverride !== undefined) {
    currentSession.evaluation.instructorScoreOverride = Number(scoreOverride);
    currentSession.evaluation.overallScore = Number(scoreOverride);
  }

  currentSession.timeline.unshift({
    id: `EVT-NOTE-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    simSecond: currentSession.currentSimSecond,
    type: 'instructor_override',
    actor: 'instructor',
    summary: `Instructor recorded evaluation notes${scoreOverride ? ` (Score adjusted to ${scoreOverride}/100)` : ''}`,
  });

  res.json({ success: true, session: currentSession });
});

// Trainee Decision Submission (with server-side restriction check & available intel snapshot)
app.post('/api/trainee/decision', (req, res) => {
  const { action, rationale, supportingReportIds = [], confidence = 'medium', targetLocation, domain = 'land', id } = req.body;

  const decisionId = id || `DEC-${Date.now()}`;

  // Snapshot the reports that were ACTUALLY DELIVERED to the trainee at this exact moment
  const deliveredReportIds = currentSession.reports
    .filter((r) => r.deliveryStatus === 'delivered' || r.deliveryStatus === 'acknowledged')
    .map((r) => r.id);

  // Run the rule-based restriction check
  const checkResult = validateDecisionRestrictions({
    decisionId,
    actionText: action,
    rationaleText: rationale,
    targetLocation,
    domain,
    selectedReportIds: supportingReportIds,
    activeRestrictions: currentSession.restrictions,
    currentConditions: currentSession.conditions,
    deliveredReports: currentSession.reports.filter((r) => deliveredReportIds.includes(r.id)),
  });

  const newDecision: TraineeDecision = {
    id: decisionId,
    timestamp: new Date().toLocaleTimeString(),
    action,
    rationale,
    supportingReportIds,
    confidence,
    targetLocation,
    domain,
    syncStatus: 'synced',
    availableReportsAtDecision: deliveredReportIds,
    revisionNumber: 1,
    conflictAlerts: checkResult.alerts,
  };

  currentSession.decisions.unshift(newDecision);

  // If conflicts detected, register alerts in session
  if (checkResult.hasConflicts) {
    for (const alert of checkResult.alerts) {
      currentSession.alerts.unshift(alert);
      currentSession.timeline.unshift({
        id: `EVT-ALERT-${Date.now()}-${alert.restrictionId}`,
        timestamp: new Date().toLocaleTimeString(),
        simSecond: currentSession.currentSimSecond,
        type: 'alert_triggered',
        actor: 'simulation_engine',
        domain,
        summary: `[${alert.severity.toUpperCase()}] Restriction Alert Triggered: ${alert.ruleTitle}`,
        details: alert.reason,
        refId: decisionId,
      });
    }
  }

  currentSession.timeline.unshift({
    id: `EVT-DEC-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    simSecond: currentSession.currentSimSecond,
    type: 'decision_submitted',
    actor: 'trainee',
    domain,
    summary: `Trainee submitted decision: "${action.slice(0, 60)}${action.length > 60 ? '...' : ''}"`,
    details: `Rationale: ${rationale}`,
    refId: decisionId,
  });

  // Recompute evaluation score
  currentSession.evaluation = evaluateSessionPerformance(
    currentSession.decisions,
    currentSession.reports,
    currentSession.alerts,
    currentSession.tasks,
    currentSession.evaluation.instructorScoreOverride,
    currentSession.instructorNotes
  );

  res.json({
    success: true,
    decision: newDecision,
    hasConflicts: checkResult.hasConflicts,
    alerts: checkResult.alerts,
    session: currentSession,
  });
});

// Trainee Decision Revision
app.post('/api/trainee/decision/revise', (req, res) => {
  const { originalDecisionId, revisedAction, revisedRationale, confidence } = req.body;
  const original = currentSession.decisions.find((d) => d.id === originalDecisionId);

  if (!original) {
    return res.status(404).json({ error: 'Original decision not found' });
  }

  const deliveredReportIds = currentSession.reports
    .filter((r) => r.deliveryStatus === 'delivered' || r.deliveryStatus === 'acknowledged')
    .map((r) => r.id);

  const checkResult = validateDecisionRestrictions({
    decisionId: `REV-${Date.now()}`,
    actionText: revisedAction,
    rationaleText: revisedRationale,
    targetLocation: original.targetLocation,
    domain: original.domain,
    selectedReportIds: original.supportingReportIds,
    activeRestrictions: currentSession.restrictions,
    currentConditions: currentSession.conditions,
    deliveredReports: currentSession.reports.filter((r) => deliveredReportIds.includes(r.id)),
  });

  const revisedDecision: TraineeDecision = {
    id: `REV-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    action: revisedAction,
    rationale: revisedRationale,
    supportingReportIds: original.supportingReportIds,
    confidence: confidence || original.confidence,
    targetLocation: original.targetLocation,
    domain: original.domain,
    syncStatus: 'synced',
    availableReportsAtDecision: deliveredReportIds,
    revisionNumber: original.revisionNumber + 1,
    previousDecisionId: original.id,
    conflictAlerts: checkResult.alerts,
  };

  currentSession.decisions.unshift(revisedDecision);

  // Mark alerts on previous decision as reconsidered if resolved
  currentSession.alerts.forEach((alert) => {
    if (alert.decisionId === originalDecisionId) {
      alert.status = checkResult.hasConflicts ? 'mitigated' : 'reconsidered';
      alert.traineeResponse = `Revised via decision ${revisedDecision.id}: ${revisedRationale.slice(0, 80)}`;
      alert.traineeResponseTime = new Date().toLocaleTimeString();
    }
  });

  currentSession.timeline.unshift({
    id: `EVT-REVISE-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    simSecond: currentSession.currentSimSecond,
    type: 'decision_revised',
    actor: 'trainee',
    domain: original.domain,
    summary: `Decision ${originalDecisionId} revised to Revision #${revisedDecision.revisionNumber}`,
    details: `Revised action: ${revisedAction}`,
    refId: revisedDecision.id,
  });

  currentSession.evaluation = evaluateSessionPerformance(
    currentSession.decisions,
    currentSession.reports,
    currentSession.alerts,
    currentSession.tasks,
    currentSession.evaluation.instructorScoreOverride,
    currentSession.instructorNotes
  );

  res.json({ success: true, decision: revisedDecision, alerts: checkResult.alerts, session: currentSession });
});

// Trainee responds to an active alert
app.post('/api/trainee/alert/respond', (req, res) => {
  const { alertId, responseText, actionType } = req.body;
  const alert = currentSession.alerts.find((a) => a.id === alertId);

  if (alert) {
    alert.status = actionType === 'reconsider' ? 'reconsidered' : 'mitigated';
    alert.traineeResponse = responseText;
    alert.traineeResponseTime = new Date().toLocaleTimeString();

    currentSession.timeline.unshift({
      id: `EVT-ALERT-RESP-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      simSecond: currentSession.currentSimSecond,
      type: 'alert_resolved',
      actor: 'trainee',
      summary: `Trainee responded to [${alert.severity.toUpperCase()}] alert on ${alert.ruleTitle}: "${responseText.slice(0, 60)}"`,
      refId: alert.id,
    });

    currentSession.evaluation = evaluateSessionPerformance(
      currentSession.decisions,
      currentSession.reports,
      currentSession.alerts,
      currentSession.tasks,
      currentSession.evaluation.instructorScoreOverride,
      currentSession.instructorNotes
    );

    res.json({ success: true, alert, session: currentSession });
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

// Trainee updates task status
app.post('/api/trainee/task/update', (req, res) => {
  const { taskId, status, observation, progressPercent } = req.body;
  const task = currentSession.tasks.find((t) => t.id === taskId);

  if (task) {
    if (status) task.status = status;
    if (progressPercent !== undefined) task.progressPercent = progressPercent;
    if (observation) task.lastObservation = observation;
    if (status === 'completed' && !task.completedTime) {
      task.completedTime = new Date().toLocaleTimeString();
    }

    currentSession.timeline.unshift({
      id: `EVT-TASK-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      simSecond: currentSession.currentSimSecond,
      type: 'task_updated',
      actor: 'trainee',
      domain: task.domain,
      summary: `Task "${task.title}" updated to ${status.toUpperCase()} (${task.progressPercent}%)`,
      refId: task.id,
    });

    res.json({ success: true, task, session: currentSession });
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

// Trainee acknowledges report
app.post('/api/trainee/report/ack', (req, res) => {
  const { reportId } = req.body;
  const report = currentSession.reports.find((r) => r.id === reportId);

  if (report) {
    report.acknowledgedByTrainee = true;
    report.acknowledgedAt = new Date().toLocaleTimeString();
    if (report.deliveryStatus === 'delivered') {
      report.deliveryStatus = 'acknowledged';
    }
    res.json({ success: true, report });
  } else {
    res.status(404).json({ error: 'Report not found' });
  }
});

// Batch Synchronization for Offline Events with Idempotency
app.post('/api/sync', (req, res) => {
  const { events = [] } = req.body;
  const syncedIds: string[] = [];
  const duplicateIds: string[] = [];
  const syncedItems: any[] = [];

  for (const event of events) {
    // Prevent duplicate processing
    if (processedEventIds.has(event.id)) {
      duplicateIds.push(event.id);
      syncedIds.push(event.id); // Treat duplicate as acknowledged
      continue;
    }

    processedEventIds.add(event.id);

    // Apply event according to type
    if (event.type === 'decision') {
      const p = event.payload;
      const deliveredReportIds = currentSession.reports
        .filter((r) => r.deliveryStatus === 'delivered' || r.deliveryStatus === 'acknowledged')
        .map((r) => r.id);

      const check = validateDecisionRestrictions({
        decisionId: p.id || event.id,
        actionText: p.action,
        rationaleText: p.rationale,
        targetLocation: p.targetLocation,
        domain: p.domain || 'land',
        selectedReportIds: p.supportingReportIds || [],
        activeRestrictions: currentSession.restrictions,
        currentConditions: currentSession.conditions,
        deliveredReports: currentSession.reports.filter((r) => deliveredReportIds.includes(r.id)),
      });

      const dec: TraineeDecision = {
        id: p.id || event.id,
        timestamp: p.timestamp || new Date().toLocaleTimeString(),
        action: p.action,
        rationale: p.rationale,
        supportingReportIds: p.supportingReportIds || [],
        confidence: p.confidence || 'medium',
        targetLocation: p.targetLocation,
        domain: p.domain || 'land',
        syncStatus: 'synced',
        availableReportsAtDecision: deliveredReportIds,
        revisionNumber: 1,
        conflictAlerts: check.alerts,
      };

      currentSession.decisions.unshift(dec);
      if (check.hasConflicts) {
        for (const a of check.alerts) currentSession.alerts.unshift(a);
      }

      currentSession.timeline.unshift({
        id: `EVT-SYNC-DEC-${event.id}`,
        timestamp: new Date().toLocaleTimeString(),
        simSecond: currentSession.currentSimSecond,
        type: 'decision_submitted',
        actor: 'trainee',
        summary: `[SYNCED FROM OFFLINE] Trainee decision: "${dec.action.slice(0, 50)}"`,
      });
    } else if (event.type === 'task_update') {
      const p = event.payload;
      const task = currentSession.tasks.find((t) => t.id === p.taskId);
      if (task) {
        if (p.status) task.status = p.status;
        if (p.progressPercent !== undefined) task.progressPercent = p.progressPercent;
        if (p.observation) task.lastObservation = p.observation;
      }
    } else if (event.type === 'report_ack') {
      const p = event.payload;
      const rep = currentSession.reports.find((r) => r.id === p.reportId);
      if (rep) {
        rep.acknowledgedByTrainee = true;
        rep.acknowledgedAt = p.timestamp || new Date().toLocaleTimeString();
      }
    }

    syncedIds.push(event.id);
    syncedItems.push(event);
  }

  // Recalculate evaluation after syncing
  currentSession.evaluation = evaluateSessionPerformance(
    currentSession.decisions,
    currentSession.reports,
    currentSession.alerts,
    currentSession.tasks,
    currentSession.evaluation.instructorScoreOverride,
    currentSession.instructorNotes
  );

  currentSession.timeline.unshift({
    id: `EVT-SYNC-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    simSecond: currentSession.currentSimSecond,
    type: 'connection_changed',
    actor: 'network',
    summary: `Restored connection: Synchronized ${syncedIds.length - duplicateIds.length} offline event(s) (${duplicateIds.length} duplicate(s) rejected).`,
  });

  res.json({
    success: true,
    syncedCount: syncedIds.length,
    duplicateCount: duplicateIds.length,
    syncedIds,
    duplicateIds,
    session: currentSession,
  });
});

// AI Assistance: Grounded After-Action Review Summary & Reflection Generator
app.post('/api/ai/aar-summary', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  const decisionsCount = currentSession.decisions.length;
  const alertsCount = currentSession.alerts.length;
  const criticalViolations = currentSession.alerts.filter((a) => a.severity === 'critical').length;
  const overallScore = currentSession.evaluation.overallScore;

  // Build context from actual session records
  const sessionLog = `
Scenario: ${currentSession.scenarioTitle}
Difficulty: ${currentSession.difficulty}
Decisions Made: ${decisionsCount}
Critical Alerts: ${criticalViolations}
Overall Rubric Score: ${overallScore}/100
Decisions List:
${currentSession.decisions
  .map(
    (d, i) =>
      `${i + 1}. [${d.domain.toUpperCase()}] Action: "${d.action}" | Rationale: "${d.rationale}" | Confidence: ${d.confidence} | Alerts: ${d.conflictAlerts.map((a) => a.ruleTitle).join(', ') || 'None'}`
  )
  .join('\n')}
Alerts List:
${currentSession.alerts.map((a) => `- [${a.severity}] ${a.ruleTitle}: ${a.reason} (Status: ${a.status})`).join('\n') || 'None'}
`;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are an expert military training evaluator conducting an After-Action Review (AAR) for a trainee who made decisions under electronic warfare jamming and contradictory intelligence in a fictional training simulation.
Ground your evaluation strictly on the session log below. Do NOT hallucinate rules or unmentioned actions.

Session Log:
${sessionLog}

Generate a concise, professional debrief containing:
1. Executive Performance Assessment (3-4 sentences summarizing how well the trainee handled information delays, contradictory reports, and restrictions).
2. Key Tactical Strengths Demonstrated.
3. High-Priority Learning Areas (focusing on restriction compliance and response to incomplete intel).
4. Three Socratic Reflection Questions for the trainee.`,
      });

      const text = response.text || '';
      currentSession.evaluation.aiDebriefSummary = text;
      return res.json({ success: true, debrief: text });
    } catch (err: any) {
      console.warn('Gemini API call failed, using deterministic fallback', err?.message);
    }
  }

  // Deterministic grounded fallback
  const fallbackDebrief = `EXECUTIVE PERFORMANCE DEBRIEF (Grounded in Recorded Events):
The trainee executed ${decisionsCount} tactical decision(s) across Land, Air, and EW domains under simulated communication friction. 
${
  criticalViolations > 0
    ? `The trainee triggered ${criticalViolations} critical restriction warning(s) (including Bridge Load Limits / Hospital RoE), highlighting the need for stricter pre-commitment verification in sensor-degraded zones.`
    : 'The trainee maintained commendable adherence to scenario restrictions and avoided catastrophic violations of Hospital RoE and Bridge Load Limits.'
}

KEY DEMONSTRATED STRENGTHS:
- Articulated written reasoning and confidence ratings for primary logistical maneuvers.
- Successfully operated and recorded decisions despite communication delay and simulated offline conditions.
${currentSession.decisions.some((d) => d.revisionNumber > 1) ? '- Displayed operational adaptability by revising initial plans upon receiving updated ground reconnaissance.' : '- Maintained steady operational focus on primary supply corridor objectives.'}

AREAS FOR REFLECTION & IMPROVEMENT:
- Cross-examination of conflicting aerial (Falcon-4) versus ground combat engineer reports before vehicle weight commitment.
- Strict cyber air-gap isolation protocols when encountering erratic SCADA frequencies at Substation Delta.
- Proactive radio emission discipline (EMCON Alpha) to counter hostile SIGINT triangulation along Ridge 12.`;

  currentSession.evaluation.aiDebriefSummary = fallbackDebrief;
  res.json({ success: true, debrief: fallbackDebrief });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================================`);
    console.log(`Tactical Decision Simulator (SIH26248)`);
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`========================================================\n`);
  });
}

startServer();
