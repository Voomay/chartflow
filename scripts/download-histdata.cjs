const fs=require('node:fs'); const path=require('node:path');
const dest=process.argv[2]; const pairs=(process.argv[3]||'XAUUSD').split(',');
const years=(process.argv[4]||'2015').split(',');
fs.mkdirSync(dest,{recursive:true});
async function download(symbol,year){
 const file=path.join(dest,`${symbol}-${String(year).replaceAll('/','-')}.zip`);
 if(fs.existsSync(file)) return {symbol,year,cached:true,bytes:fs.statSync(file).size};
 const url=`https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/${symbol.toLowerCase()}/${year}`;
 const page=await fetch(url,{signal:AbortSignal.timeout(25000)});
 if(!page.ok) throw Error(`Page HTTP ${page.status}`);
 const html=await page.text();
 const form=html.match(/<form id="file_down"[\s\S]*?<\/form>/)?.[0];
 if(!form) return {symbol,year,unavailable:true};
 const body=new URLSearchParams();
 for(const input of form.matchAll(/<input\b[^>]*>/g)){
  const name=input[0].match(/name="([^"]+)"/)?.[1];
  const value=input[0].match(/value="([^"]*)"/)?.[1]||'';
  if(name) body.set(name,value);
 }
 const response=await fetch('https://www.histdata.com/get.php',{method:'POST',body,headers:{Referer:url},signal:AbortSignal.timeout(60000)});
 if(!response.ok) throw Error(`Download HTTP ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length<100 || bytes[0]!==0x50 || bytes[1]!==0x4b) throw Error(`Not a ZIP archive (${bytes.length} bytes)`);
 fs.writeFileSync(file,bytes);
 fs.writeFileSync(file+'.source.json',JSON.stringify({provider:'HistData',symbol,year,url,retrievedAt:new Date().toISOString(),timezone:'EST fixed UTC-05:00',priceBasis:'bid',bytes:bytes.length},null,2));
 return {symbol,year,bytes:bytes.length};
}
(async()=>{
 const results=[];
 for(const symbol of pairs) for(const year of years){
  try {const r=await download(symbol,year);results.push(r);console.log(JSON.stringify(r));}
  catch(e){const r={symbol,year,error:e.message};results.push(r);console.log(JSON.stringify(r)); if(/429|403/.test(e.message)){fs.writeFileSync(path.join(dest,'download-results.json'),JSON.stringify(results,null,2));return;}}
 }
 fs.writeFileSync(path.join(dest,'download-results.json'),JSON.stringify(results,null,2));
})();
