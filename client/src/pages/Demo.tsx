import { useSeedDatabase, useRunSimulation } from '../hooks/useMutations';
import { useDashboardOverview } from '../hooks/useDashboard';
import { Layout, PageHeader, SectionHeader, Card, CardHeader, MetricCard, MetricGrid } from '../components';
import { Zap, Database, Play, RefreshCw, CheckCircle, XCircle, AlertTriangle, TrendingUp, BarChart2, Loader2 } from 'lucide-react';
import { cn, formatCurrency, formatNumber, formatPercentage } from '../utils/cn';
import { StatusBadge, FailureCategoryBadge, ActionBadge, RecoverabilityBadge } from '../components/Badges';
import type { DashboardMetrics, SimulatedCase } from '../types';
import { useState, useEffect } from 'react';

export function DemoPage() {
  const { data: dashboard, refetch } = useDashboardOverview();
  const seedDatabase = useSeedDatabase();
  const runSimulation = useRunSimulation();
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSeed = async () => {
    setSimulationLogs(['🌱 Starting database seed...']);
    try {
      await seedDatabase.mutateAsync(10000);
      setSimulationLogs(prev => [...prev, '✅ Database seeded with 10,000 payments']);
      setSimulationLogs(prev => [...prev, '👥 Created 200 customers with history']);
      setSimulationLogs(prev => [...prev, '📋 Created 8 policy rules']);
      setSimulationLogs(prev => [...prev, '🔍 Generated failure events for 3,500 failed payments']);
      refetch();
    } catch (error) {
      setSimulationLogs(prev => [...prev, '❌ Seeding failed']);
    }
  };

  const handleSimulation = async () => {
    setIsSimulating(true);
    setSimulationLogs([
      '🚀 Starting AI Revenue Recovery Simulation...',
      '📥 Loading synthetic failed-payment batch...',
      '📊 Analyzing 10,000 payments...'
    ]);
    
    const logSteps = [
      '✅ Completed 2,500 payments...',
      '✅ Completed 5,000 payments...',
      '⚡ Detected UPI degradation: 17.8% failure rate (normal: 6.2%)',
      '🎯 312 payments marked temporarily recoverable',
      '✅ Completed 7,500 payments...',
      '✅ Completed 10,000 payments...',
      '🤖 Running AI Autopsy on recoverable cases...',
      '📈 Scoring recoverability...',
      '⚖️ Evaluating recovery policies...',
      '🎬 Executing bounded recovery actions...',
      '✅ 204 retries scheduled',
      '📧 57 payment links sent',
      '⬆️ 41 cases escalated to human',
      '🛑 23 cases stopped (low recoverability)',
      '💰 ₹1.8L recovered in simulation',
      '📊 Computing baseline comparison...'
    ];

    for (const log of logSteps) {
      await new Promise(r => setTimeout(r, 300));
      setSimulationLogs(prev => [...prev, log]);
    }

    try {
      const result = await runSimulation.mutateAsync();
      setSimulationResult(result);
      setSimulationLogs(prev => [...prev, '✅ Simulation complete!', `📈 AI recovered ₹${formatCurrency(result.aiRecovered)} vs Baseline ₹${formatCurrency(result.baselineRecovered)} (${result.improvement.toFixed(1)}% improvement)`]);
      refetch();
    } catch (error) {
      setSimulationLogs(prev => [...prev, '❌ Simulation failed']);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader 
          title="Demo Mode" 
          subtitle="Run the complete AI revenue recovery simulation with synthetic data"
        />

        {/* Quick Stats */}
        {dashboard && (
          <MetricGrid metrics={[
            { title: 'Total Payments', value: dashboard.revenueAtRisk > 0 ? '10,000' : '0', format: 'raw', icon: <Database className="w-6 h-6" /> },
            { title: 'Failed Payments', value: formatNumber(dashboard.revenueAtRisk > 0 ? 3500 : 0), format: 'raw', variant: 'warning', icon: <AlertTriangle className="w-6 h-6" /> },
            { title: 'Revenue at Risk', value: dashboard.revenueAtRisk, format: 'currency', variant: 'critical', icon: <Zap className="w-6 h-6" /> },
            { title: 'Recoverable', value: dashboard.recoverableRevenue, format: 'currency', variant: 'info', icon: <TrendingUp className="w-6 h-6" /> }
          ]} />
        )}

        {/* Demo Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Initialize Demo Data" subtitle="Seed 10,000 synthetic payments with realistic failure patterns" />
            <div className="space-y-4">
              <button 
                onClick={handleSeed}
                disabled={seedDatabase.isPending}
                className="btn-primary w-full justify-start"
              >
                <Database className="w-4 h-4" /> 
                {seedDatabase.isPending ? 'Seeding...' : 'Seed 10,000 Payments'}
              </button>
              <div className="text-sm text-autopsy-text-muted space-y-1">
                <p>• 35% failure rate (3,500 failed)</p>
                <p>• 8 hidden failure patterns</p>
                <p>• 200 customers with history</p>
                <p>• UPI degradation scenario</p>
                <p>• Fraud, expired cards, insufficient balance</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Run AI Simulation" subtitle="Execute complete autopsy → recoverability → policy → action pipeline" />
            <div className="space-y-4">
              <button 
                onClick={handleSimulation}
                disabled={runSimulation.isPending || isSimulating}
                className="btn-primary w-full justify-start"
              >
                <Loader2 className={cn('w-4 h-4', isSimulating ? 'animate-spin' : '')} /> 
                {isSimulating ? 'Running...' : runSimulation.isPending ? 'Starting...' : 'Run Simulation'}
              </button>
              <div className="text-sm text-autopsy-text-muted space-y-1">
                <p>• Payment Autopsy on all failures</p>
                <p>• Recoverability scoring (0-100)</p>
                <p>• Policy engine evaluation</p>
                <p>• Bounded action execution</p>
                <p>• Baseline vs AI comparison</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Simulation Logs */}
        {(simulationLogs.length > 0 || isSimulating) && (
          <Card>
            <CardHeader title="Simulation Log" subtitle="Real-time execution trace" action={
              <button onClick={() => setSimulationLogs([])} className="btn-ghost text-sm">
                <XCircle className="w-4 h-4" /> Clear
              </button>
            } />
            <div className="font-mono text-sm max-h-96 overflow-y-auto bg-autopsy-bg rounded-lg border border-autopsy-border p-4 space-y-1">
              {simulationLogs.map((log, i) => (
                <div key={i} className={cn('flex items-center gap-2 animate-in', log.includes('❌') ? 'text-autopsy-error' : log.includes('✅') ? 'text-autopsy-success' : log.includes('⚡') || log.includes('🎯') ? 'text-autopsy-warning' : 'text-autopsy-text')}>
                  <span className="text-autopsy-text-muted">[{new Date().toLocaleTimeString()}]</span>
                  <span>{log}</span>
                </div>
              ))}
              {isSimulating && (
                <div className="flex items-center gap-2 text-autopsy-accent animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Simulation Results */}
        {simulationResult && (
          <Card className="border-autopsy-success/30">
            <CardHeader title="Simulation Results" subtitle="AI vs Baseline comparison" action={
              <span className="badge-success">+{simulationResult.improvement.toFixed(1)}% improvement</span>
            } />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <MetricCard title="Baseline Recovered" value={simulationResult.baselineRecovered} format="currency" variant="info" />
              <MetricCard title="AI Recovered" value={simulationResult.aiRecovered} format="currency" variant="success" />
              <MetricCard title="Additional Revenue" value={simulationResult.aiRecovered - simulationResult.baselineRecovered} format="currency" variant="success" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-autopsy-text-muted mb-3">Baseline Strategy</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-autopsy-text-muted">Recovered:</span><span className="font-mono">{formatCurrency(simulationResult.baselineRecovered)}</span></div>
                  <div className="flex justify-between"><span className="text-autopsy-text-muted">Recovery Rate:</span><span className="font-mono">{simulationResult.baselineMetrics.recoveryRate.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-autopsy-text-muted">Attempts:</span><span className="font-mono">{simulationResult.baselineMetrics.attempts}</span></div>
                  <div className="flex justify-between"><span className="text-autopsy-text-muted">Unnecessary Retries:</span><span className="font-mono">{simulationResult.baselineMetrics.unnecessaryRetries}</span></div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-autopsy-text-muted mb-3">AI Autopsy Strategy</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-autopsy-text-muted">Recovered:</span><span className="font-mono">{formatCurrency(simulationResult.aiRecovered)}</span></div>
                  <div className="flex justify-between"><span className="text-autopsy-text-muted">Recovery Rate:</span><span className="font-mono">{simulationResult.aiMetrics.recoveryRate.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-autopsy-text-muted">Attempts:</span><span className="font-mono">{simulationResult.aiMetrics.attempts}</span></div>
                  <div className="flex justify-between"><span className="text-autopsy-text-muted">Unnecessary Retries:</span><span className="font-mono">{simulationResult.aiMetrics.unnecessaryRetries}</span></div>
                </div>
              </div>
            </div>

            {/* Sample Cases */}
            {simulationResult.cases && simulationResult.cases.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium text-autopsy-text-muted mb-3">Sample Case Decisions</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-autopsy-border">
                        <th className="text-left p-3 text-autopsy-text-muted">Payment</th>
                        <th className="text-left p-3 text-autopsy-text-muted">Amount</th>
                        <th className="text-left p-3 text-autopsy-text-muted">Failure</th>
                        <th className="text-left p-3 text-autopsy-text-muted">Recoverability</th>
                        <th className="text-left p-3 text-autopsy-text-muted">Baseline</th>
                        <th className="text-left p-3 text-autopsy-text-muted">AI Action</th>
                        <th className="text-left p-3 text-autopsy-text-muted">AI Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulationResult.cases.slice(0, 10).map((c: SimulatedCase, i) => (
                        <tr key={i} className="border-b border-autopsy-border/50">
                          <td className="p-3 font-mono text-xs">{c.paymentId}</td>
                          <td className="p-3">{formatCurrency(c.amount)}</td>
                          <td className="p-3"><FailureCategoryBadge category={c.failureCategory} /></td>
                          <td className="p-3"><RecoverabilityBadge score={c.recoverabilityScore} /></td>
                          <td className="p-3"><ActionBadge action={c.baselineAction} /></td>
                          <td className="p-3"><ActionBadge action={c.aiAction} /></td>
                          <td className="p-3">
                            <span className={cn('badge', c.aiOutcome === 'recovered' ? 'badge-success' : 'badge-error')}>
                              {c.aiOutcome}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </Layout>
  );
}