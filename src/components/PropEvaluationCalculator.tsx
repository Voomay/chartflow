import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Target,
  Trophy,
} from 'lucide-react';
import { AccountCurrency } from '../types/trading';
import { formatMoney } from '../services/simulationEngine';

export type EvaluationStep = 'STEP_1' | 'STEP_2';
export type RiskPerTradePct = number;
export type RiskRewardRatio = number;
export type EvaluationCurrency = 'USD' | 'ZAR' | 'EUR';

export interface EvaluationScenarioInput {
  accountSize: number;
  step: EvaluationStep;
  targetPct: number;
  riskPct: RiskPerTradePct;
  riskReward: RiskRewardRatio;
  winningTrades: number;
  losingTrades: number;
}

export interface EvaluationScenarioResult {
  riskAmount: number;
  rewardAmount: number;
  targetAmount: number;
  maxLossAmount: number;
  totalWins: number;
  totalLosses: number;
  netProfit: number;
  finalBalance: number;
  progressPct: number;
  clampedProgressPct: number;
  targetReached: boolean;
  maxLossBreached: boolean;
  totalTrades: number;
  winRatePct: number;
  additionalWinsNeeded: number;
  minWinsForCurrentLosses: number;
  winsNeededWithZeroLosses: number;
  breakEvenWinRatePct: number;
}

const ACCOUNT_PRESETS = [5000, 10000, 25000, 50000, 100000, 200000] as const;
const RISK_OPTIONS = [0.25, 0.5, 1] as const;
const RR_OPTIONS = [1.5, 2, 3] as const;
const CURRENCY_OPTIONS: readonly { code: EvaluationCurrency; label: string }[] = [
  { code: 'USD', label: 'USD ($)' },
  { code: 'ZAR', label: 'ZAR (R)' },
  { code: 'EUR', label: 'EUR (€)' },
];
const STEP_DEFAULT_TARGETS: Record<EvaluationStep, number> = {
  STEP_1: 8,
  STEP_2: 5,
};
const STEP_TARGET_CHOICES: Record<EvaluationStep, readonly number[]> = {
  STEP_1: [8, 10],
  STEP_2: [5, 6],
};

/**
 * Computes theoretical prop-firm evaluation metrics for a given win/loss scenario.
 */
export function calculateEvaluationScenario(
  input: EvaluationScenarioInput
): EvaluationScenarioResult {
  const accountSize = Math.max(0, Number.isFinite(input.accountSize) ? input.accountSize : 0);
  const safeRiskPct = Math.max(0.01, Number.isFinite(input.riskPct) ? input.riskPct : 1);
  const safeRR = Math.max(0.1, Number.isFinite(input.riskReward) ? input.riskReward : 2);
  const riskAmount = accountSize * (safeRiskPct / 100);
  const rewardAmount = riskAmount * safeRR;
  const targetAmount = accountSize * (Math.max(0, input.targetPct) / 100);
  const maxLossAmount = accountSize * 0.1;

  const wins = Math.max(0, Math.round(input.winningTrades));
  const losses = Math.max(0, Math.round(input.losingTrades));

  const totalWins = wins * rewardAmount;
  const totalLosses = losses * riskAmount;
  const netProfit = totalWins - totalLosses;
  const finalBalance = accountSize + netProfit;

  const rawProgress = targetAmount > 0 ? (netProfit / targetAmount) * 100 : 0;
  const progressPct = Math.round(rawProgress);
  const clampedProgressPct = Math.max(0, Math.min(100, rawProgress));

  const targetReached = targetAmount > 0 && netProfit >= targetAmount - 1e-6;
  const maxLossBreached = accountSize > 0 && netProfit <= -maxLossAmount + 1e-6;

  const totalTrades = wins + losses;
  const winRatePct = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  const shortfall = Math.max(0, targetAmount - netProfit);
  const additionalWinsNeeded =
    rewardAmount > 0 && shortfall > 1e-6 ? Math.ceil(shortfall / rewardAmount) : 0;
  const minWinsForCurrentLosses =
    rewardAmount > 0
      ? Math.ceil((targetAmount + totalLosses - 1e-6) / rewardAmount)
      : 0;
  const winsNeededWithZeroLosses =
    rewardAmount > 0 && targetAmount > 0
      ? Math.ceil((targetAmount - 1e-6) / rewardAmount)
      : 0;
  const breakEvenWinRatePct = (1 / (1 + safeRR)) * 100;

  return {
    riskAmount,
    rewardAmount,
    targetAmount,
    maxLossAmount,
    totalWins,
    totalLosses,
    netProfit,
    finalBalance,
    progressPct,
    clampedProgressPct,
    targetReached,
    maxLossBreached,
    totalTrades,
    winRatePct,
    additionalWinsNeeded,
    minWinsForCurrentLosses: Math.max(0, minWinsForCurrentLosses),
    winsNeededWithZeroLosses: Math.max(0, winsNeededWithZeroLosses),
    breakEvenWinRatePct,
  };
}

