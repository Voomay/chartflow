import{describe,it,expect}from'vitest';import{positionRiskReward,lotsForRisk}from'../orderTicketMath';
describe('position tool and ticket risk/reward',()=>{
 it('uses the drawn entry for long and short setups',()=>{expect(positionRiskReward('LONG',100,95,115)).toBe(3);expect(positionRiskReward('SHORT',100,105,85)).toBe(3);});
 it('updates when the tool entry, stop or target is moved',()=>{expect(positionRiskReward('LONG',100,90,120)).toBe(2);expect(positionRiskReward('LONG',100,95,120)).toBe(4);expect(positionRiskReward('LONG',105,95,120)).toBe(1.5);});
 it('does not show a valid R ratio for invalid levels',()=>{expect(positionRiskReward('LONG',100,105,120)).toBeNull();expect(positionRiskReward('SHORT',100,105,120)).toBeNull();expect(positionRiskReward('LONG',100,100,120)).toBeNull();});
 it('sizes compact risk presets and custom values without exceeding the target above minimum size',()=>{for(const pct of [.5,1,2,3,1.7]){const lots=lotsForRisk(100000,pct,333,.01,.01);expect(lots*333).toBeLessThanOrEqual(100000*pct/100+1e-6);}});
 it('recalculates sizing for the market fill rather than a distant setup entry',()=>{expect(lotsForRisk(100000,1,500,.01,.01)).toBe(2);expect(lotsForRisk(100000,1,1000,.01,.01)).toBe(1);});
});
