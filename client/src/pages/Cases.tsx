import { useRecoveryCases, useAnalyzeCase } from '../hooks';
import { Layout, PageHeader, SectionHeader, RecoveryCasesTable } from '../components';
import { Search, Filter, Funnel, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatRelativeTime } from '../utils/cn';
import { useState } from 'react';
import { StatusBadge, FailureCategoryBadge, RecoverabilityBadge } from '../components/Badges';
import type { RecoveryCase } from '../types';

export function CasesPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data, isLoading, refetch } = useRecoveryCases({ page, limit: 20, status: statusFilter || undefined });
  const analyzeCase = useAnalyzeCase();

  const handleAnalyze = async (caseItem: RecoveryCase) => {
    await analyzeCase.mutateAsync(caseItem.id);
    refetch();
  };

  const statuses = [
    { value: '', label: 'All Statuses' },
    { value: 'NEW', label: 'New' },
    { value: 'AUTOPSY', label: 'Autopsy' },
    { value: 'RECOVERY_READY', label: 'Recovery Ready' },
    { value: 'ACTION_SCHEDULED', label: 'Action Scheduled' },
    { value: 'RECOVERED', label: 'Recovered' },
    { value: 'ESCALATED', label: 'Escalated' },
    { value: 'STOPPED', label: 'Stopped' },
    { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval' }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader 
          title="Recovery Cases" 
          subtitle="Manage and monitor payment recovery cases"
          action={
            <div className="flex items-center gap-2">
              <button onClick={() => refetch()} className="btn-secondary">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
          }
        />

        {/* Filters */}
        <div className="card flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-autopsy-text-muted" />
            <input
              type="text"
              placeholder="Search by payment ID, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-autopsy-text-muted">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="input w-auto"
            >
              {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Cases Table */}
        <SectionHeader 
          title={`Cases (${data?.meta.total || 0})`} 
          subtitle={statusFilter ? `Filtered by: ${statuses.find(s => s.value === statusFilter)?.label}` : 'All recovery cases'}
        />
        
        {isLoading ? (
          <div className="card">
            <div className="space-y-4">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="animate-pulse flex items-center gap-4 px-4 py-3">
                  <div className="w-24 h-6 bg-autopsy-border/50 rounded" />
                  <div className="w-20 h-6 bg-autopsy-border/50 rounded" />
                  <div className="w-24 h-6 bg-autopsy-border/50 rounded" />
                  <div className="w-20 h-6 bg-autopsy-border/50 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <RecoveryCasesTable 
              cases={data?.data || []} 
              onRowClick={(c) => window.location.href = `/cases/${c.id}`} 
            />
            
            {/* Pagination */}
            {data && data.meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-4 text-autopsy-text-muted">
                  Page {page} of {data.meta.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
                  disabled={page === data.meta.totalPages}
                  className="btn-secondary"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}