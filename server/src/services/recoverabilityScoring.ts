import { PrismaClient, FailureCategory } from '@prisma/client';
import { RecoverabilityScore, RecoverabilityFactor, AutopsyResult } from '@autopsy/shared';

const prisma = new PrismaClient();

interface ScoringInputs {
  paymentId: string;
  merchantId: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  failureCategory: FailureCategory;
  retryCount: number;
  timeSinceFailure: number; // minutes
  customerHistory: {
    successfulPayments: number;
    totalPayments: number;
    lifetimeValue: number;
    previousSuccessRate: number;
    recentPayments: Array<{ status: string; failureCategory?: FailureCategory; paymentMethod: string }>;
  };
  merchantStats: {
    recentFailureRate: number;
    normalFailureRate: number;
    degradationDetected: boolean;
  };
  autopsyResult: AutopsyResult;
  previousRecoveryAttempts: number;
  customerContactedRecently: boolean;
}

export class RecoverabilityScoringService {
  async calculate(inputs: ScoringInputs): Promise<RecoverabilityScore> {
    const factors: RecoverabilityFactor[] = [];
    let score = 50; // Base score

    // Factor 1: Customer historical success rate
    const successRateFactor = this.scoreSuccessRate(inputs.customerHistory.previousSuccessRate);
    factors.push(successRateFactor);
    score += successRateFactor.weight * successRateFactor.impact === 'positive' ? 1 : -1;

    // Factor 2: Failure category recoverability
    const categoryFactor = this.scoreFailureCategory(inputs.failureCategory, inputs.retryCount);
    factors.push(categoryFactor);
    score += categoryFactor.weight * (categoryFactor.impact === 'positive' ? 1 : -1);

    // Factor 3: Retry count
    const retryFactor = this.scoreRetryCount(inputs.retryCount);
    factors.push(retryFactor);
    score += retryFactor.weight * (retryFactor.impact === 'positive' ? 1 : -1);

    // Factor 4: Time since failure
    const timeFactor = this.scoreTimeSinceFailure(inputs.timeSinceFailure);
    factors.push(timeFactor);
    score += timeFactor.weight * (timeFactor.impact === 'positive' ? 1 : -1);

    // Factor 5: Transaction amount relative to customer norm
    const amountFactor = this.scoreAmount(inputs.amount, inputs.customerHistory);
    factors.push(amountFactor);
    score += amountFactor.weight * (amountFactor.impact === 'positive' ? 1 : -1);

    // Factor 6: Customer lifetime value
    const ltvFactor = this.scoreLTV(inputs.customerHistory.lifetimeValue);
    factors.push(ltvFactor);
    score += ltvFactor.weight * (ltvFactor.impact === 'positive' ? 1 : -1);

    // Factor 7: Merchant-level degradation
    const degradationFactor = this.scoreMerchantDegradation(inputs.merchantStats);
    factors.push(degradationFactor);
    score += degradationFactor.weight * (degradationFactor.impact === 'positive' ? 1 : -1);

    // Factor 8: Payment method reliability
    const methodFactor = this.scorePaymentMethod(inputs.paymentMethod, inputs.customerHistory);
    factors.push(methodFactor);
    score += methodFactor.weight * (methodFactor.impact === 'positive' ? 1 : -1);

    // Factor 9: Customer already contacted
    const contactFactor = this.scoreCustomerContact(inputs.customerContactedRecently);
    factors.push(contactFactor);
    score += contactFactor.weight * (contactFactor.impact === 'positive' ? 1 : -1);

    // Factor 10: Previous recovery attempts
    const prevRecoveryFactor = this.scorePreviousRecovery(inputs.previousRecoveryAttempts);
    factors.push(prevRecoveryFactor);
    score += prevRecoveryFactor.weight * (prevRecoveryFactor.impact === 'positive' ? 1 : -1);

    // Factor 11: Autopsy confidence
    const confidenceFactor = this.scoreAutopsyConfidence(inputs.autopsyResult.confidence);
    factors.push(confidenceFactor);
    score += confidenceFactor.weight * (confidenceFactor.impact === 'positive' ? 1 : -1);

    // Clamp score
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Calculate baseline comparison (simple retry strategy)
    const baselineComparison = this.calculateBaselineComparison(inputs);

    return {
      score,
      factors,
      explanation: this.generateExplanation(score, factors, inputs),
      baselineComparison
    };
  }

