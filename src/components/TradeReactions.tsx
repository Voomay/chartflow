import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { BacktestPosition, InstrumentSymbol, TradingSession } from '../types/trading';
import { getClosedTradeMood, getNewlyClosedTrade, getOpenTradeReaction, markReactionPositions, TradeMood } from '../services/tradeReactions';

const moods: Record<TradeMood, { face: string; text: string }> = {
  waiting: { face: '😌', text: 'Ready when you are' },
  steady: { face: '🙂', text: 'Finding its feet' },
  profit: { face: '😄', text: 'In the green' },
  money: { face: '🤑', text: 'Profit growing · 1R+' },
  loss: { face: '😟', text: 'In the red' },
  panic: { face: '😰', text: 'Feeling the drawdown' },
  stopped: { face: '😭', text: 'Stop loss hit' },
  won: { face: '🥳', text: 'Take profit hit' },
  closed: { face: '😌', text: 'Trade closed' },
};

function AnimatedMoney({ amount, currency }: { amount: number; currency: string }) {
  const [display, setDisplay] = useState(amount);
  const current = useRef(amount);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = amount;
      setDisplay(amount);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / 480);
      current.current = from + (amount - from) * (1 - Math.pow(1 - progress, 3));
      setDisplay(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [amount]);
  return <span className="font-mono text-[11px] font-bold tabular-nums" aria-label={new Intl.NumberFormat('en', { style: 'currency', currency, signDisplay: 'always' }).format(amount)}>
    {new Intl.NumberFormat('en', { style: 'currency', currency, signDisplay: 'always' }).format(Math.abs(display) < 0.005 ? 0 : display)}
  </span>;
}

let memoryReactionsEnabled = true;

export function TradeReactions({ positions, currency, isLight, anchorRef, midPrice, symbol, session }: { positions: BacktestPosition[]; currency: string; isLight: boolean; anchorRef: React.RefObject<HTMLDivElement>; midPrice?: number; symbol: InstrumentSymbol; session?: TradingSession }) {
  const [enabled, setEnabled] = useState(() => memoryReactionsEnabled);
  const previous = useRef(new Map(positions.map(p => [p.id, p.status])));
  const [closed, setClosed] = useState<BacktestPosition | null>(null);
  const expiry = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const trade = getNewlyClosedTrade(previous.current, positions);
    previous.current = new Map(positions.map(p => [p.id, p.status]));
    if (enabled && trade) {
      setClosed(trade);
      clearTimeout(expiry.current);
      expiry.current = setTimeout(() => setClosed(null), 8000);
    } else if (closed) {
      const stillClosed = positions.find(p => p.id === closed.id && p.status.startsWith('CLOSED_'));
      if (!stillClosed) {
        clearTimeout(expiry.current);
        setClosed(null);
      }
    }
  }, [positions, enabled, closed]);
  useEffect(() => () => clearTimeout(expiry.current), []);
  const marked = useMemo(() => markReactionPositions(positions, midPrice, symbol, session), [positions, midPrice, symbol, session]);
  const open = getOpenTradeReaction(marked);
  const mood = closed ? getClosedTradeMood(closed) : open.mood;
  const amount = closed ? closed.pnl : open.pnl;
  const reaction = moods[mood];
  const tone = amount < -0.005 ? 'text-rose-500' : amount > 0.005 ? 'text-emerald-500' : isLight ? 'text-slate-600' : 'text-slate-300';
  const toggle = (next: boolean) => {
    memoryReactionsEnabled = next;
    setEnabled(next);
    setClosed(null);
  };
  const description = `${reaction.text} · ${closed ? 'Closed trade' : open.count ? `${open.count} open ${open.count === 1 ? 'trade' : 'trades'}` : 'No open trades'} · simulated net P&L`;
  return <>
    <div ref={anchorRef} className="trade-reaction-follow absolute left-0 top-0 z-20" style={{opacity: 0}} data-testid="trade-reactions">
      {enabled && <div data-mood={mood} title={description} aria-label={description} className={`flex w-max max-w-[220px] items-center gap-1.5 rounded-full border px-2 py-1 shadow-sm backdrop-blur-sm ${isLight ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-[#131722]/95 border-[#2a2e39] text-slate-200'}`}>
        <span className={`trade-face trade-face-${mood} inline-block text-xl md:text-[26px] leading-none`} aria-hidden="true">{reaction.face}</span>
        <span className={`min-w-0 truncate ${tone}`}><AnimatedMoney key={closed ? closed.id : 'open'} amount={amount} currency={currency} /></span>
        <button type="button" aria-label="Hide trade reactions" title="Hide trade reactions" onClick={() => toggle(false)} className="ml-0.5 rounded-full p-0.5 opacity-50 hover:bg-gray-500/20 hover:opacity-100"><X className="h-3 w-3" /></button>
      </div>}
    </div>
    {!enabled && <button type="button" aria-label="Show trade reactions" title="Show trade reactions" onClick={() => toggle(true)} className={`absolute bottom-20 left-3 z-20 rounded-full border p-1.5 text-base leading-none shadow-sm ${isLight ? 'bg-white/90 border-slate-200' : 'bg-[#131722]/90 border-[#2a2e39]'}`}>🙂</button>}
  </>;
}
