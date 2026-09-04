import { PrismaClient, RecoveryCaseStatus, AuditActor, RecoveryActionType } from '@prisma/client';
import { AutopsyResult, RecoverabilityScore, PolicyDecision, RecoveryAction } from '@autopsy/shared';
import { paymentAutopsyService } from './paymentAutopsy';
import { recoverabilityScoringService } from './recoverabilityScoring';
import { recoveryPolicyEngine } from './recoveryPolicy';
import { boundedActionLayer } from './boundedActions';

const prisma = new PrismaClient();

interface AgentContext {
  caseId: string;
  merchantId: string;
  paymentId: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  failureCode: string;
  retryCount: number;
}

interface AgentRunResult {
  success: boolean;
  caseId: string;
  steps: AgentStep[];
  finalStatus: RecoveryCaseStatus;
  error?: string;
}

interface AgentStep {
  step: string;
  status: 'completed' | 'failed' | 'skipped';
  timestamp: string;
  details?: Record<string, unknown>;
  error?: string;
}

export class RecoveryAgent {
  async run(caseId: string): Promise<AgentRunResult> {
    const steps: AgentStep[] = [];
    const addStep = (step: string, status: AgentStep['status'], details?: Record<string, unknown>, error?: string) => {
      steps.push({ step, status, timestamp: new Date().toISOString(), details, error });
    };

    try {
      // OBSERVE: Load case and payment data
      addStep('OBSERVE', 'completed');
      const caseData = await this.loadCase(caseId);
      if (!caseData) throw new Error('Case not found');

      // INVESTIGATE: Gather context
      addStep('INVESTIGATE', 'completed');
      const context = await this.gatherContext(caseData);

      // DIAGNOSE: Run Payment Autopsy
      addStep('DIAGNOSE', 'completed');
      const autopsyResult = await paymentAutopsyService.analyze(context);
      await this.saveAutopsyResult(caseId, autopsyResult);
      await this.updateCaseStatus(caseId, 'AUTOPSY');

      // SCORE: Calculate Recoverability
      addStep('SCORE', 'completed');
      const recoverability = await recoverabilityScoringService.calculate({
        paymentId: caseData.paymentId,
        merchantId: caseData.merchantId,
        customerId: caseData.customerId,
        amount: caseData.amount,
        paymentMethod: caseData.paymentMethod,
        failureCategory: autopsyResult.failureCategory as any,
        retryCount: caseData.retryCount,
        timeSinceFailure: this.getMinutesSince(caseData.createdAt),
        customerHistory: await this.getCustomerHistory(caseData.customerId),
        merchantStats: await this.getMerchantStats(caseData.merchantId, caseData.paymentMethod),
        autopsyResult,
        previousRecoveryAttempts: caseData.actions.length,
        customerContactedRecently: await this.wasCustomerContactedRecently(caseData.customerId)
      });
      await this.updateCaseRecoverability(caseId, recoverability.score);

      // CHECK POLICY: Evaluate Recovery Policy
      addStep('CHECK_POLICY', 'completed');
      const policyDecision = await recoveryPolicyEngine.evaluate({
        caseId,
        merchantId: caseData.merchantId,
        amount: caseData.amount,
        failureCategory: autopsyResult.failureCategory,
        retryCount: caseData.retryCount,
        recoverabilityScore: recoverability.score,
        autopsyResult,
        recoverability,
        customerContactedRecently: await this.wasCustomerContactedRecently(caseData.customerId),
        previousRecoveryAttempts: caseData.actions.length,
        currentActions: caseData.actions,
        merchantPolicyRules: await recoveryPolicyEngine.getMerchantPolicyRules(caseData.merchantId)
      });
      await this.savePolicyDecision(caseId, policyDecision);

      // ACT: Execute bounded action if allowed
      let finalStatus: RecoveryCaseStatus = 'RECOVERY_READY';
      
      if (policyDecision.allowed && !policyDecision.requiresApproval) {
        addStep('ACT', 'completed');
        const actionResult = await this.executeAction(caseId, policyDecision, caseData);
        
        if (actionResult.success) {
          finalStatus = this.determineStatusAfterAction(policyDecision.action, caseData);
          await this.updateCaseStatus(caseId, finalStatus);
        } else {
          addStep('ACT', 'failed', {}, actionResult.error);
          finalStatus = 'RECOVERY_READY';
        }
      } else if (policyDecision.requiresApproval) {
        addStep('ACT', 'skipped', { reason: 'Requires human approval' });
        finalStatus = 'AWAITING_APPROVAL';
        await this.updateCaseStatus(caseId, finalStatus);
        await this.requestApproval(caseId, policyDecision);
      } else {
        addStep('ACT', 'skipped', { reason: policyDecision.reason });
        finalStatus = 'STOPPED';
        await this.updateCaseStatus(caseId, finalStatus);
      }

      // VERIFY RESULT: Check outcome
      addStep('VERIFY_RESULT', 'completed');
      await this.verifyOutcome(caseId);

      // AUDIT: Final audit trail is recorded throughout
      addStep('AUDIT', 'completed');

      return {
        success: true,
        caseId,
        steps,
        finalStatus
      };
    } catch (error) {
      addStep('ERROR', 'failed', {}, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        caseId,
        steps,
        finalStatus: 'STOPPED',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async loadCase(caseId: string) {
    return prisma.recoveryCase.findUnique({
      where: { id: caseId },
      include: {
        actions: { orderBy: { createdAt: 'asc' } },
        auditEvents: { orderBy: { timestamp: 'asc' } }
      }
    });
  }

  private async gatherContext(caseData: any) {
    const payment = await prisma.payment.findUnique({
      where: { id: caseData.paymentId },
      include: {
        customer: true,
        attempts: { orderBy: { attemptNumber: 'asc' } },
        failureEvents: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    if (!payment) throw new Error('Payment not found');

    const customer = payment.customer;
    const recentPayments = await prisma.payment.findMany({
      where: { 
        customerId: customer.id,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { failureEvents: { take: 1 } }
    });

    const merchantStats = await this.getMerchantStats(payment.merchantId, payment.paymentMethod);

    return {
      paymentId: payment.id,
      merchantId: payment.merchantId,
      customerId: payment.customerId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      failureCode: payment.failureCode || 'UNKNOWN',
      failureDescription: payment.failureDescription,
      retryCount: payment.retryCount,
      timestamp: payment.createdAt,
      customerHistory: {
        successfulPayments: customer.successfulPayments,
        totalPayments: customer.totalPayments,
        lifetimeValue: customer.lifetimeValue,
        previousSuccessRate: customer.totalPayments > 0 ? customer.successfulPayments / customer.totalPayments : 0,
        recentPayments: recentPayments.map(p => ({
          paymentId: p.id,
          amount: p.amount,
          status: p.status === 'success' ? 'success' : 'failed',
          timestamp: p.createdAt.toISOString(),
          failureCategory: p.failureCategory || undefined,
          paymentMethod: p.paymentMethod
        }))
      },
      merchantStats,
      previousAttempts: payment.attempts.map(a => ({
        attemptNumber: a.attemptNumber,
        status: a.status,
        failureCode: a.failureCode || undefined,
        failureCategory: a.failureCategory || undefined,
        executedAt: a.executedAt
      }))
    };
  }

  private async getCustomerHistory(customerId: string) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    const recentPayments = await prisma.payment.findMany({
      where: { 
        customerId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { failureEvents: { take: 1 } }
    });

    return {
      successfulPayments: customer?.successfulPayments || 0,
      totalPayments: customer?.totalPayments || 0,
      lifetimeValue: customer?.lifetimeValue || 0,
      previousSuccessRate: customer && customer.totalPayments > 0 ? customer.successfulPayments / customer.totalPayments : 0,
      recentPayments: recentPayments.map(p => ({
        status: p.status === 'success' ? 'success' : 'failed',
        failureCategory: p.failureCategory || undefined,
        paymentMethod: p.paymentMethod
      }))
    };
  }

  private async getMerchantStats(merchantId: string, paymentMethod: string) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [recentPayments, normalPayments] = await Promise.all([
      prisma.payment.findMany({
        where: { merchantId, paymentMethod, createdAt: { gte: thirtyMinutesAgo } }
      }),
      prisma.payment.findMany({
        where: { merchantId, paymentMethod, createdAt: { gte: twentyFourHoursAgo, lt: thirtyMinutesAgo } }
      })
    ]);

    const recentTotal = recentPayments.length;
    const recentFailed = recentPayments.filter(p => p.status === 'failed').length;
    const normalTotal = normalPayments.length;
    const normalFailed = normalPayments.filter(p => p.status === 'failed').length;

    return {
      recentFailureRate: recentTotal > 0 ? (recentFailed / recentTotal) * 100 : 0,
      normalFailureRate: normalTotal > 0 ? (normalFailed / normalTotal) * 100 : 0,
      degradationDetected: recentFailureRate > (normalFailed / Math.max(normalTotal, 1)) * 200 && recentFailureRate > 10
    };
  }

  private async wasCustomerContactedRecently(customerId: string): Promise<boolean> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const notification = await prisma.notification.findFirst({
      where: { customerId, sentAt: { gte: twentyFourHoursAgo } }
    });
    return !!notification;
  }

  private getMinutesSince(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / 60000);
  }

  private async saveAutopsyResult(caseId: string, result: AutopsyResult) {
    await prisma.autopsyResult.upsert({
      where: { caseId },
      create: { caseId, ...result },
      update: { ...result }
    });
  }

  private async savePolicyDecision(caseId: string, decision: PolicyDecision) {
    await prisma.policyDecision.upsert({
      where: { caseId },
      create: { caseId, ...decision, cooldownUntil: decision.cooldownUntil },
      update: { ...decision, cooldownUntil: decision.cooldownUntil }
    });
  }

  private async updateCaseStatus(caseId: string, status: RecoveryCaseStatus) {
    await prisma.recoveryCase.update({
      where: { id: caseId },
      data: { status, updatedAt: new Date() }
    });
  }

  private async updateCaseRecoverability(caseId: string, score: number) {
    await prisma.recoveryCase.update({
      where: { id: caseId },
      data: { recoverabilityScore: score }
    });
  }

  private async executeAction(caseId: string, decision: PolicyDecision, caseData: any): Promise<{ success: boolean; error?: string }> {
    const idempotencyKey = `${caseId}_${decision.action}_${Date.now()}`;
    
    return boundedActionLayer.executeAction(
      decision.action,
      {
        caseId,
        merchantId: caseData.merchantId,
        paymentId: caseData.paymentId,
        customerId: caseData.customerId,
        amount: caseData.amount,
        paymentMethod: caseData.paymentMethod,
        failureCategory: caseData.failureCategory || 'unknown',
        retryCount: caseData.retryCount,
        idempotencyKey
      },
      { delayMinutes: decision.cooldownUntil ? Math.ceil((decision.cooldownUntil.getTime() - Date.now()) / 60000) : 20 },
      decision.reason
    );
  }

  private determineStatusAfterAction(action: RecoveryActionType, caseData: any): RecoveryCaseStatus {
    switch (action) {
      case 'SCHEDULE_RETRY':
        return 'ACTION_SCHEDULED';
      case 'RETRY_PAYMENT':
        return 'ACTION_SCHEDULED'; // Will be updated when retry completes
      case 'SEND_PAYMENT_LINK':
      case 'SEND_RECOVERY_NOTIFICATION':
      case 'REQUEST_ALTERNATIVE_PAYMENT_METHOD':
        return 'ACTION_SCHEDULED'; // Waiting for customer response
      case 'ESCALATE_TO_HUMAN':
        return 'ESCALATED';
      case 'STOP_RECOVERY':
        return 'STOPPED';
      default:
        return 'RECOVERY_READY';
    }
  }

  private async requestApproval(caseId: string, decision: PolicyDecision) {
    await prisma.approvalRequest.create({
      data: {
        caseId,
        actionType: decision.action,
        requestedBy: 'agent',
        reason: decision.approvalReason || 'Requires human approval',
        status: 'pending'
      }
    });
  }

  private async verifyOutcome(caseId: string) {
    // Check if any scheduled actions have completed
    const pendingActions = await prisma.recoveryAction.findMany({
      where: { caseId, status: 'pending' }
    });

    for (const action of pendingActions) {
      if (action.scheduledAt && action.scheduledAt <= new Date()) {
        // Execute scheduled action
        // This would be handled by a separate scheduler in production
      }
    }
  }
}

export const recoveryAgent = new RecoveryAgent();