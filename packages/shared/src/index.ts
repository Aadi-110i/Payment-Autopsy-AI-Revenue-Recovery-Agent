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

export type AuditActor = 'system' | 'agent' | 'human' | 'webhook' | 'scheduler';

export interface AutopsyResult {
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
}

export interface TransactionSummary {
  paymentId: string;
  amount: number;
  status: 'success' | 'failed';
  timestamp: string;
  failureCategory?: FailureCategory;
  paymentMethod: string;
}

export interface RecoverabilityScore {
  score: number;
  factors: RecoverabilityFactor[];
  explanation: string;
  baselineComparison: number;
}

export interface RecoverabilityFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface PolicyDecision {
  allowed: boolean;
  action: RecoveryActionType;
  reason: string;
  policyRulesApplied: string[];
  requiresApproval: boolean;
  approvalReason?: string;
  stopConditions: string[];
  cooldownUntil?: string;
}

export interface RecoveryAction {
  type: RecoveryActionType;
  payload: Record<string, unknown>;
  reason: string;
  scheduledAt?: string;
  executedAt?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  result?: RecoveryActionResult;
  idempotencyKey: string;
}

export interface RecoveryActionResult {
  success: boolean;
  externalId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

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
  autopsyResult?: AutopsyResult;
  policyDecision?: PolicyDecision;
  actions: RecoveryAction[];
  auditTrail: AuditEvent[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  recoveredAmount?: number;
  requiresApproval: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvalRequestedAt?: string;
  approvalResolvedAt?: string;
  approvedBy?: string;
}

export interface AuditEvent {
  id: string;
  caseId: string;
  timestamp: string;
  actor: AuditActor;
  action: string;
  inputContext: Record<string, unknown>;
  decision: Record<string, unknown>;
  evidence?: string[];
  policyUsed?: string;
  outcome?: Record<string, unknown>;
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

export interface SeedPayment {
  paymentId: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  failureCode: string;
  status: 'failed' | 'success';
  timestamp: string;
  retryCount: number;
  customerLifetimeValue: number;
  previousSuccessRate: number;
  merchantId: string;
  deviceType: string;
  geography: string;
  checkoutSessionId: string;
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface WebhookPayload {
  event: string;
  payload: {
    payment: {
      id: string;
      order_id: string;
      amount: number;
      currency: string;
      method: string;
      status: string;
      error_code?: string;
      error_description?: string;
      customer_id?: string;
      email?: string;
      contact?: string;
      created_at: number;
    };
  };
}