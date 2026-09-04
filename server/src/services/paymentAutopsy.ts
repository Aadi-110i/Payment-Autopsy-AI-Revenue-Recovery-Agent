import { PrismaClient, FailureCategory, Prisma } from '@prisma/client';
import { AutopsyResult, TransactionSummary, RecoveryActionType } from '@autopsy/shared';

const prisma = new PrismaClient();

interface AutopsyInputs {
  paymentId: string;
  merchantId: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  failureCode: string;
  failureDescription?: string;
  retryCount: number;
  timestamp: Date;
  customerHistory: {
    successfulPayments: number;
    totalPayments: number;
    lifetimeValue: number;
    previousSuccessRate: number;
    recentPayments: TransactionSummary[];
  };
  merchantStats: {
    recentFailureRate: number;
    normalFailureRate: number;
    degradationDetected: boolean;
    affectedPaymentMethods: string[];
  };
  previousAttempts: Array<{
    attemptNumber: number;
    status: string;
    failureCode?: string;
    failureCategory?: FailureCategory;
    executedAt: Date;
  }>;
}

export class PaymentAutopsyService {
  async analyze(inputs: AutopsyInputs): Promise<AutopsyResult> {
    const { paymentMethod, failureCode, retryCount, customerHistory, merchantStats, previousAttempts } = inputs;
    
    const category = this.determineCategory(inputs);
    const confidence = this.calculateConfidence(category, inputs);
    const evidence = this.gatherEvidence(category, inputs);
    const severity = this.determineSeverity(category, inputs);
    const recoverability = this.estimateRecoverability(category, inputs);
    const recommendedNextStep = this.recommendNextStep(category, recoverability, retryCount, inputs);
    const explanation = this.generateExplanation(category, confidence, evidence, inputs);
    const supportingTransactionHistory = this.getSupportingHistory(inputs);

    return {
      failureCategory: category,
      rootCauseHypothesis: this.generateHypothesis(category, inputs),
      confidence,
      evidence,
      evidenceType: evidence.length > 0 && evidence.some(e => e.includes('direct')) ? 'direct' : 'inferred',
      severity,
      recoverability,
      recommendedNextStep,
      explanation,
      supportingTransactionHistory
    };
  }

  private determineCategory(inputs: AutopsyInputs): FailureCategory {
    const { failureCode, paymentMethod, retryCount, merchantStats, customerHistory, previousAttempts } = inputs;

    // Direct mapping from failure codes
    const codeCategory = this.mapFailureCodeToCategory(failureCode, paymentMethod);
    if (codeCategory !== 'unknown') {
      // Override for specific patterns
      if (codeCategory === 'temporary_gateway_issue' && merchantStats.degradationDetected) {
        return 'temporary_gateway_issue';
      }
      if (codeCategory === 'insufficient_balance' && customerHistory.previousSuccessRate < 0.5) {
        return 'repeated_failure';
      }
      return codeCategory;
    }

    // Pattern-based detection
    if (merchantStats.degradationDetected && merchantStats.affectedPaymentMethods.includes(paymentMethod)) {
      return 'temporary_gateway_issue';
    }

    if (retryCount >= 2) {
      const sameCategory = previousAttempts.every(a => a.failureCategory === previousAttempts[0].failureCategory);
      if (sameCategory && previousAttempts[0].failureCategory) {
        return 'repeated_failure';
      }
    }

    if (customerHistory.recentPayments.length > 0) {
      const recentFailures = customerHistory.recentPayments.filter(p => p.status === 'failed').length;
      if (recentFailures >= 3) {
        return 'repeated_failure';
      }
    }

    // Check for abandonment pattern (quick failure after checkout)
    if (failureCode === 'PAYMENT_TIMEOUT' && retryCount === 0) {
      return 'customer_abandonment';
    }

    return 'unknown';
  }

  private mapFailureCodeToCategory(code: string, method: string): FailureCategory {
    const mappings: Record<string, FailureCategory> = {
      'PAYMENT_TIMEOUT': 'temporary_gateway_issue',
      'INSUFFICIENT_FUNDS': 'insufficient_balance',
      'INSUFFICIENT_BALANCE': 'insufficient_balance',
      'UPI_PIN_INCORRECT': 'authentication_failure',
      'INVALID_CVV': 'authentication_failure',
      'INVALID_CREDENTIALS': 'authentication_failure',
      'BANK_DOWN': 'bank_timeout',
      'BANK_TIMEOUT': 'bank_timeout',
      'NETWORK_ERROR': 'network_issue',
      'SESSION_EXPIRED': 'network_issue',
      'EXPIRED_CARD': 'expired_card',
      'CARD_DECLINED': 'invalid_payment_method',
      '3D_SECURE_FAILED': 'authentication_failure',
      'KYC_INCOMPLETE': 'invalid_payment_method',
      'WALLET_LIMIT_EXCEEDED': 'invalid_payment_method',
      'ELIGIBILITY_FAILED': 'invalid_payment_method',
      'BANK_REJECTED': 'invalid_payment_method',
      'DOCUMENTS_INCOMPLETE': 'invalid_payment_method'
    };
    return mappings[code] || 'unknown';
  }

