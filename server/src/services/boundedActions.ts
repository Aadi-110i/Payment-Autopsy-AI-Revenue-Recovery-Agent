import { PrismaClient, RecoveryActionType, RecoveryActionStatus, RecoveryCaseStatus, AuditActor } from '@prisma/client';
import { RecoveryAction, RecoveryActionResult, AutopsyResult, PolicyDecision, RecoverabilityScore } from '@autopsy/shared';
import { v4 as uuidv4 } from 'crypto';

const prisma = new PrismaClient();

interface ActionExecutionContext {
  caseId: string;
  merchantId: string;
  paymentId: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  failureCategory: string;
  retryCount: number;
  idempotencyKey: string;
}

export class BoundedActionLayer {
  async executeAction(
    actionType: RecoveryActionType,
    context: ActionExecutionContext,
    payload: Record<string, unknown>,
    reason: string
  ): Promise<RecoveryActionResult> {
    // Validate idempotency
    const existing = await prisma.recoveryAction.findUnique({
      where: { idempotencyKey: context.idempotencyKey }
    });
    if (existing) {
      return { success: false, error: 'Duplicate action - idempotency key already used' };
    }

    // Create action record
    const action = await prisma.recoveryAction.create({
      data: {
        caseId: context.caseId,
        type: actionType,
        payload,
        reason,
        status: 'executing',
        idempotencyKey: context.idempotencyKey
      }
    });

    try {
      let result: RecoveryActionResult;
      
      switch (actionType) {
        case 'RETRY_PAYMENT':
          result = await this.executeRetry(context, payload);
          break;
        case 'SEND_PAYMENT_LINK':
          result = await this.executePaymentLink(context, payload);
          break;
        case 'SEND_RECOVERY_NOTIFICATION':
          result = await this.executeNotification(context, payload);
          break;
        case 'SCHEDULE_RETRY':
          result = await this.executeScheduleRetry(context, payload);
          break;
        case 'REQUEST_ALTERNATIVE_PAYMENT_METHOD':
          result = await this.executeAlternativeMethodRequest(context, payload);
          break;
        case 'ESCALATE_TO_HUMAN':
          result = await this.executeEscalation(context, payload);
          break;
        case 'STOP_RECOVERY':
          result = await this.executeStop(context, payload);
          break;
        default:
          result = { success: false, error: `Unknown action type: ${actionType}` };
      }

      // Update action with result
      await prisma.recoveryAction.update({
        where: { id: action.id },
        data: {
          status: result.success ? 'completed' : 'failed',
          executedAt: new Date(),
          result: result as any
        }
      });

      // Record audit event
      await this.recordAuditEvent({
        caseId: context.caseId,
        actor: 'agent',
        action: `execute_${actionType.toLowerCase()}`,
        inputContext: { ...context, payload },
        decision: { action: actionType, reason },
        outcome: result,
        policyUsed: 'recovery_policy_engine'
      });

      return result;
    } catch (error) {
      const errorResult: RecoveryActionResult = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
      
      await prisma.recoveryAction.update({
        where: { id: action.id },
        data: {
          status: 'failed',
          executedAt: new Date(),
          result: errorResult as any
        }
      });

      return errorResult;
    }
  }

  private async executeRetry(context: ActionExecutionContext, payload: Record<string, unknown>): Promise<RecoveryActionResult> {
    // In demo mode, simulate retry outcome based on recoverability
    const isDemo = process.env.DEMO_MODE === 'true';
    
    if (isDemo) {
      // Simulate based on failure category and recoverability
      const successProbability = this.getSimulatedSuccessProbability(context.failureCategory, context.retryCount);
      const success = Math.random() < successProbability;
      
      return {
        success,
        externalId: success ? `retry_${uuidv4()}` : undefined,
        error: success ? undefined : 'Simulated retry failed',
        metadata: { simulated: true, probability: successProbability }
      };
    }

    // Real Razorpay retry would go here
    // const razorpay = new Razorpay({ key_id, key_secret });
    // const payment = await razorpay.payments.fetch(context.paymentId);
    // const retry = await razorpay.payments.retry(payment.id);
    
    return { success: false, error: 'Razorpay retry not implemented in demo mode' };
  }

