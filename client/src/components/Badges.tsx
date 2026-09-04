import { cn } from '../utils/cn';
import type { RecoveryCaseStatus, FailureCategory, RecoveryActionType } from '../types';

export function StatusBadge({ status }: { status: RecoveryCaseStatus }) {
  const statusConfig: Record<RecoveryCaseStatus, { label: string; className: string; icon?: string }> = {
    NEW: { label: 'New', className: 'badge' },
    AUTOPSY: { label: 'Autopsy', className: 'badge' },
    RECOVERY_READY: { label: 'Ready', className: 'badge-info' },
    ACTION_SCHEDULED: { label: 'Scheduled', className: 'badge-warning' },
    RECOVERED: { label: 'Recovered', className: 'badge-success' },
    ESCALATED: { label: 'Escalated', className: 'badge-info' },
    STOPPED: { label: 'Stopped', className: 'badge-error' },
    AWAITING_APPROVAL: { label: 'Awaiting Approval', className: 'badge-warning' }
  };

  const config = statusConfig[status] || { label: status, className: 'badge' };
  
  return <span className={cn(config.className, 'capitalize')}>{config.label}</span>;
}

export function FailureCategoryBadge({ category }: { category: FailureCategory }) {
  const categoryConfig: Record<FailureCategory, { label: string; className: string }> = {
    temporary_gateway_issue: { label: 'Gateway Issue', className: 'badge-warning' },
    bank_timeout: { label: 'Bank Timeout', className: 'badge-info' },
    network_issue: { label: 'Network Issue', className: 'badge-info' },
    authentication_failure: { label: 'Auth Failure', className: 'badge-error' },
    insufficient_balance: { label: 'Insufficient Balance', className: 'badge-warning' },
    expired_card: { label: 'Expired Card', className: 'badge-error' },
    invalid_payment_method: { label: 'Invalid Method', className: 'badge-error' },
    customer_abandonment: { label: 'Abandonment', className: 'badge' },
    repeated_failure: { label: 'Repeated Failure', className: 'badge-error' },
    suspected_fraud: { label: 'Suspected Fraud', className: 'badge-error' },
    unknown: { label: 'Unknown', className: 'badge' }
  };

  const config = categoryConfig[category] || { label: category, className: 'badge' };
  return <span className={config.className}>{config.label}</span>;
}

export function ActionBadge({ action }: { action: RecoveryActionType }) {
  const actionLabels: Record<RecoveryActionType, string> = {
    RETRY_PAYMENT: 'Retry',
    SEND_PAYMENT_LINK: 'Payment Link',
    SEND_RECOVERY_NOTIFICATION: 'Notification',
    SCHEDULE_RETRY: 'Scheduled Retry',
    REQUEST_ALTERNATIVE_PAYMENT_METHOD: 'Alt. Method',
    ESCALATE_TO_HUMAN: 'Escalate',
    STOP_RECOVERY: 'Stop'
  };

  const actionColors: Record<RecoveryActionType, string> = {
    RETRY_PAYMENT: 'badge-info',
    SEND_PAYMENT_LINK: 'badge-warning',
    SEND_RECOVERY_NOTIFICATION: 'badge-info',
    SCHEDULE_RETRY: 'badge-warning',
    REQUEST_ALTERNATIVE_PAYMENT_METHOD: 'badge-info',
    ESCALATE_TO_HUMAN: 'badge-error',
    STOP_RECOVERY: 'badge-error'
  };

  return (
    <span className={cn(actionColors[action], 'capitalize')}>
      {actionLabels[action] || action}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  let className = 'badge';
  if (percentage >= 90) className = 'badge-success';
  else if (percentage >= 70) className = 'badge-warning';
  else if (percentage >= 50) className = 'badge-info';
  else className = 'badge-error';
  
  return <span className={className}>{percentage}% confidence</span>;
}

export function RecoverabilityBadge({ score }: { score: number }) {
  let className = 'badge';
  let label = 'Low';
  if (score >= 80) { className = 'badge-success'; label = 'High'; }
  else if (score >= 60) { className = 'badge-warning'; label = 'Good'; }
  else if (score >= 40) { className = 'badge-info'; label = 'Medium'; }
  else { className = 'badge-error'; label = 'Low'; }
  
  return <span className={className}>{label} ({score})</span>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { label: string; className: string }> = {
    low: { label: 'Low', className: 'badge' },
    medium: { label: 'Medium', className: 'badge-info' },
    high: { label: 'High', className: 'badge-warning' },
    critical: { label: 'Critical', className: 'badge-error' }
  };
  
  const c = config[severity] || { label: severity, className: 'badge' };
  return <span className={c.className}>{c.label}</span>;
}