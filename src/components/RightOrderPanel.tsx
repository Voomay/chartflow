import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  ChartDrawing,
  InstrumentSymbol,
  OrderSubType,
  ThemeMode,
  TradingSession,
} from '../types/trading';
import {
  calculatePositionPnl,
  computeLiveSessionMetrics,
  convertUsdToAccountCurrency,
  formatMoney,
  formatTimestampInTimezone,
  getBidAskFromMid,
  getEffectiveInstrumentSpec,
  PlaceOrderInput,
} from '../services/simulationEngine';

interface RightOrderPanelProps {
  session: TradingSession;
  symbol: InstrumentSymbol;
  currentMidPrice: number;
  pricingContext?: string;
  pricingReady?: boolean;
  atr14: number;
  theme: ThemeMode;
  onExecuteOrder: (req: PlaceOrderInput) => { ok: boolean; error?: string };
  onStartNewChallengeAttempt: (targetPhase?: 'PHASE_1' | 'PHASE_2') => void;
  onOpenAnalytics: () => void;
  availableStrategies: string[];
  activePositionDrawing?: ChartDrawing | null;
  onAddOrUpdatePositionDrawing?: (
    side: 'LONG' | 'SHORT',
    entry: number,
    sl: number,
    tp: number,
    lot: number
  ) => void;
}