  private calculateConfidence(category: FailureCategory, inputs: AutopsyInputs): number {
    const { failureCode, merchantStats, previousAttempts, customerHistory } = inputs;
    let confidence = 0.5;

    // Direct code mapping gives high confidence
    const directMapping = this.mapFailureCodeToCategory(inputs.failureCode, inputs.paymentMethod);
    if (directMapping !== 'unknown' && directMapping === category) {
      confidence = 0.85;
    }

    // Merchant-wide degradation boosts confidence for temporary_gateway_issue
    if (category === 'temporary_gateway_issue' && merchantStats.degradationDetected) {
      confidence = Math.max(confidence, 0.9);
    }

    // Repeated same failure boosts confidence
    if (category === 'repeated_failure' && previousAttempts.length >= 2) {
      const sameCategory = previousAttempts.every(a => a.failureCategory === category);
      if (sameCategory) confidence = Math.max(confidence, 0.88);
    }

    // Customer history patterns
    if (category === 'insufficient_balance' && customerHistory.previousSuccessRate < 0.6) {
      confidence = Math.max(confidence, 0.82);
    }

    // Expired card is usually definitive
    if (category === 'expired_card') {
      confidence = 0.95;
    }

    return Math.min(confidence, 0.99);
  }

  private gatherEvidence(category: FailureCategory, inputs: AutopsyInputs): string[] {
    const { paymentMethod, failureCode, retryCount, merchantStats, customerHistory, previousAttempts, timestamp } = inputs;
    const evidence: string[] = [];

    switch (category) {
      case 'temporary_gateway_issue':
        if (merchantStats.degradationDetected) {
          evidence.push(`Merchant-wide ${paymentMethod} degradation detected: ${merchantStats.currentFailureRate.toFixed(1)}% failure rate (normal: ${merchantStats.normalFailureRate.toFixed(1)}%)`);
          evidence.push(`${merchantStats.affectedPayments} payments affected in last 30 minutes`);
        }
        if (previousAttempts.length > 0) {
          const recentSuccess = previousAttempts.find(a => a.status === 'success');
          if (recentSuccess) {
            evidence.push(`Previous successful payment ${this.timeAgo(recentSuccess.executedAt, timestamp)}`);
          }
        }
        evidence.push(`${failureCode} is characteristic of transient gateway issues`);
        break;

      case 'insufficient_balance':
        evidence.push(`Customer has ${customerHistory.successfulPayments}/${customerHistory.totalPayments} historical success rate (${(customerHistory.previousSuccessRate * 100).toFixed(0)}%)`);
        if (customerHistory.recentPayments.length > 0) {
          const recentInsufficient = customerHistory.recentPayments.filter(p => p.failureCategory === 'insufficient_balance').length;
          if (recentInsufficient > 0) {
            evidence.push(`${recentInsufficient} recent insufficient balance failures`);
          }
        }
        evidence.push(`Transaction amount ₹${(inputs.amount / 100).toLocaleString()} may exceed available balance`);
        break;

      case 'expired_card':
        evidence.push('Card expiry date indicates card is expired');
        const altSuccess = customerHistory.recentPayments.filter(p => p.paymentMethod !== paymentMethod && p.status === 'success').length;
        if (altSuccess > 0) {
          evidence.push(`Customer has ${altSuccess} successful payments with alternative payment methods`);
        }
        break;

      case 'authentication_failure':
        evidence.push(`${failureCode} indicates authentication failure`);
        if (retryCount > 0) {
          evidence.push(`${retryCount} previous attempt(s) with same authentication error`);
        }
        break;

      case 'bank_timeout':
        evidence.push('Issuing bank did not respond within timeout window');
        if (merchantStats.degradationDetected && merchantStats.affectedPaymentMethods.includes('netbanking')) {
          evidence.push('Coincides with merchant-wide netbanking degradation');
        }
        break;

      case 'repeated_failure':
        evidence.push(`${previousAttempts.length} consecutive failed attempts`);
        const categories = [...new Set(previousAttempts.map(a => a.failureCategory).filter(Boolean))];
        if (categories.length === 1) {
          evidence.push(`All failures categorized as ${categories[0]}`);
        }
        evidence.push(`Customer success rate: ${(customerHistory.previousSuccessRate * 100).toFixed(0)}%`);
        break;

      case 'customer_abandonment':
        evidence.push('Payment failed immediately after checkout initiation');
        evidence.push('No retry attempts made by customer');
        evidence.push('Session timing consistent with user abandonment');
        break;

      case 'suspected_fraud':
        evidence.push('Unusually high transaction amount for this customer');
        evidence.push('New device and geography combination');
        evidence.push('Velocity anomaly: multiple high-value attempts in short window');
        break;

      default:
        evidence.push(`Failure code: ${failureCode}`);
        evidence.push(`Payment method: ${paymentMethod}`);
        evidence.push(`Retry count: ${retryCount}`);
    }

    return evidence;
  }

