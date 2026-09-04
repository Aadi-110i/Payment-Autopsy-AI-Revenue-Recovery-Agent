import { PrismaClient } from '@prisma/client';
import { SeedPayment, FailureCategory } from '@autopsy/shared';

const prisma = new PrismaClient();

const MERCHANT_ID = 'merchant_demo_001';
const MERCHANT_NAME = 'Demo Merchant';

const paymentMethods = ['upi', 'card', 'netbanking', 'wallet', 'emi'];
const failureCodes = {
  upi: ['PAYMENT_TIMEOUT', 'INSUFFICIENT_FUNDS', 'UPI_PIN_INCORRECT', 'BANK_DOWN', 'NETWORK_ERROR'],
  card: ['CARD_DECLINED', 'EXPIRED_CARD', 'INVALID_CVV', 'INSUFFICIENT_FUNDS', '3D_SECURE_FAILED'],
  netbanking: ['BANK_TIMEOUT', 'INVALID_CREDENTIALS', 'BANK_DOWN', 'SESSION_EXPIRED'],
  wallet: ['INSUFFICIENT_BALANCE', 'KYC_INCOMPLETE', 'WALLET_LIMIT_EXCEEDED'],
  emi: ['ELIGIBILITY_FAILED', 'BANK_REJECTED', 'DOCUMENTS_INCOMPLETE']
};

const geographies = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad'];
const deviceTypes = ['mobile', 'desktop', 'tablet'];

function getFailureCategory(method: string, code: string): FailureCategory {
  if (code === 'INSUFFICIENT_FUNDS' || code === 'INSUFFICIENT_BALANCE') return 'insufficient_balance';
  if (code === 'EXPIRED_CARD') return 'expired_card';
  if (code === 'UPI_PIN_INCORRECT' || code === 'INVALID_CVV' || code === 'INVALID_CREDENTIALS') return 'authentication_failure';
  if (code === 'BANK_DOWN' || code === 'BANK_TIMEOUT') return 'bank_timeout';
  if (code === 'NETWORK_ERROR' || code === 'SESSION_EXPIRED') return 'network_issue';
  if (code === 'PAYMENT_TIMEOUT') return 'temporary_gateway_issue';
  if (code === 'CARD_DECLINED' || code === '3D_SECURE_FAILED' || code === 'ELIGIBILITY_FAILED' || code === 'BANK_REJECTED') return 'invalid_payment_method';
  if (code === 'KYC_INCOMPLETE' || code === 'WALLET_LIMIT_EXCEEDED' || code === 'DOCUMENTS_INCOMPLETE') return 'invalid_payment_method';
  return 'unknown';
}

