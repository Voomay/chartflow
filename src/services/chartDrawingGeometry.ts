export interface PixelPoint {x:number;y:number}
// Clip a directed ray or an infinite line to the plot; also handles vertical lines.
export function clipExtendedLine(a:PixelPoint,b:PixelPoint,width:number,height:number,ray=false):[PixelPoint,PixelPoint]|null {
  const dx=b.x-a.x,dy=b.y-a.y;
  if(![a.x,a.y,b.x,b.y,width,height].every(Number.isFinite)||width<=0||height<=0||Math.hypot(dx,dy)<0.001)return null;
  let low=ray?0:-Infinity,high=Infinity;
  for(const [origin,direction,max] of [[a.x,dx,width],[a.y,dy,height]]){
    if(Math.abs(direction)<1e-9){if(origin<0||origin>max)return null;continue;}
    const v1=-origin/direction,v2=(max-origin)/direction;
    low=Math.max(low,Math.min(v1,v2));high=Math.min(high,Math.max(v1,v2));
    if(low>high)return null;
  }
  return [{x:a.x+low*dx,y:a.y+low*dy},{x:a.x+high*dx,y:a.y+high*dy}];
}
export const PATTERN_LABELS:Record<string,string[]>={abc_pattern:['0','A','B','C'],abcd_pattern:['A','B','C','D']};
export const isPatternTool=(tool:string)=>tool==='abc_pattern'||tool==='abcd_pattern';
export function formatChartCrosshairTime(timestampMs:number,timezone:string):string {
  const formatted=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,weekday:'short',day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'}).format(new Date(timestampMs));
  return timezone==='Africa/Johannesburg'?formatted.replace(/\s+(?:GMT\+2|SAST|UTC\+2)$/i,' South Africa'):formatted;
}
