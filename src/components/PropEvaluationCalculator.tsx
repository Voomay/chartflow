import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
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

export interface WorstPassingScenarioResult {
  riskAmount: number;
  rewardAmount: number;
  targetAmount: number;
  maxLossAmount: number;
  maxSurvivableLosses: number;
  worstDrawdownAmount: number;
  worstDrawdownPct: number;
  lowestBalance: number;
  bufferToBreach: number;
  winsToRecoverAndPass: number;
  totalTrades: number;
  requiredWinRatePct: number;
  netProfit: number;
  finalBalance: number;
  canSurviveAnyLoss: boolean;
  minTheoreticalWinRatePct: number;
}

export interface AlternativeScenario {
  id: 'lower-risk' | 'higher-rr' | 'faster-risk';
  title: string;
  badge: string;
  description: string;
  riskPct: number;
  riskReward: number;
  riskAmount: number;
  rewardAmount: number;
  wins: number;
  losses: number;
  totalTrades: number;
  effectiveWinRatePct: number;
  netProfit: number;
  maxConsecutiveLosses: number;
  reachableAtWinRate: boolean;
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

/**
 * Computes the worst-case drawdown & recovery path on the selected risk that
 * still reaches the profit target without breaching the 10% max loss limit.
 */
export function calculateWorstPassingScenario(
  input: Omit<EvaluationScenarioInput, 'winningTrades' | 'losingTrades'>
): WorstPassingScenarioResult {
  const accountSize = Math.max(0, Number.isFinite(input.accountSize) ? input.accountSize : 0);
  const safeRiskPct = Math.max(0.01, Number.isFinite(input.riskPct) ? input.riskPct : 1);
  const safeRR = Math.max(0.1, Number.isFinite(input.riskReward) ? input.riskReward : 2);
  const riskAmount = accountSize * (safeRiskPct / 100);
  const rewardAmount = riskAmount * safeRR;
  const targetAmount = accountSize * (Math.max(0, input.targetPct) / 100);
  const maxLossAmount = accountSize * 0.1;

  const maxSurvivableLosses =
    riskAmount > 0 && maxLossAmount > 0
      ? Math.max(0, Math.floor((maxLossAmount - 1e-6) / riskAmount))
      : 0;
  const worstDrawdownAmount = maxSurvivableLosses * riskAmount;
  const worstDrawdownPct =
    accountSize > 0 ? (worstDrawdownAmount / accountSize) * 100 : 0;
  const lowestBalance = accountSize - worstDrawdownAmount;
  const bufferToBreach = Math.max(0, maxLossAmount - worstDrawdownAmount);

  const winsToRecoverAndPass =
    rewardAmount > 0 && targetAmount > 0
      ? Math.ceil((targetAmount + worstDrawdownAmount - 1e-6) / rewardAmount)
      : 0;
  const totalTrades = maxSurvivableLosses + winsToRecoverAndPass;
  const requiredWinRatePct =
    totalTrades > 0 ? (winsToRecoverAndPass / totalTrades) * 100 : 0;
  const netProfit = winsToRecoverAndPass * rewardAmount - worstDrawdownAmount;
  const finalBalance = accountSize + netProfit;
  const minTheoreticalWinRatePct = (1 / (1 + safeRR)) * 100;

  return {
    riskAmount,
    rewardAmount,
    targetAmount,
    maxLossAmount,
    maxSurvivableLosses,
    worstDrawdownAmount,
    worstDrawdownPct,
    lowestBalance,
    bufferToBreach,
    winsToRecoverAndPass,
    totalTrades,
    requiredWinRatePct,
    netProfit,
    finalBalance,
    canSurviveAnyLoss: maxSurvivableLosses > 0,
    minTheoreticalWinRatePct,
  };
}

function solveTradesForTargetAtWinRate(
  accountSize: number,
  targetAmount: number,
  riskPct: number,
  riskReward: number,
  winRatePct: number
): {
  riskAmount: number;
  rewardAmount: number;
  wins: number;
  losses: number;
  totalTrades: number;
  effectiveWinRatePct: number;
  netProfit: number;
  maxConsecutiveLosses: number;
  reachableAtWinRate: boolean;
  breakEvenWinRatePct: number;
} {
  const safeRiskPct = Math.max(0.05, riskPct);
  const safeRR = Math.max(0.1, riskReward);
  const riskAmount = accountSize * (safeRiskPct / 100);
  const rewardAmount = riskAmount * safeRR;
  const maxLossAmount = accountSize * 0.1;
  const maxConsecutiveLosses =
    riskAmount > 0 && maxLossAmount > 0
      ? Math.max(0, Math.floor((maxLossAmount - 1e-6) / riskAmount))
      : 0;
  const breakEvenWinRatePct = (1 / (1 + safeRR)) * 100;
  const winProb = Math.min(100, Math.max(0, winRatePct)) / 100;

  if (targetAmount <= 0 || rewardAmount <= 0) {
    return {
      riskAmount,
      rewardAmount,
      wins: 0,
      losses: 0,
      totalTrades: 0,
      effectiveWinRatePct: 0,
      netProfit: 0,
      maxConsecutiveLosses,
      reachableAtWinRate: false,
      breakEvenWinRatePct,
    };
  }

  for (let total = 1; total <= 500; total++) {
    const wins = Math.round(total * winProb);
    const losses = total - wins;
    const netProfit = wins * rewardAmount - losses * riskAmount;
    if (netProfit >= targetAmount - 1e-6) {
      return {
        riskAmount,
        rewardAmount,
        wins,
        losses,
        totalTrades: total,
        effectiveWinRatePct: (wins / total) * 100,
        netProfit,
        maxConsecutiveLosses,
        reachableAtWinRate: true,
        breakEvenWinRatePct,
      };
    }
  }

  return {
    riskAmount,
    rewardAmount,
    wins: 0,
    losses: 0,
    totalTrades: 0,
    effectiveWinRatePct: winRatePct,
    netProfit: 0,
    maxConsecutiveLosses,
    reachableAtWinRate: false,
    breakEvenWinRatePct,
  };
}

/**
 * Generates alternative risk and R:R paths to reach the same profit target
 * using the user's selected win rate.
 */
export function calculateAlternativeScenarios(input: {
  accountSize: number;
  targetPct: number;
  riskPct: number;
  riskReward: number;
  winRatePct: number;
}): AlternativeScenario[] {
  const accountSize = Math.max(0, Number.isFinite(input.accountSize) ? input.accountSize : 0);
  const safeRiskPct = Math.max(0.05, Number.isFinite(input.riskPct) ? input.riskPct : 1);
  const safeRR = Math.max(0.1, Number.isFinite(input.riskReward) ? input.riskReward : 2);
  const targetAmount = accountSize * (Math.max(0, input.targetPct) / 100);
  const winRatePct = Math.min(100, Math.max(0, Number.isFinite(input.winRatePct) ? input.winRatePct : 50));

  const lowerRiskPct =
    safeRiskPct <= 0.25
      ? 0.1
      : Math.max(0.1, Math.round(safeRiskPct * 50) / 100);
  const higherRR =
    safeRR < 2
      ? 2.5
      : safeRR < 3
      ? 3
      : Math.min(25, Math.round((safeRR + 1) * 10) / 10);
  const fasterRiskPct =
    safeRiskPct < 2
      ? Math.min(5, Math.round(safeRiskPct * 150) / 100)
      : Math.min(8, Math.round((safeRiskPct + 0.5) * 100) / 100);

  const lowerRiskSolved = solveTradesForTargetAtWinRate(
    accountSize,
    targetAmount,
    lowerRiskPct,
    safeRR,
    winRatePct
  );
  const higherRRSolved = solveTradesForTargetAtWinRate(
    accountSize,
    targetAmount,
    safeRiskPct,
    higherRR,
    winRatePct
  );
  const fasterRiskSolved = solveTradesForTargetAtWinRate(
    accountSize,
    targetAmount,
    fasterRiskPct,
    safeRR,
    winRatePct
  );

  return [
    {
      id: 'lower-risk',
      title: 'Conservative (Half Risk)',
      badge: `${lowerRiskPct}% risk · 1:${safeRR}`,
      description: 'Cuts risk per trade to double your drawdown cushion before 10% max loss.',
      riskPct: lowerRiskPct,
      riskReward: safeRR,
      ...lowerRiskSolved,
    },
    {
      id: 'higher-rr',
      title: 'Higher R:R Target',
      badge: `${safeRiskPct}% risk · 1:${higherRR}`,
      description: 'Keeps your exact risk % while aiming for a larger reward multiple.',
      riskPct: safeRiskPct,
      riskReward: higherRR,
      ...higherRRSolved,
    },
    {
      id: 'faster-risk',
      title: 'Accelerated Risk',
      badge: `${fasterRiskPct}% risk · 1:${safeRR}`,
      description: 'Reaches the target in fewer trades with a tighter drawdown buffer.',
      riskPct: fasterRiskPct,
      riskReward: safeRR,
      ...fasterRiskSolved,
    },
  ];
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
  const [isCustomTarget, setIsCustomTarget] = useState<boolean>(false);
  const [customTargetStr, setCustomTargetStr] = useState<string>('12');
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

  const worstScenario = useMemo(
    () =>
      calculateWorstPassingScenario({
        accountSize,
        step,
        targetPct,
        riskPct,
        riskReward,
      }),
    [accountSize, step, targetPct, riskPct, riskReward]
  );

  const alternativeScenarios = useMemo(
    () =>
      calculateAlternativeScenarios({
        accountSize,
        targetPct,
        riskPct,
        riskReward,
        winRatePct: result.totalTrades > 0 ? result.winRatePct : 50,
      }),
    [accountSize, targetPct, riskPct, riskReward, result.totalTrades, result.winRatePct]
  );

  const handleStepChange = (nextStep: EvaluationStep) => {
    setStep(nextStep);
    const nextTarget = STEP_DEFAULT_TARGETS[nextStep];
    setIsCustomTarget(false);
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

  const handleWinRateChange = (nextWinRate: number) => {
    const clampedWr = Math.min(100, Math.max(0, Math.round(nextWinRate)));
    const baseTotal = Math.max(1, winningTrades + losingTrades || 10);
    const nextWins = Math.min(40, Math.round((clampedWr / 100) * baseTotal));
    const nextLosses = Math.min(40, Math.max(0, baseTotal - nextWins));
    setWinningTrades(nextWins);
    setLosingTrades(nextLosses);
  };

  const handleApplyAlternative = (alt: AlternativeScenario) => {
    const isRiskPreset = RISK_OPTIONS.includes(alt.riskPct as (typeof RISK_OPTIONS)[number]);
    setIsCustomRisk(!isRiskPreset);
    setRiskPct(alt.riskPct);
    if (!isRiskPreset) {
      setCustomRiskStr(String(alt.riskPct));
    }

    const isRRPreset = RR_OPTIONS.includes(alt.riskReward as (typeof RR_OPTIONS)[number]);
    setIsCustomRR(!isRRPreset);
    setRiskReward(alt.riskReward);
    if (!isRRPreset) {
      setCustomRRStr(String(alt.riskReward));
    }

    if (alt.reachableAtWinRate) {
      setWinningTrades(Math.min(40, alt.wins));
      setLosingTrades(Math.min(40, alt.losses));
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
              <div className="grid grid-cols-3 gap-1.5">
                {STEP_TARGET_CHOICES[step].map((pct) => {
                  const active = !isCustomTarget && targetPct === pct;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setIsCustomTarget(false);
                        setTargetPct(pct);
                      }}
                      className={`py-2 px-2 rounded-lg text-xs font-mono font-semibold border transition truncate ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-400'
                          : `${borderCls} ${subtleBg} opacity-75 hover:opacity-100`
                      }`}
                    >
                      {pct}% ({formatMoney(accountSize * (pct / 100), selectedCurrency)})
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomTarget(true);
                    const parsed = parseFloat(customTargetStr);
                    if (Number.isFinite(parsed) && parsed > 0) {
                      setTargetPct(Math.min(100, Math.max(0.5, parsed)));
                    }
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold border transition ${
                    isCustomTarget
                      ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-400'
                      : `${borderCls} ${subtleBg} opacity-75 hover:opacity-100`
                  }`}
                >
                  Custom
                </button>
              </div>
              {isCustomTarget && (
                <div className="pt-1.5 flex items-center gap-2">
                  <input
                    type="number"
                    min={0.5}
                    max={100}
                    step={0.5}
                    aria-label="Custom profit target percentage"
                    value={customTargetStr}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setCustomTargetStr(raw);
                      const parsed = parseFloat(raw);
                      if (Number.isFinite(parsed) && parsed > 0) {
                        setTargetPct(Math.min(100, Math.max(0.5, parsed)));
                      }
                    }}
                    placeholder="e.g. 12"
                    className={`w-28 px-3 py-2 rounded-xl border text-xs sm:text-sm font-mono outline-none ${inputCls}`}
                  />
                  <span className={`text-xs font-mono ${mutedText}`}>
                    % = {formatMoney(accountSize * (targetPct / 100), selectedCurrency)}
                  </span>
                </div>
              )}
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

          {/* Win Rate + Winning / Losing Trade Sliders */}
          <div className="space-y-4 pt-2 border-t border-gray-500/15">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                <label htmlFor="eval-win-rate" className="font-semibold">
                  Win rate
                  <span className={`ml-2 font-normal text-xs ${mutedText}`}>
                    ({result.totalTrades} total trade{result.totalTrades === 1 ? '' : 's'})
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  {result.totalTrades > 0 &&
                    result.winRatePct <= result.breakEvenWinRatePct + 1e-6 && (
                      <span className="text-[11px] font-medium text-amber-400">
                        At/below {result.breakEvenWinRatePct.toFixed(0)}% break-even
                      </span>
                    )}
                  <span className="font-mono font-bold text-sky-400 tabular-nums">
                    {result.winRatePct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <input
                id="eval-win-rate"
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(result.winRatePct)}
                onChange={(e) => handleWinRateChange(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

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

          {/* Worst-Case Scenario on Selected Risk That Still Passes */}
          <div className="space-y-3 pt-3 border-t border-gray-500/15">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <h4 className="text-xs sm:text-sm font-semibold">
                  Worst-case scenario on {riskPct}% risk to still pass
                </h4>
              </div>
              <span className={`text-[11px] font-mono ${mutedText}`}>
                Max loss limit: -{formatMoney(worstScenario.maxLossAmount, selectedCurrency)} (10%)
              </span>
            </div>

            {worstScenario.canSurviveAnyLoss ? (
              <div className={`rounded-xl border p-3.5 space-y-3 ${borderCls} ${subtleBg}`}>
                <p className={`text-xs leading-relaxed ${mutedText}`}>
                  At{' '}
                  <strong className="font-mono text-rose-400">
                    {riskPct}% ({formatMoney(worstScenario.riskAmount, selectedCurrency)})
                  </strong>{' '}
                  risk per trade, you can suffer up to{' '}
                  <strong className="font-mono text-amber-400">
                    {worstScenario.maxSurvivableLosses} consecutive loss
                    {worstScenario.maxSurvivableLosses === 1 ? '' : 'es'}
                  </strong>{' '}
                  (dropping to{' '}
                  <strong className="font-mono">
                    {formatMoney(worstScenario.lowestBalance, selectedCurrency)}
                  </strong>
                  , -{worstScenario.worstDrawdownPct.toFixed(1)}%) before breaching the 10% max
                  drawdown, then still pass with{' '}
                  <strong className="font-mono text-emerald-400">
                    {worstScenario.winsToRecoverAndPass} winning trade
                    {worstScenario.winsToRecoverAndPass === 1 ? '' : 's'}
                  </strong>{' '}
                  at 1:{riskReward} R:R.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className={`rounded-lg border p-2.5 min-w-0 ${borderCls}`}>
                    <p className={`text-[10px] uppercase tracking-wider ${mutedText}`}>
                      Max streak losses
                    </p>
                    <strong className="block text-xs sm:text-sm font-mono font-bold text-rose-400 mt-0.5 tabular-nums">
                      {worstScenario.maxSurvivableLosses} losses
                    </strong>
                    <span className={`text-[11px] font-mono ${mutedText}`}>
                      -{formatMoney(worstScenario.worstDrawdownAmount, selectedCurrency)}
                    </span>
                  </div>
                  <div className={`rounded-lg border p-2.5 min-w-0 ${borderCls}`}>
                    <p className={`text-[10px] uppercase tracking-wider ${mutedText}`}>
                      Wins to recover & pass
                    </p>
                    <strong className="block text-xs sm:text-sm font-mono font-bold text-emerald-400 mt-0.5 tabular-nums">
                      {worstScenario.winsToRecoverAndPass} wins
                    </strong>
                    <span className={`text-[11px] font-mono ${mutedText}`}>
                      {worstScenario.totalTrades} total trades
                    </span>
                  </div>
                  <div className={`rounded-lg border p-2.5 min-w-0 ${borderCls}`}>
                    <p className={`text-[10px] uppercase tracking-wider ${mutedText}`}>
                      Worst-path win rate
                    </p>
                    <strong className="block text-xs sm:text-sm font-mono font-bold text-amber-400 mt-0.5 tabular-nums">
                      {worstScenario.requiredWinRatePct.toFixed(0)}%
                    </strong>
                    <span className={`text-[11px] font-mono ${mutedText}`}>
                      Floor &gt;{worstScenario.minTheoreticalWinRatePct.toFixed(0)}%
                    </span>
                  </div>
                  <div className={`rounded-lg border p-2.5 min-w-0 ${borderCls}`}>
                    <p className={`text-[10px] uppercase tracking-wider ${mutedText}`}>
                      Final balance
                    </p>
                    <strong className="block text-xs sm:text-sm font-mono font-bold text-emerald-400 mt-0.5 tabular-nums truncate">
                      {formatMoney(worstScenario.finalBalance, selectedCurrency)}
                    </strong>
                    <span className={`text-[11px] font-mono ${mutedText}`}>
                      {formatMoney(worstScenario.netProfit, selectedCurrency, true)} net
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  At {riskPct}% risk per trade, even 1 loss reaches or exceeds the 10% max drawdown.
                  Lower your risk below 10% to allow any losing trades.
                </span>
              </div>
            )}
          </div>

          {/* Alternative Scenarios */}
          <div className="space-y-3 pt-3 border-t border-gray-500/15">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="text-xs sm:text-sm font-semibold">
                  Alternative scenarios to reach {targetPct}% target
                </h4>
              </div>
              <span className={`text-[11px] font-mono ${mutedText}`}>
                At {result.totalTrades > 0 ? result.winRatePct.toFixed(0) : 50}% win rate
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {alternativeScenarios.map((alt) => (
                <div
                  key={alt.id}
                  className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 min-w-0 ${borderCls} ${subtleBg}`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold flex items-center gap-1.5 truncate">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{alt.title}</span>
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 shrink-0">
                        {alt.badge}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-snug ${mutedText}`}>{alt.description}</p>
                  </div>

                  {alt.reachableAtWinRate ? (
                    <div className="space-y-1.5 pt-1 border-t border-gray-500/10 text-[11px]">
                      <div className="flex items-center justify-between font-mono">
                        <span className={mutedText}>Path to target:</span>
                        <span className="font-semibold">
                          <span className="text-emerald-400">{alt.wins}W</span> /{' '}
                          <span className="text-rose-400">{alt.losses}L</span> ({alt.totalTrades} trades)
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono">
                        <span className={mutedText}>Net profit:</span>
                        <span className="font-semibold text-emerald-400">
                          {formatMoney(alt.netProfit, selectedCurrency, true)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono">
                        <span className={mutedText}>Max loss streak:</span>
                        <span>{alt.maxConsecutiveLosses} losses</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-400 pt-1 border-t border-gray-500/10">
                      Needs &gt;{alt.breakEvenWinRatePct.toFixed(0)}% win rate at 1:{alt.riskReward} R:R.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => handleApplyAlternative(alt)}
                    className={`w-full py-1.5 px-2.5 rounded-lg border text-[11px] font-semibold transition ${borderCls} hover:border-emerald-500/45 hover:text-emerald-400`}
                  >
                    Apply this scenario
                  </button>
                </div>
              ))}
            </div>
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
