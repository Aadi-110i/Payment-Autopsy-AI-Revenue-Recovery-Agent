# Autopsy - AI Revenue Recovery Agent

**Diagnose failed payments. Recover revenue intelligently.**

An AI-powered revenue recovery system built for the Razorpay AI Builder Internship 2026 (AI Revenue Recovery Track). The system goes beyond simple retry logic to perform automated payment autopsies, estimate recoverability, and execute bounded recovery actions with full audit trails.

---

## Problem Statement

Payment failures represent significant lost revenue. Traditional retry systems use fixed rules (retry after 30 minutes) without understanding:

- Why the payment failed
- Whether recovery is worthwhile
- What intervention is most effective
- When to stop to avoid wasting resources

---

## Solution

Autopsy implements a complete revenue recovery pipeline:

```
PAYMENT FAILURE -> ROOT CAUSE -> RECOVERABILITY -> INTERVENTION -> BOUNDED ACTION -> OUTCOME -> LEARNING
```

### Key Differentiators

| Traditional Retry Bot | Autopsy |
|----------------------|---------|
| Blindly retries after fixed intervals | Diagnoses root cause with evidence |
| No recoverability estimation | Scores 0-100 with explainable factors |
| Single retry action | 7 bounded action types |
| No audit trail | Immutable audit events for every decision |
| No baseline comparison | Measures vs simple retry baseline |
| No safety boundaries | Policy engine enforces hard limits |

---

## Architecture

```
┌──────────────────────┐
│      React UI        │
│ Dashboard / Cases    │
│ Analytics / Audit    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    Express API       │
│ Auth / REST / Webhook│
└──────────┬───────────┘
           │
┌──────────┼──────────┐
▼          ▼          ▼
PostgreSQL  Redis    Razorpay API
  Prisma    BullMQ   Test Mode
           │
           ▼
┌──────────────────────┐
│ Recovery Orchestrator│
└──────────┬───────────┘
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
Autopsy  Score  Policy
Engine   Engine Engine
    │      │      │
    └──────┼──────┘
           ▼
┌──────────────────────┐
│ Bounded Action Layer │
│ retry/link/notify/   │
│ escalate/stop        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│      Audit Trail     │
└──────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | TanStack Query (React Query) |
| Charts | Recharts |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL with Prisma ORM |
| Queue | Redis + BullMQ |
| Payments | Razorpay Test Mode APIs |
| AI | LLM API with structured JSON responses |
| Testing | Vitest, Supertest, Playwright |

---

## Core Features

### 1. Payment Autopsy Engine
- Classifies failures into 11 categories with confidence scores
- Evidence-based diagnosis (direct and inferred)
- Merchant-wide degradation detection
- Human-readable explanations

### 2. Recoverability Scoring (0-100)
- 11 weighted factors (customer history, failure type, amount, time, etc.)
- Explainable score with positive and negative factors
- Baseline comparison against simple retry strategy

### 3. Recovery Policy Engine
- Hard stops: Fraud, max retries (2), low recoverability (<30)
- Approval required: High-value (>₹50K), repeated attempts
- Cooldowns: Customer contact (24h), merchant degradation (1h)
- Action mapping: Category to appropriate intervention

### 4. Bounded Recovery Actions
1. `RETRY_PAYMENT` - Immediate retry
2. `SEND_PAYMENT_LINK` - Customer self-service
3. `SEND_RECOVERY_NOTIFICATION` - Email/SMS reminder
4. `SCHEDULE_RETRY` - Delayed retry (configurable)
5. `REQUEST_ALTERNATIVE_PAYMENT_METHOD` - Card update flow
6. `ESCALATE_TO_HUMAN` - Manual review queue
7. `STOP_RECOVERY` - Terminate recovery

### 5. Complete Audit Trail
Every decision recorded with:
- Timestamp, actor, action
- Input context, decision, evidence
- Policy used, outcome

### 6. Simulation & Evaluation
- 10,000 synthetic payments with 8 hidden patterns
- Baseline (simple retry) vs AI comparison
- Metrics: recovery rate, unnecessary retries, time to recovery, ROI

### 7. Merchant Incident Detection
- Detects payment rail degradation
- Prevents blind retries during systemic issues
- Recommends delayed retries and merchant notification

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Clone and install
git clone <repo>
cd autopsy-recovery
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Database setup
cd server
npm run db:generate
npm run db:push
npm run db:seed

# Start development
cd ..
npm run dev
```