export const RightOrderPanel: React.FC<RightOrderPanelProps> = ({
  session,
  symbol,
  currentMidPrice,
  pricingContext,
  pricingReady = true,
  atr14,
  theme,
  onExecuteOrder,
  onStartNewChallengeAttempt,
  onOpenAnalytics,
  availableStrategies,
  activePositionDrawing,
  onAddOrUpdatePositionDrawing,
}) => {
  const isLight = theme === 'light';
  const spec = getEffectiveInstrumentSpec(symbol, session);
  const { bid, ask, spread, spreadPips } = getBidAskFromMid(
    currentMidPrice,
    symbol,
    session
  );

  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [orderCategory, setOrderCategory] = useState<'MARKET' | 'LIMIT' | 'STOP'>('MARKET');
  const [sizingMode, setSizingMode] = useState<'LOTS' | 'RISK_PCT'>('LOTS');
  const [lotSizeInput, setLotSizeInput] = useState<string>('1.00');
  const [riskPctInput, setRiskPctInput] = useState<string>('1.0');
  const [entryPriceInput, setEntryPriceInput] = useState<string>('');
  const [stopLossInput, setStopLossInput] = useState<string>('');
  const [takeProfitInput, setTakeProfitInput] = useState<string>('');
  const [selectedR, setSelectedR] = useState<number | null>(2);
  const [strategyTag, setStrategyTag] = useState<string>(
    session.strategyName || 'Price Action'
  );
  const [orderFeedback, setOrderFeedback] = useState<{
    type: 'error' | 'success';
    message: string;
  } | null>(null);
  const [showChallengeTracker, setShowChallengeTracker] = useState<boolean>(true);

  const liveMetrics = useMemo(() => computeLiveSessionMetrics(session), [session]);

  const rules = session.frozenConfig?.propFirmRules || session.propFirmRules;
  const opts = session.frozenConfig?.moreOptions || session.moreOptions;
  const currency =
    session.frozenConfig?.accountCurrency || session.accountCurrency || 'USD';

  const initializedPricingContext = useRef<string | null>(null);
  // Initialize from the requested archive, preserving edits during timeframe reloads.
  useEffect(() => {
    const context = `${session.id}:${symbol}:${pricingContext || ''}`;
    if (!pricingReady || initializedPricingContext.current === context || !currentMidPrice || currentMidPrice <= 0 || activePositionDrawing) return;
    initializedPricingContext.current = context;
    const defaultDist = Math.max(
      spec.pipSize * 20,
      atr14 > 0 ? atr14 * 1.5 : spec.pipSize * 25
    );
    const fillBase = side === 'LONG' ? ask : bid;
    const defaultSL =
      side === 'LONG'
        ? Number((fillBase - defaultDist).toFixed(spec.decimals))
        : Number((fillBase + defaultDist).toFixed(spec.decimals));
    const defaultTP =
      side === 'LONG'
        ? Number((fillBase + defaultDist * 2).toFixed(spec.decimals))
        : Number((fillBase - defaultDist * 2).toFixed(spec.decimals));

    setStopLossInput(defaultSL.toFixed(spec.decimals));
    setTakeProfitInput(defaultTP.toFixed(spec.decimals));

    if (orderCategory !== 'MARKET') {
      const pendingOffset = defaultDist * 0.5;
      const pendingPrice =
        orderCategory === 'LIMIT'
          ? side === 'LONG'
            ? fillBase - pendingOffset
            : fillBase + pendingOffset
          : side === 'LONG'
          ? fillBase + pendingOffset
          : fillBase - pendingOffset;
      setEntryPriceInput(
        Number(pendingPrice.toFixed(spec.decimals)).toFixed(spec.decimals)
      );
    }
  }, [symbol, session.id, pricingContext, pricingReady, activePositionDrawing]);

  // Synchronize order ticket inputs with any active Long / Short position tool drawing on the chart
  useEffect(() => {
    if (!activePositionDrawing) return;
    if (
      activePositionDrawing.type !== 'long_position' &&
      activePositionDrawing.type !== 'short_position'
    ) {
      return;
    }
    const drawingSide =
      activePositionDrawing.type === 'long_position' ? 'LONG' : 'SHORT';
    setSide(drawingSide);
    setEntryPriceInput(
      Number(activePositionDrawing.price1.toFixed(spec.decimals)).toFixed(
        spec.decimals
      )
    );
    if (
      activePositionDrawing.stopLoss !== undefined &&
      activePositionDrawing.stopLoss > 0
    ) {
      setStopLossInput(
        Number(activePositionDrawing.stopLoss.toFixed(spec.decimals)).toFixed(
          spec.decimals
        )
      );
    }
    if (
      activePositionDrawing.takeProfit !== undefined &&
      activePositionDrawing.takeProfit > 0
    ) {
      setTakeProfitInput(
        Number(
          activePositionDrawing.takeProfit.toFixed(spec.decimals)
        ).toFixed(spec.decimals)
      );
    }
    if (
      activePositionDrawing.lotSize !== undefined &&
      activePositionDrawing.lotSize > 0
    ) {
      setLotSizeInput(activePositionDrawing.lotSize.toFixed(2));
    }
  }, [
    activePositionDrawing?.id,
    activePositionDrawing?.type,
    activePositionDrawing?.price1,
    activePositionDrawing?.stopLoss,
    activePositionDrawing?.takeProfit,
    activePositionDrawing?.lotSize,
    spec.decimals,
  ]);

  const handleSelectSide = (nextSide: 'LONG' | 'SHORT') => {
    setSide(nextSide);
    setOrderFeedback(null);
    const fillBase = nextSide === 'LONG' ? ask : bid;
    const defaultDist = Math.max(
      spec.pipSize * 20,
      atr14 > 0 ? atr14 * 1.5 : spec.pipSize * 25
    );
    const nextSL =
      nextSide === 'LONG'
        ? Number((fillBase - defaultDist).toFixed(spec.decimals))
        : Number((fillBase + defaultDist).toFixed(spec.decimals));
    const nextTP =
      nextSide === 'LONG'
        ? Number((fillBase + defaultDist * 2).toFixed(spec.decimals))
        : Number((fillBase - defaultDist * 2).toFixed(spec.decimals));
    setStopLossInput(nextSL.toFixed(spec.decimals));
    setTakeProfitInput(nextTP.toFixed(spec.decimals));

    let finalEntry = fillBase;
    if (orderCategory !== 'MARKET') {
      const pendingOffset = defaultDist * 0.5;
      const pendingPrice =
        orderCategory === 'LIMIT'
          ? nextSide === 'LONG'
            ? fillBase - pendingOffset
            : fillBase + pendingOffset
          : nextSide === 'LONG'
          ? fillBase + pendingOffset
          : fillBase - pendingOffset;
      finalEntry = Number(pendingPrice.toFixed(spec.decimals));
      setEntryPriceInput(finalEntry.toFixed(spec.decimals));
    }

    // Spawn or update Long / Short position tool on the chart
    if (onAddOrUpdatePositionDrawing) {
      const lot = parseFloat(lotSizeInput) || 1.0;
      onAddOrUpdatePositionDrawing(nextSide, finalEntry, nextSL, nextTP, lot);
    }
  };

  const handleSelectOrderCategory = (cat: 'MARKET' | 'LIMIT' | 'STOP') => {
    setOrderCategory(cat);
    setOrderFeedback(null);
    if (cat !== 'MARKET') {
      const fillBase = side === 'LONG' ? ask : bid;
      if (
        activePositionDrawing &&
        (activePositionDrawing.type === 'long_position' ||
          activePositionDrawing.type === 'short_position')
      ) {
        const dEntry = Number(activePositionDrawing.price1.toFixed(spec.decimals));
        const isValidForCat =
          cat === 'LIMIT'
            ? side === 'LONG'
              ? dEntry < ask
              : dEntry > bid
            : side === 'LONG'
            ? dEntry > ask
            : dEntry < bid;
        if (isValidForCat) {
          setEntryPriceInput(dEntry.toFixed(spec.decimals));
          if (activePositionDrawing.stopLoss) {
            setStopLossInput(activePositionDrawing.stopLoss.toFixed(spec.decimals));
          }
          if (activePositionDrawing.takeProfit) {
            setTakeProfitInput(activePositionDrawing.takeProfit.toFixed(spec.decimals));
          }
          return;
        }
      }

      const defaultDist = Math.max(
        spec.pipSize * 15,
        atr14 > 0 ? atr14 * 0.8 : spec.pipSize * 15
      );
      const pendingPrice = Number(
        (cat === 'LIMIT'
          ? side === 'LONG'
            ? fillBase - defaultDist
            : fillBase + defaultDist
          : side === 'LONG'
          ? fillBase + defaultDist
          : fillBase - defaultDist
        ).toFixed(spec.decimals)
      );
      setEntryPriceInput(pendingPrice.toFixed(spec.decimals));

      const prevRef = Number(entryPriceInput) || fillBase;
      const currSL = Number(stopLossInput) || 0;
      const currTP = Number(takeProfitInput) || 0;
      const slDist =
        currSL > 0 && Math.abs(prevRef - currSL) > 0
          ? Math.abs(prevRef - currSL)
          : defaultDist * 1.5;
      const tpDist =
        currTP > 0 && Math.abs(currTP - prevRef) > 0
          ? Math.abs(currTP - prevRef)
          : defaultDist * 3.0;
      const nextSL =
        side === 'LONG' ? pendingPrice - slDist : pendingPrice + slDist;
      const nextTP =
        side === 'LONG' ? pendingPrice + tpDist : pendingPrice - tpDist;
      if (currSL > 0) {
        setStopLossInput(Number(nextSL.toFixed(spec.decimals)).toFixed(spec.decimals));
      }
      if (currTP > 0) {
        setTakeProfitInput(Number(nextTP.toFixed(spec.decimals)).toFixed(spec.decimals));
      }
    }
  };

  const resolvedOrderSubType: OrderSubType =
    orderCategory === 'MARKET'
      ? 'MARKET'
      : orderCategory === 'LIMIT'
      ? side === 'LONG'
        ? 'BUY_LIMIT'
        : 'SELL_LIMIT'
      : side === 'LONG'
      ? 'BUY_STOP'
      : 'SELL_STOP';

  const effectiveEntryPrice =
    orderCategory === 'MARKET'
      ? side === 'LONG'
        ? ask
        : bid
      : Number(entryPriceInput) || (side === 'LONG' ? ask : bid);

  const parsedSL = Number(stopLossInput) || 0;
  const parsedTP = Number(takeProfitInput) || 0;

  // Compute lot size if sizingMode === 'RISK_PCT'
  const effectiveLotSize = useMemo(() => {
    const minQ = spec.minQuantity || 0.01;
    const inc = spec.quantityIncrement || 0.01;
    if (sizingMode === 'LOTS') {
      const raw = Number(lotSizeInput);
      if (!Number.isFinite(raw) || raw <= 0) return minQ;
      return Math.max(minQ, Number(raw.toFixed(2)));
    }
    const riskPct = Math.max(0.05, Number(riskPctInput) || 1);
    const targetRiskMoney = liveMetrics.currentBalance * (riskPct / 100);
    if (parsedSL <= 0 || Math.abs(effectiveEntryPrice - parsedSL) <= 0) {
      return minQ;
    }
    const oneLotRisk = Math.abs(
      calculatePositionPnl(side, effectiveEntryPrice, parsedSL, 1, symbol, session)
    );
    if (oneLotRisk <= 0) return minQ;
    const rawLots = targetRiskMoney / oneLotRisk;
    const stepped = Math.floor(rawLots / inc) * inc;
    return Math.max(minQ, Number(stepped.toFixed(2)));
  }, [
    sizingMode,
    lotSizeInput,
    riskPctInput,
    liveMetrics.currentBalance,
    parsedSL,
    effectiveEntryPrice,
    symbol,
    side,
    spec.minQuantity,
    spec.quantityIncrement,
    session,
  ]);

  // Live Risk, Reward, and Cost Estimates
  const estimates = useMemo(() => {
    const estimatedRiskMoney =
      parsedSL > 0
        ? Math.abs(
            calculatePositionPnl(
              side,
              effectiveEntryPrice,
              parsedSL,
              effectiveLotSize,
              symbol,
              session
            )
          )
        : 0;

    const estimatedRewardMoney =
      parsedTP > 0
        ? Math.max(
            0,
            calculatePositionPnl(
              side,
              effectiveEntryPrice,
              parsedTP,
              effectiveLotSize,
              symbol,
              session
            )
          )
        : 0;

    const riskPctOfBalance =
      liveMetrics.currentBalance > 0
        ? (estimatedRiskMoney / liveMetrics.currentBalance) * 100
        : 0;
    const rrRatio =
      estimatedRiskMoney > 0 && estimatedRewardMoney > 0
        ? estimatedRewardMoney / estimatedRiskMoney
        : null;

    const spreadCostMoney = convertUsdToAccountCurrency(
      spread * effectiveLotSize * spec.contractSize,
      currency
    );
    const commPerLotUsd = opts?.commissionPerLotUsd ?? 0;
    const commissionMoney = convertUsdToAccountCurrency(
      commPerLotUsd * effectiveLotSize,
      currency
    );
    const slippagePrice = (opts?.slippagePips ?? 0) * spec.pipSize;
    const slippageMoney = convertUsdToAccountCurrency(
      slippagePrice * effectiveLotSize * spec.contractSize,
      currency
    );
    const totalEstimatedCost = Number(
      (spreadCostMoney + commissionMoney + slippageMoney).toFixed(2)
    );

    return {
      estimatedRiskMoney: Number(estimatedRiskMoney.toFixed(2)),
      estimatedRewardMoney: Number(estimatedRewardMoney.toFixed(2)),
      riskPctOfBalance: Number(riskPctOfBalance.toFixed(2)),
      rrRatio: rrRatio !== null ? Number(rrRatio.toFixed(2)) : null,
      spreadCostMoney: Number(spreadCostMoney.toFixed(2)),
      commissionMoney,
      slippageMoney: Number(slippageMoney.toFixed(2)),
      totalEstimatedCost,
    };
  }, [
    symbol,
    side,
    effectiveEntryPrice,
    parsedSL,
    parsedTP,
    effectiveLotSize,
    spec,
    session,
    currency,
    opts,
    liveMetrics.currentBalance,
    spread,
  ]);

  const applyQuickRR = (targetR: number) => {
    setSelectedR(targetR);
    let currentSL = parsedSL;
    if (currentSL <= 0 || Math.abs(effectiveEntryPrice - currentSL) <= 0) {
      const defaultDist = Math.max(
        spec.pipSize * 20,
        atr14 > 0 ? atr14 * 1.5 : spec.pipSize * 25
      );
      currentSL =
        side === 'LONG'
          ? Number((effectiveEntryPrice - defaultDist).toFixed(spec.decimals))
          : Number((effectiveEntryPrice + defaultDist).toFixed(spec.decimals));
      setStopLossInput(currentSL.toFixed(spec.decimals));
    }
    const slDist = Math.abs(effectiveEntryPrice - currentSL);
    if (slDist <= 0) return;
    const nextTP =
      side === 'LONG'
        ? effectiveEntryPrice + slDist * targetR
        : effectiveEntryPrice - slDist * targetR;
    const roundedTP = Number(nextTP.toFixed(spec.decimals));
    setTakeProfitInput(roundedTP.toFixed(spec.decimals));

    // Also automatically update any active position tool on the chart!
    if (onAddOrUpdatePositionDrawing) {
      onAddOrUpdatePositionDrawing(
        side,
        effectiveEntryPrice,
        Number(currentSL.toFixed(spec.decimals)),
        roundedTP,
        effectiveLotSize
      );
    }
  };

  const handleSubmitOrder = () => {
    setOrderFeedback(null);
    let finalSL = parsedSL;
    let finalTP = parsedTP;
    if (orderCategory === 'MARKET' && activePositionDrawing) {
      const dEntry = activePositionDrawing.price1;
      const mktEntry = side === 'LONG' ? ask : bid;
      if (finalSL > 0) {
        const slValid = side === 'LONG' ? finalSL < mktEntry : finalSL > mktEntry;
        if (!slValid) {
          const slDist = Math.max(
            spec.pipSize * 10,
            Math.abs(dEntry - finalSL)
          );
          finalSL = Number(
            (side === 'LONG' ? mktEntry - slDist : mktEntry + slDist).toFixed(
              spec.decimals
            )
          );
        }
      }
      if (finalTP > 0) {
        const tpValid = side === 'LONG' ? finalTP > mktEntry : finalTP < mktEntry;
        if (!tpValid) {
          const tpDist = Math.max(
            spec.pipSize * 15,
            Math.abs(finalTP - dEntry)
          );
          finalTP = Number(
            (side === 'LONG' ? mktEntry + tpDist : mktEntry - tpDist).toFixed(
              spec.decimals
            )
          );
        }
      }
    }
    const res = onExecuteOrder({
      symbol,
      side,
      orderSubType: resolvedOrderSubType,
      lotSize: effectiveLotSize,
      entryPrice: orderCategory === 'MARKET' ? undefined : Number(entryPriceInput),
      stopLoss: finalSL,
      takeProfit: finalTP,
      endTime: activePositionDrawing?.time2,
    });
    if (!res.ok) {
      setOrderFeedback({
        type: 'error',
        message: res.error || 'Order rejected by execution engine.',
      });
    } else {
      setOrderFeedback({
        type: 'success',
        message: `${
          orderCategory === 'MARKET' ? 'Executed' : 'Placed'
        } ${side} ${effectiveLotSize.toFixed(2)} lots ${symbol} @ ${effectiveEntryPrice.toFixed(
          spec.decimals
        )}`,
      });
      setTimeout(() => {
        setOrderFeedback((prev) => (prev?.type === 'success' ? null : prev));
      }, 3500);
    }
  };

  const challengeStatus =
    session.challengeState?.status ||
    (session.status === 'PASSED' || session.status === 'FAILED'
      ? session.status
      : 'ACTIVE');
  const isLocked = challengeStatus === 'FAILED' || challengeStatus === 'PASSED';
  const isPropMode = session.mode === 'PROP_FIRM';
  const mandatorySL = isPropMode && Boolean(rules.mandatoryStopLoss);

  const panelBg = isLight
    ? 'bg-white border-[#e0e3eb] text-[#131722]'
    : 'bg-[#12151b] border-[#242832] text-[#d1d4dc]';
  const cardBg = isLight
    ? 'bg-[#f8f9fd] border-[#e0e3eb]'
    : 'bg-[#161920] border-[#262a34]';
  const inputBg = isLight
    ? 'bg-white border-[#d8dce6] text-[#131722]'
    : 'bg-[#0d0f13] border-[#262a34] text-white';

  return (
    <aside
      data-tour="order-ticket"
      className={`w-80 border-l flex flex-col h-full shrink-0 select-none overflow-y-auto custom-scrollbar ${panelBg}`}
    >
      {/* Top Section: Order Ticket Header */}
      <div
        className={`px-3.5 py-2.5 border-b flex items-center justify-between ${
          isLight ? 'border-[#e0e3eb]' : 'border-[#242832]'
        }`}
      >
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-xs font-extrabold tracking-tight uppercase">
              Execution Order
            </h2>
            <p className="text-[10px] opacity-65 font-mono">
              {symbol} · {spec.contractSize.toLocaleString()}{' '}
              {spec.category === 'METALS'
                ? 'oz'
                : spec.category === 'INDICES'
                ? 'contracts'
                : 'units'}
              /lot
            </p>
          </div>
        </div>
        <div className="text-right font-mono">
          <div className="text-[10px] opacity-65">Spread</div>
          <div className="text-[11px] font-bold text-amber-400">
            {spreadPips} pips
          </div>
        </div>
      </div>

      {/* Trading Locked Banner (When Challenge Failed or Passed) */}
      {isLocked && (
        <div
          className={`m-3 p-3 rounded-xl border space-y-2 ${
            challengeStatus === 'FAILED'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2 font-extrabold text-xs">
            {challengeStatus === 'FAILED' ? (
              <>
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  CHALLENGE FAILED ({rules.challengePhase.replace('_', ' ')}) — LOCKED
                </span>
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>CHALLENGE PASSED!</span>
              </>
            )}
          </div>
          {session.challengeState?.breachEvent && (
            <p className="text-[11px] leading-relaxed opacity-90">
              {session.challengeState.breachEvent.explanation}
            </p>
          )}
          {session.challengeState?.passedEvent && (
            <p className="text-[11px] leading-relaxed opacity-90">
              Target reached on{' '}
              {formatTimestampInTimezone(
                session.challengeState.passedEvent.timestamp,
                session.displayTimezone
              )}{' '}
              with {session.challengeState.passedEvent.tradingDaysCompleted} trading days.
            </p>
          )}
          <div className="space-y-1.5 pt-1">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onStartNewChallengeAttempt('PHASE_1')}
                className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white keep-white text-[11px] font-extrabold flex items-center justify-center gap-1 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Redo Phase 1
              </button>
              <button
                type="button"
                onClick={() => onStartNewChallengeAttempt('PHASE_2')}
                className="px-2 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold flex items-center justify-center gap-1 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Redo Phase 2
              </button>
            </div>
            <button
              type="button"
              onClick={onOpenAnalytics}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#252a34] hover:bg-[#2f3542] border border-[#3a404f] text-white keep-white text-[11px] font-bold flex items-center justify-center gap-1 transition"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              View Challenge Analytics
            </button>
          </div>
        </div>
      )}

      {/* Order Ticket Body */}
      <div className="p-3 space-y-3">
        {/* Live Bid / Ask Buy & Sell Selector */}
        <div className="grid grid-cols-2 gap-2" data-tour="order-side">
          <button
            type="button"
            disabled={isLocked}
            onClick={() => handleSelectSide('SHORT')}
            className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
              side === 'SHORT'
                ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/20'
                : isLight
                ? 'bg-rose-50/60 hover:bg-rose-100/70 border-rose-200 text-rose-900'
                : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">
                SELL / SHORT
              </span>
              <ArrowDownRight className="w-3.5 h-3.5" />
            </div>
            <div className="text-sm font-mono font-black mt-1">
              {bid.toFixed(spec.decimals)}
            </div>
            <div className="text-[9px] font-mono opacity-75">Bid Price</div>
          </button>

          <button
            type="button"
            disabled={isLocked}
            onClick={() => handleSelectSide('LONG')}
            className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
              side === 'LONG'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/20'
                : isLight
                ? 'bg-emerald-50/60 hover:bg-emerald-100/70 border-emerald-200 text-emerald-900'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-extrabold uppercase tracking-wider">
                BUY / LONG
              </span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <div className="text-sm font-mono font-black mt-1">
              {ask.toFixed(spec.decimals)}
            </div>
            <div className="text-[9px] font-mono opacity-75">Ask Price</div>
          </button>
        </div>

        {/* Order Type Selector: Market / Limit / Stop */}
        <div
          data-tour="order-type"
          className={`grid grid-cols-3 gap-1 p-1 rounded-lg border text-[11px] font-bold ${
            isLight ? 'bg-[#f0f3fa] border-[#d8dce6]' : 'bg-[#0d0f13] border-[#262a34]'
          }`}
        >
          {(['MARKET', 'LIMIT', 'STOP'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              disabled={isLocked}
              onClick={() => handleSelectOrderCategory(cat)}
              className={`py-1.5 rounded-md transition ${
                orderCategory === cat
                  ? 'bg-emerald-600 text-white border border-emerald-500 shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              {cat === 'MARKET'
                ? 'Market'
                : cat === 'LIMIT'
                ? `${side === 'LONG' ? 'Buy' : 'Sell'} Limit`
                : `${side === 'LONG' ? 'Buy' : 'Sell'} Stop`}
            </button>
          ))}
        </div>

        {/* Pending Order Entry Price Input */}
        {orderCategory !== 'MARKET' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold opacity-80">
                {resolvedOrderSubType.replace('_', ' ')} Entry Price
              </span>
              <span className="font-mono text-[10px] text-emerald-400">
                {orderCategory === 'LIMIT'
                  ? side === 'LONG'
                    ? 'Must be < Ask'
                    : 'Must be > Bid'
                  : side === 'LONG'
                  ? 'Must be > Ask'
                  : 'Must be < Bid'}
              </span>
            </div>
            <input
              type="number"
              step={spec.minMove}
              value={entryPriceInput}
              onChange={(e) => setEntryPriceInput(e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none ${inputBg}`}
            />
          </div>
        )}

        {/* Position Size (Lots vs Risk %) */}
        <div className="space-y-1.5" data-tour="order-size">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold opacity-80">Position Size</span>
            <div className="flex items-center gap-1 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setSizingMode('LOTS')}
                className={`px-2 py-0.5 rounded border transition ${
                  sizingMode === 'LOTS'
                    ? 'bg-emerald-600 text-white keep-white border-emerald-500 shadow-sm'
                    : `${cardBg} opacity-70 hover:opacity-100`
                }`}
              >
                Lots
              </button>
              <button
                type="button"
                onClick={() => setSizingMode('RISK_PCT')}
                className={`px-2 py-0.5 rounded border transition ${
                  sizingMode === 'RISK_PCT'
                    ? 'bg-emerald-600 text-white keep-white border-emerald-500 shadow-sm'
                    : `${cardBg} opacity-70 hover:opacity-100`
                }`}
              >
                % Risk
              </button>
            </div>
          </div>

          {sizingMode === 'LOTS' ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={spec.minQuantity}
                  step={spec.quantityIncrement}
                  value={lotSizeInput}
                  onChange={(e) => setLotSizeInput(e.target.value)}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none ${inputBg}`}
                />
                {[0.1, 0.5, 1.0, 2.0].map((presetLot) => {
                  const isSelectedLot =
                    Math.abs((Number(lotSizeInput) || 0) - presetLot) < 0.001;
                  return (
                    <button
                      key={presetLot}
                      type="button"
                      onClick={() => setLotSizeInput(presetLot.toFixed(2))}
                      className={`px-2 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition ${
                        isSelectedLot
                          ? 'bg-emerald-600 text-white keep-white border-emerald-500 shadow-sm'
                          : `${cardBg} hover:border-emerald-500/50`
                      }`}
                    >
                      {presetLot}
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] opacity-60 font-mono flex justify-between">
                <span>Min: {spec.minQuantity} lot</span>
                <span>Step: {spec.quantityIncrement} lot</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                {[0.5, 1.0, 2.0].map((pct) => {
                  const isSelectedRisk =
                    Math.abs((Number(riskPctInput) || 0) - pct) < 0.001;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setRiskPctInput(pct.toFixed(1))}
                      className={`flex-1 py-1 rounded-lg border text-[11px] font-mono font-bold transition ${
                        isSelectedRisk
                          ? 'bg-emerald-600 text-white keep-white border-emerald-500 shadow-sm'
                          : `${cardBg} hover:border-emerald-500/50`
                      }`}
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold opacity-60 shrink-0">Custom %</span>
                <input
                  type="number"
                  min={0.05}
                  max={50}
                  step={0.1}
                  value={riskPctInput}
                  placeholder="Custom %"
                  onChange={(e) => setRiskPctInput(e.target.value)}
                  className={`flex-1 px-2 py-1 rounded-lg border text-xs font-mono font-bold outline-none ${inputBg}`}
                />
                <span className="text-xs font-mono font-bold opacity-60">%</span>
              </div>
              <div className="text-[10px] text-emerald-400 font-mono font-bold">
                Auto-Sized: {effectiveLotSize.toFixed(2)} lots
              </div>
            </div>
          )}
        </div>

        {/* Stop Loss & Take Profit Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-rose-400 flex items-center gap-1">
                Stop Loss
                {mandatorySL && (
                  <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300 font-mono">
                    REQ
                  </span>
                )}
              </span>
              {!mandatorySL && parsedSL > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStopLossInput('0');
                    setSelectedR(null);
                  }}
                  className="text-[9px] opacity-60 hover:opacity-100"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="number"
              step={spec.minMove}
              value={stopLossInput}
              onChange={(e) => {
                setStopLossInput(e.target.value);
                setSelectedR(null);
              }}
              placeholder="0.00"
              className={`w-full px-2 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none border-rose-500/30 ${inputBg}`}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-emerald-400">Take Profit</span>
              <div
                className="flex items-center gap-1 text-[9px] font-mono"
                data-tour="order-rr"
                title="Quick risk-reward: 1R = 1:1, 2R = 1:2, 3R = 1:3"
              >
                {[1, 2, 3].map((r) => {
                  const matchesRR =
                    selectedR === r ||
                    (estimates.rrRatio !== null &&
                      Math.abs(estimates.rrRatio - r) < 0.08);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => applyQuickRR(r)}
                      className={`px-1.5 py-0.5 rounded border font-extrabold transition ${
                        matchesRR
                          ? 'bg-emerald-600 text-white keep-white border-emerald-500 shadow-sm'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                      }`}
                    >
                      {r}R
                    </button>
                  );
                })}
              </div>
            </div>
            <input
              type="number"
              step={spec.minMove}
              value={takeProfitInput}
              onChange={(e) => {
                setTakeProfitInput(e.target.value);
                setSelectedR(null);
              }}
              placeholder="0.00"
              className={`w-full px-2 py-1.5 rounded-lg border text-xs font-mono font-bold outline-none border-emerald-500/30 ${inputBg}`}
            />
          </div>
        </div>

        {/* Strategy Tag Selector */}
        <div>
          <label className="block text-[10px] font-bold opacity-70 mb-1">
            Strategy Playbook
          </label>
          <select
            value={strategyTag}
            onChange={(e) => setStrategyTag(e.target.value)}
            className={`w-full px-2 py-1.5 rounded-lg border text-[11px] font-semibold outline-none ${inputBg}`}
          >
            {availableStrategies.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Estimated Risk, Reward & Costs Summary Card */}
        <div className={`p-2.5 rounded-xl border space-y-1.5 text-[11px] ${cardBg}`}>
          <div className="flex items-center justify-between font-bold text-[10px] uppercase tracking-wider opacity-70 pb-1 border-b border-gray-500/20">
            <span className="flex items-center gap-1">
              <Calculator className="w-3 h-3 text-emerald-400" /> Pre-Trade Estimates
            </span>
            <span className="font-mono">{effectiveLotSize.toFixed(2)} Lots</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="opacity-75">Estimated Risk (SL):</span>
            <span className="font-mono font-bold text-rose-400">
              {parsedSL > 0
                ? `-${formatMoney(estimates.estimatedRiskMoney, currency)} (${
                    estimates.riskPctOfBalance
                  }%)`
                : 'No SL (Uncapped)'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="opacity-75">Estimated Reward (TP):</span>
            <span className="font-mono font-bold text-emerald-400">
              {parsedTP > 0
                ? `+${formatMoney(estimates.estimatedRewardMoney, currency)} (${
                    estimates.rrRatio !== null ? `${estimates.rrRatio}R` : 'N/A'
                  })`
                : 'Open Target'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-gray-500/15">
            <span className="opacity-75">Est. Costs (Sprd+Comm+Slip):</span>
            <span className="font-mono font-bold text-amber-400">
              {formatMoney(estimates.totalEstimatedCost, currency)}
            </span>
          </div>
        </div>

        {/* Validation / Execution Feedback Banner */}
        {orderFeedback && (
          <div
            className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
              orderFeedback.type === 'error'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {orderFeedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <span className="font-medium leading-snug">{orderFeedback.message}</span>
          </div>
        )}

        {/* Submit Order Button */}
        <button
          type="button"
          data-tour="order-execute"
          disabled={isLocked}
          onClick={handleSubmitOrder}
          className={`w-full py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-1.5 ${
            isLocked
              ? 'bg-gray-600/30 text-gray-400 cursor-not-allowed border border-gray-600/30'
              : side === 'LONG'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
              : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25'
          }`}
        >
          {isLocked ? (
            <>
              <Lock className="w-3.5 h-3.5" /> Trading Locked ({challengeStatus})
            </>
          ) : (
            <>
              {orderCategory === 'MARKET' ? 'Execute' : 'Place'}{' '}
              {resolvedOrderSubType.replace('_', ' ')} · {effectiveLotSize.toFixed(2)} Lots
            </>
          )}
        </button>
      </div>

      {/* Live Challenge Tracker Section */}
      <div
        className={`mt-auto border-t ${
          isLight ? 'border-[#e0e3eb]' : 'border-[#242832]'
        }`}
      >
        <button
          type="button"
          onClick={() => setShowChallengeTracker((v) => !v)}
          className={`w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-extrabold uppercase tracking-wider ${
            isPropMode
              ? isLight
                ? 'bg-amber-50/70 text-amber-900'
                : 'bg-amber-500/10 text-amber-300'
              : ''
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            {isPropMode ? 'Live Challenge Tracker' : 'Session Risk & Drawdown'}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                challengeStatus === 'FAILED'
                  ? 'bg-rose-500 text-white'
                  : challengeStatus === 'PASSED'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#252a34] text-[#cbd5e1]'
              }`}
            >
              {isPropMode
                ? `${rules.challengePhase.replace('_', ' ')} · ${challengeStatus}`
                : 'NORMAL'}
            </span>
            {showChallengeTracker ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </div>
        </button>

        {showChallengeTracker && (
          <div className="p-3 space-y-2.5 text-[11px]">
            {/* Profit Target Progress */}
            <div className={`p-2.5 rounded-xl border space-y-1.5 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1">
                  <Target className="w-3 h-3 text-emerald-400" /> Profit Target (
                  {rules.profitTargetPct}%)
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {liveMetrics.profitProgressPct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-500/20 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, liveMetrics.profitProgressPct)
                    )}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono opacity-75">
                <span>
                  Current:{' '}
                  {formatMoney(liveMetrics.profitProgressAmount, currency, true)}
                </span>
                <span>
                  Rem: {formatMoney(liveMetrics.profitRemainingAmount, currency)}
                </span>
              </div>
            </div>

            {/* Daily Loss Remaining */}
            <div className={`p-2.5 rounded-xl border space-y-1.5 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-400" /> Daily Loss Rem (
                  {rules.maxDailyDrawdownPct}%)
                </span>
                <span className="text-[9px] font-mono px-1 rounded bg-amber-500/15 text-amber-400">
                  {liveMetrics.calculationBasis}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-500/20 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    liveMetrics.dailyLossUsedPct > 80 ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, 100 - liveMetrics.dailyLossUsedPct)
                    )}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono opacity-75">
                <span>
                  Floor: {formatMoney(liveMetrics.dailyLossThreshold, currency)}
                </span>
                <span className="font-bold text-amber-400">
                  Left: {formatMoney(liveMetrics.dailyLossRemainingAmount, currency)}
                </span>
              </div>
            </div>

            {/* Overall Loss Remaining */}
            <div className={`p-2.5 rounded-xl border space-y-1.5 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-rose-400" /> Max Loss Rem (
                  {rules.maxTotalDrawdownPct}%)
                </span>
                <span className="text-[9px] font-mono px-1 rounded bg-rose-500/15 text-rose-400">
                  {liveMetrics.drawdownType}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-500/20 overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, 100 - liveMetrics.overallLossUsedPct)
                    )}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono opacity-75">
                <span>
                  Floor: {formatMoney(liveMetrics.overallLossThreshold, currency)}
                </span>
                <span className="font-bold text-rose-400">
                  Left: {formatMoney(liveMetrics.overallLossRemainingAmount, currency)}
                </span>
              </div>
            </div>

            {/* Trading Days & Duration Row */}
            <div className="grid grid-cols-2 gap-2">
              <div className={`p-2 rounded-lg border ${cardBg}`}>
                <div className="text-[9px] uppercase font-bold opacity-60">
                  Trading Days
                </div>
                <div className="text-xs font-mono font-bold mt-0.5">
                  {liveMetrics.tradingDaysCompleted}
                  {rules.minTradingDaysEnabled !== false
                    ? ` / ${rules.minTradingDays} min`
                    : ' days'}
                </div>
              </div>
              <div className={`p-2 rounded-lg border ${cardBg}`}>
                <div className="text-[9px] uppercase font-bold opacity-60">
                  Challenge Days
                </div>
                <div className="text-xs font-mono font-bold mt-0.5">
                  {liveMetrics.elapsedCalendarDays}
                  {rules.maxDurationEnabled && rules.maxDurationDays
                    ? ` / ${rules.maxDurationDays}d`
                    : 'd elapsed'}
                </div>
              </div>
            </div>

            {(session.previousAttempts?.length ?? 0) > 0 && (
              <div className="text-[10px] font-mono opacity-75 flex items-center justify-between pt-1">
                <span>Previous Attempts Preserved:</span>
                <span className="font-bold text-emerald-400">
                  {session.previousAttempts?.length} attempt(s)
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
