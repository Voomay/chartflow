import{describe,it,expect}from'vitest';import{positionRiskReward,lotsForRisk}from'../orderTicketMath';
import {
  calculatePipAndPointDistance,
  calculatePipValue,
  calculatePositionPnl,
  calculateRequiredMargin,
} from '../simulationEngine';
import { getInstrumentConfig } from '../goldDataService';

describe('position tool and ticket risk/reward',()=>{
 it('uses the drawn entry for long and short setups',()=>{expect(positionRiskReward('LONG',100,95,115)).toBe(3);expect(positionRiskReward('SHORT',100,105,85)).toBe(3);});
 it('updates when the tool entry, stop or target is moved',()=>{expect(positionRiskReward('LONG',100,90,120)).toBe(2);expect(positionRiskReward('LONG',100,95,120)).toBe(4);expect(positionRiskReward('LONG',105,95,120)).toBe(1.5);});
 it('does not show a valid R ratio for invalid levels',()=>{expect(positionRiskReward('LONG',100,105,120)).toBeNull();expect(positionRiskReward('SHORT',100,105,120)).toBeNull();expect(positionRiskReward('LONG',100,100,120)).toBeNull();});
 it('sizes compact risk presets and custom values without exceeding the target above minimum size',()=>{for(const pct of [.5,1,2,3,1.7]){const lots=lotsForRisk(100000,pct,333,.01,.01);expect(lots*333).toBeLessThanOrEqual(100000*pct/100+1e-6);}});
 it('recalculates sizing for the market fill rather than a distant setup entry',()=>{expect(lotsForRisk(100000,1,500,.01,.01)).toBe(2);expect(lotsForRisk(100000,1,1000,.01,.01)).toBe(1);});
});