function generateSeedPayments(): SeedPayment[] {
  const payments: SeedPayment[] = [];
  const baseTime = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
  
  // Create 10,000 payments with realistic patterns
  for (let i = 0; i < 10000; i++) {
    const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const codes = failureCodes[method as keyof typeof failureCodes];
    const failureCode = codes[Math.floor(Math.random() * codes.length)];
    const isFailure = Math.random() < 0.35; // 35% failure rate
    const timestamp = new Date(baseTime + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Customer with history
    const customerId = `cust_${String(Math.floor(i / 50)).padStart(4, '0')}`;
    const customerPayments = Math.floor(Math.random() * 50) + 5;
    const customerSuccessRate = 0.7 + Math.random() * 0.25; // 70-95%
    const customerLTV = Math.floor(10000 + Math.random() * 500000);
    
    // Create patterns for specific scenarios
    let category: FailureCategory = 'unknown';
    let retryCount = 0;
    let amount = Math.floor(100 + Math.random() * 50000);
    
    // Scenario A: Temporary gateway degradation (UPI failures spike at specific times)
    const hour = new Date(timestamp).getHours();
    const minute = new Date(timestamp).getMinutes();
    const isUpiDegradationWindow = method === 'upi' && hour === 20 && minute >= 10 && minute <= 35;
    
    // Scenario B: Insufficient balance pattern for specific customers
    const isLowBalanceCustomer = customerId.endsWith('0001') || customerId.endsWith('0002');
    
    // Scenario C: Customer abandonment (quick failures after checkout)
    const isAbandonment = Math.random() < 0.08 && failureCode === 'PAYMENT_TIMEOUT';
    
    // Scenario D: Expired card
    const isExpiredCard = failureCode === 'EXPIRED_CARD';
    
    // Scenario E: High value payment requiring approval
    const isHighValue = amount > 50000;
    
    // Scenario F: Repeated failure where system must STOP
    const isRepeatedFailure = customerId === 'cust_0099' && retryCount >= 2;
    
    // Scenario G: Fraud-like case
    const isFraud = customerId === 'cust_0100' && amount > 100000;
    
    // Scenario H: Payment eventually recovered after scheduled retry
    const isRecoverable = method === 'upi' && failureCode === 'PAYMENT_TIMEOUT' && !isUpiDegradationWindow;
    
    if (isUpiDegradationWindow) {
      category = 'temporary_gateway_issue';
      if (isFailure) retryCount = Math.floor(Math.random() * 2);
    } else if (isLowBalanceCustomer && (failureCode === 'INSUFFICIENT_FUNDS' || failureCode === 'INSUFFICIENT_BALANCE')) {
      category = 'insufficient_balance';
      retryCount = Math.floor(Math.random() * 3);
    } else if (isAbandonment) {
      category = 'customer_abandonment';
    } else if (isExpiredCard) {
      category = 'expired_card';
    } else if (isFraud) {
      category = 'suspected_fraud';
    } else if (isRepeatedFailure) {
      category = 'repeated_failure';
    } else if (isRecoverable) {
      category = 'temporary_gateway_issue';
    } else {
      category = getFailureCategory(method, failureCode);
    }
    
    payments.push({
      paymentId: `pay_${String(i).padStart(6, '0')}`,
      orderId: `order_${String(i).padStart(6, '0')}`,
      customerId,
      amount,
      currency: 'INR',
      paymentMethod: method,
      failureCode: isFailure ? failureCode : 'SUCCESS',
      status: isFailure ? 'failed' : 'success',
      timestamp,
      retryCount,
      customerLifetimeValue: customerLTV,
      previousSuccessRate: customerSuccessRate,
      merchantId: MERCHANT_ID,
      deviceType: deviceTypes[Math.floor(Math.random() * deviceTypes.length)],
      geography: geographies[Math.floor(Math.random() * geographies.length)],
      checkoutSessionId: `session_${String(i).padStart(6, '0')}`
    });
  }
  
  return payments;
}

async function main() {
  console.log('🌱 Starting database seed...');
  
  // Clean existing data
  await prisma.auditEvent.deleteMany();
  await prisma.recoveryAction.deleteMany();
  await prisma.policyDecision.deleteMany();
  await prisma.autopsyResult.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.recoveryCase.deleteMany();
  await prisma.failureEvent.deleteMany();
  await prisma.paymentAttempt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.merchantIncident.deleteMany();
  await prisma.policyRule.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.agentRun.deleteMany();
  
  console.log('🧹 Cleaned existing data');
  
  // Create merchant
  const merchant = await prisma.merchant.create({
    data: {
      id: MERCHANT_ID,
      name: MERCHANT_NAME,
      razorpayKeyId: 'rzp_test_demo_key',
      webhookSecret: 'whsec_demo_secret'
    }
  });
  console.log('🏪 Created merchant:', merchant.name);
  
  // Create policy rules
  const policyRules = [
    {
      merchantId: MERCHANT_ID,
      name: 'Max Retry Limit',
      description: 'Stop autonomous retries after 2 attempts',
      condition: { retryCount: { gte: 2 } },
      action: 'STOP_RECOVERY',
      priority: 100
    },
    {
      merchantId: MERCHANT_ID,
      name: 'High Value Approval',
      description: 'Require human approval for payments over ₹50,000',
      condition: { amount: { gt: 50000 } },
      action: 'ESCALATE_TO_HUMAN',
      priority: 90
    },
    {
      merchantId: MERCHANT_ID,
      name: 'Fraud Prevention',
      description: 'Do not attempt recovery for suspected fraud',
      condition: { failureCategory: 'suspected_fraud' },
      action: 'STOP_RECOVERY',
      priority: 100
    },
    {
      merchantId: MERCHANT_ID,
      name: 'Temporary Gateway Retry',
      description: 'Schedule retry for temporary gateway issues with high recoverability',
      condition: { failureCategory: 'temporary_gateway_issue', recoverabilityScore: { gt: 70 }, retryCount: 0 },
      action: 'SCHEDULE_RETRY',
      priority: 80
    },
    {
      merchantId: MERCHANT_ID,
      name: 'Insufficient Balance - Payment Link',
      description: 'Send payment link for insufficient balance with good history',
      condition: { failureCategory: 'insufficient_balance', previousSuccessRate: { gt: 0.8 } },
      action: 'SEND_PAYMENT_LINK',
      priority: 70
    },
    {
      merchantId: MERCHANT_ID,
      name: 'Expired Card - Alternative Method',
      description: 'Request alternative payment method for expired cards',
      condition: { failureCategory: 'expired_card' },
      action: 'REQUEST_ALTERNATIVE_PAYMENT_METHOD',
      priority: 60
    },
    {
      merchantId: MERCHANT_ID,
      name: 'Customer Contact Cooldown',
      description: 'Prevent repeated customer notifications within 24 hours',
      condition: { customerContactedRecently: true },
      action: 'STOP_RECOVERY',
      priority: 50
    },
    {
      merchantId: MERCHANT_ID,
      name: 'Merchant-Wide Degradation',
      description: 'Reduce retries and delay actions during merchant-wide degradation',
      condition: { merchantDegradation: true },
      action: 'SCHEDULE_RETRY',
      priority: 40
    }
  ];
  
  await prisma.policyRule.createMany({ data: policyRules });
  console.log('📋 Created', policyRules.length, 'policy rules');
  
  // Generate and insert seed payments
  const seedPayments = generateSeedPayments();
  
  // Group by customer to create customers first
  const customerMap = new Map<string, { id: string; lifetimeValue: number; successRate: number; paymentCount: number }>();
  
  for (const p of seedPayments) {
    if (!customerMap.has(p.customerId)) {
      customerMap.set(p.customerId, {
        id: p.customerId,
        lifetimeValue: p.customerLifetimeValue,
        successRate: p.previousSuccessRate,
        paymentCount: 0
      });
    }
    customerMap.get(p.customerId)!.paymentCount++;
  }
  
  // Create customers
  for (const [id, data] of customerMap) {
    await prisma.customer.create({
      data: {
        id: data.id,
        merchantId: MERCHANT_ID,
        razorpayCustomerId: `rzp_cust_${id}`,
        email: `customer${id}@example.com`,
        phone: `+91${String(Math.floor(7000000000 + Math.random() * 3000000000))}`,
        lifetimeValue: data.lifetimeValue,
        successfulPayments: Math.floor(data.paymentCount * data.successRate),
        totalPayments: data.paymentCount,
        lastPaymentAt: new Date()
      }
    });
  }
  console.log('👥 Created', customerMap.size, 'customers');
  
  // Create payments in batches
  const batchSize = 500;
  for (let i = 0; i < seedPayments.length; i += batchSize) {
    const batch = seedPayments.slice(i, i + batchSize);
    await prisma.payment.createMany({
      data: batch.map(p => ({
        id: p.paymentId,
        merchantId: p.merchantId,
        customerId: p.customerId,
        razorpayPaymentId: p.paymentId,
        razorpayOrderId: p.orderId,
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.paymentMethod,
        status: p.status,
        failureCode: p.failureCode,
        failureCategory: p.status === 'failed' ? getFailureCategory(p.paymentMethod, p.failureCode) : null,
        retryCount: p.retryCount,
        metadata: {
          deviceType: p.deviceType,
          geography: p.geography,
          checkoutSessionId: p.checkoutSessionId
        },
        createdAt: new Date(p.timestamp)
      }))
    });
    console.log(`💳 Inserted payments ${i + 1}-${Math.min(i + batchSize, seedPayments.length)}`);
  }
  
  // Create failure events for failed payments
  const failedPayments = seedPayments.filter(p => p.status === 'failed');
  const failureEvents = failedPayments.map(p => ({
    paymentId: p.paymentId,
    failureCode: p.failureCode,
    failureReason: getFailureReason(p.failureCode),
    category: getFailureCategory(p.paymentMethod, p.failureCode),
    confidence: 0.7 + Math.random() * 0.25,
    evidence: generateEvidence(p),
    evidenceType: Math.random() > 0.5 ? 'direct' : 'inferred',
    severity: getSeverity(p.failureCode),
    metadata: { deviceType: p.deviceType, geography: p.geography }
  }));
  
  await prisma.failureEvent.createMany({ data: failureEvents });
  console.log('🔍 Created', failureEvents.length, 'failure events');
  
  // Create payment attempts for failed payments with retries
  const attempts = [];
  for (const p of failedPayments) {
    for (let attempt = 1; attempt <= p.retryCount; attempt++) {
      attempts.push({
        paymentId: p.paymentId,
        attemptNumber: attempt,
        amount: p.amount,
        status: attempt === p.retryCount && Math.random() > 0.3 ? 'success' : 'failed',
        failureCode: attempt === p.retryCount && Math.random() > 0.3 ? null : p.failureCode,
        failureCategory: getFailureCategory(p.paymentMethod, p.failureCode),
        gatewayResponse: { attempt, timestamp: new Date(Date.now() - attempt * 60000).toISOString() }
      });
    }
  }
  
  if (attempts.length > 0) {
    await prisma.paymentAttempt.createMany({ data: attempts });
    console.log('🔄 Created', attempts.length, 'payment attempts');
  }
  
  console.log('✅ Seed completed successfully!');
  console.log(`   Total payments: ${seedPayments.length}`);
  console.log(`   Failed payments: ${failedPayments.length}`);
  console.log(`   Customers: ${customerMap.size}`);
  console.log(`   Policy rules: ${policyRules.length}`);
}

function getFailureReason(code: string): string {
  const reasons: Record<string, string> = {
    'PAYMENT_TIMEOUT': 'Payment gateway did not respond within timeout',
    'INSUFFICIENT_FUNDS': 'Customer account has insufficient balance',
    'UPI_PIN_INCORRECT': 'Incorrect UPI PIN entered',
    'BANK_DOWN': 'Issuing bank is temporarily unavailable',
    'NETWORK_ERROR': 'Network connectivity issue during payment',
    'CARD_DECLINED': 'Card issuer declined the transaction',
    'EXPIRED_CARD': 'Card has expired',
    'INVALID_CVV': 'Invalid CVV entered',
    '3D_SECURE_FAILED': '3D Secure authentication failed',
    'BANK_TIMEOUT': 'Bank did not respond in time',
    'INVALID_CREDENTIALS': 'Invalid netbanking credentials',
    'SESSION_EXPIRED': 'Payment session expired',
    'INSUFFICIENT_BALANCE': 'Wallet balance insufficient',
    'KYC_INCOMPLETE': 'Wallet KYC not completed',
    'WALLET_LIMIT_EXCEEDED': 'Wallet transaction limit exceeded',
    'ELIGIBILITY_FAILED': 'Customer not eligible for EMI',
    'BANK_REJECTED': 'Bank rejected EMI application',
    'DOCUMENTS_INCOMPLETE': 'Required documents not provided',
    'SUCCESS': 'Payment completed successfully'
  };
  return reasons[code] || 'Unknown failure reason';
}

function generateEvidence(p: SeedPayment): string[] {
  const evidence = [];
  if (p.paymentMethod === 'upi' && p.failureCode === 'PAYMENT_TIMEOUT') {
    evidence.push('Multiple similar UPI timeout failures in same time window');
    evidence.push('Previous successful payment 42 minutes earlier');
  }
  if (p.failureCode === 'INSUFFICIENT_FUNDS') {
    evidence.push('Customer has 3 previous insufficient balance failures this month');
    evidence.push('Average transaction amount exceeds typical wallet balance');
  }
  if (p.failureCode === 'EXPIRED_CARD') {
    evidence.push('Card expiry date shows card expired 2 months ago');
    evidence.push('Customer has 12 successful payments with different card');
  }
  if (p.customerId === 'cust_0099') {
    evidence.push('Customer has 5 consecutive failed payments');
    evidence.push('All failures are authentication related');
  }
  if (p.customerId === 'cust_0100' && p.amount > 100000) {
    evidence.push('Unusually high transaction amount for this customer');
    evidence.push('New device and geography for this customer');
    evidence.push('Velocity check: 3 high-value attempts in 10 minutes');
  }
  return evidence.length > 0 ? evidence : ['Standard failure pattern detected'];
}

function getSeverity(code: string): string {
  if (['SUSPECTED_FRAUD', 'BANK_DOWN'].includes(code)) return 'critical';
  if (['INSUFFICIENT_FUNDS', 'EXPIRED_CARD', 'CARD_DECLINED'].includes(code)) return 'high';
  if (['PAYMENT_TIMEOUT', 'NETWORK_ERROR', 'BANK_TIMEOUT'].includes(code)) return 'medium';
  return 'low';
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });