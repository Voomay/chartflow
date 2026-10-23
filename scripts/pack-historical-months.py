from pathlib import Path
import zipfile,json,hashlib,sys
raw=Path(sys.argv[1])/'raw/histdata'
groups={}
for p in raw.glob('*-2026-*.zip'): groups.setdefault(p.name.split('-')[0],[]).append(p)
for symbol,files in groups.items():
 target=raw/f'{symbol}-2026.zip'
 metadata=[]
 with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as out:
  for source in sorted(files):
   with zipfile.ZipFile(source) as z:
    for name in z.namelist():
     if name.endswith('.csv') and 'DAT_ASCII_' in name: out.writestr(name,z.read(name))
   metadata.append({'file':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),**json.loads(source.with_suffix('.zip.source.json').read_text())})
 target.with_suffix('.zip.source.json').write_text(json.dumps({'provider':'HistData','containerOnly':True,'sourceParts':metadata},separators=(',',':')))
 print(json.dumps({'symbol':symbol,'months':len(files),'containerBytes':target.stat().st_size}),flush=True)
