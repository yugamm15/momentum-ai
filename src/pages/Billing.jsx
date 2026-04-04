import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  ReceiptText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import ChangeablePricingSection from '../components/billing/ChangeablePricingSection';
import { useWorkspace } from '../components/workspace/useWorkspace';
import {
  BILLING_PLANS,
  buildBillingQuote,
  buildBillingRules,
  formatCurrency,
  getActiveSeatCount,
  getPlanById,
  validateBillingForm,
} from '../lib/billing';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export default function Billing({ session }) {
  const { snapshot } = useWorkspace();
  const activeSeats = useMemo(() => getActiveSeatCount(snapshot?.people), [snapshot?.people]);

  const [selectedPlanId, setSelectedPlanId] = useState('momentum');
  const [billingCycle, setBillingCycle] = useState('yearly');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(null);
  const [form, setForm] = useState(() => ({
    billingName: deriveDisplayName(session?.user?.email),
    billingEmail: String(session?.user?.email || '').trim(),
    company: 'Momentum Workspace',
    taxId: '',
    purchaseOrder: '',
    acceptedAuthority: false,
    acceptedRecurring: false,
  }));

  const selectedPlan = useMemo(
    () => getPlanById(BILLING_PLANS, selectedPlanId),
    [selectedPlanId]
  );
  const quote = useMemo(
    () => buildBillingQuote({ plan: selectedPlan, billingCycle, activeSeats }),
    [activeSeats, billingCycle, selectedPlan]
  );
  const billingRules = useMemo(
    () => buildBillingRules({ plan: selectedPlan, billingCycle, activeSeats }),
    [activeSeats, billingCycle, selectedPlan]
  );
  const errors = useMemo(() => validateBillingForm(form), [form]);
  const formIsValid = Object.keys(errors).length === 0;

  function handleFieldChange(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSelectionChange(planId, cycle) {
    setSelectedPlanId(planId);
    setBillingCycle(cycle);
    setCheckoutReady(null);
  }

  function handlePrepareCheckout() {
    setAttemptedSubmit(true);

    if (!formIsValid) {
      return;
    }

    setCheckoutReady({
      planId: selectedPlan.id,
      billingCycle,
      quote,
      billingEmail: form.billingEmail.trim(),
      company: form.company.trim(),
    });
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className="mx-auto min-h-screen max-w-[1600px] space-y-8 p-6 md:p-8 xl:p-12"
    >
      <motion.section variants={fadeUp} className="glass-panel relative overflow-hidden p-8 md:p-10">
        <div className="absolute inset-y-0 right-0 w-[32rem] bg-[radial-gradient(circle_at_right,rgba(249,115,22,0.12),transparent_60%)]" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-600 shadow-sm dark:text-orange-400">
            <CreditCard className="h-3.5 w-3.5" />
            Plan and billing
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Choose the workspace plan and settle the billing rules up front.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            This page locks the plan, seats, billing cadence, and approval rules in one place so checkout does not stay
            vague for the workspace owner.
          </p>
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-6 xl:grid-cols-[0.78fr_0.9fr]">
        <ChangeablePricingSection
          title="Select a plan"
          plans={BILLING_PLANS}
          defaultPlanId={selectedPlanId}
          defaultBillingCycle={billingCycle}
          monthlyLabel="Monthly"
          yearlyLabel="Yearly"
          footerText="Upgrades should apply immediately. Downgrades should wait until renewal."
          buttonText="Lock this plan"
          onSelectionChange={handleSelectionChange}
          onContinue={handleSelectionChange}
        />

        <div className="space-y-6">
          <section className="glass-panel p-7">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
              <ReceiptText className="h-4 w-4 text-orange-500" />
              Live quote
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <QuoteMetric
                label="Selected plan"
                value={selectedPlan?.name || 'No plan'}
                hint={billingCycle === 'yearly' ? 'Annual billing' : 'Monthly billing'}
              />
              <QuoteMetric
                label="Active seats"
                value={String(quote.activeSeats)}
                hint="Current workspace members"
              />
              <QuoteMetric
                label="Billed seats"
                value={String(quote.billedSeats)}
                hint={`Minimum for ${selectedPlan?.name || 'this plan'}`}
              />
            </div>

            <div className="mt-6 rounded-[28px] bg-orange-500 px-6 py-6 text-white shadow-[0_20px_60px_rgba(249,115,22,0.2)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/75">
                {billingCycle === 'yearly' ? 'Estimated annual charge' : 'Estimated monthly charge'}
              </div>
              <div className="mt-3 text-4xl font-extrabold tracking-tight">
                {billingCycle === 'yearly' ? formatCurrency(quote.annualTotal) : formatCurrency(quote.monthlyEquivalent)}
              </div>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">
                {billingCycle === 'yearly'
                  ? `${formatCurrency(quote.monthlyEquivalent)} equivalent per month for ${quote.billedSeats} billed seats.`
                  : `${formatCurrency(quote.monthlyEquivalent)} billed each month for ${quote.billedSeats} seats.`}
              </p>
              {billingCycle === 'yearly' && quote.annualSavings > 0 ? (
                <div className="mt-4 inline-flex rounded-full bg-white/14 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white">
                  Saves {formatCurrency(quote.annualSavings)} per year
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="glass-panel p-7">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Billing rules
              </div>
              <div className="mt-5 space-y-4">
                {billingRules.map((rule, index) => (
                  <div key={rule.title} className="rounded-[24px] bg-secondary/55 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-foreground">{rule.title}</div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{rule.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-7">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                <Building2 className="h-4 w-4 text-emerald-500" />
                Billing contact
              </div>
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  handlePrepareCheckout();
                }}
              >
                <Field
                  label="Billing contact"
                  value={form.billingName}
                  onChange={(value) => handleFieldChange('billingName', value)}
                  error={attemptedSubmit ? errors.billingName : ''}
                  placeholder="Your full name"
                />
                <Field
                  label="Billing email"
                  value={form.billingEmail}
                  onChange={(value) => handleFieldChange('billingEmail', value)}
                  error={attemptedSubmit ? errors.billingEmail : ''}
                  placeholder="finance@company.com"
                  type="email"
                />
                <Field
                  label="Workspace or company"
                  value={form.company}
                  onChange={(value) => handleFieldChange('company', value)}
                  error={attemptedSubmit ? errors.company : ''}
                  placeholder="Momentum Workspace"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Tax ID"
                    value={form.taxId}
                    onChange={(value) => handleFieldChange('taxId', value)}
                    placeholder="Optional"
                  />
                  <Field
                    label="Purchase order"
                    value={form.purchaseOrder}
                    onChange={(value) => handleFieldChange('purchaseOrder', value)}
                    placeholder="Optional"
                  />
                </div>

                <ConsentRow
                  checked={form.acceptedAuthority}
                  onChange={(checked) => handleFieldChange('acceptedAuthority', checked)}
                  label="I am allowed to approve billing for this workspace."
                  error={attemptedSubmit ? errors.acceptedAuthority : ''}
                />
                <ConsentRow
                  checked={form.acceptedRecurring}
                  onChange={(checked) => handleFieldChange('acceptedRecurring', checked)}
                  label={`I accept ${billingCycle === 'yearly' ? 'annual' : 'monthly'} recurring billing for ${quote.billedSeats} billed seats.`}
                  error={attemptedSubmit ? errors.acceptedRecurring : ''}
                />

                <button type="submit" className="button-primary w-full justify-center">
                  Continue to payment
                </button>
              </form>
            </div>
          </section>
        </div>
      </motion.section>

      <AnimatePresence>
        {checkoutReady ? (
          <motion.section
            variants={fadeUp}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="glass-panel p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Checkout ready
                </div>
                <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground">
                  {checkoutReady.company} is ready for the {selectedPlan?.name} plan.
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  The selection is settled. The next backend step is to hand this payload into the payment processor.
                </p>
              </div>
              <div className="rounded-[24px] bg-secondary/50 px-5 py-4 text-sm leading-6 text-muted-foreground">
                <div>
                  <strong className="text-foreground">Billing email:</strong> {checkoutReady.billingEmail}
                </div>
                <div>
                  <strong className="text-foreground">Cycle:</strong> {billingCycle}
                </div>
                <div>
                  <strong className="text-foreground">Estimated total:</strong>{' '}
                  {billingCycle === 'yearly'
                    ? formatCurrency(quote.annualTotal)
                    : formatCurrency(quote.monthlyEquivalent)}
                </div>
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function QuoteMetric({ label, value, hint }) {
  return (
    <div className="rounded-[24px] bg-secondary/55 px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{value}</div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{hint}</p>
    </div>
  );
}

function Field({ label, value, onChange, error, placeholder, type = 'text' }) {
  return (
    <label className="block">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-2xl border bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:ring-2 focus:ring-orange-500/35 ${
          error ? 'border-rose-500/40' : 'border-border'
        }`}
      />
      {error ? <div className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</div> : null}
    </label>
  );
}

function ConsentRow({ checked, onChange, label, error }) {
  return (
    <label className="block">
      <div className={`rounded-2xl border px-4 py-3 ${error ? 'border-rose-500/35 bg-rose-500/5' : 'border-border bg-secondary/40'}`}>
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border text-orange-500 focus:ring-orange-500"
          />
          <span className="text-sm leading-6 text-foreground">{label}</span>
        </div>
      </div>
      {error ? <div className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</div> : null}
    </label>
  );
}

function deriveDisplayName(email) {
  const localPart = String(email || '').trim().split('@')[0];
  if (!localPart) {
    return '';
  }

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
