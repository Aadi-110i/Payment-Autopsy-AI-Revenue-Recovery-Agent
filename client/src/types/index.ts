export type FailureCategory =
  | 'temporary_gateway_issue'
  | 'bank_timeout'
  | 'network_issue'
  | 'authentication_failure'
  | 'insufficient_balance'
  | 'expired_card'
  | 'invalid_payment_method'
  | 'customer_abandonment'
  | 'repeated_failure'
  | 'unknown'
  | 'suspected_fraud';

export type RecoveryActionType =
  | 'RETRY_PAYMENT'
  | 'SEND_PAYMENT_LINK'
  | 'SEND_RECOVERY_NOTIFICATION'
  | 'SCHEDULE_RETRY'
  | 'REQUEST_ALTERNATIVE_PAYMENT_METHOD'
  | 'ESCALATE_TO_HUMAN'
  | 'STOP_RECOVERY';

export type RecoveryCaseStatus =
  | 'NEW'
  | 'AUTOPSY'
  | 'RECOVERY_READY'
  | 'ACTION_SCHEDULED'
  | 'RECOVERED'
  | 'ESCALATED'
  | 'STOPPED'
  | 'AWAITING_APPROVAL';

export interface RecoveryCase {
  id: string;
  merchantId: string;
  paymentId: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  failureCode: string;
  failureCategory?: FailureCategory;
  status: RecoveryCaseStatus;
  retryCount: number;
  maxRetries: number;
  recoverabilityScore?: number;
  requiresApproval: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  recoveredAmount?: number;
  customer?: {
    id: string;
    email: string;
    lifetimeValue: number;
  };
  autopsyResult?: AutopsyResult;
  policyDecision?: PolicyDecision;
  actions?: RecoveryAction[];
}

export interface AutopsyResult {
  id: string;
  caseId: string;
  failureCategory: FailureCategory;
  rootCauseHypothesis: string;
  confidence: number;
  evidence: string[];
  evidenceType: 'direct' | 'inferred';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverability: 'high' | 'medium' | 'low' | 'none';
  recommendedNextStep: RecoveryActionType;
  explanation: string;
  supportingTransactionHistory?: TransactionSummary[];
  createdAt: string;
}

export interface TransactionSummary {
  paymentId: string;
  amount: number;
  status: 'success' | 'failed';
  timestamp: string;
  failureCategory?: FailureCategory;
  paymentMethod: string;
}

export interface PolicyDecision {
  id: string;
  caseId: string;
  allowed: boolean;
  action: RecoveryActionType;
  reason: string;
  policyRulesApplied: string[];
  requiresApproval: boolean;
  approvalReason?: string;
  stopConditions: string[];
  cooldownUntil?: string;
  createdAt: string;
}

export interface RecoveryAction {
  id: string;
  caseId: string;
  type: RecoveryActionType;
  payload: Record<string, unknown>;
  reason: string;
  scheduledAt?: string;
  executedAt?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  result?: RecoveryActionResult;
  idempotencyKey: string;
  createdAt: string;
}

export interface RecoveryActionResult {
  success: boolean;
  externalId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardMetrics {
  revenueAtRisk: number;
  recoverableRevenue: number;
  recoveredRevenue: number;
  recoveryRate: number;
  recoveryROI: number;
  unnecessaryRetryRate: number;
  falseInterventionRate: number;
  avgTimeToRecovery: number;
  revenuePer1000Failures: number;
  actionsTaken: number;
  casesEscalated: number;
  casesStopped: number;
  estimatedContactCost: number;
  netRecoveredValue: number;
  byCategory: CategoryMetrics[];
  byPaymentMethod: PaymentMethodMetrics[];
  overTime: TimeSeriesMetrics[];
  recentCases: RecentCase[];
  aiInsights: AIInsight[];
  activeIncidents: MerchantIncident[];
}

export interface CategoryMetrics {
  category: FailureCategory;
  count: number;
  totalAmount: number;
  recoveredAmount: number;
  recoveryRate: number;
  avgRecoverability: number;
}

export interface PaymentMethodMetrics {
  method: string;
  failureRate: number;
  totalAttempts: number;
  recoveredCount: number;
}

export interface TimeSeriesMetrics {
  timestamp: string;
  failures: number;
  recovered: number;
  revenueAtRisk: number;
}

export interface RecentCase {
  id: string;
  paymentId: string;
  amount: number;
  failureCategory?: FailureCategory;
  recoverabilityScore?: number;
  status: RecoveryCaseStatus;
  createdAt: string;
}

export interface AIInsight {
  id: string;
  type: 'anomaly' | 'pattern' | 'recommendation' | 'alert';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  data: Record<string, unknown>;
  createdAt: string;
  actionable: boolean;
  suggestedAction?: RecoveryActionType;
}

export interface MerchantIncident {
  id: string;
  merchantId: string;
  type: 'degradation' | 'outage' | 'anomaly';
  paymentMethod: string;
  normalFailureRate: number;
  currentFailureRate: number;
  affectedPayments: number;
  estimatedRevenueAtRisk: number;
  potentialCause: string;
  detectedAt: string;
  resolvedAt?: string;
  status: 'active' | 'mitigating' | 'resolved';
  recommendedActions: RecoveryActionType[];
}

export interface AuditEvent {
  id: string;
  caseId: string;
  timestamp: string;
  actor: 'system' | 'agent' | 'human' | 'webhook' | 'scheduler';
  action: string;
  inputContext: Record<string, unknown>;
  decision: Record<string, unknown>;
  evidence?: string[];
  policyUsed?: string;
  outcome?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SimulationResult {
  totalPayments: number;
  totalFailedValue: number;
  baselineRecovered: number;
  aiRecovered: number;
  improvement: number;
  baselineMetrics: BaselineMetrics;
  aiMetrics: BaselineMetrics;
  cases: SimulatedCase[];
}

export interface BaselineMetrics {
  recovered: number;
  recoveryRate: number;
  attempts: number;
  unnecessaryRetries: number;
  notificationsSent: number;
  avgTimeToRecovery: number;
}

export interface SimulatedCase {
  paymentId: string;
  amount: number;
  failureCategory: FailureCategory;
  recoverabilityScore: number;
  baselineAction: RecoveryActionType;
  aiAction: RecoveryActionType;
  baselineOutcome: 'recovered' | 'failed' | 'escalated' | 'stopped';
  aiOutcome: 'recovered' | 'failed' | 'escalated' | 'stopped';
  baselineRecoveredAmount: number;
  aiRecoveredAmount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}