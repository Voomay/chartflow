import {BacktestPosition} from '../types/trading';

// A streak is consecutive closed trades in exit-time order. A flat result breaks it.
// Count each losing run once when it reaches two losses, regardless of its final length.
export function computeTradeStreaks(trades:BacktestPosition[]) {
  const closed=trades.filter(trade=>['CLOSED_TP','CLOSED_SL','CLOSED_MANUAL','CLOSED_BREACH'].includes(trade.status))
    .slice().sort((a,b)=>(a.exitTime??a.entryTime)-(b.exitTime??b.entryTime));
  let longestWinStreak=0,longestLossStreak=0,currentStreak=0,losingStreakCount=0;
  for(const trade of closed){
    if(trade.pnl>0.005){currentStreak=currentStreak>0?currentStreak+1:1;longestWinStreak=Math.max(longestWinStreak,currentStreak);}
    else if(trade.pnl< -0.005){currentStreak=currentStreak<0?currentStreak-1:-1;longestLossStreak=Math.max(longestLossStreak,-currentStreak);if(currentStreak===-2)losingStreakCount++;}
    else currentStreak=0;
  }
  return {longestWinStreak,longestLossStreak,currentStreak,currentLossStreak:Math.max(0,-currentStreak),losingStreakCount};
}
