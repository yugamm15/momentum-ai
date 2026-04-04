export const BILLING_PLANS = [
  {
    id: 'core',
    name: 'Core',
    description: 'For small teams that need meeting capture, review, and follow-through.',
    priceMonthly: '$12',
    priceYearly: '$10',
    monthlyRate: 12,
    yearlyRate: 10,
    minSeats: 3,
    badge: '',
    featuresLabel: 'Includes',
    features: [
      { text: 'Meeting vault with transcript search' },
      { text: 'Evidence-backed task extraction' },
      { text: 'Needs-review queue for unclear follow-ups' },
      { text: '30-day recording retention', hasInfo: true, infoText: 'Older recordings can still be exported before retention ends.' },
    ],
  },
  {
    id: 'momentum',
    name: 'Momentum',
    description: 'Best for active teams that need continuity across recurring meetings.',
    priceMonthly: '$24',
    priceYearly: '$20',
    monthlyRate: 24,
    yearlyRate: 20,
    minSeats: 5,
    badge: 'Most useful',
    featuresLabel: 'Everything in Core, plus',
    features: [
      { text: 'Since-last-meeting memory and drift tracking' },
      { text: 'Role-aware owner load and review workflows' },
      { text: '90-day recording retention', hasInfo: true, infoText: 'Designed for recurring teams that revisit the same work often.' },
      { text: 'Priority meeting processing' },
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    description: 'For larger organizations that need stronger controls and support.',
    priceMonthly: '$42',
    priceYearly: '$36',
    monthlyRate: 42,
    yearlyRate: 36,
    minSeats: 10,
    badge: 'Admin controls',
    featuresLabel: 'Everything in Momentum, plus',
    features: [
      { text: 'Workspace controls and billing review' },
      { text: 'Priority support and onboarding' },
      { text: '180-day recording retention', hasInfo: true, infoText: 'Longer retention is useful for quarterly planning and audit reviews.' },
      { text: 'Advanced rollout support for large teams' },
    ],
  },
];

export function getPlanById(plans, planId) {
  const list = Array.isArray(plans) ? plans : [];
  return list.find((plan) => plan.id === planId) || list[0] || null;
}

export function normalizeBillingCycle(value) {
  return value === 'yearly' ? 'yearly' : 'monthly';
}

export function getActiveSeatCount(people) {
  const members = (Array.isArray(people) ? people : []).filter((person) => person?.isWorkspaceMember !== false);
  return Math.max(1, members.length || 0);
}

export function getBilledSeatCount(plan, activeSeats) {
  const normalizedSeats = Math.max(1, Number(activeSeats || 0));
  const minimumSeats = Math.max(1, Number(plan?.minSeats || 1));
  return Math.max(normalizedSeats, minimumSeats);
}

export function buildBillingQuote({ plan, billingCycle, activeSeats }) {
  const normalizedCycle = normalizeBillingCycle(billingCycle);
  const resolvedPlan = plan || BILLING_PLANS[0];
  const billedSeats = getBilledSeatCount(resolvedPlan, activeSeats);
  const rate = normalizedCycle === 'yearly' ? Number(resolvedPlan.yearlyRate || 0) : Number(resolvedPlan.monthlyRate || 0);
  const monthlyEquivalent = rate * billedSeats;
  const annualTotal = normalizedCycle === 'yearly' ? monthlyEquivalent * 12 : null;
  const monthlyBaseline = Number(resolvedPlan.monthlyRate || 0) * billedSeats * 12;
  const yearlySpend = Number(resolvedPlan.yearlyRate || 0) * billedSeats * 12;
  const annualSavings = Math.max(0, monthlyBaseline - yearlySpend);

  return {
    planId: resolvedPlan.id,
    planName: resolvedPlan.name,
    billingCycle: normalizedCycle,
    activeSeats: Math.max(1, Number(activeSeats || 0)),
    billedSeats,
    minimumSeats: Math.max(1, Number(resolvedPlan.minSeats || 1)),
    rate,
    monthlyEquivalent,
    annualTotal,
    annualSavings,
    renewalLabel:
      normalizedCycle === 'yearly'
        ? 'Renews annually until changed before renewal.'
        : 'Renews monthly until changed before renewal.',
  };
}

export function buildBillingRules({ plan, billingCycle, activeSeats }) {
  const quote = buildBillingQuote({ plan, billingCycle, activeSeats });

  return [
    {
      title: 'Seat floor',
      body:
        quote.billedSeats > quote.activeSeats
          ? `${quote.planName} bills a minimum of ${quote.minimumSeats} seats, so this workspace will be billed for ${quote.billedSeats} seats until more members join.`
          : `This workspace will be billed for ${quote.billedSeats} active seat${quote.billedSeats === 1 ? '' : 's'}.`,
    },
    {
      title: 'Plan changes',
      body: 'Upgrades should take effect immediately. Downgrades should apply on the next renewal so existing access is not interrupted mid-cycle.',
    },
    {
      title: quote.billingCycle === 'yearly' ? 'Annual commitment' : 'Monthly commitment',
      body:
        quote.billingCycle === 'yearly'
          ? 'Annual billing is charged upfront for the full term and should stay locked until renewal unless support approves an exception.'
          : 'Monthly billing renews each month and can be changed before the next invoice is generated.',
    },
    {
      title: 'Billing authority',
      body: 'Only a workspace owner or finance contact should confirm the purchase, because this action authorizes recurring billing for the whole workspace.',
    },
  ];
}

export function validateBillingForm(values) {
  const errors = {};
  const billingName = String(values?.billingName || '').trim();
  const billingEmail = String(values?.billingEmail || '').trim();
  const company = String(values?.company || '').trim();
  const acceptedAuthority = Boolean(values?.acceptedAuthority);
  const acceptedRecurring = Boolean(values?.acceptedRecurring);

  if (!billingName) {
    errors.billingName = 'Billing contact name is required.';
  }

  if (!billingEmail) {
    errors.billingEmail = 'Billing email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) {
    errors.billingEmail = 'Enter a valid billing email.';
  }

  if (!company) {
    errors.company = 'Workspace or company name is required.';
  }

  if (!acceptedAuthority) {
    errors.acceptedAuthority = 'You must confirm that you can approve billing for this workspace.';
  }

  if (!acceptedRecurring) {
    errors.acceptedRecurring = 'You must accept recurring billing before continuing.';
  }

  return errors;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
