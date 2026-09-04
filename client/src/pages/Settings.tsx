import { Layout, PageHeader, SectionHeader, Card, CardHeader } from '../components';
import { Zap, Shield, Bell, Database, Key, Users, Save, RefreshCw } from 'lucide-react';
import { cn } from '../utils/cn';
import { useState } from 'react';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'policies' | 'notifications' | 'integrations'>('general');

  const tabs = [
    { id: 'general', label: 'General', icon: Zap },
    { id: 'policies', label: 'Policies', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Database }
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader title="Settings" subtitle="Configure Autopsy recovery behavior" />

        <div className="card overflow-hidden">
          <div className="border-b border-autopsy-border">
            <nav className="flex overflow-x-auto" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all duration-150 whitespace-nowrap',
                    activeTab === tab.id
                      ? 'border-autopsy-accent text-autopsy-accent'
                      : 'border-transparent text-autopsy-text-muted hover:text-autopsy-text'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'policies' && <PolicySettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'integrations' && <IntegrationSettings />}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function GeneralSettings() {
  const [demoMode, setDemoMode] = useState(true);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [maxRetries, setMaxRetries] = useState(2);
  const [approvalThreshold, setApprovalThreshold] = useState(50000);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h3 className="font-medium text-autopsy-text">Operating Mode</h3>
        <div className="space-y-3">
          <SettingRow
            label="Demo Mode"
            description="Use synthetic data and simulated payment outcomes"
            action={
              <Toggle checked={demoMode} onChange={setDemoMode} />
            }
          />
          <SettingRow
            label="Auto-analyze new cases"
            description="Automatically run autopsy when new failed payments arrive"
            action={
              <Toggle checked={autoAnalyze} onChange={setAutoAnalyze} />
            }
          />
        </div>
      </section>

      <section className="space-y-4 pt-6 border-t border-autopsy-border">
        <h3 className="font-medium text-autopsy-text">Recovery Limits</h3>
        <div className="space-y-4">
          <SettingRow
            label="Maximum autonomous retries"
            description="Stop autonomous retries after this many attempts"
            action={
              <select
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
                className="input w-32"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            }
          />
          <SettingRow
            label="Approval threshold"
            description="Transactions above this amount require human approval"
            action={
              <input
                type="number"
                value={approvalThreshold}
                onChange={(e) => setApprovalThreshold(Number(e.target.value))}
                className="input w-40"
                placeholder="50000"
              />
            }
          />
        </div>
      </section>

      <section className="space-y-4 pt-6 border-t border-autopsy-border">
        <div className="flex justify-end">
          <button className="btn-primary"><Save className="w-4 h-4 mr-2" /> Save Settings</button>
        </div>
      </section>
    </div>
  );
}

function PolicySettings() {
  const policies = [
    { id: 'max_retries', name: 'Max Retry Limit', description: 'Stop autonomous retries after 2 attempts', enabled: true, priority: 100 },
    { id: 'high_value', name: 'High Value Approval', description: 'Require human approval for payments over ₹50,000', enabled: true, priority: 90 },
    { id: 'fraud', name: 'Fraud Prevention', description: 'Do not attempt recovery for suspected fraud', enabled: true, priority: 100 },
    { id: 'gateway_retry', name: 'Gateway Retry', description: 'Schedule retry for temporary gateway issues', enabled: true, priority: 80 },
    { id: 'insufficient_balance', name: 'Insufficient Balance', description: 'Send payment link for balance issues with good history', enabled: true, priority: 70 },
    { id: 'expired_card', name: 'Expired Card', description: 'Request alternative payment method for expired cards', enabled: true, priority: 60 },
    { id: 'contact_cooldown', name: 'Contact Cooldown', description: 'Prevent repeated notifications within 24 hours', enabled: true, priority: 50 },
    { id: 'degradation', name: 'Merchant Degradation', description: 'Reduce retries during merchant-wide degradation', enabled: true, priority: 40 }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-autopsy-text">Recovery Policies</h3>
        <button className="btn-secondary text-sm"><Save className="w-4 h-4 mr-1" /> Save Policies</button>
      </div>
      <p className="text-sm text-autopsy-text-muted">
        Policies are evaluated in priority order (highest first). The first matching policy determines the action.
      </p>
      
      <div className="space-y-3">
        {policies.map((policy) => (
          <PolicyRow key={policy.id} policy={policy} />
        ))}
      </div>
    </div>
  );
}

