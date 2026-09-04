import { useDashboardOverview, useMetrics } from '../hooks/useDashboard';
import { Layout, PageHeader, SectionHeader, Card, CardHeader, MetricCard, MetricGrid } from '../components';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { cn, formatCurrency, formatNumber, formatPercentage } from '../utils/cn';
import type { DashboardMetrics } from '../types';

const COLORS = ['#D6A62A', '#1565C0', '#2E7D32', '#C62828', '#8A8A8A', '#6A1B9A'];

export function AnalyticsPage() {
  const { data: dashboard, isLoading } = useDashboardOverview();
  const { data: metrics } = useMetrics();

  if (isLoading) {
    return (
      <Layout>
        <PageHeader title="Analytics" subtitle="Loading charts..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader title="Analytics" subtitle="Deep dive into recovery performance" />

        {/* Summary Cards */}
        <MetricGrid metrics={[
          { title: 'Total Failed Value', value: dashboard!.revenueAtRisk, format: 'currency', variant: 'critical' },
          { title: 'Recoverable Value', value: dashboard!.recoverableRevenue, format: 'currency', variant: 'info' },
          { title: 'Recovered Value', value: dashboard!.recoveredRevenue, format: 'currency', variant: 'success' },
          { title: 'Net Recovery Rate', value: dashboard!.recoveryRate, format: 'percentage', trend: { value: dashboard!.recoveryRate - 45, label: 'vs industry' } }
        ]} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Failure Categories */}
          <Card>
            <CardHeader title="Failure Category Analysis" subtitle="Volume and recovery by failure type" />
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard!.byCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" />
                  <XAxis type="number" tick={{ fill: '#8A8A8A', fontSize: 12 }} axisLine={{ stroke: '#1E1E1E' }} />
                  <YAxis dataKey="category" type="category" tick={{ fill: '#F5F5F0', fontSize: 12 }} axisLine={false} width={160} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid #1E1E1E', borderRadius: '8px' }}
                    formatter={(value: number, name: string) => [name === 'count' ? value : formatCurrency(value), name]}
                  />
                  <Bar dataKey="count" fill="#D6A62A" radius={[0, 4, 4, 0]} name="Failed Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Recovery Funnel */}
          <Card>
            <CardHeader title="Recovery Funnel" subtitle="Cases progressing through pipeline" />
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { stage: 'New', count: dashboard!.recentCases.filter(c => c.status === 'NEW').length, color: '#8A8A8A' },
                  { stage: 'Autopsy', count: dashboard!.recentCases.filter(c => c.status === 'AUTOPSY').length, color: '#D6A62A' },
                  { stage: 'Ready', count: dashboard!.recentCases.filter(c => c.status === 'RECOVERY_READY').length, color: '#1565C0' },
                  { stage: 'Scheduled', count: dashboard!.recentCases.filter(c => c.status === 'ACTION_SCHEDULED').length, color: '#6A1B9A' },
                  { stage: 'Recovered', count: dashboard!.recentCases.filter(c => c.status === 'RECOVERED').length, color: '#2E7D32' },
                  { stage: 'Escalated', count: dashboard!.recentCases.filter(c => c.status === 'ESCALATED').length, color: '#C62828' },
                  { stage: 'Stopped', count: dashboard!.recentCases.filter(c => c.status === 'STOPPED').length, color: '#8A8A8A' }
                ]} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" />
                  <XAxis type="number" tick={{ fill: '#8A8A8A', fontSize: 12 }} axisLine={{ stroke: '#1E1E1E' }} />
                  <YAxis dataKey="stage" type="category" tick={{ fill: '#F5F5F0', fontSize: 12 }} axisLine={false} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: '#111111', border: '1px solid #1E1E1E', borderRadius: '8px' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {dashboard!.recentCases.filter(c => c.status === 'NEW').length > 0 && <Cell fill="#8A8A8A" />}
                    {dashboard!.recentCases.filter(c => c.status === 'AUTOPSY').length > 0 && <Cell fill="#D6A62A" />}
                    {dashboard!.recentCases.filter(c => c.status === 'RECOVERY_READY').length > 0 && <Cell fill="#1565C0" />}
                    {dashboard!.recentCases.filter(c => c.status === 'ACTION_SCHEDULED').length > 0 && <Cell fill="#6A1B9A" />}
                    {dashboard!.recentCases.filter(c => c.status === 'RECOVERED').length > 0 && <Cell fill="#2E7D32" />}
                    {dashboard!.recentCases.filter(c => c.status === 'ESCALATED').length > 0 && <Cell fill="#C62828" />}
                    {dashboard!.recentCases.filter(c => c.status === 'STOPPED').length > 0 && <Cell fill="#8A8A8A" />}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Time Series & Payment Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Failures Over Time */}
          <Card>
            <CardHeader title="Failure Trends (24h)" subtitle="Hourly failure volume and recovery" />
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard!.overTime}>
                  <defs>
                    <linearGradient id="failures-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D6A62A" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D6A62A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="recovered-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E7D32" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2E7D32" stopOpacity={0} />
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
                  <Area type="monotone" dataKey="failures" stroke="#D6A62A" fillOpacity={1} fill="url(#failures-area)" name="Failures" />
                  <Line type="monotone" dataKey="recovered" stroke="#2E7D32" strokeWidth={2} dot={false} name="Recovered" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Payment Method Distribution */}
          <Card>
            <CardHeader title="Payment Method Failures" subtitle="Failure distribution by payment method" />
            <div className="h-80">
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
          </Card>
        </div>

        {/* Recoverability Distribution */}
        <Card>
          <CardHeader title="Recoverability Score Distribution" subtitle="How recoverable are the failed payments?" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { range: '0-20', count: 0 },
                { range: '21-40', count: 0 },
                { range: '41-60', count: 0 },
                { range: '61-80', count: 0 },
                { range: '81-100', count: 0 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" />
                <XAxis dataKey="range" tick={{ fill: '#8A8A8A', fontSize: 12 }} axisLine={{ stroke: '#1E1E1E' }} />
                <YAxis tick={{ fill: '#F5F5F0', fontSize: 12 }} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#111111', border: '1px solid #1E1E1E', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="#D6A62A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Baseline vs AI Comparison */}
        {metrics && (
          <Card>
            <CardHeader title="Baseline vs AI Comparison" subtitle="Simple retry vs intelligent recovery" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard title="Baseline Recovered" value={metrics.baseline?.recovered || 0} format="currency" variant="info" />
              <MetricCard title="AI Recovered" value={metrics.ai?.recovered || 0} format="currency" variant="success" />
              <MetricCard title="Improvement" value={metrics.improvement || 0} format="percentage" variant="success" />
            </div>
          </Card>
        )}

        {/* Key Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader title="Efficiency Metrics" />
            <div className="space-y-3">
              <MetricRow label="Unnecessary Retries" value={formatPercentage(dashboard!.unnecessaryRetryRate)} />
              <MetricRow label="False Interventions" value={formatPercentage(dashboard!.falseInterventionRate)} />
              <MetricRow label="Avg Time to Recovery" value={`${dashboard!.avgTimeToRecovery}m`} />
              <MetricRow label="Revenue per 1K Failures" value={formatCurrency(dashboard!.revenuePer1000Failures * 1000)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Cost Analysis" />
            <div className="space-y-3">
              <MetricRow label="Est. Contact Cost" value={formatCurrency(dashboard!.estimatedContactCost)} />
              <MetricRow label="Net Recovered" value={formatCurrency(dashboard!.netRecoveredValue)} />
              <MetricRow label="Recovery ROI" value={dashboard!.recoveryROI + '%'} />
              <MetricRow label="Actions Taken" value={formatNumber(dashboard!.actionsTaken)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Case Outcomes" />
            <div className="space-y-3">
              <MetricRow label="Escalated to Human" value={formatNumber(dashboard!.casesEscalated)} />
              <MetricRow label="Correctly Stopped" value={formatNumber(dashboard!.casesStopped)} />
              <MetricRow label="Autonomous Recoveries" value={formatNumber(dashboard!.actionsTaken - dashboard!.casesEscalated - dashboard!.casesStopped)} />
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-autopsy-border/50">
      <span className="text-sm text-autopsy-text-muted">{label}</span>
      <span className="font-mono text-autopsy-text">{value}</span>
    </div>
  );
}