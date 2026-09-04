import { ReactNode } from 'react';
import { cn, formatRelativeTime } from '../utils/cn';
import { Bot, User, Zap, Shield, Database, Clock, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import type { AuditEvent } from '../types';

interface AuditTimelineProps {
  events: AuditEvent[];
  className?: string;
}

const actorIcons = {
  system: Database,
  agent: Bot,
  human: User,
  webhook: Zap,
  scheduler: Clock
};

const actionIcons: Record<string, ReactNode> = {
  'payment_failed': <AlertTriangle className="w-4 h-4 text-autopsy-error" />,
  'autopsy_started': <Bot className="w-4 h-4 text-autopsy-accent" />,
  'root_cause_determined': <Info className="w-4 h-4 text-autopsy-info" />,
  'recoverability_scored': <CheckCircle className="w-4 h-4 text-autopsy-warning" />,
  'policy_evaluated': <Shield className="w-4 h-4 text-autopsy-info" />,
  'recovery_action_scheduled': <Clock className="w-4 h-4 text-autopsy-warning" />,
  'retry_executed': <Zap className="w-4 h-4 text-autopsy-accent" />,
  'payment_succeeded': <CheckCircle className="w-4 h-4 text-autopsy-success" />,
  'recovery_stopped': <XCircle className="w-4 h-4 text-autopsy-error" />,
  'approval_requested': <Shield className="w-4 h-4 text-autopsy-warning" />,
  'approval_approved': <CheckCircle className="w-4 h-4 text-autopsy-success" />,
  'approval_rejected': <XCircle className="w-4 h-4 text-autopsy-error" />,
  'notification_sent': <Info className="w-4 h-4 text-autopsy-info" />,
  'escalated_to_human': <User className="w-4 h-4 text-autopsy-error" />
};

export function AuditTimeline({ events, className }: AuditTimelineProps) {
  if (events.length === 0) {
    return (
      <div className={cn('card py-8 text-center', className)}>
        <p className="text-autopsy-text-muted">No audit events yet</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {events.map((event, index) => {
        const ActorIcon = actorIcons[event.actor] || Database;
        const ActionIcon = actionIcons[event.action] || Info;
        const isLast = index === events.length - 1;
        
        return (
          <div key={event.id} className="relative flex gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={cn(
                'w-3 h-3 rounded-full border-2 border-autopsy-bg relative z-10',
                event.actor === 'agent' && 'bg-autopsy-accent',
                event.actor === 'human' && 'bg-autopsy-success',
                event.actor === 'system' && 'bg-autopsy-info',
                event.actor === 'webhook' && 'bg-autopsy-warning',
                event.actor === 'scheduler' && 'bg-autopsy-text-muted'
              )}>
                <ActionIcon className="w-2 h-2" />
              </div>
              {!isLast && (
                <div className="w-0.5 h-full bg-autopsy-border mt-1" />
              )}
            </div>
            
            {/* Event content */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-autopsy-bg border border-autopsy-border flex items-center justify-center">
                  <ActorIcon className="w-4 h-4 text-autopsy-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-autopsy-text capitalize">{event.actor}</span>
                    <span className="text-xs text-autopsy-text-muted px-2 py-0.5 rounded bg-autopsy-border">{event.action.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-autopsy-text-muted ml-auto">{formatRelativeTime(event.timestamp)}</span>
                  </div>
                  
                  {/* Decision summary */}
                  {event.decision && Object.keys(event.decision).length > 0 && (
                    <div className="ml-10 mt-2 p-3 bg-autopsy-bg rounded-lg border border-autopsy-border/50">
                      <pre className="text-xs text-autopsy-text-muted font-mono overflow-x-auto">
                        {JSON.stringify(event.decision, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {/* Evidence */}
                  {event.evidence && event.evidence.length > 0 && (
                    <div className="ml-10 mt-2 space-y-1">
                      {event.evidence.map((evidence, i) => (
                        <div key={i} className="text-sm text-autopsy-text-muted flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-autopsy-border flex-shrink-0 mt-1.5" />
                          <span>{evidence}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Outcome */}
                  {event.outcome && Object.keys(event.outcome).length > 0 && (
                    <div className="ml-10 mt-2 p-3 bg-autopsy-success/5 border border-autopsy-success/20 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-autopsy-success mb-1">
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium">Outcome</span>
                      </div>
                      <pre className="text-xs text-autopsy-success font-mono overflow-x-auto">
                        {JSON.stringify(event.outcome, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}