  private async executePaymentLink(context: ActionExecutionContext, payload: Record<string, unknown>): Promise<RecoveryActionResult> {
    const isDemo = process.env.DEMO_MODE === 'true';
    
    if (isDemo) {
      const linkId = `plink_${uuidv4()}`;
      return {
        success: true,
        externalId: linkId,
        metadata: { 
          simulated: true, 
          paymentLink: `https://rzp.io/i/${linkId}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      };
    }

    // Real Razorpay payment link creation
    return { success: false, error: 'Payment link creation not implemented in demo mode' };
  }

  private async executeNotification(context: ActionExecutionContext, payload: Record<string, unknown>): Promise<RecoveryActionResult> {
    const isDemo = process.env.DEMO_MODE === 'true';
    
    if (isDemo) {
      // Create notification record
      await prisma.notification.create({
        data: {
          caseId: context.caseId,
          customerId: context.customerId,
          merchantId: context.merchantId,
          type: 'recovery_notification',
          channel: payload.channel as string || 'email',
          subject: payload.subject as string || 'Payment Recovery',
          content: payload.content as string || 'Your payment needs attention',
          status: 'sent',
          sentAt: new Date()
        }
      });

      return {
        success: true,
        externalId: `notif_${uuidv4()}`,
        metadata: { simulated: true, channel: payload.channel || 'email' }
      };
    }

    return { success: false, error: 'Notification sending not implemented in demo mode' };
  }

  private async executeScheduleRetry(context: ActionExecutionContext, payload: Record<string, unknown>): Promise<RecoveryActionResult> {
    const delayMinutes = (payload.delayMinutes as number) || 20;
    const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    // In real implementation, this would schedule a job in BullMQ
    // await retryQueue.add('retry-payment', { caseId: context.caseId }, { delay: delayMinutes * 60 * 1000 });
    
    return {
      success: true,
      externalId: `sched_${uuidv4()}`,
      metadata: { 
        scheduledAt: scheduledAt.toISOString(),
        delayMinutes,
        simulated: process.env.DEMO_MODE === 'true'
      }
    };
  }

  private async executeAlternativeMethodRequest(context: ActionExecutionContext, payload: Record<string, unknown>): Promise<RecoveryActionResult> {
    const isDemo = process.env.DEMO_MODE === 'true';
    
    if (isDemo) {
      await prisma.notification.create({
        data: {
          caseId: context.caseId,
          customerId: context.customerId,
          merchantId: context.merchantId,
          type: 'alternative_method_request',
          channel: 'email',
          subject: 'Update your payment method',
          content: 'Your payment failed due to an expired/invalid payment method. Please update to continue.',
          status: 'sent',
          sentAt: new Date()
        }
      });

      return {
        success: true,
        externalId: `alt_req_${uuidv4()}`,
        metadata: { simulated: true }
      };
    }

    return { success: false, error: 'Alternative method request not implemented in demo mode' };
  }

  private async executeEscalation(context: ActionExecutionContext, payload: Record<string, unknown>): Promise<RecoveryActionResult> {
    // Create approval request
    await prisma.approvalRequest.create({
      data: {
        caseId: context.caseId,
        actionType: 'ESCALATE_TO_HUMAN',
        requestedBy: 'agent',
        reason: payload.reason as string || 'Requires human review',
        status: 'pending'
      }
    });

    return {
      success: true,
      externalId: `esc_${uuidv4()}`,
      metadata: { escalated: true, reason: payload.reason }
    };
  }

  private async executeStop(context: ActionExecutionContext, payload: Record<string, unknown>): Promise<RecoveryActionResult> {
    // Update case status to STOPPED
    await prisma.recoveryCase.update({
      where: { id: context.caseId },
      data: { status: 'STOPPED', completedAt: new Date() }
    });

    return {
      success: true,
      externalId: `stop_${uuidv4()}`,
      metadata: { stopped: true, reason: payload.reason }
    };
  }

  private getSimulatedSuccessProbability(failureCategory: string, retryCount: number): number {
    const baseProbabilities: Record<string, number> = {
      'temporary_gateway_issue': 0.75,
      'bank_timeout': 0.65,
      'network_issue': 0.60,
      'authentication_failure': 0.25,
      'insufficient_balance': 0.40,
      'expired_card': 0.10,
      'invalid_payment_method': 0.05,
      'customer_abandonment': 0.15,
      'repeated_failure': 0.05,
      'suspected_fraud': 0.00,
      'unknown': 0.20
    };

    const base = baseProbabilities[failureCategory] || 0.20;
    const retryPenalty = retryCount * 0.15;
    return Math.max(0, base - retryPenalty);
  }

  private async recordAuditEvent(data: {
    caseId: string;
    actor: AuditActor;
    action: string;
    inputContext: Record<string, unknown>;
    decision: Record<string, unknown>;
    outcome?: Record<string, unknown>;
    policyUsed?: string;
  }) {
    await prisma.auditEvent.create({
      data: {
        caseId: data.caseId,
        actor: data.actor,
        action: data.action,
        inputContext: data.inputContext as any,
        decision: data.decision as any,
        outcome: data.outcome as any,
        policyUsed: data.policyUsed
      }
    });
  }
}

export const boundedActionLayer = new BoundedActionLayer();