  private scoreSuccessRate(rate: number): RecoverabilityFactor {
    if (rate >= 0.9) return { factor: 'Customer Success Rate', impact: 'positive', weight: 15, description: `Excellent history: ${(rate * 100).toFixed(0)}% success rate` };
    if (rate >= 0.7) return { factor: 'Customer Success Rate', impact: 'positive', weight: 10, description: `Good history: ${(rate * 100).toFixed(0)}% success rate` };
    if (rate >= 0.5) return { factor: 'Customer Success Rate', impact: 'neutral', weight: 5, description: `Average history: ${(rate * 100).toFixed(0)}% success rate` };
    return { factor: 'Customer Success Rate', impact: 'negative', weight: 10, description: `Poor history: ${(rate * 100).toFixed(0)}% success rate` };
  }

  private scoreFailureCategory(category: FailureCategory, retryCount: number): RecoverabilityFactor {
    const categoryScores: Record<FailureCategory, { base: number; retryPenalty: number }> = {
      'temporary_gateway_issue': { base: 20, retryPenalty: 5 },
      'bank_timeout': { base: 15, retryPenalty: 5 },
      'network_issue': { base: 15, retryPenalty: 5 },
      'authentication_failure': { base: 5, retryPenalty: 8 },
      'insufficient_balance': { base: 10, retryPenalty: 5 },
      'expired_card': { base: 5, retryPenalty: 3 },
      'invalid_payment_method': { base: -5, retryPenalty: 5 },
      'customer_abandonment': { base: 0, retryPenalty: 3 },
      'repeated_failure': { base: -15, retryPenalty: 10 },
      'suspected_fraud': { base: -50, retryPenalty: 0 },
      'unknown': { base: -5, retryPenalty: 5 }
    };

    const config = categoryScores[category] || categoryScores.unknown;
    const adjusted = config.base - (retryCount * config.retryPenalty);
    
    if (adjusted >= 15) return { factor: 'Failure Category', impact: 'positive', weight: Math.abs(adjusted), description: `${category} typically has high recovery potential` };
    if (adjusted >= 0) return { factor: 'Failure Category', impact: 'neutral', weight: Math.abs(adjusted), description: `${category} has moderate recovery potential` };
    return { factor: 'Failure Category', impact: 'negative', weight: Math.abs(adjusted), description: `${category} has low recovery potential` };
  }

  private scoreRetryCount(retryCount: number): RecoverabilityFactor {
    if (retryCount === 0) return { factor: 'Retry Count', impact: 'positive', weight: 10, description: 'First recovery attempt - full potential' };
    if (retryCount === 1) return { factor: 'Retry Count', impact: 'neutral', weight: 5, description: 'One previous attempt - diminishing returns' };
    if (retryCount === 2) return { factor: 'Retry Count', impact: 'negative', weight: 10, description: 'Two previous attempts - low marginal recovery' };
    return { factor: 'Retry Count', impact: 'negative', weight: 15, description: `${retryCount} previous attempts - very low recovery probability` };
  }

