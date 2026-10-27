import React, { ReactNode, useEffect, useRef } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  SlidersHorizontal,
  Trophy,
  Zap,
} from 'lucide-react';
import { ThemeMode } from '../types/trading';

interface AnimatedOrderPanelProps {
  open: boolean;
  mobile: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onSelectSideAndOpen?: (side: 'LONG' | 'SHORT') => void;
  activeSide?: 'LONG' | 'SHORT';
  spreadPips?: number;
  unitLabel?: string;
  isPropMode?: boolean;
  theme?: ThemeMode;
  children: ReactNode;
}

export function AnimatedOrderPanel({
  open,
  mobile,
  onClose,
  onOpen,
  onSelectSideAndOpen,
  activeSide = 'LONG',
  spreadPips,
  unitLabel = 'pips',
  isPropMode = false,
  theme = 'dark',
  children,
}: AnimatedOrderPanelProps) {
  const root = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const isLight = theme === 'light';

  useEffect(() => {
    if (mobile) {
      if (root.current) root.current.inert = !open;
      if (bodyRef.current) bodyRef.current.inert = false;
    } else {
      if (root.current) root.current.inert = false;
      if (bodyRef.current) bodyRef.current.inert = !open;
      if (railRef.current) railRef.current.inert = open;
    }
  }, [open, mobile]);

  if (mobile) {
    return (
      <div
        ref={root}
        id="chart-order-panel"
        aria-hidden={!open}
        data-open={open}
        className="order-panel-mobile"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div ref={bodyRef} className="order-panel-mobile-body">
          <button
            type="button"
            onClick={onClose}
            className="ml-auto mr-3 mb-2 block rounded-full border border-emerald-400/35 bg-[#0d1722]/95 px-4 py-2 text-xs font-semibold text-emerald-100 shadow-lg backdrop-blur-md"
          >
            Close order panel ×
          </button>
          <div className="h-[75dvh] flex flex-col [&>aside]:!w-full [&>aside]:border-l-0 [&>aside]:border-t [&>aside]:rounded-t-3xl">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={root}
      id="chart-order-panel"
      data-open={open}
      data-theme={theme}
      className={`order-panel-desktop relative border-l select-none ${
        isLight
          ? 'bg-[#f3f7fb] border-emerald-500/25 text-slate-800'
          : 'bg-[#0b121b] border-emerald-500/20 text-slate-100'
      }`}
    >
      {/* Collapsed Desktop Quick-Action Icon Rail */}
      <div
        ref={railRef}
        aria-hidden={open}
        className={`order-panel-desktop-rail flex flex-col items-center justify-between py-3 px-1.5 ${
          isLight
            ? 'bg-gradient-to-b from-[#f7fafd] via-[#f1f6fb] to-[#ebf2f9]'
            : 'bg-gradient-to-b from-[#0d1722] via-[#0b121b] to-[#090f17]'
        }`}
      >
        <div className="flex flex-col items-center gap-2.5 w-full">
          {/* Slide-out / Expand button */}
          <button
            type="button"
            onClick={() => onOpen?.()}
            title="Expand Execution Order panel"
            aria-label="Expand Execution Order panel"
            className={`w-10 h-9 rounded-xl border flex items-center justify-center transition-all ${
              isLight
                ? 'bg-white border-emerald-500/30 text-teal-700 hover:bg-emerald-50 hover:border-emerald-500/60 shadow-sm'
                : 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/20 hover:text-white hover:border-emerald-400/60 shadow-[0_0_16px_-4px_rgba(16,185,129,0.35)]'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            className={`w-7 h-px ${
              isLight ? 'bg-emerald-500/20' : 'bg-emerald-500/20'
            }`}
          />

          {/* Quick BUY Icon Button */}
          <button
            type="button"
            onClick={() => {
              if (onSelectSideAndOpen) {
                onSelectSideAndOpen('LONG');
              } else {
                onOpen?.();
              }
            }}
            title="Buy / Long — Slide out order ticket"
            aria-label="Buy or Long — open order ticket"
            className={`group w-11 py-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              activeSide === 'LONG'
                ? 'bg-gradient-to-b from-emerald-500 to-teal-600 text-white border-emerald-300/70 shadow-[0_8px_20px_-6px_rgba(16,185,129,0.65)]'
                : isLight
                ? 'bg-emerald-50/90 hover:bg-emerald-500 text-emerald-700 hover:text-white border-emerald-300'
                : 'bg-emerald-500/12 hover:bg-gradient-to-b hover:from-emerald-500 hover:to-teal-600 text-emerald-300 hover:text-white border-emerald-500/35 hover:border-emerald-300/70'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            <span className="text-[9px] font-extrabold uppercase tracking-wider leading-none">
              Buy
            </span>
          </button>

          {/* Quick SELL Icon Button */}
          <button
            type="button"
            onClick={() => {
              if (onSelectSideAndOpen) {
                onSelectSideAndOpen('SHORT');
              } else {
                onOpen?.();
              }
            }}
            title="Sell / Short — Slide out order ticket"
            aria-label="Sell or Short — open order ticket"
            className={`group w-11 py-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              activeSide === 'SHORT'
                ? 'bg-gradient-to-b from-rose-500 to-rose-600 text-white border-rose-300/70 shadow-[0_8px_20px_-6px_rgba(244,63,94,0.65)]'
                : isLight
                ? 'bg-rose-50/90 hover:bg-rose-500 text-rose-700 hover:text-white border-rose-300'
                : 'bg-rose-500/12 hover:bg-gradient-to-b hover:from-rose-500 hover:to-rose-600 text-rose-300 hover:text-white border-rose-500/35 hover:border-rose-300/70'
            }`}
          >
            <ArrowDownRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5" />
            <span className="text-[9px] font-extrabold uppercase tracking-wider leading-none">
              Sell
            </span>
          </button>

          {/* Place Order Ticket Icon Button */}
          <button
            type="button"
            onClick={() => onOpen?.()}
            title="Place Order — Slide out full order ticket"
            aria-label="Place Order — open order ticket"
            className={`group w-11 py-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              isLight
                ? 'bg-gradient-to-b from-emerald-500/15 via-teal-500/10 to-sky-500/15 hover:from-emerald-500 hover:to-teal-600 border-emerald-500/45 text-teal-800 hover:text-white shadow-sm'
                : 'bg-gradient-to-b from-emerald-500/20 via-teal-500/15 to-[#2962ff]/25 hover:from-emerald-500 hover:via-teal-500 hover:to-[#2962ff] border-emerald-400/45 text-emerald-200 hover:text-white shadow-[0_8px_22px_-6px_rgba(16,185,129,0.45)]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="text-[8px] font-extrabold uppercase tracking-tight leading-[1.1] text-center">
              Place
              <br />
              Order
            </span>
          </button>
        </div>

        {/* Bottom Rail Status: Spread & Challenge Indicator */}
        <div className="flex flex-col items-center gap-2 w-full">
          {spreadPips !== undefined && (
            <button
              type="button"
              onClick={() => onOpen?.()}
              title={`Current Spread: ${spreadPips} ${unitLabel}`}
              className={`w-11 py-1.5 px-1 rounded-lg border flex flex-col items-center justify-center font-mono transition ${
                isLight
                  ? 'bg-amber-50/90 border-amber-300/70 text-amber-800 hover:bg-amber-100'
                  : 'bg-amber-500/10 border-amber-400/25 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              <span className="text-[7px] uppercase tracking-wider opacity-70 font-sans font-bold">
                Sprd
              </span>
              <span className="text-[9px] font-extrabold leading-tight">
                {spreadPips}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpen?.()}
            title={
              isPropMode
                ? 'View Live Challenge Tracker'
                : 'View Session Risk & Drawdown'
            }
            className={`w-10 h-8 rounded-lg border flex items-center justify-center transition ${
              isPropMode
                ? isLight
                  ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  : 'bg-amber-500/10 border-amber-400/30 text-amber-300 hover:bg-amber-500/20'
                : isLight
                ? 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {isPropMode ? (
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Full Order Panel Body */}
      <div
        ref={bodyRef}
        aria-hidden={!open}
        className="order-panel-desktop-body"
      >
        <div>{children}</div>
      </div>
    </div>
  );
}
