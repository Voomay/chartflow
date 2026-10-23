const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto');
const root=process.argv[2],raw=path.join(root,'raw/histdata'),store=path.join(root,'archive');fs.mkdirSync(store,{recursive:true});
const baseFile=path.join(store,'manifest.json'); const worker=process.argv[3]; const manifestFile=worker===undefined?baseFile:path.join(store,`manifest-${worker}.json`);
const manifest=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile)):fs.existsSync(baseFile)?JSON.parse(fs.readFileSync(baseFile)):{version:1,provider:'HistData',timezone:'UTC',sourceTimezone:'EST fixed UTC-05:00',priceBasis:'bid',volume:'Not supplied by source; zero',symbols:{}};
const aliases={SPXUSD:'SPX500',GRXEUR:'GER30',UKXGBP:'UK100',WTIUSD:'USOIL',BCOUSD:'UKOIL',NSXUSD:'NAS100'};
const steps={'5m':300,'15m':900,'30m':1800,'1H':3600,'4H':14400,'1D':86400};
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(b){let n=0xffffffff;for(const v of b)n=crcTable[(n^v)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function* csvEntries(b){
 let eocd=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw Error('ZIP directory absent');
 let p=b.readUInt32LE(eocd+16);const count=b.readUInt16LE(eocd+10);
 for(let i=0;i<count;i++){
  if(b.readUInt32LE(p)!==0x02014b50)throw Error('ZIP directory corrupt');
  const method=b.readUInt16LE(p+10),crc=b.readUInt32LE(p+16),compressed=b.readUInt32LE(p+20),size=b.readUInt32LE(p+24),nl=b.readUInt16LE(p+28),el=b.readUInt16LE(p+30),cl=b.readUInt16LE(p+32),offset=b.readUInt32LE(p+42),name=b.subarray(p+46,p+46+nl).toString();
  p+=46+nl+el+cl;
  if(!name.endsWith('.csv')||!name.includes('DAT_ASCII_'))continue;
  if(b.readUInt32LE(offset)!==0x04034b50||size>100*1024*1024)throw Error('Invalid ZIP entry');
  const start=offset+30+b.readUInt16LE(offset+26)+b.readUInt16LE(offset+28),packed=b.subarray(start,start+compressed);
  const data=method===8?z.inflateRawSync(packed,{maxOutputLength:100*1024*1024}):method===0?packed:null;
  if(!data||data.length!==size||crc32(data)!==crc)throw Error('ZIP content checksum mismatch');
  yield data.toString('utf8');
 }
}
function save(file,rows){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,z.gzipSync(JSON.stringify(rows),{level:1}));}
const files=fs.readdirSync(raw).filter(n=>n.endsWith('.zip')).sort((a,b)=>(+!a.startsWith('XAUUSD'))-(+!b.startsWith('XAUUSD'))||a.localeCompare(b));
const symbols=[...new Set(files.map(name=>aliases[name.split('-')[0]]||name.split('-')[0]))];
for(const name of files){
 const match=name.match(/^(.+)-(\d{4})\.zip$/);if(!match)continue;
 const [,source,year]=match,symbol=aliases[source]||source,info=manifest.symbols[symbol]||={sourceSymbol:source,provider:'HistData',priceBasis:'bid',years:{}};
 if(worker==='month'&&year!=='2026')continue;
 if(worker!==undefined&&worker!=='month'&&symbols.indexOf(symbol)%4!==Number(worker))continue;
 if(info.years[year])continue;
 const started=Date.now();
 try{
  const zip=fs.readFileSync(path.join(raw,name));const unique=new Map();let invalid=0,duplicates=0;
  for(const csv of csvEntries(zip))for(const line of csv.split(/\r?\n/)){
   if(!line.trim())continue;
   const [date,...values]=line.replace(/^\uFEFF/,'').split(';');
   const stamp=Date.UTC(+date.slice(0,4),+date.slice(4,6)-1,+date.slice(6,8),+date.slice(9,11)+5,+date.slice(11,13),+date.slice(13,15))/1000;
   const [o,h,l,c]=values.slice(0,4).map(Number);
   if(!Number.isFinite(stamp)||stamp%60||![o,h,l,c].every(x=>Number.isFinite(x)&&x>0)||h<Math.max(o,c)||l>Math.min(o,c)||h<l){invalid++;continue;}
   if(unique.has(stamp))duplicates++;
   unique.set(stamp,[stamp,o,h,l,c,0]);
  }
  if(!unique.size||invalid){console.log(JSON.stringify({symbol,year,quarantined:true,invalid}));continue;}
  const bars=[...unique.values()].sort((a,b)=>a[0]-b[0]);const months=new Map(),maps=Object.fromEntries([...Object.keys(steps),'1W','1M'].map(tf=>[tf,new Map()]));const gaps=[];
  for(let i=0;i<bars.length;i++){
   const b=bars[i],t=b[0],date=new Date(t*1000),month=new Date((t-18000)*1000).toISOString().slice(0,7);
   if(!months.has(month))months.set(month,[]);months.get(month).push(b);
   if(i&&t-bars[i-1][0]>60)gaps.push([bars[i-1][0],t,t-bars[i-1][0]]);
   for(const [tf,map] of Object.entries(maps)){
    const bucket=steps[tf]?Math.floor(t/steps[tf])*steps[tf]:tf==='1W'?(Math.floor(t/86400)-(date.getUTCDay()+6)%7)*86400:Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1)/1000;
    const old=map.get(bucket);if(old){old[2]=Math.max(old[2],b[2]);old[3]=Math.min(old[3],b[3]);old[4]=b[4];}else map.set(bucket,[bucket,...b.slice(1)]);
   }
  }
  for(const [month,rows] of months)save(path.join(store,symbol,'1m',`${month}.json.gz`),rows);
  for(const [tf,map] of Object.entries(maps))save(path.join(store,symbol,tf,`${year}.json.gz`),[...map.values()]);
  const item={rows:bars.length,first:bars[0][0],last:bars.at(-1)[0],invalidRows:invalid,duplicates,gapsOverOneMinute:gaps.length,largestGapSeconds:Math.max(0,...gaps.map(g=>g[2])),largestGaps:gaps.sort((a,b)=>b[2]-a[2]).slice(0,10),sourceSha256:crypto.createHash('sha256').update(zip).digest('hex'),sourceUrl:`https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/${source.toLowerCase()}/${year}`};
  info.years[year]=item;const years=Object.values(info.years);info.first=Math.min(...years.map(v=>v.first));info.last=Math.max(...years.map(v=>v.last));info.rows=years.reduce((s,v)=>s+v.rows,0);
  fs.writeFileSync(manifestFile+'.tmp',JSON.stringify(manifest));fs.renameSync(manifestFile+'.tmp',manifestFile);
  console.log(JSON.stringify({symbol,year,rows:bars.length,invalid,seconds:(Date.now()-started)/1000}));
 }catch(e){console.log(JSON.stringify({symbol,year,error:e.message}));}
}