function PolicyRow({ policy }: { policy: any }) {
  const [enabled, setEnabled] = useState(policy.enabled);
  
  return (
    <div className="p-4 bg-autopsy-bg rounded-lg border border-autopsy-border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-autopsy-text">{policy.name}</h4>
            <span className="text-xs text-autopsy-text-muted px-2 py-0.5 rounded bg-autopsy-border">Priority: {policy.priority}</span>
          </div>
          <p className="text-sm text-autopsy-text-muted">{policy.description}</p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>
    </div>
  );
}

function NotificationSettings() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [cooldownHours, setCooldownHours] = useState(24);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h3 className="font-medium text-autopsy-text">Channels</h3>
        <div className="space-y-3">
          <SettingRow
            label="Email notifications"
            description="Send recovery notifications via email"
            action={<Toggle checked={emailEnabled} onChange={setEmailEnabled} />}
          />
          <SettingRow
            label="SMS notifications"
            description="Send recovery notifications via SMS"
            action={<Toggle checked={smsEnabled} onChange={setSmsEnabled} />}
          />
          <SettingRow
            label="Webhook notifications"
            description="Send case updates to configured webhook endpoints"
            action={<Toggle checked={webhookEnabled} onChange={setWebhookEnabled} />}
          />
        </div>
      </section>

      <section className="space-y-4 pt-6 border-t border-autopsy-border">
        <h3 className="font-medium text-autopsy-text">Rate Limiting</h3>
        <SettingRow
          label="Customer contact cooldown"
          description="Minimum hours between customer notifications"
          action={
            <input
              type="number"
              value={cooldownHours}
              onChange={(e) => setCooldownHours(Number(e.target.value))}
              className="input w-32"
              min="1"
              max="168"
            />
          }
        />
      </section>
    </div>
  );
}

function IntegrationSettings() {
  const [razorpayKeyId, setRazorpayKeyId] = useState('rzp_test_demo_key');
  const [webhookSecret, setWebhookSecret] = useState('whsec_demo_secret');
  const [webhookUrl, setWebhookUrl] = useState('https://api.example.com/webhooks/razorpay');

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h3 className="font-medium text-autopsy-text">Razorpay Configuration</h3>
        <p className="text-sm text-autopsy-text-muted">Configure Razorpay test mode credentials for webhook processing</p>
        <div className="space-y-4">
          <SettingRow
            label="Key ID"
            description="Razorpay test mode key ID"
            action={
              <input
                type="text"
                value={razorpayKeyId}
                onChange={(e) => setRazorpayKeyId(e.target.value)}
                className="input w-80 font-mono"
                placeholder="rzp_test_..."
              />
            }
          />
          <SettingRow
            label="Webhook Secret"
            description="Secret for verifying webhook signatures"
            action={
              <input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="input w-80 font-mono"
                placeholder="whsec_..."
              />
            }
          />
        </div>
      </section>

      <section className="space-y-4 pt-6 border-t border-autopsy-border">
        <h3 className="font-medium text-autopsy-text">Outbound Webhooks</h3>
        <SettingRow
          label="Callback URL"
          description="Receive case status updates at this endpoint"
          action={
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="input w-96"
              placeholder="https://your-app.com/webhooks/autopsy"
            />
          }
        />
      </section>
    </div>
  );
}

function SettingRow({ label, description, action }: { label: string; description: string; action: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <h4 className="font-medium text-autopsy-text">{label}</h4>
        <p className="text-sm text-autopsy-text-muted mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors',
        checked ? 'bg-autopsy-accent' : 'bg-autopsy-border'
      )}
      role="switch"
      aria-checked={checked}
    >
      <span className={cn(
        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform',
        checked ? 'translate-x-5' : 'translate-x-0.5'
      )} />
    </button>
  );
}