### Environment Variables

```env
# Server
DATABASE_URL="postgresql://user:pass@localhost:5432/autopsy"
REDIS_URL="redis://localhost:6379"
PORT=3001
NODE_ENV=development

# Razorpay Test Mode
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="whsec_..."

# Frontend
FRONTEND_URL="http://localhost:5173"

# AI (Optional - uses mock if not provided)
OPENAI_API_KEY="sk-..."
LLM_PROVIDER="openai"

# Demo
DEMO_MODE=true
```

### Demo Mode

The system includes a full demo with:
- 10,000 synthetic payments
- 8 realistic failure scenarios
- Hidden patterns (UPI degradation, fraud, etc.)
- One-click simulation runner

Click "Run Simulation" on the Demo page to see the complete pipeline in action.

---

## Dashboard Sections

1. **Revenue Overview** - At risk, recoverable, recovered, rate, ROI
2. **Failure Intelligence** - Categories, payment methods, time series, degradation
3. **Recovery Pipeline** - Kanban: New, Autopsy, Ready, Scheduled, Recovered, Escalated, Stopped
4. **Recent Cases** - Table with inline actions
5. **AI Insights** - Automated pattern detection

---

## Case Detail Page

Click any case to see:
- Payment context and customer history
- Failure autopsy with evidence
- Recoverability score breakdown
- Policy decision with applied rules
- Executed actions and outcomes
- Visual audit timeline

---

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Type checking
npm run lint
```

---

## Evaluation Methodology

The system measures:
- **Recovery Rate**: Recovered / Recoverable
- **Improvement vs Baseline**: AI vs simple retry
- **Unnecessary Retry Rate**: Retries beyond 2nd attempt that failed
- **False Intervention Rate**: Actions that did not lead to recovery
- **Avg Time to Recovery**: From failure to success
- **Net Recovered Value**: Revenue recovered minus contact costs

---

## Safety Boundaries

- No LLM financial actions: All actions go through policy engine
- Idempotency keys: Prevent duplicate executions
- Amount limits: Autonomous actions capped at ₹50K
- Retry limits: Maximum 2 autonomous retries
- Fraud isolation: Suspected fraud escalated immediately
- Approval workflow: High-value or low-confidence cases require human review

---

## Project Structure

```
autopsy-recovery/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # React Query hooks
│   │   ├── api/            # API client
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Helpers
├── server/                 # Express backend
│   ├── src/
│   │   ├── services/       # Core business logic
│   │   ├── agents/         # Recovery agent orchestration
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   ├── queues/         # BullMQ queues
│   │   └── utils/          # Helpers
│   └── prisma/             # Database schema and seed
├── packages/shared/        # Shared TypeScript types
└── README.md
```

---

## Demo Scenarios

The seed data includes 8 scenarios demonstrating different agent decisions:

| Scenario | Failure Type | Expected Action |
|----------|-------------|-----------------|
| A | Temporary gateway degradation | Schedule retry (20 min) |
| B | Insufficient balance | Send payment link |
| C | Customer abandonment | Send notification |
| D | Expired card | Request alt. method |
| E | High-value (>₹50K) | Escalate to human |
| F | Repeated failure (3+) | Stop recovery |
| G | Suspected fraud | Stop and escalate risk |
| H | Recoverable after delay | Schedule retry to success |

---

## Known Limitations

- Demo mode uses simulated payment outcomes
- Real Razorpay webhook processing requires ngrok/tunnel
- LLM integration uses mock responses (configure OPENAI_API_KEY for real)
- Single merchant in demo (multi-tenant ready in schema)
- No authentication in demo (add NextAuth/Clerk for production)

---

## Future Improvements

- Real LLM integration for explanation generation
- Multi-merchant support with isolated data
- Advanced ML for recoverability prediction
- Customer communication preferences
- A/B testing framework for policies
- Slack/Teams alerts for incidents
- Historical trend analysis
- Custom policy builder UI

---

## License

MIT License - Built for Razorpay AI Builder Internship 2026

---

## Why This Is Not Just Another Payment Retry Bot

Autopsy is a revenue operations product, not a retry script. It diagnoses why payments fail using evidence, estimates whether recovery makes economic sense, selects constrained interventions based on policy, executes safely with idempotency, stops when continued effort is wasteful, and measures actual revenue impact against a baseline. Every decision is auditable and explainable, making it suitable for production financial systems where accountability matters.