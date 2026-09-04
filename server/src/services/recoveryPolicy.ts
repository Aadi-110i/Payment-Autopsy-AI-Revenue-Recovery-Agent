import { PrismaClient, PolicyRule, RecoveryActionType, RecoveryCaseStatus } from '@prisma/client';
import { PolicyDecision, RecoveryAction, AutopsyResult, RecoverabilityScore } from '@autopsy/shared';

const prisma = new PrismaClient();

interface PolicyEvaluationInputs {
  caseId: string;
  merchantId: string;
  amount: number;
  failureCategory: string;
  retryCount: number;
  recoverabilityScore: number;
  autopsyResult: AutopsyResult;
  recoverability: RecoverabilityScore;
  customerContactedRecently: boolean;
  previousRecoveryAttempts: number;
  currentActions: RecoveryAction[];
  merchantPolicyRules: PolicyRule[];
}

export class RecoveryPolicyEngine {
  async evaluate(inputs: PolicyEvaluationInputs): Promise<PolicyDecision> {
    const { amount, failureCategory, retryCount, recoverabilityScore, merchantPolicyRules, customerContactedRecently, previousRecoveryAttempts, currentActions } = inputs;
    
    const appliedRules: string[] = [];
    const stopConditions: string[] = [];
    let allowed = false;
    let action: RecoveryActionType = 'STOP_RECOVERY';
    let reason = '';
    let requiresApproval = false;
    let approvalReason = '';
    let cooldownUntil: Date | undefined;

    // Rule 1: Hard stops - fraud
    if (failureCategory === 'suspected_fraud') {
      appliedRules.push('fraud_prevention');
      stopConditions.push('Suspected fraud - recovery blocked');
      action = 'STOP_RECOVERY';
      reason = 'Suspected fraud detected - escalated to risk review';
      requiresApproval = false;
      return { allowed: false, action, reason, policyRulesApplied: appliedRules, requiresApproval, stopConditions };
    }

    // Rule 2: Maximum retry limit
    if (retryCount >= 2) {
      appliedRules.push('max_retry_limit');
      stopConditions.push('Maximum autonomous retries (2) reached');
      action = 'STOP_RECOVERY';
      reason = 'Maximum retry limit reached - autonomous recovery stopped';
      requiresApproval = false;
      return { allowed: false, action, reason, policyRulesApplied: appliedRules, requiresApproval, stopConditions, cooldownUntil };
    }

    // Rule 3: High value requires approval
    if (amount > 50000) {
      appliedRules.push('high_value_approval');
      requiresApproval = true;
      approvalReason = `Transaction amount ₹${(amount / 100).toLocaleString()} exceeds ₹50,000 autonomous threshold`;
    }

    // Rule 4: Customer contact cooldown
    if (customerContactedRecently) {
      appliedRules.push('customer_contact_cooldown');
      stopConditions.push('Customer contacted within last 24 hours');
      // Allow non-notification actions
    }

    // Rule 5: Low recoverability
    if (recoverabilityScore < 30) {
      appliedRules.push('low_recoverability');
      stopConditions.push(`Low recoverability score: ${recoverabilityScore}`);
      action = 'STOP_RECOVERY';
      reason = `Recoverability score (${recoverabilityScore}) below threshold (30)`;
      requiresApproval = false;
      return { allowed: false, action, reason, policyRulesApplied: appliedRules, requiresApproval, stopConditions, cooldownUntil };
    }

    // Rule 6: Merchant-wide degradation - delay retries
    if (inputs.autopsyResult.evidence.some(e => e.includes('Merchant-wide') || e.includes('degradation'))) {
      appliedRules.push('merchant_degradation');
      // Schedule retry for later instead of immediate
      cooldownUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    }

    // Determine action based on failure category and recoverability
    const recommendedAction = inputs.autopsyResult.recommendedNextStep;
    
    // Check if recommended action is allowed by policy
    const actionAllowed = this.isActionAllowed(recommendedAction, inputs, appliedRules, stopConditions);
    
    if (actionAllowed.allowed) {
      allowed = true;
      action = recommendedAction;
      reason = actionAllowed.reason;
    } else {
      // Fallback to safe action
      allowed = false;
      action = 'STOP_RECOVERY';
      reason = actionAllowed.reason;
      stopConditions.push(...actionAllowed.stopConditions);
    }

    // Check if any current action is already pending/executing
    const pendingAction = currentActions.find(a => a.status === 'pending' || a.status === 'executing');
    if (pendingAction) {
      allowed = false;
      action = 'STOP_RECOVERY';
      reason = `Action ${pendingAction.type} already in progress`;
      stopConditions.push('Concurrent action prevention');
    }

    return {
      allowed,
      action,
      reason,
      policyRulesApplied: appliedRules,
      requiresApproval,
      approvalReason,
      stopConditions,
      cooldownUntil
    };
  }

