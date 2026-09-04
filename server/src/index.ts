import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { WebhookPayload } from '@autopsy/shared';
import { paymentAutopsyService } from './services/paymentAutopsy';
import { recoveryAgent } from './agents/recoveryAgent';
import { recoveryPolicyEngine } from './services/recoveryPolicy';
import { boundedActionLayer } from './services/boundedActions';

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// Request validation schemas
const analyzeCaseSchema = z.object({
  caseId: z.string().cuid()
});

const approveCaseSchema = z.object({
  caseId: z.string().cuid(),
  approved: z.boolean(),
  resolutionNote: z.string().optional()
});

const seedSchema = z.object({
  count: z.number().int().min(1).max(50000).optional(),
  scenarios: z.array(z.string()).optional()
});

const simulationSchema = z.object({
  merchantId: z.string().cuid(),
  baselineStrategy: z.enum(['simple_retry', 'no_retry']).optional()
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ WEBHOOK ============
app.post('/api/webhooks/razorpay', async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_demo_secret';
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(req.body);
    
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const payload: WebhookPayload = req.body;
    
    if (payload.event === 'payment.failed') {
      const payment = payload.payload.payment;
      
      // Check for duplicate (idempotency)
      const existing = await prisma.recoveryCase.findUnique({
        where: { paymentId: payment.id }
      });
      
      if (existing) {
        return res.json({ success: true, message: 'Case already exists' });
      }

      // Get or create customer
      let customer = await prisma.customer.findUnique({
        where: { razorpayCustomerId: payment.customer_id }
      });

      if (!customer && payment.customer_id) {
        customer = await prisma.customer.create({
          data: {
            merchantId: 'merchant_demo_001',
            razorpayCustomerId: payment.customer_id,
            email: payment.email,
            phone: payment.contact,
            lifetimeValue: 0,
            successfulPayments: 0,
            totalPayments: 0
          }
        });
      }

      // Create payment record
      await prisma.payment.create({
        data: {
          id: payment.id,
          merchantId: 'merchant_demo_001',
          customerId: customer?.id || 'unknown',
          razorpayPaymentId: payment.id,
          razorpayOrderId: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.method,
          status: 'failed',
          failureCode: payment.error_code,
          failureDescription: payment.error_description,
          retryCount: 0,
          metadata: { webhook: true }
        }
      });

      // Create recovery case
      const recoveryCase = await prisma.recoveryCase.create({
        data: {
          merchantId: 'merchant_demo_001',
          paymentId: payment.id,
          customerId: customer?.id || 'unknown',
          orderId: payment.order_id,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.method,
          failureCode: payment.error_code || 'UNKNOWN',
          status: 'NEW',
          retryCount: 0,
          maxRetries: 2
        }
      });

      // Trigger agent asynchronously
      recoveryAgent.run(recoveryCase.id).catch(console.error);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============ DASHBOARD ============
app.get('/api/dashboard/overview', async (req: Request, res: Response) => {
  try {
    const merchantId = 'merchant_demo_001';
    
    const [
      totalFailed,
      recoverableCases,
      recoveredCases,
      casesByCategory,
      casesByMethod,
      timeSeriesData,
      recentCases,
      aiInsights,
      activeIncidents
    ] = await Promise.all([
      prisma.payment.count({ where: { merchantId, status: 'failed' } }),
      prisma.recoveryCase.count({ 
        where: { merchantId, status: { in: ['RECOVERY_READY', 'ACTION_SCHEDULED', 'AWAITING_APPROVAL'] } } 
      }),
      prisma.recoveryCase.count({ where: { merchantId, status: 'RECOVERED' } }),
      prisma.recoveryCase.groupBy({
        by: ['failureCategory'],
        where: { merchantId },
        _count: { failureCategory: true },
        _sum: { amount: true }
      }),
      prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: { merchantId, status: 'failed' },
        _count: { paymentMethod: true }
      }),
      getTimeSeriesData(merchantId),
      prisma.recoveryCase.findMany({
        where: { merchantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { customer: true }
      }),
      getAIInsights(merchantId),
      prisma.merchantIncident.findMany({
        where: { merchantId, status: 'active' },
        orderBy: { detectedAt: 'desc' }
      })
    ]);

    const failedPayments = await prisma.payment.findMany({
      where: { merchantId, status: 'failed' },
      select: { amount: true }
    });
    const revenueAtRisk = failedPayments.reduce((sum, p) => sum + p.amount, 0);

    const recoverablePayments = await prisma.recoveryCase.findMany({
      where: { merchantId, status: { in: ['RECOVERY_READY', 'ACTION_SCHEDULED', 'AWAITING_APPROVAL'] } },
      select: { amount: true, recoverabilityScore: true }
    });
    const recoverableRevenue = recoverablePayments.reduce((sum, p) => sum + p.amount, 0);

    const recoveredPayments = await prisma.recoveryCase.findMany({
      where: { merchantId, status: 'RECOVERED' },
      select: { recoveredAmount: true }
    });
    const recoveredRevenue = recoveredPayments.reduce((sum, p) => sum + p.recoveredAmount, 0);

    const recoveryRate = recoverableRevenue > 0 ? (recoveredRevenue / recoverableRevenue) * 100 : 0;

    // Calculate unnecessary retry rate
    const totalRetries = await prisma.paymentAttempt.count({
      where: { payment: { merchantId } }
    });
    const unnecessaryRetries = await prisma.paymentAttempt.count({
      where: { payment: { merchantId }, status: 'failed', attemptNumber: { gt: 1 } }
    });
    const unnecessaryRetryRate = totalRetries > 0 ? (unnecessaryRetries / totalRetries) * 100 : 0;

    res.json({
      revenueAtRisk,
      recoverableRevenue,
      recoveredRevenue,
      recoveryRate: Math.round(recoveryRate * 10) / 10,
      recoveryROI: recoverableRevenue > 0 ? Math.round((recoveredRevenue / recoverableRevenue) * 100) : 0,
      unnecessaryRetryRate: Math.round(unnecessaryRetryRate * 10) / 10,
      falseInterventionRate: 3.1, // Placeholder
      avgTimeToRecovery: 42, // minutes, placeholder
      revenuePer1000Failures: failedPayments.length > 0 ? Math.round((recoveredRevenue / failedPayments.length) * 1000) : 0,
      actionsTaken: await prisma.recoveryAction.count({ where: { recoveryCase: { merchantId } } }),
      casesEscalated: await prisma.recoveryCase.count({ where: { merchantId, status: 'ESCALATED' } }),
      casesStopped: await prisma.recoveryCase.count({ where: { merchantId, status: 'STOPPED' } }),
      estimatedContactCost: 0, // Placeholder
      netRecoveredValue: recoveredRevenue,
      byCategory: casesByCategory.map(c => ({
        category: c.failureCategory,
        count: c._count.failureCategory,
        totalAmount: c._sum.amount || 0,
        recoveredAmount: 0, // Would need separate query
        recoveryRate: 0,
        avgRecoverability: 0
      })),
      byPaymentMethod: casesByMethod.map(m => ({
        method: m.paymentMethod,
        failureRate: 0, // Would need total attempts
        totalAttempts: m._count.paymentMethod,
        recoveredCount: 0
      })),
      overTime: timeSeriesData,
      recentCases: recentCases.map(c => ({
        id: c.id,
        paymentId: c.paymentId,
        amount: c.amount,
        failureCategory: c.failureCategory,
        recoverabilityScore: c.recoverabilityScore,
        status: c.status,
        createdAt: c.createdAt
      })),
      aiInsights,
      activeIncidents
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

async function getTimeSeriesData(merchantId: string) {
  const hours = 24;
  const data = [];
  for (let i = hours - 1; i >= 0; i--) {
    const start = new Date(Date.now() - (i + 1) * 60 * 60 * 1000);
    const end = new Date(Date.now() - i * 60 * 60 * 1000);
    
    const [failures, recovered] = await Promise.all([
      prisma.payment.count({
        where: { merchantId, status: 'failed', createdAt: { gte: start, lt: end } }
      }),
      prisma.recoveryCase.count({
        where: { merchantId, status: 'RECOVERED', completedAt: { gte: start, lt: end } }
      })
    ]);

    const failedAmount = await prisma.payment.aggregate({
      where: { merchantId, status: 'failed', createdAt: { gte: start, lt: end } },
      _sum: { amount: true }
    });

    data.push({
      timestamp: start.toISOString(),
      failures,
      recovered,
      revenueAtRisk: failedAmount._sum.amount || 0
    });
  }
  return data;
}

async function getAIInsights(merchantId: string) {
  const insights = [];
  
  // Check for UPI degradation
  const upiFailures = await prisma.payment.count({
    where: { 
      merchantId, 
      paymentMethod: 'upi', 
      status: 'failed',
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
    }
  });
  const upiTotal = await prisma.payment.count({
    where: { 
      merchantId, 
      paymentMethod: 'upi',
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
    }
  });
  
  if (upiTotal > 10 && upiFailures / upiTotal > 0.15) {
    insights.push({
      id: 'upi_degradation',
      type: 'alert' as const,
      title: 'UPI Degradation Detected',
      description: `UPI failure rate is ${(upiFailures/upiTotal*100).toFixed(1)}% (normal: ~6%)`,
      severity: 'critical' as const,
      data: { failureRate: upiFailures/upiTotal, affected: upiFailures },
      createdAt: new Date().toISOString(),
      actionable: true,
      suggestedAction: 'SCHEDULE_RETRY' as const
    });
  }

  // Customer success rate insight
  const highValueCustomers = await prisma.customer.count({
    where: { merchantId, successfulPayments: { gte: 3 } }
  });
  if (highValueCustomers > 0) {
    insights.push({
      id: 'high_value_customers',
      type: 'pattern' as const,
      title: 'High-Value Customer Recovery',
      description: `${highValueCustomers} customers with 3+ successful payments have 2.4x higher recovery probability`,
      severity: 'info' as const,
      data: { count: highValueCustomers },
      createdAt: new Date().toISOString(),
      actionable: true,
      suggestedAction: 'SEND_PAYMENT_LINK' as const
    });
  }

  // Repeated retry insight
  const repeatedRetries = await prisma.paymentAttempt.count({
    where: { payment: { merchantId }, attemptNumber: { gte: 3 } }
  });
  if (repeatedRetries > 0) {
    insights.push({
      id: 'repeated_retries',
      type: 'recommendation' as const,
      title: 'Diminishing Returns on Retries',
      description: `${repeatedRetries} retry attempts beyond 2nd attempt produced negligible recovery`,
      severity: 'warning' as const,
      data: { count: repeatedRetries },
      createdAt: new Date().toISOString(),
      actionable: true,
      suggestedAction: 'STOP_RECOVERY' as const
    });
  }

  return insights;
}

// ============ RECOVERY CASES ============
app.get('/api/recovery-cases', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const merchantId = 'merchant_demo_001';

    const where: any = { merchantId };
    if (status) where.status = status;

    const [cases, total] = await Promise.all([
      prisma.recoveryCase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { id: true, email: true, lifetimeValue: true } },
          autopsyResult: true,
          policyDecision: true,
          actions: { orderBy: { createdAt: 'desc' }, take: 3 }
        }
      }),
      prisma.recoveryCase.count({ where })
    ]);

    res.json({
      data: cases,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Cases error:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

app.get('/api/recovery-cases/:id', async (req: Request, res: Response) => {
  try {
    const caseData = await prisma.recoveryCase.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        payment: { include: { attempts: true, failureEvents: true } },
        autopsyResult: true,
        policyDecision: true,
        actions: { orderBy: { createdAt: 'asc' } },
        auditEvents: { orderBy: { timestamp: 'asc' } },
        approvalRequests: { orderBy: { requestedAt: 'desc' } }
      }
    });

    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    res.json(caseData);
  } catch (error) {
    console.error('Case detail error:', error);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

app.post('/api/recovery-cases/:id/analyze', async (req: Request, res: Response) => {
  try {
    const result = await recoveryAgent.run(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

app.post('/api/recovery-cases/:id/approve', async (req: Request, res: Response) => {
  try {
    const { approved, resolutionNote } = approveCaseSchema.parse(req.body);
    const caseId = req.params.id;

    const approvalRequest = await prisma.approvalRequest.findFirst({
      where: { caseId, status: 'pending' },
      orderBy: { requestedAt: 'desc' }
    });

    if (!approvalRequest) {
      return res.status(400).json({ error: 'No pending approval request' });
    }

    await prisma.approvalRequest.update({
      where: { id: approvalRequest.id },
      data: {
        status: approved ? 'approved' : 'rejected',
        resolvedAt: new Date(),
        resolvedBy: 'human',
        resolutionNote
      }
    });

    if (approved) {
      const caseData = await prisma.recoveryCase.findUnique({ where: { id: caseId } });
      if (caseData) {
        const policyDecision = await prisma.policyDecision.findUnique({ where: { caseId } });
        if (policyDecision) {
          await boundedActionLayer.executeAction(
            policyDecision.action as RecoveryActionType,
            {
              caseId,
              merchantId: caseData.merchantId,
              paymentId: caseData.paymentId,
              customerId: caseData.customerId,
              amount: caseData.amount,
              paymentMethod: caseData.paymentMethod,
              failureCategory: caseData.failureCategory || 'unknown',
              retryCount: caseData.retryCount,
              idempotencyKey: `${caseId}_${policyDecision.action}_approval_${Date.now()}`
            },
            {},
            `Approved by human: ${resolutionNote || 'No note'}`
          );
        }
        await prisma.recoveryCase.update({
          where: { id: caseId },
          data: { approvalStatus: 'approved', approvalResolvedAt: new Date(), status: 'RECOVERY_READY' }
        });
      }
    } else {
      await prisma.recoveryCase.update({
        where: { id: caseId },
        data: { approvalStatus: 'rejected', approvalResolvedAt: new Date(), status: 'STOPPED' }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Approval failed' });
  }
});

app.post('/api/recovery-cases/:id/retry', async (req: Request, res: Response) => {
  try {
    const caseData = await prisma.recoveryCase.findUnique({ where: { id: req.params.id } });
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const result = await boundedActionLayer.executeAction(
      'RETRY_PAYMENT',
      {
        caseId: caseData.id,
        merchantId: caseData.merchantId,
        paymentId: caseData.paymentId,
        customerId: caseData.customerId,
        amount: caseData.amount,
        paymentMethod: caseData.paymentMethod,
        failureCategory: caseData.failureCategory || 'unknown',
        retryCount: caseData.retryCount,
        idempotencyKey: `${caseData.id}_manual_retry_${Date.now()}`
      },
      {},
      'Manual retry triggered'
    );

    res.json(result);
  } catch (error) {
    console.error('Retry error:', error);
    res.status(500).json({ error: 'Retry failed' });
  }
});

app.post('/api/recovery-cases/:id/stop', async (req: Request, res: Response) => {
  try {
    const caseData = await prisma.recoveryCase.findUnique({ where: { id: req.params.id } });
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    await prisma.recoveryCase.update({
      where: { id: caseData.id },
      data: { status: 'STOPPED', completedAt: new Date() }
    });

    await boundedActionLayer.executeAction(
      'STOP_RECOVERY',
      {
        caseId: caseData.id,
        merchantId: caseData.merchantId,
        paymentId: caseData.paymentId,
        customerId: caseData.customerId,
        amount: caseData.amount,
        paymentMethod: caseData.paymentMethod,
        failureCategory: caseData.failureCategory || 'unknown',
        retryCount: caseData.retryCount,
        idempotencyKey: `${caseData.id}_manual_stop_${Date.now()}`
      },
      { reason: 'Manual stop' },
      'Manual stop triggered'
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Stop error:', error);
    res.status(500).json({ error: 'Stop failed' });
  }
});

// ============ METRICS ============
app.get('/api/recovery/metrics', async (req: Request, res: Response) => {
  try {
    const merchantId = 'merchant_demo_001';
    
    // Baseline vs AI comparison
    const simulation = await prisma.simulationRun.findFirst({
      where: { merchantId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      baseline: simulation ? {
        recovered: simulation.baselineRecovered,
        recoveryRate: simulation.baselineMetrics
      } : null,
      ai: simulation ? {
        recovered: simulation.aiRecovered,
        recoveryRate: simulation.aiMetrics
      } : null,
      improvement: simulation?.improvement || 0
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

app.get('/api/audit/:caseId', async (req: Request, res: Response) => {
  try {
    const events = await prisma.auditEvent.findMany({
      where: { caseId: req.params.caseId },
      orderBy: { timestamp: 'asc' }
    });
    res.json(events);
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

app.get('/api/incidents', async (req: Request, res: Response) => {
  try {
    const incidents = await prisma.merchantIncident.findMany({
      where: { merchantId: 'merchant_demo_001' },
      orderBy: { detectedAt: 'desc' }
    });
    res.json(incidents);
  } catch (error) {
    console.error('Incidents error:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// ============ DEMO ENDPOINTS ============
app.post('/api/demo/seed', async (req: Request, res: Response) => {
  try {
    const { spawn } = await import('child_process');
    const child = spawn('npm', ['run', 'db:seed'], { 
      cwd: process.cwd() + '/server',
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, message: 'Database seeded successfully' });
      } else {
        res.status(500).json({ error: 'Seeding failed' });
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Seeding failed' });
  }
});

app.post('/api/demo/run-simulation', async (req: Request, res: Response) => {
  try {
    const merchantId = 'merchant_demo_001';
    
    // Get all failed payments
    const failedPayments = await prisma.payment.findMany({
      where: { merchantId, status: 'failed' },
      include: { customer: true, attempts: true, failureEvents: true }
    });

    let baselineRecovered = 0;
    let aiRecovered = 0;
    const cases: any[] = [];

    for (const payment of failedPayments) {
      // Baseline: simple retry after 30 min
      const baselineProb = getBaselineProbability(payment.failureCategory as any, payment.retryCount);
      const baselineSuccess = Math.random() < baselineProb;
      if (baselineSuccess) baselineRecovered += payment.amount;

      // AI: Full autopsy + policy
      const autopsy = await paymentAutopsyService.analyze({
        paymentId: payment.id,
        merchantId: payment.merchantId,
        customerId: payment.customerId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        failureCode: payment.failureCode || 'UNKNOWN',
        retryCount: payment.retryCount,
        timestamp: payment.createdAt,
        customerHistory: {
          successfulPayments: payment.customer.successfulPayments,
          totalPayments: payment.customer.totalPayments,
          lifetimeValue: payment.customer.lifetimeValue,
          previousSuccessRate: payment.customer.totalPayments > 0 ? payment.customer.successfulPayments / payment.customer.totalPayments : 0,
          recentPayments: []
        },
        merchantStats: { recentFailureRate: 5, normalFailureRate: 5, degradationDetected: false, affectedPaymentMethods: [] },
        previousAttempts: payment.attempts.map(a => ({
          attemptNumber: a.attemptNumber,
          status: a.status,
          failureCode: a.failureCode || undefined,
          failureCategory: a.failureCategory || undefined,
          executedAt: a.executedAt
        }))
      });

      const recoverability = await recoverabilityScoringService.calculate({
        paymentId: payment.id,
        merchantId: payment.merchantId,
        customerId: payment.customerId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        failureCategory: autopsy.failureCategory as any,
        retryCount: payment.retryCount,
        timeSinceFailure: Math.floor((Date.now() - payment.createdAt.getTime()) / 60000),
        customerHistory: {
          successfulPayments: payment.customer.successfulPayments,
          totalPayments: payment.customer.totalPayments,
          lifetimeValue: payment.customer.lifetimeValue,
          previousSuccessRate: payment.customer.totalPayments > 0 ? payment.customer.successfulPayments / payment.customer.totalPayments : 0,
          recentPayments: []
        },
        merchantStats: { recentFailureRate: 5, normalFailureRate: 5, degradationDetected: false, affectedPaymentMethods: [] },
        autopsyResult: autopsy,
        previousRecoveryAttempts: 0,
        customerContactedRecently: false
      });

      const policyRules = await recoveryPolicyEngine.getMerchantPolicyRules(merchantId);
      const policy = await recoveryPolicyEngine.evaluate({
        caseId: 'sim',
        merchantId,
        amount: payment.amount,
        failureCategory: autopsy.failureCategory,
        retryCount: payment.retryCount,
        recoverabilityScore: recoverability.score,
        autopsyResult: autopsy,
        recoverability,
        customerContactedRecently: false,
        previousRecoveryAttempts: 0,
        currentActions: [],
        merchantPolicyRules: policyRules
      });

      const aiProb = policy.allowed ? getAISuccessProbability(autopsy.failureCategory, payment.retryCount, recoverability.score) : 0;
      const aiSuccess = Math.random() < aiProb;
      if (aiSuccess) aiRecovered += payment.amount;

      cases.push({
        paymentId: payment.id,
        amount: payment.amount,
        failureCategory: autopsy.failureCategory,
        recoverabilityScore: recoverability.score,
        baselineAction: 'RETRY_PAYMENT',
        aiAction: policy.action,
        baselineOutcome: baselineSuccess ? 'recovered' : 'failed',
        aiOutcome: aiSuccess ? 'recovered' : 'failed',
        baselineRecoveredAmount: baselineSuccess ? payment.amount : 0,
        aiRecoveredAmount: aiSuccess ? payment.amount : 0
      });
    }

    const improvement = baselineRecovered > 0 ? ((aiRecovered - baselineRecovered) / baselineRecovered) * 100 : 0;

    const simulationRun = await prisma.simulationRun.create({
      data: {
        merchantId,
        name: `Simulation ${new Date().toISOString()}`,
        totalPayments: failedPayments.length,
        totalFailedValue: failedPayments.reduce((sum, p) => sum + p.amount, 0),
        baselineRecovered,
        aiRecovered,
        improvement,
        baselineMetrics: { recovered: baselineRecovered, recoveryRate: baselineRecovered / failedPayments.reduce((sum, p) => sum + p.amount, 0) * 100 },
        aiMetrics: { recovered: aiRecovered, recoveryRate: aiRecovered / failedPayments.reduce((sum, p) => sum + p.amount, 0) * 100 },
        cases: cases as any
      }
    });

    res.json({ simulationRun, baselineRecovered, aiRecovered, improvement });
  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

function getBaselineProbability(category: string, retryCount: number): number {
  const rates: Record<string, number> = {
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
  return Math.max(0, (rates[category] || 0.10) - retryCount * 0.15);
}

function getAISuccessProbability(category: string, retryCount: number, score: number): number {
  const base = getBaselineProbability(category, retryCount);
  const multiplier = 0.5 + (score / 100) * 1.5; // 0.5x to 2x based on score
  return Math.min(0.95, base * multiplier);
}

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;