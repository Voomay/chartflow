import {describe,it,expect} from 'vitest';
import {clipExtendedLine,formatChartCrosshairTime,PATTERN_LABELS} from '../chartDrawingGeometry';
describe('extended drawing geometry',()=>{
 it('extends both ends of an infinite line',()=>{expect(clipExtendedLine({x:20,y:20},{x:40,y:40},100,80)).toEqual([{x:0,y:0},{x:80,y:80}]);});
 it('starts a ray at its origin',()=>{expect(clipExtendedLine({x:20,y:20},{x:40,y:40},100,80,true)).toEqual([{x:20,y:20},{x:80,y:80}]);});
 it('supports reverse rays',()=>{expect(clipExtendedLine({x:40,y:40},{x:20,y:20},100,80,true)).toEqual([{x:40,y:40},{x:0,y:0}]);});
 it('supports vertical lines without division by zero',()=>{expect(clipExtendedLine({x:40,y:20},{x:40,y:30},100,80)).toEqual([{x:40,y:0},{x:40,y:80}]);});
 it('rejects zero-length or off-plot lines',()=>{expect(clipExtendedLine({x:1,y:1},{x:1,y:1},100,80)).toBeNull();expect(clipExtendedLine({x:110,y:1},{x:110,y:5},100,80)).toBeNull();});
 it('defines the requested ordered pattern anchors',()=>{expect(PATTERN_LABELS.abc_pattern).toEqual(['0','A','B','C']);expect(PATTERN_LABELS.abcd_pattern).toEqual(['A','B','C','D']);});
});
describe('chart crosshair clock',()=>{
 it('uses the selected zone across a date boundary and labels South Africa time clearly',()=>{expect(formatChartCrosshairTime(Date.UTC(2026,0,5,0,30),'America/New_York')).toContain('Sun, 04 Jan 26');expect(formatChartCrosshairTime(Date.UTC(2026,0,5,0,30),'Africa/Johannesburg')).toContain('02:30 South Africa');});
 it('observes daylight saving changes',()=>{expect(formatChartCrosshairTime(Date.UTC(2026,6,5,12),'Europe/London')).toContain('13:00');expect(formatChartCrosshairTime(Date.UTC(2026,0,5,12),'Europe/London')).toContain('12:00');});
});
