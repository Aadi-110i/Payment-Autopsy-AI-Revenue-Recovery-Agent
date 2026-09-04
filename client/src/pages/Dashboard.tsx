import { useDashboardOverview, useIncidents } from '../hooks/useDashboard';
import { useRunSimulation, useSeedDatabase } from '../hooks/useMutations';
import { Layout, PageHeader, SectionHeader, MetricGrid, MetricCard, RevenueOverviewCards, OperationalMetricCards } from '../components';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { Zap, AlertTriangle, TrendingUp, RefreshCw, Play, Database, Zap as ZapIcon } from 'lucide-react';
import { cn, formatCurrency, formatNumber, formatPercentage } from '../utils/cn';
import { StatusBadge, FailureCategoryBadge } from '../components/Badges';
import type { DashboardMetrics, AIInsight, MerchantIncident } from '../types';
import { useState } from 'react';

const COLORS = ['#D6A62A', '#1565C0', '#2E7D32', '#C62828', '#8A8A8A'];

export function DashboardPage() {
  const { data: dashboard, isLoading, error, refetch } = useDashboardOverview();
  const { data: incidents } = useIncidents();
  const runSimulation = useRunSimulation();
  const seedDatabase = useSeedDatabase();
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const handleRunSimulation = async () => {
    try {
      const result = await runSimulation.mutateAsync();
      setSimulationResult(result);
    } catch (error) {
      console.error('Simulation failed:', error);
    }
  };

  const handleSeed = async () => {
    await seedDatabase.mutateAsync(10000);
    refetch();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <PageHeader title="Dashboard" subtitle="Loading metrics..." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="metric-card animate-pulse">
                <div className="h-4 bg-autopsy-border/50 rounded w-3/4 mb-2" />
                <div className="h-8 bg-autopsy-border/50 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader 
          title="Dashboard" 
          subtitle="Real-time revenue recovery overview"
          action={
            <div className="flex items-center gap-2">
              <button 
                onClick={() => refetch()}
                disabled={runSimulation.isPending}
                className="btn-secondary"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <button 
                onClick={handleRunSimulation}
                disabled={runSimulation.isPending}
                className="btn-primary"
              >
                <Play className="w-4 h-4" /> 
                {runSimulation.isPending ? 'Running...' : 'Run Simulation'}
              </button>
            </div>
          }
        </PageHeader>

        {/* Revenue Overview */}
        <SectionHeader title="Revenue Overview" subtitle="Key recovery metrics at a glance" />
        <RevenueOverviewCards data={dashboard!} />
        
        {/* Operational Metrics */}
        <SectionHeader title="Operational Metrics" subtitle="Recovery efficiency indicators" />
        <OperationalMetricCards data={dashboard!} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Failure Categories */}
          <div className="card">
            <SectionHeader title="Failure Categories" subtitle="Distribution of failure types" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard!.byCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" />
                  <XAxis type="number" tick={{ fill: '#8A8A8A', fontSize: 12 }} axisLine={{ stroke: '#1E1E1E' }} />
                  <YAxis dataKey="category" type="category" tick={{ fill: '#F5F5F0', fontSize: 12 }} axisLine={false} width={140} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid #1E1E1E', borderRadius: '8px' }}
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                  />
                  <Bar dataKey="count" fill="#D6A62A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recovery Pipeline */}
          <div className="card">
            <SectionHeader title="Recovery Pipeline" subtitle="Cases by status" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { status: 'New', count: 0 },
                  { status: 'Autopsy', count: 0 },
                  { status: 'Ready', count: dashboard!.recentCases.filter(c => c.status === 'RECOVERY_READY').length },
                  { status: 'Scheduled', count: dashboard!.recentCases.filter(c => c.status === 'ACTION_SCHEDULED').length },
                  { status: 'Recovered', count: dashboard!.recentCases.filter(c => c.status === 'RECOVERED').length },
                  { status: 'Escalated', count: dashboard!.recentCases.filter(c => c.status === 'ESCALATED').length },
                  { status: 'Stopped', count: dashboard!.recentCases.filter(c => c.status === 'STOPPED').length }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" />
                  <XAxis dataKey="status" tick={{ fill: '#8A8A8A', fontSize: 12 }} axisLine={{ stroke: '#1E1E1E' }} />
                  <YAxis tick={{ fill: '#F5F5F0', fontSize: 12 }} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#111111', border: '1px solid #1E1E1E', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#D6A62A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Time Series & Payment Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Failures Over Time */}
          <div className="card">
            <SectionHeader title="Failures Over Time" subtitle="Last 24 hours" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard!.overTime}>
                  <defs>
                    <linearGradient id="failures-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D6A62A" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D6A62A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" />
                  <XAxis 
                    dataKey="timestamp" 
                    tick={{ fill: '#8A8A8A', fontSize: 11 }} 
                    axisLine={{ stroke: '#1E1E1E' }}
                    tickFormatter={(value) => new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  />
                  <YAxis tick={{ fill: '#F5F5F0', fontSize: 11 }} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid #1E1E1E', borderRadius: '8px' }}
                    formatter={(value: number, name: string) => [name === 'failures' ? value : formatCurrency(value), name]}
                  />
                  <Area type="monotone" dataKey="failures" stroke="#D6A62A" fillOpacity={1} fill="url(#failures-gradient)" />
                  <Line type="monotone" dataKey="recovered" stroke="#2E7D32" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Method Failure Rate */}
          <div className="card">
            <SectionHeader title="Payment Method Failures" subtitle="Failure distribution by method" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboard!.byPaymentMethod}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="totalAttempts"
                    nameKey="method"
                    label={({ method, totalAttempts, failureRate }) => `${method}: ${failureRate.toFixed(1)}%`}
                    labelLine={false}
                  >
                    {dashboard!.byPaymentMethod.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid #1E1E1E', borderRadius: '8px' }}
                    formatter={(value: number) => [value, 'Attempts']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        {dashboard!.aiInsights.length > 0 && (
          <div className="card">
            <SectionHeader title="AI Insights" subtitle="Automated pattern detection" />
            <div className="space-y-3">
              {dashboard!.aiInsights.map((insight: AIInsight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </div>
        )}

        {/* Active Incidents */}
        {incidents && incidents.length > 0 && (
          <div className="card">
            <SectionHeader title="Active Incidents" subtitle="Merchant-wide degradation detected" />
            <div className="space-y-3">
              {incidents.map((incident: MerchantIncident) => (
                <IncidentCard key={incident.id} incident={incident} />
              ))}
            </div>
          </div>
        )}

        {/* Recent Cases */}
        <div className="card">
          <SectionHeader 
            title="Recent Recovery Cases" 
            subtitle="Latest cases requiring attention"
            action={
              <a href="/cases" className="text-sm text-autopsy-accent hover:underline">View all</a>
            }
          />
          <RecoveryCasesTable cases={dashboard!.recentCases} />
        </div>

        {/* Simulation Results */}
        {simulationResult && (
          <div className="card border-autopsy-success/30 animate-in">
            <SectionHeader 
              title="Simulation Complete" 
              subtitle="AI vs Baseline comparison"
              action={
                <span className={cn('badge-success', simulationResult.improvement > 0 ? '' : 'badge-error')}>
                  {simulationResult.improvement > 0 ? '+' : ''}{simulationResult.improvement.toFixed(1)}% improvement
                </span>
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Baseline Recovered" value={simulationResult.baselineRecovered} format="currency" variant="info" />
              <MetricCard title="AI Recovered" value={simulationResult.aiRecovered} format="currency" variant="success" />
              <MetricCard title="Additional Revenue" value={simulationResult.aiRecovered - simulationResult.baselineRecovered} format="currency" variant="success" />
            </div>
          </div>
        )}

        {/* Demo Actions */}
        <div className="card border-autopsy-accent/30">
          <SectionHeader title="Demo Controls" subtitle="Initialize or reset demo data" />
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleSeed}
              disabled={seedDatabase.isPending}
              className="btn-secondary"
            >
              <Database className="w-4 h-4" /> 
              {seedDatabase.isPending ? 'Seeding...' : 'Seed 10,000 Payments'}
            </button>
            <button 
              onClick={handleRunSimulation}
              disabled={runSimulation.isPending}
              className="btn-primary"
            >
              <ZapIcon className="w-4 h-4" /> 
              {runSimulation.isPending ? 'Running Simulation...' : 'Run AI Simulation'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const severityColors = {
    info: 'border-autopsy-info/30 bg-autopsy-info/5',
    warning: 'border-autopsy-warning/30 bg-autopsy-warning/5',
    critical: 'border-autopsy-error/30 bg-autopsy-error/5'
  };

  const severityIcons = {
    info: <Info className="w-5 h-5 text-autopsy-info" />,
    warning: <AlertTriangle className="w-5 h-5 text-autopsy-warning" />,
    critical: <AlertTriangle className="w-5 h-5 text-autopsy-error" />
  };

  return (
    <div className={cn('p-4 rounded-lg border', severityColors[insight.severity])}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">{severityIcons[insight.severity]}</div>
        <div className="flex-1">
          <h4 className="font-medium text-autopsy-text">{insight.title}</h4>
          <p className="text-sm text-autopsy-text-muted mt-1">{insight.description}</p>
          {insight.actionable && insight.suggestedAction && (
            <ActionBadge action={insight.suggestedAction} />
          )}
        </div>
      </div>
    </div>
  );
}

function IncidentCard({ incident }: { incident: MerchantIncident }) {
  return (
    <div className="p-4 rounded-lg border border-autopsy-error/30 bg-autopsy-error/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-autopsy-error" />
            <h4 className="font-medium text-autopsy-text">{incident.type.toUpperCase()}: {incident.paymentMethod.toUpperCase()}</h4>
            <StatusBadge status={incident.status === 'active' ? 'ESCALATED' : incident.status === 'mitigating' ? 'ACTION_SCHEDULED' : 'RECOVERED'} />
          </div>
          <p className="text-sm text-autopsy-text-muted">{incident.potentialCause}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-autopsy-text-muted">
            <span>Failure rate: <span className="text-autopsy-text font-mono">{incident.currentFailureRate.toFixed(1)}%</span> (normal: {incident.normalFailureRate.toFixed(1)}%)</span>
            <span>{incident.affectedPayments} payments affected</span>
            <span>Revenue at risk: <span className="font-mono">{formatCurrency(incident.estimatedRevenueAtRisk)}</span></span>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {incident.recommendedActions.map((action, i) => (
            <ActionBadge key={i} action={action} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Import RecoveryCasesTable
import { RecoveryCasesTable } from '../components/DataTable';
import { ActionBadge } from '../components/Badges';