  private scoreTimeSinceFailure(minutes: number): RecoverabilityFactor {
    if (minutes <= 30) return { factor: 'Time Since Failure', impact: 'positive', weight: 8, description: `Recent failure (${minutes} min) - issue may still be transient` };
    if (minutes <= 120) return { factor: 'Time Since Failure', impact: 'positive', weight: 5, description: `Within 2 hours (${minutes} min) - good recovery window` };
    if (minutes <= 1440) return { factor: 'Time Since Failure', impact: 'neutral', weight: 2, description: `Within 24 hours (${Math.round(minutes/60)} hrs) - standard recovery window` };
    return { factor: 'Time Since Failure', impact: 'negative', weight: 8, description: `Old failure (${Math.round(minutes/60)} hrs) - customer may have moved on` };
  }

  private scoreAmount(amount: number, history: ScoringInputs['customerHistory']): RecoverabilityFactor {
    const avgAmount = history.lifetimeValue / Math.max(history.totalPayments, 1);
    const ratio = amount / avgAmount;
    
    if (ratio <= 1.5) return { factor: 'Transaction Amount', impact: 'positive', weight: 8, description: `Amount (₹${(amount/100).toLocaleString()}) within customer norm` };
    if (ratio <= 3) return { factor: 'Transaction Amount', impact: 'neutral', weight: 3, description: `Amount moderately above customer average` };
    return { factor: 'Transaction Amount', impact: 'negative', weight: 10, description: `Amount significantly exceeds customer typical spend` };
  }

  private scoreLTV(ltv: number): RecoverabilityFactor {
    if (ltv >= 200000) return { factor: 'Customer Lifetime Value', impact: 'positive', weight: 8, description: `High-value customer (₹${(ltv/100).toLocaleString()} LTV) - worth extra recovery effort` };
    if (ltv >= 50000) return { factor: 'Customer Lifetime Value', impact: 'positive', weight: 5, description: `Valuable customer (₹${(ltv/100).toLocaleString()} LTV)` };
    if (ltv >= 10000) return { factor: 'Customer Lifetime Value', impact: 'neutral', weight: 2, description: `Regular customer (₹${(ltv/100).toLocaleString()} LTV)` };
    return { factor: 'Customer Lifetime Value', impact: 'negative', weight: 3, description: `Low-value customer (₹${(ltv/100).toLocaleString()} LTV) - limited recovery ROI` };
  }

  private scoreMerchantDegradation(stats: ScoringInputs['merchantStats']): RecoverabilityFactor {
    if (stats.degradationDetected) {
      return { factor: 'Merchant Degradation', impact: 'negative', weight: 12, description: `Merchant-wide degradation detected (${stats.recentFailureRate.toFixed(1)}% vs ${stats.normalFailureRate.toFixed(1)}% normal) - wait for resolution` };
    }
    if (stats.recentFailureRate < stats.normalFailureRate * 0.5) {
      return { factor: 'Merchant Degradation', impact: 'positive', weight: 3, description: `Better than normal failure rates - good recovery environment` };
    }
    return { factor: 'Merchant Degradation', impact: 'neutral', weight: 1, description: `Normal merchant failure rates` };
  }

  private scorePaymentMethod(method: string, history: ScoringInputs['customerHistory']): RecoverabilityFactor {
    const methodSuccess = history.recentPayments.filter(p => p.paymentMethod === method && p.status === 'success').length;
    const methodTotal = history.recentPayments.filter(p => p.paymentMethod === method).length;
    const methodRate = methodTotal > 0 ? methodSuccess / methodTotal : 0;

    if (methodRate >= 0.8 && methodTotal >= 3) return { factor: 'Payment Method Reliability', impact: 'positive', weight: 8, description: `${method} has ${(methodRate * 100).toFixed(0)}% success rate for this customer` };
    if (methodRate >= 0.5) return { factor: 'Payment Method Reliability', impact: 'neutral', weight: 3, description: `${method} has mixed results for this customer` };
    return { factor: 'Payment Method Reliability', impact: 'negative', weight: 5, description: `${method} has low success rate - consider alternative` };
  }

