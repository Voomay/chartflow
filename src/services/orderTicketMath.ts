export function positionRiskReward(side:'LONG'|'SHORT',entry:number,stop:number,target:number):number|null {
 if(![entry,stop,target].every(value=>Number.isFinite(value)&&value>0))return null;
 const risk=side==='LONG'?entry-stop:stop-entry;const reward=side==='LONG'?target-entry:entry-target;
 return risk>0&&reward>0?reward/risk:null;
}
export function lotsForRisk(balance:number,riskPct:number,oneLotRisk:number,minimum:number,increment:number):number {
 if(![balance,riskPct,oneLotRisk,minimum,increment].every(Number.isFinite)||balance<=0||riskPct<=0||oneLotRisk<=0||minimum<=0||increment<=0)return minimum;
 return Math.max(minimum,Number((Math.floor((balance*riskPct/100)/oneLotRisk/increment+1e-9)*increment).toFixed(8)));
}
