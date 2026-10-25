import {describe,it,expect} from 'vitest';
import {signupBounds,inSignupRange,pageOf,southAfricaDay} from '../adminReporting';
describe('administrator reporting',()=>{
 it('uses South African calendar dates at UTC midnight boundaries',()=>{const now=Date.parse('2026-10-22T22:30:00Z');expect(southAfricaDay(now)).toBe('2026-10-23');const bounds=signupBounds('today',now);expect(inSignupRange('2026-10-22T22:00:00Z',bounds)).toBe(true);expect(inSignupRange('2026-10-23T22:00:00Z',bounds)).toBe(false);});
 it('handles year boundaries for previous month and tomorrow',()=>{expect(signupBounds('lastMonth',Date.parse('2026-01-03T10:00:00Z'))).toEqual({from:'2025-12-01',to:'2025-12-31'});expect(signupBounds('tomorrow',Date.parse('2026-12-31T10:00:00Z'))).toEqual({from:'2027-01-01',to:'2027-01-01'});});
 it('handles leap-year month lengths and complete annual ranges',()=>{expect(signupBounds('lastMonth',Date.parse('2024-03-15T10:00:00Z'))).toEqual({from:'2024-02-01',to:'2024-02-29'});expect(signupBounds('year',Date.parse('2026-10-23T10:00:00Z'))).toEqual({from:'2026-01-01',to:'2026-12-31'});});
 it('does not invent future signups or accept malformed registration dates',()=>{const bounds=signupBounds('tomorrow',Date.parse('2026-10-23T10:00:00Z'));expect(inSignupRange('2026-10-23T09:00:00Z',bounds)).toBe(false);expect(inSignupRange('invalid',signupBounds('all'))).toBe(false);});
 it('paginates 47 records as 20, 20, 7 without overlaps',()=>{const rows=Array.from({length:47},(_,i)=>i);const pages=[1,2,3].map(page=>pageOf(rows,page));expect(pages.map(page=>page.rows.length)).toEqual([20,20,7]);expect(pages.flatMap(page=>page.rows)).toEqual(rows);expect(pages[2].start).toBe(41);expect(pages[2].end).toBe(47);});
 it('clamps pages after filtering and represents an empty list',()=>{expect(pageOf([1],3).page).toBe(1);expect(pageOf([],99)).toMatchObject({page:1,pages:1,start:0,end:0,total:0,rows:[]});});
});
