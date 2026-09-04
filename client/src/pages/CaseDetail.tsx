import { useRecoveryCase, useAuditTrail, useApproveCase, useRetryCase, useStopCase } from '../hooks';
import { Layout, PageHeader, SectionHeader, Card, CardHeader } from '../components';
import { AuditTimeline } from '../components/AuditTimeline';
import { ArrowLeft, Zap, Brain, Shield, Clock, CheckCircle, XCircle, AlertTriangle, Info, User, Bot, Database, Zap as ZapIcon, Shield as ShieldIcon, ExternalLink, Download, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { cn, formatCurrency, formatRelativeTime, formatPercentage } from '../utils/cn';
import { StatusBadge, FailureCategoryBadge, ActionBadge, ConfidenceBadge, RecoverabilityBadge, SeverityBadge } from '../components/Badges';
import type { RecoveryCase, AutopsyResult, PolicyDecision, RecoveryAction, AuditEvent } from '../types';
import { useState } from 'react';

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: caseData, isLoading, error, refetch } = useRecoveryCase(id!, true);
  const { data: auditEvents } = useAuditTrail(id!, true);
  const approveCase = useApproveCase();
  const retryCase = useRetryCase();
  const stopCase = useStopCase();
  const [activeTab, setActiveTab] = useState<'overview' | 'autopsy' | 'policy' | 'actions' | 'audit'>('overview');

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto space-y-6">
          <PageHeader title="Loading..." subtitle="Fetching case details" />
          <div className="card animate-pulse space-y-6 p-6">
            <div className="h-8 bg-autopsy-border/50 rounded w-1/4" />
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-autopsy-border/50 rounded" />)}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !caseData) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto">
          <PageHeader title="Case Not Found" subtitle="The requested recovery case does not exist" />
          <Link to="/cases" className="btn-primary"><ArrowLeft className="w-4 h-4" /> Back to Cases</Link>
        </div>
      </Layout>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'autopsy', label: 'Autopsy', icon: Brain },
    { id: 'policy', label: 'Policy', icon: Shield },
    { id: 'actions', label: 'Actions', icon: Zap },
    { id: 'audit', label: 'Audit Trail', icon: Database }
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link to="/cases" className="inline-flex items-center gap-2 text-autopsy-text-muted hover:text-autopsy-text mb-4">
              <ArrowLeft className="w-4 h-4" /> Back to Cases
            </Link>
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-2xl font-bold text-autopsy-text">Case {caseData.id.slice(0, 8)}</h1>
              <StatusBadge status={caseData.status} />
              {caseData.failureCategory && <FailureCategoryBadge category={caseData.failureCategory} />}
              {caseData.recoverabilityScore !== undefined && <RecoverabilityBadge score={caseData.recoverabilityScore} />}
            </div>
            <p className="text-autopsy-text-muted mt-2">Payment: <code className="font-mono text-autopsy-text">{caseData.paymentId}</code></p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="md">
            <p className="text-sm text-autopsy-text-muted">Amount</p>
            <p className="text-2xl font-bold text-autopsy-text tabular-nums">{formatCurrency(caseData.amount)}</p>
          </Card>
          <Card padding="md">
            <p className="text-sm text-autopsy-text-muted">Retry Count</p>
            <p className="text-2xl font-bold text-autopsy-text tabular-nums">{caseData.retryCount} / {caseData.maxRetries}</p>
          </Card>
          <Card padding="md">
            <p className="text-sm text-autopsy-text-muted">Payment Method</p>
            <p className="text-2xl font-bold text-autopsy-text capitalize">{caseData.paymentMethod}</p>
          </Card>
          <Card padding="md">
            <p className="text-sm text-autopsy-text-muted">Created</p>
            <p className="text-2xl font-bold text-autopsy-text">{formatRelativeTime(caseData.createdAt)}</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="card overflow-hidden">
          <div className="border-b border-autopsy-border">
            <nav className="flex overflow-x-auto" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`${tab.id}-panel`}
                  id={`${tab.id}-tab`}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all duration-150 whitespace-nowrap',
                    activeTab === tab.id
                      ? 'border-autopsy-accent text-autopsy-accent'
                      : 'border-transparent text-autopsy-text-muted hover:text-autopsy-text'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6" role="tabpanel">
            {activeTab === 'overview' && <OverviewTab caseData={caseData} />}
            {activeTab === 'autopsy' && <AutopsyTab caseData={caseData} />}
            {activeTab === 'policy' && <PolicyTab caseData={caseData} />}
            {activeTab === 'actions' && <ActionsTab caseData={caseData} 
              onRetry={() => retryCase.mutateAsync(caseData.id).then(refetch)} 
              onStop={() => stopCase.mutateAsync(caseData.id).then(refetch)}
              onApprove={(approved) => approveCase.mutateAsync({ caseId: caseData.id!, approved }).then(refetch)}
            />}
            {activeTab === 'audit' && <AuditTab events={auditEvents || []} />}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function OverviewTab({ caseData }: { caseData: RecoveryCase }) {
  return (
    <div className="space-y-6">
      {/* Why This Failed */}
      <Card>
        <CardHeader title="Why This Failed" />
        <div className="space-y-4">
          {caseData.autopsyResult && (
            <>
              <div className="p-4 bg-autopsy-bg rounded-lg border border-autopsy-border">
                <p className="text-autopsy-text">{caseData.autopsyResult.explanation}</p>
              </div>
              <div>
                <h4 className="font-medium text-autopsy-text-muted mb-2">Evidence</h4>
                <ul className="space-y-2">
                  {caseData.autopsyResult.evidence.map((evidence, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-autopsy-text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-autopsy-border flex-shrink-0 mt-1.5" />
                      <span>{evidence}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-3">
                <ConfidenceBadge confidence={caseData.autopsyResult.confidence} />
                <SeverityBadge severity={caseData.autopsyResult.severity} />
              </div>
            </>
          )}

          {/* Customer History */}
          <div className="pt-4 border-t border-autopsy-border">
            <h4 className="font-medium text-autopsy-text-muted mb-3">Customer History</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricItem label="Lifetime Value" value={formatCurrency(caseData.customer?.lifetimeValue || 0)} />
              <MetricItem label="Successful Payments" value={caseData.customer?.successfulPayments || 0} />
              <MetricItem label="Total Payments" value={caseData.customer?.totalPayments || 0} />
              <MetricItem label="Success Rate" value={caseData.customer && caseData.customer.totalPayments > 0 
                ? formatPercentage((caseData.customer.successfulPayments / caseData.customer.totalPayments) * 100) 
                : 'N/A'} />
            </div>
          </div>
        </div>
      </Card>

      {/* Recommended Action */}
      {caseData.policyDecision && (
        <Card>
          <CardHeader title="Recommended Action" />
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-autopsy-bg rounded-lg border border-autopsy-border">
              <ActionBadge action={caseData.policyDecision.action} />
              <div>
                <p className="font-medium text-autopsy-text">{caseData.policyDecision.reason}</p>
                <p className="text-sm text-autopsy-text-muted">Policy rules: {caseData.policyDecision.policyRulesApplied.join(', ') || 'None'}</p>
              </div>
            </div>
            {caseData.policyDecision.requiresApproval && (
              <div className="p-4 bg-autopsy-warning/5 border border-autopsy-warning/30 rounded-lg">
                <div className="flex items-center gap-2 text-autopsy-warning mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Requires Human Approval</span>
                </div>
                <p className="text-sm text-autopsy-text-muted">{caseData.policyDecision.approvalReason}</p>
              </div>
            )}
            {caseData.policyDecision.stopConditions.length > 0 && (
              <div>
                <h4 className="font-medium text-autopsy-text-muted mb-2">Stop Conditions</h4>
                <ul className="space-y-1">
                  {caseData.policyDecision.stopConditions.map((condition, i) => (
                    <li key={i} className="text-sm text-autopsy-error flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      {condition}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Recovery Outcome */}
      {caseData.status === 'RECOVERED' && (
        <Card className="border-autopsy-success/30">
          <CardHeader title="Recovery Successful" action={
            <span className="badge-success">₹{formatCurrency(caseData.recoveredAmount || caseData.amount)} recovered</span>
          } />
          <p className="text-autopsy-text">Payment recovered on {caseData.completedAt ? formatRelativeTime(caseData.completedAt) : 'unknown date'}</p>
        </Card>
      )}

      {caseData.status === 'STOPPED' && (
        <Card className="border-autopsy-error/30">
          <CardHeader title="Recovery Stopped" action={
            <span className="badge-error">Stopped</span>
          } />
          <p className="text-autopsy-text">Autonomous recovery was stopped per policy.</p>
        </Card>
      )}
    </div>
  );
}

function AutopsyTab({ caseData }: { caseData: RecoveryCase }) {
  if (!caseData.autopsyResult) {
    return (
      <div className="text-center py-12">
        <Brain className="w-12 h-12 text-autopsy-text-muted mx-auto mb-4" />
        <p className="text-autopsy-text-muted">No autopsy performed yet</p>
      </div>
    );
  }

  const autopsy = caseData.autopsyResult;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Failure Diagnosis" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-autopsy-text-muted">Failure Category</p>
              <FailureCategoryBadge category={autopsy.failureCategory} />
            </div>
            <div>
              <p className="text-sm text-autopsy-text-muted">Root Cause Hypothesis</p>
              <p className="text-autopsy-text font-mono text-sm">{autopsy.rootCauseHypothesis}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-autopsy-text-muted">Explanation</p>
            <p className="text-autopsy-text">{autopsy.explanation}</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <ConfidenceBadge confidence={autopsy.confidence} />
            <SeverityBadge severity={autopsy.severity} />
            <span className="badge">Evidence: {autopsy.evidenceType}</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Evidence" />
        <ul className="space-y-2">
          {autopsy.evidence.map((evidence, i) => (
            <li key={i} className="flex items-start gap-3 p-3 bg-autopsy-bg rounded-lg border border-autopsy-border">
              <span className="w-1.5 h-1.5 rounded-full bg-autopsy-accent flex-shrink-0 mt-1.5" />
              <span className="text-autopsy-text">{evidence}</span>
            </li>
          ))}
        </ul>
      </Card>

      {autopsy.supportingTransactionHistory && autopsy.supportingTransactionHistory.length > 0 && (
        <Card>
          <CardHeader title="Supporting Transaction History" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-autopsy-border">
                  <th className="text-left p-3 text-autopsy-text-muted">Payment ID</th>
                  <th className="text-left p-3 text-autopsy-text-muted">Amount</th>
                  <th className="text-left p-3 text-autopsy-text-muted">Status</th>
                  <th className="text-left p-3 text-autopsy-text-muted">Method</th>
                  <th className="text-left p-3 text-autopsy-text-muted">Time</th>
                </tr>
              </thead>
              <tbody>
                {autopsy.supportingTransactionHistory.map((tx, i) => (
                  <tr key={i} className="border-b border-autopsy-border/50">
                    <td className="p-3 font-mono text-xs">{tx.paymentId}</td>
                    <td className="p-3">{formatCurrency(tx.amount)}</td>
                    <td className="p-3">
                      <span className={cn('badge', tx.status === 'success' ? 'badge-success' : 'badge-error')}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-3">{tx.paymentMethod}</td>
                    <td className="p-3 text-autopsy-text-muted">{formatRelativeTime(tx.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function PolicyTab({ caseData }: { caseData: RecoveryCase }) {
  if (!caseData.policyDecision) {
    return (
      <div className="text-center py-12">
        <ShieldIcon className="w-12 h-12 text-autopsy-text-muted mx-auto mb-4" />
        <p className="text-autopsy-text-muted">No policy evaluation performed yet</p>
      </div>
    );
  }

  const policy = caseData.policyDecision;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Policy Decision" action={
          policy.allowed ? <span className="badge-success">Allowed</span> : <span className="badge-error">Denied</span>
        } />
        <div className="space-y-4">
          <div className="p-4 bg-autopsy-bg rounded-lg border border-autopsy-border">
            <p className="font-medium text-autopsy-text">{policy.reason}</p>
            <p className="text-sm text-autopsy-text-muted mt-1">Action: <ActionBadge action={policy.action} /></p>
          </div>
          
          <div>
            <h4 className="font-medium text-autopsy-text-muted mb-2">Applied Policy Rules</h4>
            <ul className="space-y-1">
              {policy.policyRulesApplied.map((rule, i) => (
                <li key={i} className="text-sm text-autopsy-text flex items-center gap-2">
                  <ShieldIcon className="w-4 h-4 text-autopsy-accent" />
                  {rule}
                </li>
              ))}
              {policy.policyRulesApplied.length === 0 && (
                <li className="text-sm text-autopsy-text-muted">No specific rules applied</li>
              )}
            </ul>
          </div>

          {policy.requiresApproval && (
            <div className="p-4 bg-autopsy-warning/5 border border-autopsy-warning/30 rounded-lg">
              <div className="flex items-center gap-2 text-autopsy-warning mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Requires Human Approval</span>
              </div>
              <p className="text-sm text-autopsy-text-muted">{policy.approvalReason}</p>
            </div>
          )}

          {policy.stopConditions.length > 0 && (
            <div>
              <h4 className="font-medium text-autopsy-text-muted mb-2">Stop Conditions</h4>
              <ul className="space-y-1">
                {policy.stopConditions.map((condition, i) => (
                  <li key={i} className="text-sm text-autopsy-error flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {condition}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {policy.cooldownUntil && (
            <div className="p-4 bg-autopsy-info/5 border border-autopsy-info/30 rounded-lg">
              <div className="flex items-center gap-2 text-autopsy-info mb-1">
                <Clock className="w-5 h-5" />
                <span className="font-medium">Cooldown Until</span>
              </div>
              <p className="text-sm text-autopsy-text-muted">{new Date(policy.cooldownUntil).toLocaleString()}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function ActionsTab({ caseData, onRetry, onStop, onApprove }: { 
  caseData: RecoveryCase;
  onRetry: () => Promise<void>;
  onStop: () => Promise<void>;
  onApprove: (approved: boolean) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      {/* Executed Actions */}
      <Card>
        <CardHeader title="Executed Actions" />
        {caseData.actions && caseData.actions.length > 0 ? (
          <div className="space-y-3">
            {caseData.actions.map((action) => (
              <ActionRow key={action.id} action={action} />
            ))}
          </div>
        ) : (
          <p className="text-autopsy-text-muted text-center py-8">No actions executed yet</p>
        )}
      </Card>

      {/* Available Actions */}
      <Card>
        <CardHeader title="Available Actions" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button 
            onClick={onRetry}
            disabled={retryCase.isPending || caseData.status === 'RECOVERED' || caseData.status === 'STOPPED'}
            className="btn-secondary w-full justify-start"
          >
            <ZapIcon className="w-4 h-4" /> Retry Payment
          </button>
          <button 
            onClick={onStop}
            disabled={stopCase.isPending || caseData.status === 'STOPPED'}
            className="btn-danger w-full justify-start"
          >
            <XCircle className="w-4 h-4" /> Stop Recovery
          </button>
          {caseData.policyDecision?.requiresApproval && caseData.approvalStatus === 'pending' && (
            <>
              <button 
                onClick={() => onApprove(true)}
                disabled={approveCase.isPending}
                className="btn-primary w-full justify-start"
              >
                <CheckCircle className="w-4 h-4" /> Approve Recovery
              </button>
              <button 
                onClick={() => onApprove(false)}
                disabled={approveCase.isPending}
                className="btn-danger w-full justify-start"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function ActionRow({ action }: { action: RecoveryAction }) {
  const statusIcons = {
    pending: <Clock className="w-4 h-4 text-autopsy-warning" />,
    executing: <ZapIcon className="w-4 h-4 text-autopsy-accent animate-spin" />,
    completed: <CheckCircle className="w-4 h-4 text-autopsy-success" />,
    failed: <XCircle className="w-4 h-4 text-autopsy-error" />,
    cancelled: <XCircle className="w-4 h-4 text-autopsy-text-muted" />
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-autopsy-bg rounded-lg border border-autopsy-border">
      <div className="flex-shrink-0">{statusIcons[action.status]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <ActionBadge action={action.type} />
          <span className="text-sm text-autopsy-text-muted">{action.reason}</span>
        </div>
        <div className="text-xs text-autopsy-text-muted mt-1">
          {action.executedAt ? `Executed: ${formatRelativeTime(action.executedAt)}` : action.scheduledAt ? `Scheduled: ${formatRelativeTime(action.scheduledAt)}` : 'Pending'}
        </div>
      </div>
      {action.result && (
        <div className="flex items-center gap-2 text-sm">
          {action.result.success ? (
            <span className="text-autopsy-success">Success</span>
          ) : (
            <span className="text-autopsy-error">Failed: {action.result.error}</span>
          )}
        </div>
      )}
    </div>
  );
}

function AuditTab({ events }: { events: AuditEvent[] }) {
  return (
    <div className="card p-0">
      <AuditTimeline events={events} />
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-autopsy-bg rounded-lg border border-autopsy-border">
      <p className="text-xs text-autopsy-text-muted">{label}</p>
      <p className="text-lg font-bold text-autopsy-text tabular-nums">{value}</p>
    </div>
  );
}

// Import hooks
import { useApproveCase, useRetryCase, useStopCase } from '../hooks/useMutations';