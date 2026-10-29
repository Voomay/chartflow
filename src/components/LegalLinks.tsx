import React from 'react';
export type LegalDocumentKey='terms'|'privacy'|'popia';
export const LegalLinks:React.FC<{onOpen?:(page:LegalDocumentKey)=>void;onOpenSitemap?:()=>void;className?:string}>=({onOpen,onOpenSitemap,className=''})=>(
  <nav aria-label="Legal and site information" className={`flex flex-wrap gap-x-3 gap-y-2 text-[10px] ${className}`}>
    {([{id:'terms',label:'Terms & Conditions'},{id:'privacy',label:'Privacy Policy'},{id:'popia',label:'POPIA'}] as const).map(page=>(
      <a
        key={page.id}
        href={`/${page.id}`}
        onClick={onOpen?event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onOpen(page.id);}:undefined}
        className="opacity-65 hover:opacity-100 hover:text-emerald-400 transition-colors"
      >
        {page.label}
      </a>
    ))}
    <a
      href="/sitemap"
      onClick={onOpenSitemap?event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onOpenSitemap();}:undefined}
      className="opacity-65 hover:opacity-100 hover:text-emerald-400 transition-colors"
    >
      Sitemap
    </a>
  </nav>
);
