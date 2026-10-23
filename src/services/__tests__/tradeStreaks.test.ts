import {describe,it,expect} from 'vitest';
import {computeTradeStreaks} from '../tradeStreaks';
import {BacktestPosition} from '../../types/trading';
const trades=(values:number[])=>values.map((pnl,i)=>({id:String(i),pnl,entryTime:i*60,exitTime:i*60+30,status:'CLOSED_MANUAL'} as BacktestPosition));
describe('Consecutive closed-trade streaks',()=>{
 it('returns zero for no trades',()=>expect(computeTradeStreaks([])).toEqual({longestWinStreak:0,longestLossStreak:0,currentStreak:0,currentLossStreak:0,losingStreakCount:0}));
 it('counts a long losing run once and reports its current length',()=>expect(computeTradeStreaks(trades([-1,-2,-3,-4]))).toMatchObject({losingStreakCount:1,longestLossStreak:4,currentLossStreak:4}));
 it('counts separate runs of two or more losses and excludes isolated losses',()=>expect(computeTradeStreaks(trades([-1,2,-1,-2,3,-1,-2,-3,5]))).toMatchObject({losingStreakCount:2,longestLossStreak:3,currentLossStreak:0,currentStreak:1}));
 it('break-even breaks both the current run and a future run',()=>expect(computeTradeStreaks(trades([-1,0,-1,0]))).toMatchObject({losingStreakCount:0,longestLossStreak:1,currentStreak:0}));
 it('uses exit order rather than insertion order',()=>expect(computeTradeStreaks(trades([-1,2,-3,-4]).reverse())).toMatchObject({currentLossStreak:2,longestLossStreak:2,losingStreakCount:1}));
 it('ignores pending, cancelled and open orders',()=>expect(computeTradeStreaks([...trades([-1,-1]),...['OPEN','PENDING','CANCELLED'].map(status=>({...trades([500])[0],exitTime:9999,status} as BacktestPosition))])).toMatchObject({currentLossStreak:2,losingStreakCount:1}));
 it('retains longest winning run after a loss',()=>expect(computeTradeStreaks(trades([1,2,3,-1]))).toMatchObject({longestWinStreak:3,currentStreak:-1,longestLossStreak:1}));
 it('treats the report rounding tolerance as break-even',()=>expect(computeTradeStreaks(trades([-1,-.005,-1]))).toMatchObject({losingStreakCount:0,longestLossStreak:1,currentLossStreak:1}));
});
