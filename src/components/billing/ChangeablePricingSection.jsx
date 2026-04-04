import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Info } from 'lucide-react';

export default function ChangeablePricingSection({
  title = 'Select a plan',
  plans = [],
  defaultPlanId,
  defaultBillingCycle = 'monthly',
  monthlyLabel = 'Monthly',
  yearlyLabel = 'Yearly',
  footerText = 'Cancel anytime. No long-term contract.',
  buttonText = 'Continue',
  onContinue,
  onSelectionChange,
}) {
  const safePlans = useMemo(() => (Array.isArray(plans) ? plans : []), [plans]);
  const initialPlanId = defaultPlanId && safePlans.some((plan) => plan.id === defaultPlanId)
    ? defaultPlanId
    : safePlans[0]?.id || '';

  const [selectedPlan, setSelectedPlan] = useState(initialPlanId);
  const [billingCycle, setBillingCycle] = useState(defaultBillingCycle === 'yearly' ? 'yearly' : 'monthly');
  const resolvedSelectedPlanId = safePlans.some((plan) => plan.id === selectedPlan)
    ? selectedPlan
    : safePlans[0]?.id || '';

  const selectedPlanRecord = useMemo(
    () => safePlans.find((plan) => plan.id === resolvedSelectedPlanId) || null,
    [resolvedSelectedPlanId, safePlans]
  );

  useEffect(() => {
    if (!selectedPlanRecord) {
      return;
    }

    onSelectionChange?.(selectedPlanRecord.id, billingCycle);
  }, [billingCycle, onSelectionChange, selectedPlanRecord]);

  const canContinue = Boolean(selectedPlanRecord);

  return (
    <section className="w-full max-w-[460px] rounded-[28px] bg-neutral-100 p-1.5 shadow-sm ring-1 ring-neutral-200/60 dark:bg-neutral-950 dark:ring-neutral-800/70">
      <div className="flex items-center justify-between px-3 py-4">
        <h2 className="text-[17px] font-medium tracking-tight text-neutral-800 dark:text-neutral-100">
          {title}
        </h2>
        <div
          className="relative flex items-center rounded-full bg-neutral-200 p-1 ring-1 ring-transparent dark:bg-neutral-950 dark:ring-neutral-600/50"
          role="tablist"
          aria-label="Billing cycle"
        >
          <motion.div
            className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm dark:bg-orange-500/15 dark:shadow-none"
            animate={{ x: billingCycle === 'monthly' ? 0 : '100%' }}
            transition={{ type: 'spring', bounce: 0.35, duration: 0.6 }}
            style={{ left: 4 }}
          />
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`relative z-10 w-[72px] rounded-full py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              billingCycle === 'monthly'
                ? 'text-neutral-800 dark:text-orange-500'
                : 'text-neutral-400 dark:text-neutral-500'
            }`}
          >
            {monthlyLabel}
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={`relative z-10 w-[72px] rounded-full py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              billingCycle === 'yearly'
                ? 'text-neutral-800 dark:text-orange-500'
                : 'text-neutral-400 dark:text-neutral-500'
            }`}
          >
            {yearlyLabel}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {safePlans.map((plan) => {
          const isSelected = resolvedSelectedPlanId === plan.id;

          return (
            <motion.div
              layout
              key={plan.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => setSelectedPlan(plan.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedPlan(plan.id);
                }
              }}
              transition={{ type: 'spring', bounce: 0.35, duration: 0.6 }}
              className={`relative cursor-pointer overflow-hidden rounded-[20px] bg-white transition-colors duration-300 dark:bg-neutral-800/50 ${
                isSelected
                  ? 'shadow-[0_4px_16px_rgba(249,115,22,0.06)] ring-[1px] ring-orange-500 dark:shadow-none dark:ring-orange-500'
                  : 'shadow-sm ring-1 ring-neutral-200/80 hover:ring-neutral-300 dark:shadow-none dark:ring-neutral-800 dark:hover:ring-neutral-700'
              }`}
            >
              <div className="px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-1 gap-3">
                    <div className="mt-0.5 shrink-0">
                      <div
                        className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border transition-colors ${
                          isSelected
                            ? 'border-orange-500 bg-orange-500'
                            : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-transparent'
                        }`}
                      >
                        {isSelected ? <Check size={11} strokeWidth={3.5} className="text-white" /> : null}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[16px] font-medium leading-none text-neutral-800 dark:text-neutral-100">
                          {plan.name}
                        </span>
                        {plan.badge ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider leading-none text-green-600 dark:bg-green-500/10 dark:text-green-400">
                            {plan.badge}
                          </span>
                        ) : null}
                      </div>
                      <span className="mt-1.5 text-[11px] leading-snug text-neutral-500 dark:text-neutral-400 sm:leading-none">
                        {plan.description}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="flex h-[18px] items-center justify-end overflow-hidden text-[15px] font-medium leading-none text-neutral-800 dark:text-neutral-100 sm:text-[16px]">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={`${plan.id}-${billingCycle}`}
                          initial={{
                            y: billingCycle === 'yearly' ? 20 : -20,
                            opacity: 0,
                            filter: 'blur(4px)',
                          }}
                          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                          exit={{
                            y: billingCycle === 'monthly' ? -20 : 20,
                            opacity: 0,
                            filter: 'blur(4px)',
                          }}
                          transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                          className="inline-block whitespace-nowrap"
                        >
                          {billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                    <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      per user / month
                    </span>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isSelected ? (
                    <motion.div
                      key={`${plan.id}-features`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        opacity: { duration: 0.18 },
                        height: { duration: 0.28, ease: 'easeOut' },
                      }}
                      className="overflow-hidden"
                    >
                      <div className="mb-1 mt-3.5 border-t border-dashed border-neutral-200 pt-3.5 dark:border-neutral-800 sm:mt-4 sm:pt-4">
                        {plan.featuresLabel ? (
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                            {plan.featuresLabel}
                          </p>
                        ) : null}
                        <div className="flex flex-col gap-2.5">
                          {plan.features.map((feature, index) => (
                            <div key={`${plan.id}-feature-${index}`} className="flex items-center gap-2.5">
                              <Check size={14} strokeWidth={3} className="shrink-0 text-green-500" />
                              <span className="text-[12px] leading-tight text-neutral-600 dark:text-neutral-300">
                                {feature.text}
                              </span>
                              {feature.hasInfo ? (
                                <span
                                  title={feature.infoText || feature.text}
                                  className="ml-0.5 inline-flex"
                                  aria-label={feature.infoText || feature.text}
                                >
                                  <Info size={13} className="text-neutral-300 dark:text-neutral-600" />
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col items-center gap-4 px-3 pb-2 sm:flex-row sm:justify-between">
        <span className="text-center text-[10px] uppercase leading-relaxed tracking-[0.05em] text-neutral-400 sm:text-left">
          {footerText}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!selectedPlanRecord) return;
            onContinue?.(selectedPlanRecord.id, billingCycle);
          }}
          disabled={!canContinue}
          className="w-full rounded-full bg-orange-500 px-8 py-2.5 text-[13px] font-medium text-white outline-none transition-all hover:bg-orange-600 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {buttonText}
        </button>
      </div>
    </section>
  );
}