  private determineSeverity(category: FailureCategory, inputs: AutopsyInputs): 'low' | 'medium' | 'high' | 'critical' {
    const { amount, failureCode, customerHistory } = inputs;
    
    if (category === 'suspected_fraud') return 'critical';
    if (category === 'repeated_failure' && inputs.retryCount >= 3) return 'high';
    if (category === 'insufficient_balance' && customerHistory.previousSuccessRate < 0.5) return 'high';
    if (amount > 100000) return 'high';
    if (category === 'expired_card' || category === 'invalid_payment_method') return 'medium';
    if (category === 'temporary_gateway_issue' || category === 'bank_timeout') return 'medium';
    return 'low';
  }

  private estimateRecoverability(category: FailureCategory, inputs: AutopsyInputs): 'high' | 'medium' | 'low' | 'none' {
    const { retryCount, customerHistory, merchantStats, amount } = inputs;

    if (category === 'suspected_fraud') return 'none';
    if (category === 'repeated_failure' && retryCount >= 3) return 'low';
    if (category === 'expired_card') return 'medium'; // Can recover with new card
    if (category === 'invalid_payment_method') return 'low';
    if (category === 'customer_abandonment') return 'low';
    
    if (category === 'temporary_gateway_issue') {
      if (merchantStats.degradationDetected) return 'medium'; // Wait for degradation to resolve
      if (retryCount === 0 && customerHistory.previousSuccessRate > 0.7) return 'high';
      return 'medium';
    }

    if (category === 'insufficient_balance') {
      if (customerHistory.previousSuccessRate > 0.8) return 'high';
      if (customerHistory.previousSuccessRate > 0.5) return 'medium';
      return 'low';
    }

    if (category === 'bank_timeout' || category === 'network_issue') {
      if (retryCount === 0) return 'high';
      return 'medium';
    }

    if (category === 'authentication_failure') {
      if (retryCount === 0) return 'medium';
      return 'low';
    }

    return 'low';
  }

  private recommendNextStep(
    category: FailureCategory, 
    recoverability: string, 
    retryCount: number,
    inputs: AutopsyInputs
  ): RecoveryActionType {
    const { amount } = inputs;

    if (recoverability === 'none') return 'STOP_RECOVERY';
    if (category === 'suspected_fraud') return 'ESCALATE_TO_HUMAN';
    if (amount > 50000) return 'ESCALATE_TO_HUMAN';

    if (category === 'temporary_gateway_issue' && retryCount === 0 && recoverability === 'high') {
      return 'SCHEDULE_RETRY';
    }
    if (category === 'bank_timeout' && retryCount === 0) {
      return 'SCHEDULE_RETRY';
    }
    if (category === 'network_issue' && retryCount === 0) {
      return 'SCHEDULE_RETRY';
    }
    if (category === 'insufficient_balance' && recoverability === 'high') {
      return 'SEND_PAYMENT_LINK';
    }
    if (category === 'expired_card') {
      return 'REQUEST_ALTERNATIVE_PAYMENT_METHOD';
    }
    if (category === 'authentication_failure' && retryCount === 0) {
      return 'SEND_RECOVERY_NOTIFICATION';
    }
    if (category === 'customer_abandonment') {
      return 'SEND_RECOVERY_NOTIFICATION';
    }
    if (retryCount >= 2) {
      return 'STOP_RECOVERY';
    }

    return 'ESCALATE_TO_HUMAN';
  }

  private generateHypothesis(category: FailureCategory, inputs: AutopsyInputs): string {
    const { paymentMethod, failureCode, merchantStats } = inputs;

    const hypotheses: Record<FailureCategory, string> = {
      'temporary_gateway_issue': merchantStats.degradationDetected 
        ? `Transient ${paymentMethod} gateway degradation affecting multiple merchants`
        : `Transient ${paymentMethod} gateway timeout - likely temporary infrastructure issue`,
      'bank_timeout': `Issuing bank timeout - bank infrastructure temporarily unavailable`,
      'network_issue': `Network connectivity issue between customer and payment gateway`,
      'authentication_failure': `Customer authentication failed - incorrect credentials or expired session`,
      'insufficient_balance': `Customer account/wallet has insufficient funds for this transaction amount`,
      'expired_card': `Payment card has expired - customer needs to update payment method`,
      'invalid_payment_method': `Payment method configuration invalid or not supported for this transaction`,
      'customer_abandonment': `Customer abandoned checkout before completing payment`,
      'repeated_failure': `Persistent failure pattern - same root cause across multiple attempts`,
      'suspected_fraud': `Transaction exhibits fraud indicators - unusual amount, device, velocity`,
      'unknown': `Unable to determine specific root cause from available data`
    };

    return hypotheses[category] || 'Unable to determine root cause';
  }