describe('Realistic Live / Prop-Firm Pip, Point, P&L & Leverage Margin Calculations', () => {
  it('calculates exact pips, points, and PnL for Gold (XAUUSD: 100 oz/lot, $0.10 pip, $0.01 point)', () => {
    const dist = calculatePipAndPointDistance(3000.0, 3010.0, 'XAUUSD');
    expect(dist.pips).toBe(100);
    expect(dist.points).toBe(1000);
    expect(dist.unitLabel).toBe('pips');

    // 1.00 lot XAUUSD moving $10.00 (100 pips) = $1,000.00
    expect(calculatePositionPnl('LONG', 3000.0, 3010.0, 1.0, 'XAUUSD')).toBe(1000.0);
    expect(calculatePipValue(1.0, 3000.0, 'XAUUSD')).toBe(10.0);
  });

  it('calculates exact pips, points, and PnL for USD-quoted Forex Majors (EURUSD, GBPUSD: 100,000 units/lot)', () => {
    const dist = calculatePipAndPointDistance(1.1, 1.105, 'EURUSD');
    expect(dist.pips).toBe(50);
    expect(dist.points).toBe(500);
    expect(dist.unitLabel).toBe('pips');

    // 1.00 lot EURUSD moving 50 pips (0.0050) = $500.00 ($10/pip)
    expect(calculatePositionPnl('LONG', 1.1, 1.105, 1.0, 'EURUSD')).toBe(500.0);
    expect(calculatePipValue(1.0, 1.1, 'EURUSD')).toBe(10.0);
  });

  it('calculates exact dynamic PnL and pip value for USD-base Forex Majors (USDJPY, USDCHF, USDCAD)', () => {
    // USDJPY: 100,000 USD contract, 1 pip = 0.01 JPY = 1,000 JPY / exitRate
    const jpyDist = calculatePipAndPointDistance(150.0, 151.0, 'USDJPY');
    expect(jpyDist.pips).toBe(100);
    expect(jpyDist.points).toBe(1000);

    // 1.00 lot LONG from 150.000 to 151.500 (+150 pips = +150,000 JPY / 151.500 = $990.10)
    expect(calculatePositionPnl('LONG', 150.0, 151.5, 1.0, 'USDJPY')).toBe(990.1);
    // Pip value at 158.00 = 1000 / 158.01 ≈ $6.33
    expect(calculatePipValue(1.0, 158.0, 'USDJPY')).toBeCloseTo(6.33, 2);

    // USDCHF: 100,000 USD contract, 1 pip = 0.0001 CHF = 10 CHF / exitRate
    // At 0.8000 CHF/USD, 1 pip = 10 / 0.8001 = $12.50 (NOT hardcoded $10.00!)
    expect(calculatePipValue(1.0, 0.8, 'USDCHF')).toBeCloseTo(12.5, 2);

    // USDCAD: at 1.3850 CAD/USD, 1 pip = 10 / 1.3851 ≈ $7.22
    expect(calculatePipValue(1.0, 1.385, 'USDCAD')).toBeCloseTo(7.22, 2);
  });

  it('calculates realistic PnL for Forex Crosses (EURGBP, GBPJPY, EURAUD) using 100,000 base units', () => {
    expect(getInstrumentConfig('EURGBP').contractSize).toBe(100000);
    expect(getInstrumentConfig('GBPJPY').contractSize).toBe(100000);
    expect(getInstrumentConfig('EURAUD').contractSize).toBe(100000);

    // EURGBP: 10 pips (0.0010) on 1.00 lot = 100 GBP -> $128.21 USD (at 0.78 GBP/USD)
    const eurgbpPnl = calculatePositionPnl('LONG', 0.85, 0.851, 1.0, 'EURGBP');
    expect(eurgbpPnl).toBeCloseTo(128.21, 1);

    // GBPJPY: 100 pips (1.00) on 1.00 lot = 100,000 JPY -> $645.16 USD (at 155 JPY/USD)
    const gbpjpyPnl = calculatePositionPnl('LONG', 200.0, 201.0, 1.0, 'GBPJPY');
    expect(gbpjpyPnl).toBeCloseTo(645.16, 1);
  });

  it('uses standard Prop-Firm CFD contractSize = 1 for Cash Indices (NAS100, SPX500, US30, GER30, UK100)', () => {
    for (const sym of ['NAS100', 'SPX500', 'US30', 'GER30', 'UK100'] as const) {
      expect(getInstrumentConfig(sym).contractSize).toBe(1);
      expect(getInstrumentConfig(sym).pipSize).toBe(1.0);
    }

    // 1.00 lot NAS100 moving 50 points = $50.00 (not $1,000 from 20x futures multiplier!)
    const nasDist = calculatePipAndPointDistance(20000, 20050, 'NAS100');
    expect(nasDist.pips).toBe(50);
    expect(nasDist.unitLabel).toBe('pts');
    expect(calculatePositionPnl('LONG', 20000, 20050, 1.0, 'NAS100')).toBe(50.0);

    // GER30 is EUR-quoted: 1.00 lot moving 100 points = 100 EUR -> $108.70 USD (or exact €100 in EUR account)
    expect(calculatePositionPnl('LONG', 22000, 22100, 1.0, 'GER30')).toBeCloseTo(108.7, 1);
    expect(
      calculatePositionPnl('LONG', 22000, 22100, 1.0, 'GER30', {
        accountCurrency: 'EUR',
      } as any)
    ).toBe(100.0);
  });

  it('uses standard CFD contract sizes for Energies (100 bbl/lot) and Crypto (1 coin/lot)', () => {
    // USOIL: 100 barrels/lot -> $1.00 move = $100.00
    expect(getInstrumentConfig('USOIL').contractSize).toBe(100);
    expect(calculatePositionPnl('LONG', 70.0, 71.0, 1.0, 'USOIL')).toBe(100.0);

    // BTCUSD & ETHUSD: 1 coin/lot -> $100.00 move = $100.00
    expect(getInstrumentConfig('BTCUSD').contractSize).toBe(1);
    expect(getInstrumentConfig('ETHUSD').contractSize).toBe(1);
    expect(calculatePositionPnl('LONG', 2500.0, 2600.0, 1.0, 'ETHUSD')).toBe(100.0);
  });

  it('calculates accurate Notional Value and Required Margin across leverage settings (1:30, 1:100, 1:500)', () => {
    // USDJPY: 1.00 lot = $100,000 USD notional regardless of JPY price (158.05)
    const usdjpyMargin100 = calculateRequiredMargin(1.0, 158.05, 'USDJPY', null, 100);
    expect(usdjpyMargin100.notionalUsd).toBe(100000);
    expect(usdjpyMargin100.requiredMarginUsd).toBe(1000);

    // EURUSD: 1.00 lot at 1.1500 = $115,000 USD notional
    const eurusdMargin100 = calculateRequiredMargin(1.0, 1.15, 'EURUSD', null, 100);
    expect(eurusdMargin100.notionalUsd).toBe(115000);
    expect(eurusdMargin100.requiredMarginUsd).toBe(1150);

    const eurusdMargin30 = calculateRequiredMargin(1.0, 1.15, 'EURUSD', null, 30);
    expect(eurusdMargin30.requiredMarginUsd).toBeCloseTo(3833.33, 2);

    const eurusdMargin500 = calculateRequiredMargin(1.0, 1.15, 'EURUSD', null, 500);
    expect(eurusdMargin500.requiredMarginUsd).toBe(230);

    // XAUUSD: 1.00 lot (100 oz) at $3,000 = $300,000 notional -> $3,000 margin at 1:100
    const goldMargin100 = calculateRequiredMargin(1.0, 3000, 'XAUUSD', null, 100);
    expect(goldMargin100.notionalUsd).toBe(300000);
    expect(goldMargin100.requiredMarginUsd).toBe(3000);
  });
});

