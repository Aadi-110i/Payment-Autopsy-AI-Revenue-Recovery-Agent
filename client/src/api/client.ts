const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Dashboard
  getDashboardOverview: () => fetchJson<DashboardMetrics>('/dashboard/overview'),
  
  // Recovery Cases
  getRecoveryCases: (params?: { page?: number; limit?: number; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    return fetchJson<PaginatedResponse<RecoveryCase>>(`/recovery-cases?${searchParams}`);
  },
  
  getRecoveryCase: (id: string) => fetchJson<RecoveryCase>(`/recovery-cases/${id}`),
  
  analyzeCase: (caseId: string) => fetchJson<AgentRunResult>(`/recovery-cases/${caseId}/analyze`, {
    method: 'POST'
  }),
  
  approveCase: (caseId: string, approved: boolean, resolutionNote?: string) => 
    fetchJson<{ success: boolean }>(`/recovery-cases/${caseId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved, resolutionNote })
    }),
  
  retryCase: (caseId: string) => fetchJson<RecoveryActionResult>(`/recovery-cases/${caseId}/retry`, {
    method: 'POST'
  }),
  
  stopCase: (caseId: string) => fetchJson<{ success: boolean }>(`/recovery-cases/${caseId}/stop`, {
    method: 'POST'
  }),
  
  // Metrics
  getMetrics: () => fetchJson<{ baseline: any; ai: any; improvement: number }>('/recovery/metrics'),
  
  // Audit
  getAuditTrail: (caseId: string) => fetchJson<AuditEvent[]>(`/audit/${caseId}`),
  
  // Incidents
  getIncidents: () => fetchJson<MerchantIncident[]>('/incidents'),
  
  // Demo
  seedDatabase: (count?: number) => fetchJson<{ success: boolean; message: string }>('/demo/seed', {
    method: 'POST',
    body: JSON.stringify({ count })
  }),
  
  runSimulation: () => fetchJson<SimulationResult & { baselineRecovered: number; aiRecovered: number }>('/demo/run-simulation', {
    method: 'POST'
  })
};

// Type imports for the API
import type { DashboardMetrics, RecoveryCase, PaginatedResponse, RecoveryActionResult, AgentRunResult, AuditEvent, MerchantIncident, SimulationResult, BaselineMetrics } from '../types';

// Helper function to format currency
export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(amount / 100);
}

// Helper function to format relative time
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Status color mapping
export function getStatusColor(status: RecoveryCaseStatus): string {
  switch (status) {
    case 'RECOVERED': return 'text-autopsy-success';
    case 'ACTION_SCHEDULED':
    case 'RECOVERY_READY': return 'text-autopsy-warning';
    case 'ESCALATED':
    case 'AWAITING_APPROVAL': return 'text-autopsy-info';
    case 'STOPPED': return 'text-autopsy-error';
    case 'AUTOPSY': return 'text-autopsy-text-muted';
    default: return 'text-autopsy-text-muted';
  }
}

export function getStatusBadge(status: RecoveryCaseStatus): string {
  switch (status) {
    case 'RECOVERED': return 'badge-success';
    case 'ACTION_SCHEDULED': return 'badge-warning';
    case 'RECOVERY_READY': return 'badge-info';
    case 'ESCALATED': return 'badge-info';
    case 'AWAITING_APPROVAL': return 'badge-warning';
    case 'STOPPED': return 'badge-error';
    case 'AUTOPSY': return 'badge';
    default: return 'badge';
  }
}

export function getFailureCategoryLabel(category: FailureCategory): string {
  const labels: Record<FailureCategory, string> = {
    'temporary_gateway_issue': 'Temporary Gateway Issue',
    'bank_timeout': 'Bank Timeout',
    'network_issue': 'Network Issue',
    'authentication_failure': 'Authentication Failure',
    'insufficient_balance': 'Insufficient Balance',
    'expired_card': 'Expired Card',
    'invalid_payment_method': 'Invalid Payment Method',
    'customer_abandonment': 'Customer Abandonment',
    'repeated_failure': 'Repeated Failure',
    'suspected_fraud': 'Suspected Fraud',
    'unknown': 'Unknown'
  };
  return labels[category] || category;
}

export function getActionLabel(action: RecoveryActionType): string {
  const labels: Record<RecoveryActionType, string> = {
    'RETRY_PAYMENT': 'Retry Payment',
    'SEND_PAYMENT_LINK': 'Send Payment Link',
    'SEND_RECOVERY_NOTIFICATION': 'Send Notification',
    'SCHEDULE_RETRY': 'Schedule Retry',
    'REQUEST_ALTERNATIVE_PAYMENT_METHOD': 'Request Alt. Method',
    'ESCALATE_TO_HUMAN': 'Escalate to Human',
    'STOP_RECOVERY': 'Stop Recovery'
  };
  return labels[action] || action;
}