  private scoreCustomerContact(contacted: boolean): RecoverabilityFactor {
    if (contacted) return { factor: 'Customer Contact', impact: 'negative', weight: 10, description: 'Customer already contacted recently - avoid notification fatigue' };
    return { factor: 'Customer Contact', impact: 'positive', weight: 5, description: 'Customer not contacted yet - notification available' };
  }

  private scorePreviousRecovery(attempts: number): RecoverabilityFactor {
    if (attempts === 0) return { factor: 'Previous Recovery Attempts', impact: 'positive', weight: 8, description: 'No previous recovery attempts - full intervention options available' };
    if (attempts === 1) return { factor: 'Previous Recovery Attempts', impact: 'neutral', weight: 3, description: 'One previous recovery attempt' };
    return { factor: 'Previous Recovery Attempts', impact: 'negative', weight: 10, description: `${attempts} previous recovery attempts - diminishing returns` };
  }

  private scoreAutopsyConfidence(confidence: number): RecoverabilityFactor {
    if (confidence >= 0.9) return { factor: 'Diagnosis Confidence', impact: 'positive', weight: 8, description: `High-confidence diagnosis (${(confidence * 100).toFixed(0)}%) - targeted intervention possible` };
    if (confidence >= 0.7) return { factor: 'Diagnosis Confidence', impact: 'positive', weight: 5, description: `Good confidence (${(confidence * 100).toFixed(0)}%) - reasonable intervention basis` };
    if (confidence >= 0.5) return { factor: 'Diagnosis Confidence', impact: 'neutral', weight: 2, description: `Moderate confidence (${(confidence * 100).toFixed(0)}%) - cautious approach` };
    return { factor: 'Diagnosis Confidence', impact: 'negative', weight: 5, description: `Low confidence (${(confidence * 100).toFixed(0)}%) - uncertain diagnosis` };
  }

  private calculateBaselineComparison(inputs: ScoringInputs): number {
    // Simple baseline: retry after 30 minutes with no intelligence
    const category = inputs.failureCategory;
    const retryCount = inputs.retryCount;
    
    const baselineRates: Record<FailureCategory, number> = {
      'temporary_gateway_issue': 0.35,
      'bank_timeout': 0.30,
      'network_issue': 0.25,
      'authentication_failure': 0.10,
      'insufficient_balance': 0.15,
      'expired_card': 0.05,
      'invalid_payment_method': 0.02,
      'customer_abandonment': 0.08,
      'repeated_failure': 0.03,
      'suspected_fraud': 0.00,
      'unknown': 0.10
    };

    const baselineRate = baselineRates[category] || 0.10;
    const retryPenalty = retryCount * 0.15;
    return Math.max(0, (baselineRate - retryPenalty) * 100);
  }

  private generateExplanation(score: number, factors: RecoverabilityFactor[], inputs: ScoringInputs): string {
    const positiveFactors = factors.filter(f => f.impact === 'positive' && f.weight > 5);
    const negativeFactors = factors.filter(f => f.impact === 'negative' && f.weight > 5);
    
    let explanation = `Recoverability Score: ${score}/100\n\n`;
    
    if (positiveFactors.length > 0) {
      explanation += `Positive factors:\n`;
      positiveFactors.forEach(f => explanation += `• ${f.description}\n`);
      explanation += '\n';
    }
    
    if (negativeFactors.length > 0) {
      explanation += `Risk factors:\n`;
      negativeFactors.forEach(f => explanation += `• ${f.description}\n`);
      explanation += '\n';
    }
    
    const category = inputs.failureCategory;
    const baselineRate = this.calculateBaselineComparison(inputs);
    const improvement = score - baselineRate;
    
    explanation += `Baseline retry strategy would achieve ~${baselineRate.toFixed(0)}% recovery probability. `;
    explanation += `AI-guided approach: ${improvement > 0 ? `+${improvement.toFixed(0)}%` : `${improvement.toFixed(0)}%`} difference.`;
    
    return explanation;
  }
}

export const recoverabilityScoringService = new RecoverabilityScoringService();