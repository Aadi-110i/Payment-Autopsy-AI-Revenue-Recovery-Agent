import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock, DollarSign, Target } from 'lucide-react';
import { cn, formatCurrency, formatNumber, formatPercentage } from '../utils/cn';
import type { DashboardMetrics } from '../types';

interface MetricCardProps {
  title: string;
  value: number | string;
  format?: 'currency' | 'number' | 'percentage' | 'raw';
  trend?: { value: number; label?: string };
  icon?: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'info' | 'critical';
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  format = 'number', 
  trend, 
  icon, 
  variant = 'default',
  className 
}: MetricCardProps) {
  const variantClasses = {
    default: 'border-autopsy-border',
    success: 'border-autopsy-success/30',
    warning: 'border-autopsy-warning/30',
    info: 'border-autopsy-info/30',
    critical: 'border-autopsy-error/30'
  };

  const trendIcon = trend 
    ? trend.value > 0 ? <TrendingUp className="w-4 h-4 text-autopsy-success" /> 
    : trend.value < 0 ? <TrendingDown className="w-4 h-4 text-autopsy-error" /> 
    : <Minus className="w-4 h-4 text-autopsy-text-muted" />
    : null;

  let formattedValue: string;
  switch (format) {
    case 'currency':
      formattedValue = typeof value === 'number' ? formatCurrency(value) : value;
      break;
    case 'percentage':
      formattedValue = typeof value === 'number' ? formatPercentage(value) : value;
      break;
    case 'number':
      formattedValue = typeof value === 'number' ? formatNumber(value) : value;
      break;
    default:
      formattedValue = String(value);
  }

  return (
    <div className={cn('metric-card', variantClasses[variant], className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-autopsy-text-muted">{title}</p>
          <p className="text-2xl lg:text-3xl font-bold text-autopsy-text mt-1 tabular-nums">{formattedValue}</p>
          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              {trendIcon}
              <span className={cn('text-sm font-medium', trend.value > 0 ? 'text-autopsy-success' : trend.value < 0 ? 'text-autopsy-error' : 'text-autopsy-text-muted')}>
                {trend.value > 0 ? '+' : ''}{formatPercentage(Math.abs(trend.value))}
              </span>
              {trend.label && <span className="text-sm text-autopsy-text-muted">{trend.label}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-autopsy-bg border border-autopsy-border flex items-center justify-center text-autopsy-text-muted flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export function MetricGrid({ metrics }: { metrics: MetricCardProps[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
}

// Predefined metric cards for dashboard
export function RevenueOverviewCards({ data }: { data: DashboardMetrics }) {
  return (
    <MetricGrid metrics={[
      {
        title: 'Revenue at Risk',
        value: data.revenueAtRisk,
        format: 'currency',
        icon: <DollarSign className="w-6 h-6" />,
        variant: 'critical'
      },
      {
        title: 'Recoverable Revenue',
        value: data.recoverableRevenue,
        format: 'currency',
        icon: <Target className="w-6 h-6" />,
        variant: 'info'
      },
      {
        title: 'Revenue Recovered',
        value: data.recoveredRevenue,
        format: 'currency',
        trend: { value: data.recoveryRate, label: 'rate' },
        icon: <CheckCircle className="w-6 h-6" />,
        variant: 'success'
      },
      {
        title: 'Recovery Rate',
        value: data.recoveryRate,
        format: 'percentage',
        trend: { value: data.recoveryRate - 50, label: 'vs baseline' },
        icon: <TrendingUp className="w-6 h-6" />,
        variant: 'default'
      }
    ]} />
  );
}

export function OperationalMetricCards({ data }: { data: DashboardMetrics }) {
  return (
    <MetricGrid metrics={[
      {
        title: 'Unnecessary Retries',
        value: data.unnecessaryRetryRate,
        format: 'percentage',
        icon: <AlertTriangle className="w-6 h-6" />,
        variant: 'warning'
      },
      {
        title: 'Avg Time to Recovery',
        value: `${data.avgTimeToRecovery}m`,
        format: 'raw',
        icon: <Clock className="w-6 h-6" />,
        variant: 'info'
      },
      {
        title: 'Cases Escalated',
        value: data.casesEscalated,
        format: 'number',
        icon: <Target className="w-6 h-6" />,
        variant: 'info'
      },
      {
        title: 'Cases Stopped',
        value: data.casesStopped,
        format: 'number',
        icon: <CheckCircle className="w-6 h-6" />,
        variant: 'success'
      }
    ]} />
  );
}