interface PropEvaluationCalculatorProps {
  currency?: AccountCurrency;
  defaultAccountSize?: number;
  isLight: boolean;
  onCreatePropChallenge?: () => void;
}

export const PropEvaluationCalculator: React.FC<PropEvaluationCalculatorProps> = ({
  currency = 'USD',
  defaultAccountSize = 5000,
  isLight,
  onCreatePropChallenge,
}) => {
  const initialCurrency: EvaluationCurrency =
    currency === 'ZAR' || currency === 'EUR' ? currency : 'USD';
  const initialSize = defaultAccountSize > 0 ? defaultAccountSize : 5000;
  const isInitialPreset = ACCOUNT_PRESETS.includes(
    initialSize as (typeof ACCOUNT_PRESETS)[number]
  );

  const [collapsed, setCollapsed] = useState(false);
  const [selectedCurrency, setSelectedCurrency] =
    useState<EvaluationCurrency>(initialCurrency);
  const [step, setStep] = useState<EvaluationStep>('STEP_1');
  const [accountSize, setAccountSize] = useState<number>(initialSize);
  const [isCustomAccountSize, setIsCustomAccountSize] = useState<boolean>(
    !isInitialPreset
  );
  const [customAccountStr, setCustomAccountStr] = useState<string>(
    String(initialSize)
  );
  const [targetPct, setTargetPct] = useState<number>(STEP_DEFAULT_TARGETS.STEP_1);
  const [riskPct, setRiskPct] = useState<RiskPerTradePct>(1);
  const [isCustomRisk, setIsCustomRisk] = useState<boolean>(false);
  const [customRiskStr, setCustomRiskStr] = useState<string>('1.5');
  const [riskReward, setRiskReward] = useState<RiskRewardRatio>(2);
  const [isCustomRR, setIsCustomRR] = useState<boolean>(false);
  const [customRRStr, setCustomRRStr] = useState<string>('2.5');
  const [winningTrades, setWinningTrades] = useState<number>(7);
  const [losingTrades, setLosingTrades] = useState<number>(6);

  const result = useMemo(
    () =>
      calculateEvaluationScenario({
        accountSize,
        step,
        targetPct,
        riskPct,
        riskReward,
        winningTrades,
        losingTrades,
      }),
    [accountSize, step, targetPct, riskPct, riskReward, winningTrades, losingTrades]
  );

  const handleStepChange = (nextStep: EvaluationStep) => {
    setStep(nextStep);
    const nextTarget = STEP_DEFAULT_TARGETS[nextStep];
    setTargetPct(nextTarget);
    if (nextStep === 'STEP_1') {
      setIsCustomRisk(false);
      setRiskPct(1);
      setIsCustomRR(false);
      setRiskReward(2);
      setWinningTrades(7);
      setLosingTrades(6);
    } else {
      setIsCustomRisk(false);
      setRiskPct(1);
      setIsCustomRR(false);
      setRiskReward(2);
      setWinningTrades(5);
      setLosingTrades(5);
    }
  };

  const handleReset = () => {
    handleStepChange(step);
  };

  const borderCls = isLight ? 'border-slate-200' : 'border-white/10';
  const subtleBg = isLight ? 'bg-slate-50' : 'bg-[#0b141e]/70';
  const pillContainerBg = isLight ? 'bg-slate-100' : 'bg-[#0b141e]';
  const mutedText = isLight ? 'text-slate-600' : 'text-slate-400';
  const inputCls = isLight
    ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
    : 'bg-[#081018] border-white/15 text-white focus:border-emerald-400';

  return (
    <section
      aria-label="Interactive prop firm evaluation calculator"
      className="hub-surface rounded-2xl p-3.5 sm:p-6 min-w-0 max-w-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="hub-metric-icon mt-0.5 shrink-0">
            <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold tracking-tight">
                Interactive evaluation calculator
              </h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                Standalone planner
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${mutedText}`}>
              Test your risk per trade and R:R in {selectedCurrency} to see how many wins it takes to pass{' '}
              {step === 'STEP_1' ? 'Step 1 (Phase 1)' : 'Step 2 (Phase 2)'}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          {onCreatePropChallenge && (
            <button
              type="button"
              onClick={onCreatePropChallenge}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
            >
              <Trophy className="w-3.5 h-3.5" />
              Start challenge
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition ${borderCls} ${subtleBg} hover:opacity-90`}
          >
            {collapsed ? (
              <>
                <span>Show</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Hide</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-4 pt-4 border-t border-gray-500/15 space-y-5">
          {/* Row 1: Evaluation Phase + Currency */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-end">
            {/* Step selector */}
            <div className="md:col-span-7 space-y-1.5 min-w-0">
              <label className={`block text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
                Evaluation phase
              </label>
              <div className={`grid grid-cols-2 p-1 rounded-xl border ${borderCls} ${pillContainerBg}`}>
                {(
                  [
                    { id: 'STEP_1', label: 'Step 1 · Phase 1' },
                    { id: 'STEP_2', label: 'Step 2 · Phase 2' },
                  ] as const
                ).map((item) => {
                  const active = step === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleStepChange(item.id)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition ${
                        active
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : `${mutedText} hover:opacity-100`
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Currency selector: USD / ZAR / EUR */}
            <div className="md:col-span-5 space-y-1.5 min-w-0">
              <label className={`block text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
                Currency
              </label>
              <div className={`grid grid-cols-3 p-1 rounded-xl border ${borderCls} ${pillContainerBg}`}>
                {CURRENCY_OPTIONS.map((curr) => {
                  const active = selectedCurrency === curr.code;
                  return (
                    <button
                      key={curr.code}
                      type="button"
                      onClick={() => setSelectedCurrency(curr.code)}
                      className={`py-2 px-2 rounded-lg text-xs font-mono font-semibold transition ${
                        active
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : `${mutedText} hover:opacity-100`
                      }`}
                    >
                      {curr.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Account Balance + Profit Target */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
            {/* Account Size */}
            <div className="lg:col-span-7 space-y-1.5 min-w-0">
              <label className={`block text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
                Account balance ({selectedCurrency})
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                {ACCOUNT_PRESETS.map((preset) => {
                  const active = !isCustomAccountSize && accountSize === preset;
                  const label = `${preset / 1000}K`;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setIsCustomAccountSize(false);
                        setAccountSize(preset);
                        setCustomAccountStr(String(preset));
                      }}
                      className={`px-2.5 py-2 rounded-lg text-xs font-mono font-semibold border transition ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-400'
                          : `${borderCls} ${subtleBg} opacity-75 hover:opacity-100`
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomAccountSize(true);
                    const parsed = parseFloat(customAccountStr);
                    if (Number.isFinite(parsed) && parsed > 0) {
                      setAccountSize(parsed);
                    }
                  }}
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition ${
                    isCustomAccountSize
                      ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-400'
                      : `${borderCls} ${subtleBg} opacity-75 hover:opacity-100`
                  }`}
                >
                  Custom
                </button>
              </div>
              {isCustomAccountSize && (
                <div className="pt-1.5 flex items-center gap-2 max-w-xs">
                  <input
                    type="number"
                    min={100}
                    step={500}
                    aria-label="Custom account balance"
                    value={customAccountStr}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setCustomAccountStr(raw);
                      const parsed = parseFloat(raw);
                      if (Number.isFinite(parsed) && parsed > 0) {
                        setAccountSize(parsed);
                      }
                    }}
                    placeholder="e.g. 50000"
                    className={`w-full px-3 py-2 rounded-xl border text-xs sm:text-sm font-mono outline-none ${inputCls}`}
                  />
                </div>
              )}
            </div>

            {/* Profit Target % */}
            <div className="lg:col-span-5 space-y-1.5 min-w-0">
              <label className={`block text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
                Profit target
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {STEP_TARGET_CHOICES[step].map((pct) => {
                  const active = targetPct === pct;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setTargetPct(pct)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-mono font-semibold border transition truncate ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-400'
                          : `${borderCls} ${subtleBg} opacity-75 hover:opacity-100`
                      }`}
                    >
                      {pct}% ({formatMoney(accountSize * (pct / 100), selectedCurrency)})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Risk per trade + Risk-to-reward ratio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Risk per trade (Presets + Custom) */}
            <div className="space-y-2 min-w-0">
              <p className={`text-xs font-semibold ${mutedText}`}>Risk per trade</p>
              <div className="space-y-2">
                {RISK_OPTIONS.map((opt) => {
                  const active = !isCustomRisk && riskPct === opt;
                  const dollarRisk = accountSize * (opt / 100);
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setIsCustomRisk(false);
                        setRiskPct(opt);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left text-xs sm:text-sm transition ${
                        active
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : `${borderCls} ${subtleBg} hover:border-emerald-500/30`
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          active
                            ? 'border-emerald-500 bg-emerald-500'
                            : isLight
                            ? 'border-slate-300 bg-white'
                            : 'border-slate-600 bg-transparent'
                        }`}
                      >
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="font-mono font-medium truncate">
                        {opt}% — {formatMoney(dollarRisk, selectedCurrency)}
                      </span>
                    </button>
                  );
                })}

                {/* Custom Risk per Trade */}
                <div
                  className={`w-full rounded-xl border px-3 py-2.5 transition ${
                    isCustomRisk
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : `${borderCls} ${subtleBg} hover:border-emerald-500/30`
                  }`}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isCustomRisk}
                    onClick={() => {
                      setIsCustomRisk(true);
                      const parsed = parseFloat(customRiskStr);
                      if (Number.isFinite(parsed) && parsed > 0) {
                        setRiskPct(parsed);
                      }
                    }}
                    className="w-full flex items-center justify-between gap-2 text-left text-xs sm:text-sm"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isCustomRisk
                            ? 'border-emerald-500 bg-emerald-500'
                            : isLight
                            ? 'border-slate-300 bg-white'
                            : 'border-slate-600 bg-transparent'
                        }`}
                      >
                        {isCustomRisk && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="font-semibold">Custom risk %</span>
                    </span>
                    <span className="font-mono text-xs text-emerald-400 shrink-0">
                      {formatMoney(
                        accountSize * ((isCustomRisk ? riskPct : parseFloat(customRiskStr) || 0) / 100),
                        selectedCurrency
                      )}
                    </span>
                  </button>
                  {isCustomRisk && (
                    <div className="mt-2.5 flex items-center gap-2 pl-7">
                      <input
                        type="number"
                        min={0.05}
                        max={25}
                        step={0.1}
                        aria-label="Custom risk per trade percentage"
                        value={customRiskStr}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setCustomRiskStr(raw);
                          const parsed = parseFloat(raw);
                          if (Number.isFinite(parsed) && parsed > 0) {
                            setRiskPct(Math.min(25, Math.max(0.05, parsed)));
                          }
                        }}
                        className={`w-28 px-2.5 py-1.5 rounded-lg border text-xs sm:text-sm font-mono outline-none ${inputCls}`}
                      />
                      <span className={`text-xs font-semibold ${mutedText}`}>% per trade</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Risk-to-reward ratio (Presets + Custom) */}
            <div className="space-y-3 flex flex-col justify-between min-w-0">
              <div className="space-y-2">
                <p className={`text-xs font-semibold ${mutedText}`}>Risk-to-reward ratio</p>
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl border ${borderCls} ${pillContainerBg}`}>
                  {RR_OPTIONS.map((rr) => {
                    const active = !isCustomRR && riskReward === rr;
                    return (
                      <button
                        key={rr}
                        type="button"
                        onClick={() => {
                          setIsCustomRR(false);
                          setRiskReward(rr);
                        }}
                        className={`py-2 px-2.5 rounded-lg text-xs sm:text-sm font-mono font-semibold transition ${
                          active
                            ? isLight
                              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                              : 'bg-emerald-600 text-white shadow-sm'
                            : `${mutedText} hover:opacity-100`
                        }`}
                      >
                        1:{rr}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomRR(true);
                      const parsed = parseFloat(customRRStr);
                      if (Number.isFinite(parsed) && parsed > 0) {
                        setRiskReward(parsed);
                      }
                    }}
                    className={`py-2 px-2.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                      isCustomRR
                        ? isLight
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'bg-emerald-600 text-white shadow-sm'
                        : `${mutedText} hover:opacity-100`
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {isCustomRR && (
                  <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${borderCls} ${subtleBg}`}>
                    <span className="font-mono text-xs sm:text-sm font-bold">1 :</span>
                    <input
                      type="number"
                      min={0.5}
                      max={25}
                      step={0.1}
                      aria-label="Custom risk to reward ratio"
                      value={customRRStr}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCustomRRStr(raw);
                        const parsed = parseFloat(raw);
                        if (Number.isFinite(parsed) && parsed > 0) {
                          setRiskReward(Math.min(25, Math.max(0.5, parsed)));
                        }
                      }}
                      className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs sm:text-sm font-mono outline-none ${inputCls}`}
                    />
                    <span className={`text-xs ${mutedText}`}>R:R (e.g. 2.5, 4, 5)</span>
                  </div>
                )}
              </div>

              {/* Quick passing insight */}
              <div className={`rounded-xl border p-3 text-xs space-y-1.5 ${borderCls} ${subtleBg}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    <Target className="w-3.5 h-3.5 shrink-0" />
                    <span>Passing breakdown ({targetPct}% target)</span>
                  </div>
                  <span className={`text-[11px] font-mono ${mutedText}`}>
                    Break-even: {result.breakEvenWinRatePct.toFixed(0)}%
                  </span>
                </div>
                <p className={`leading-relaxed ${mutedText}`}>
                  Each win pays{' '}
                  <strong className="text-emerald-400 font-mono">
                    {formatMoney(result.rewardAmount, selectedCurrency, true)}
                  </strong>{' '}
                  and each loss costs{' '}
                  <strong className="text-rose-400 font-mono">
                    -{formatMoney(result.riskAmount, selectedCurrency)}
                  </strong>
                  . With 0 losses you pass in{' '}
                  <strong className="font-mono text-emerald-400">
                    {result.winsNeededWithZeroLosses} winning trade
                    {result.winsNeededWithZeroLosses === 1 ? '' : 's'}
                  </strong>
                  ; with {losingTrades} losing trade{losingTrades === 1 ? '' : 's'}, you need{' '}
                  <strong className="font-mono text-emerald-400">
                    {result.minWinsForCurrentLosses} winning trade
                    {result.minWinsForCurrentLosses === 1 ? '' : 's'}
                  </strong>{' '}
                  to pass {step === 'STEP_1' ? 'Step 1' : 'Step 2'}.
                </p>
              </div>
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4 pt-2 border-t border-gray-500/15">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <label htmlFor="eval-winning-trades" className="font-semibold">
                  Winning trades
                </label>
                <span className="font-mono font-bold text-emerald-400 tabular-nums">
                  {winningTrades}
                </span>
              </div>
              <input
                id="eval-winning-trades"
                type="range"
                min={0}
                max={40}
                step={1}
                value={winningTrades}
                onChange={(e) => setWinningTrades(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <label htmlFor="eval-losing-trades" className="font-semibold">
                  Losing trades
                </label>
                <span className="font-mono font-bold text-rose-400 tabular-nums">
                  {losingTrades}
                </span>
              </div>
              <input
                id="eval-losing-trades"
                type="range"
                min={0}
                max={40}
                step={1}
                value={losingTrades}
                onChange={(e) => setLosingTrades(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Results 2x2 Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
            <div className={`rounded-xl border p-3 min-w-0 ${borderCls} ${subtleBg}`}>
              <p className={`text-[11px] ${mutedText}`}>Total wins</p>
              <strong className="block text-sm sm:text-base font-mono font-bold text-emerald-400 mt-0.5 tabular-nums truncate">
                {formatMoney(result.totalWins, selectedCurrency, true)}
              </strong>
            </div>
            <div className={`rounded-xl border p-3 min-w-0 ${borderCls} ${subtleBg}`}>
              <p className={`text-[11px] ${mutedText}`}>Total losses</p>
              <strong className="block text-sm sm:text-base font-mono font-bold text-rose-400 mt-0.5 tabular-nums truncate">
                -{formatMoney(result.totalLosses, selectedCurrency)}
              </strong>
            </div>
            <div className={`rounded-xl border p-3 min-w-0 ${borderCls} ${subtleBg}`}>
              <p className={`text-[11px] ${mutedText}`}>Net profit/loss</p>
              <strong
                className={`block text-sm sm:text-base font-mono font-bold mt-0.5 tabular-nums truncate ${
                  result.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatMoney(result.netProfit, selectedCurrency, true)}
              </strong>
            </div>
            <div className={`rounded-xl border p-3 min-w-0 ${borderCls} ${subtleBg}`}>
              <p className={`text-[11px] ${mutedText}`}>Final balance</p>
              <strong className="block text-sm sm:text-base font-mono font-bold mt-0.5 tabular-nums truncate">
                {formatMoney(result.finalBalance, selectedCurrency)}
              </strong>
            </div>
          </div>

          {/* Profit Target Progress */}
          <div className="space-y-2 pt-2 border-t border-gray-500/15">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="font-semibold">
                Profit target progress{' '}
                <span className={`font-normal text-xs ${mutedText}`}>
                  (Target: {formatMoney(result.targetAmount, selectedCurrency)} · Win rate:{' '}
                  {result.winRatePct.toFixed(0)}%)
                </span>
              </span>
              <span className="font-mono font-bold tabular-nums">
                {Math.max(0, result.progressPct)}%
              </span>
            </div>

            <div
              className={`h-2.5 w-full rounded-full overflow-hidden ${
                isLight ? 'bg-slate-200' : 'bg-white/10'
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  result.maxLossBreached
                    ? 'bg-rose-500'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
                style={{ width: `${result.clampedProgressPct}%` }}
              />
            </div>

            {result.targetReached ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Profit target reached in this scenario.</span>
              </p>
            ) : result.maxLossBreached ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Net loss exceeds typical 10% max drawdown ({formatMoney(-result.maxLossAmount, selectedCurrency)}).
                </span>
              </p>
            ) : (
              <p className={`text-xs ${mutedText}`}>
                You need{' '}
                <strong className="text-emerald-400 font-mono">
                  {result.additionalWinsNeeded} more winning trade
                  {result.additionalWinsNeeded === 1 ? '' : 's'}
                </strong>{' '}
                at 1:{riskReward} R:R to reach the {formatMoney(result.targetAmount, selectedCurrency)}{' '}
                target.
              </p>
            )}
          </div>

          {/* Disclaimer + Reset */}
          <div className="space-y-3 pt-1">
            <p className={`text-[11px] leading-relaxed ${mutedText}`}>
              These are theoretical outcomes before spreads, commissions and slippage. The
              calculator shows net profit, not whether the sequence of trades would breach the
              daily or trailing limits.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className={`w-full py-2.5 px-4 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 transition ${borderCls} ${subtleBg} hover:border-emerald-500/40`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset example
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
