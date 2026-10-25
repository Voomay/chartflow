export type SignupRange='today'|'yesterday'|'tomorrow'|'month'|'lastMonth'|'year'|'lastYear'|'all'|'custom';
export const southAfricaDay=(value:string|number)=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
 return ['year','month','day'].map(type=>parts.find(part=>part.type===type)?.value).join('-');
};
const shiftDay=(day:string,days:number)=>southAfricaDay(Date.parse(`${day}T00:00:00+02:00`)+days*86400000);
export function signupBounds(range:SignupRange,now=Date.now(),from='',to=''):{from:string;to:string}{
 const today=southAfricaDay(now),year=Number(today.slice(0,4)),month=Number(today.slice(5,7));
 const monthStart=`${today.slice(0,7)}-01`;
 switch(range){
 case 'today':return {from:today,to:today};
 case 'tomorrow':return {from:shiftDay(today,1),to:shiftDay(today,1)};
 case 'yesterday':return {from:shiftDay(today,-1),to:shiftDay(today,-1)};
 case 'month':return {from:monthStart,to:shiftDay(`${month===12?year+1:year}-${String(month===12?1:month+1).padStart(2,'0')}-01`,-1)};
 case 'lastMonth':return {from:`${month===1?year-1:year}-${String(month===1?12:month-1).padStart(2,'0')}-01`,to:shiftDay(monthStart,-1)};
 case 'year':return {from:`${year}-01-01`,to:`${year}-12-31`};
 case 'lastYear':return {from:`${year-1}-01-01`,to:`${year-1}-12-31`};
 case 'custom':return {from,to};
 default:return {from:'',to:''};
 }
}
export function inSignupRange(value:string,bounds:{from:string;to:string}){
 if(!Number.isFinite(Date.parse(value)))return false;
 const day=southAfricaDay(value);return (!bounds.from||day>=bounds.from)&&(!bounds.to||day<=bounds.to);
}
export function pageOf<T>(rows:T[],page:number,size=20){
 const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.max(1,Math.min(page,pages));
 return {rows:rows.slice((current-1)*size,current*size),page:current,pages,start:rows.length?(current-1)*size+1:0,end:Math.min(current*size,rows.length),total:rows.length};
}