  private generateExplanation(category: FailureCategory, confidence: number, evidence: string[], inputs: AutopsyInputs): string {
    const { amount, paymentMethod, retryCount } = inputs;
    const amountStr = `₹${(amount / 100).toLocaleString()}`;

    const templates: Record<FailureCategory, string> = {
      'temporary_gateway_issue': `This ${paymentMethod} payment of ${amountStr} likely failed due to a transient gateway issue. ${evidence[0]}. The ${(confidence * 100).toFixed(0)}% confidence is based on ${evidence.length} evidence points including merchant-wide failure patterns and recent successful payment history.`,
      'insufficient_balance': `The payment of ${amountStr} failed due to insufficient balance. ${evidence[0]}. Customer has a ${(inputs.customerHistory.previousSuccessRate * 100).toFixed(0)}% historical success rate with ${evidence.length} supporting evidence points.`,
      'expired_card': `Payment failed because the card on file has expired. ${evidence[0]}. Customer has successfully used alternative payment methods before, suggesting high recoverability with a payment method update.`,
      'authentication_failure': `Authentication failed for this ${paymentMethod} payment. ${evidence[0]}. ${retryCount > 0 ? `This is attempt #${retryCount + 1}.` : 'First attempt - customer may need to re-enter credentials.'}`,
      'bank_timeout': `The issuing bank did not respond within the timeout window. ${evidence[0]}. This is typically a temporary bank-side issue.`,
      'network_issue': `Network connectivity issue prevented payment completion. ${evidence[0]}. Usually resolves on retry.`,
      'customer_abandonment': `Customer appears to have abandoned the checkout flow. ${evidence[0]}. A recovery notification may bring them back.`,
      'repeated_failure': `This payment has failed ${retryCount + 1} times with consistent failure pattern. ${evidence[0]}. Further autonomous retries unlikely to succeed.`,
      'suspected_fraud': `This transaction shows multiple fraud indicators. ${evidence[0]}. Recovery attempts blocked pending risk review.`,
      'unknown': `Unable to classify failure with high confidence. ${evidence[0]}. Manual review recommended.`
    };

    return templates[category] || 'Unable to generate explanation';
  }

  private getSupportingHistory(inputs: AutopsyInputs): TransactionSummary[] {
    return inputs.customerHistory.recentPayments.slice(0, 10).map(p => ({
      paymentId: p.paymentId,
      amount: p.amount,
      status: p.status,
      timestamp: p.timestamp,
      failureCategory: p.failureCategory,
      paymentMethod: p.paymentMethod
    }));
  }

  private timeAgo(date: Date, reference: Date): string {
    const diffMs = reference.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
  }

  // Helper method to fetch all required data for autopsy
  async gatherInputs(paymentId: string): Promise<AutopsyInputs | null> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        customer: true,
        attempts: { orderBy: { attemptNumber: 'asc' } },
        failureEvents: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    if (!payment) return null;

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

  private async getMerchantStats(merchantId: string, paymentMethod: string) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [recentPayments, normalPayments] = await Promise.all([
      prisma.payment.findMany({
        where: {
          merchantId,
          paymentMethod,
          createdAt: { gte: thirtyMinutesAgo }
        }
      }),
      prisma.payment.findMany({
        where: {
          merchantId,
          paymentMethod,
          createdAt: { gte: twentyFourHoursAgo, lt: thirtyMinutesAgo }
        }
      })
    ]);

    const recentTotal = recentPayments.length;
    const recentFailed = recentPayments.filter(p => p.status === 'failed').length;
    const normalTotal = normalPayments.length;
    const normalFailed = normalPayments.filter(p => p.status === 'failed').length;

    const recentFailureRate = recentTotal > 0 ? (recentFailed / recentTotal) * 100 : 0;
    const normalFailureRate = normalTotal > 0 ? (normalFailed / normalTotal) * 100 : 0;
    const degradationDetected = recentFailureRate > normalFailureRate * 2 && recentFailureRate > 10;

    return {
      recentFailureRate,
      normalFailureRate,
      degradationDetected,
      affectedPayments: recentFailed,
      affectedPaymentMethods: degradationDetected ? [paymentMethod] : []
    };
  }
}

export const paymentAutopsyService = new PaymentAutopsyService();