  private isActionAllowed(
    action: RecoveryActionType, 
    inputs: PolicyEvaluationInputs,
    appliedRules: string[],
    stopConditions: string[]
  ): { allowed: boolean; reason: string; stopConditions: string[] } {
    const { retryCount, recoverabilityScore, customerContactedRecently, amount, failureCategory } = inputs;

    switch (action) {
      case 'SCHEDULE_RETRY':
        if (retryCount >= 2) {
          return { allowed: false, reason: 'Max retries reached', stopConditions: ['Max retry limit'] };
        }
        if (recoverabilityScore < 40) {
          return { allowed: false, reason: 'Recoverability too low for retry', stopConditions: ['Low recoverability'] };
        }
        if (failureCategory === 'suspected_fraud') {
          return { allowed: false, reason: 'Fraud case - no retries', stopConditions: ['Fraud prevention'] };
        }
        return { allowed: true, reason: 'Scheduled retry permitted by policy', stopConditions: [] };

      case 'SEND_PAYMENT_LINK':
        if (customerContactedRecently) {
          return { allowed: false, reason: 'Customer contacted recently', stopConditions: ['Customer contact cooldown'] };
        }
        if (failureCategory !== 'insufficient_balance' && failureCategory !== 'customer_abandonment') {
          return { allowed: false, reason: 'Payment link not appropriate for this failure type', stopConditions: ['Inappropriate action'] };
        }
        return { allowed: true, reason: 'Payment link allowed for balance/abandonment issues', stopConditions: [] };

      case 'SEND_RECOVERY_NOTIFICATION':
        if (customerContactedRecently) {
          return { allowed: false, reason: 'Customer contacted recently', stopConditions: ['Customer contact cooldown'] };
        }
        if (failureCategory === 'suspected_fraud') {
          return { allowed: false, reason: 'Fraud case - no notifications', stopConditions: ['Fraud prevention'] };
        }
        return { allowed: true, reason: 'Recovery notification permitted', stopConditions: [] };

      case 'REQUEST_ALTERNATIVE_PAYMENT_METHOD':
        if (failureCategory !== 'expired_card' && failureCategory !== 'invalid_payment_method') {
          return { allowed: false, reason: 'Alternative method request not appropriate', stopConditions: ['Inappropriate action'] };
        }
        return { allowed: true, reason: 'Alternative payment method request permitted', stopConditions: [] };

      case 'ESCALATE_TO_HUMAN':
        return { allowed: true, reason: 'Escalation to human review permitted', stopConditions: [] };

      case 'STOP_RECOVERY':
        return { allowed: true, reason: 'Recovery stopped per policy', stopConditions: stopConditions };

      case 'RETRY_PAYMENT':
        // Immediate retry - only for specific cases
        if (retryCount >= 1) {
          return { allowed: false, reason: 'Immediate retry not allowed after first attempt', stopConditions: ['Retry policy'] };
        }
        if (recoverabilityScore > 80 && (failureCategory === 'network_issue' || failureCategory === 'bank_timeout')) {
          return { allowed: true, reason: 'Immediate retry for high-confidence transient failure', stopConditions: [] };
        }
        return { allowed: false, reason: 'Immediate retry not recommended', stopConditions: ['Retry policy'] };

      default:
        return { allowed: false, reason: 'Unknown action', stopConditions: ['Invalid action'] };
    }
  }

  // Get active policy rules for a merchant
  async getMerchantPolicyRules(merchantId: string): Promise<PolicyRule[]> {
    return prisma.policyRule.findMany({
      where: { merchantId, enabled: true },
      orderBy: { priority: 'desc' }
    });
  }

  // Check if a specific action requires approval
  async requiresApproval(merchantId: string, action: RecoveryActionType, amount: number): Promise<{ required: boolean; reason?: string }> {
    const rules = await this.getMerchantPolicyRules(merchantId);
    
    for (const rule of rules) {
      const condition = rule.condition as Record<string, unknown>;
      
      if (rule.action === 'ESCALATE_TO_HUMAN') {
        if (condition.amount && typeof condition.amount === 'object' && 'gt' in condition.amount) {
          if (amount > (condition.amount.gt as number)) {
            return { required: true, reason: rule.description };
          }
        }
        if (condition.failureCategory === 'suspected_fraud') {
          return { required: true, reason: rule.description };
        }
      }
    }
    
    // Default rules
    if (amount > 50000) return { required: true, reason: 'High value transaction requires approval' };
    if (action === 'ESCALATE_TO_HUMAN') return { required: true, reason: 'Escalation requires human review' };
    
    return { required: false };
  }

  // Get default policy configuration
  getDefaultPolicyConfig() {
    return {
      maxRetries: 2,
      minRetryDelayMinutes: 15,
      maxRecoveryAttempts: 3,
      maxAutonomousAmount: 50000,
      customerContactCooldownHours: 24,
      escalationThresholds: {
        retryCount: 2,
        amount: 50000,
        recoverabilityScore: 30
      },
      cooldownPeriods: {
        merchantDegradationMinutes: 60,
        customerContactHours: 24
      }
    };
  }
}

export const recoveryPolicyEngine = new RecoveryPolicyEngine();