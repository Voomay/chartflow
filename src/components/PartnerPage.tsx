import {useEffect} from 'react';
import {ArrowUpRight,Check,Handshake,HeartHandshake,Layers3,Mail,MessageSquarePlus,ShieldCheck,TrendingUp} from 'lucide-react';
import {SiteHeader,SiteHeaderProps} from './SiteHeader';
import {LegalLinks,LegalDocumentKey} from './LegalLinks';
import {applyPageSeo} from '../services/seo';
import {OFFICIAL_CONTACT_EMAIL,PERSONAL_CONTACT_EMAIL} from '../services/platformAccounts';
const contact=`mailto:${OFFICIAL_CONTACT_EMAIL}?cc=${PERSONAL_CONTACT_EMAIL}&subject=`+encodeURIComponent('Partner with Chart Replay')+'&body='+encodeURIComponent('Hi Chart Replay team,\n\nI would like to explore a partnership supporting South African traders.\n\nName:\nBusiness / organisation:\nWebsite:\nPartnership idea:\nHow we can support the community:\n\nKind regards,');
export function PartnerPage({
 onBack: _onBack,
 onOpenLegal,
 onOpenSitemap,
 onOpenContactUs,
 siteHeaderProps,
 embedded = false,
 isLight = false,
}:{
 onBack:()=>void;
 onOpenLegal?:(page:LegalDocumentKey)=>void;
 onOpenSitemap?:()=>void;
 onOpenContactUs?:()=>void;
 siteHeaderProps?:Omit<SiteHeaderProps,'activePage'>;
 embedded?:boolean;
 isLight?:boolean;
}){
 useEffect(()=>{
  if(embedded)return;
  applyPageSeo({
   title:'Partner with Us – Support South African Forex Traders | Chart Replay',
   description:'Explore sponsorship, educational collaboration, and community partnership opportunities with Chart Replay (chartreplay.co.za) to keep quality trading practice free for South African traders.',
   path:'/partners',
   type:'website',
  });
 },[embedded]);

 const bodyContent = (
  <div className={embedded && isLight ? 'text-slate-900' : 'text-slate-200 bg-[radial-gradient(ellipse_at_20%_0%,rgba(16,185,129,0.16),transparent_55%),radial-gradient(ellipse_at_90%_20%,rgba(14,165,233,0.13),transparent_45%)]'}>
   <div className={embedded ? 'max-w-6xl mx-auto px-3.5 sm:px-8 py-6 sm:py-8' : 'max-w-6xl mx-auto px-5 sm:px-8'}>
    <section className={`grid lg:grid-cols-[1.25fr_1fr] items-center gap-10 ${embedded ? 'pt-2 pb-12 sm:pb-16' : 'pt-12 pb-16 sm:pt-20 sm:pb-24'}`}>
     <div>
      <p className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.18em] ${embedded && isLight ? 'border-emerald-300 bg-emerald-50 text-emerald-700 font-bold' : 'border-emerald-300/20 bg-emerald-400/5 text-emerald-200'}`}>
       <Handshake size={14}/>Partner with Chart Replay
      </p>
      <h1 className="mt-6 text-3xl sm:text-5xl font-semibold leading-[1.07] tracking-[-0.045em]">
       More opportunity.<br/>
       <span className={embedded && isLight ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent' : 'bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent'}>
        Less in the way.
       </span>
      </h1>
      <p className={`mt-5 max-w-xl text-base leading-7 ${embedded && isLight ? 'text-slate-600' : 'text-slate-400'}`}>
       Help us keep quality trading practice free and accessible for South African traders, for as long as possible.
      </p>
      <p className={`mt-3 max-w-xl text-sm leading-7 ${embedded && isLight ? 'text-slate-500' : 'text-slate-500'}`}>
       We’re looking for brokers, prop firms, technology providers and businesses that share that goal. Support the platform, contribute useful expertise, or build something valuable with our community.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
       {onOpenContactUs && (
        <button
         type="button"
         onClick={onOpenContactUs}
         className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-4 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 transition"
        >
         Send Partnership Inquiry<ArrowUpRight size={17}/>
        </button>
       )}
       <a
        href={contact}
        className={`inline-flex items-center gap-2 rounded-xl border px-5 py-4 text-sm font-semibold transition ${
         embedded && isLight
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20'
        }`}
       >
        <Mail size={16}/>Email Us Directly
       </a>
      </div>
      <p className={`mt-3 text-xs ${embedded && isLight ? 'text-slate-500' : 'text-slate-400'}`}>
       Official email: <a href={`mailto:${OFFICIAL_CONTACT_EMAIL}`} className={embedded && isLight ? 'text-sky-700 font-semibold underline' : 'text-cyan-300 underline'}>{OFFICIAL_CONTACT_EMAIL}</a> · Personal email: <a href={`mailto:${PERSONAL_CONTACT_EMAIL}`} className={embedded && isLight ? 'text-emerald-700 font-semibold underline' : 'text-emerald-300 underline'}>{PERSONAL_CONTACT_EMAIL}</a>
      </p>
     </div>
     <div className={`relative rounded-[28px] border p-7 sm:p-9 ${
      embedded && isLight
       ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-cyan-50/60 to-white shadow-sm'
       : 'border-emerald-300/20 bg-gradient-to-br from-emerald-500/10 via-cyan-400/5 to-slate-900'
     }`}>
      <HeartHandshake size={38} className={embedded && isLight ? 'text-emerald-600' : 'text-emerald-300'}/>
      <p className={`mt-7 text-[10px] tracking-[0.2em] uppercase ${embedded && isLight ? 'text-cyan-700 font-bold' : 'text-cyan-200'}`}>
       Our shared ambition
      </p>
      <h2 className="mt-3 text-2xl sm:text-3xl font-semibold leading-tight">
       Put the trader’s<br/>progress first.
      </h2>
      <div className="mt-7 space-y-4">
       {['Accessible tools for deliberate practice','Support for a South African community','Partnerships that add practical value'].map(text=>(
        <p key={text} className={`flex gap-3 items-center text-sm ${embedded && isLight ? 'text-slate-700' : 'text-slate-300'}`}>
         <Check size={16} className={`shrink-0 ${embedded && isLight ? 'text-emerald-600' : 'text-emerald-300'}`}/>{text}
        </p>
       ))}
      </div>
      <p className={`mt-8 border-t pt-5 text-xs leading-6 ${embedded && isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-500'}`}>
       A focused platform where traders can replay, reflect and improve—without distractions competing for every click.
      </p>
     </div>
    </section>

    <section className="pb-14">
     <p className={`text-[10px] uppercase tracking-[0.18em] ${embedded && isLight ? 'text-emerald-700 font-bold' : 'text-emerald-300'}`}>
      Ways to work together
     </p>
     <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight">
      Bring something useful to the table.
     </h2>
     <div className="mt-7 grid md:grid-cols-3 gap-4">
      {[
       [TrendingUp,'Support the platform','Help fund the tools and infrastructure that keep practice accessible. We can discuss a limited, clearly labelled sponsor placement or relevant partner introduction.'],
       [HeartHandshake,'Share knowledge','Collaborate on practical educational resources, community initiatives and events that help traders develop a more thoughtful process.'],
       [Layers3,'Build with us','Contribute technology, market-data access, product expertise or services that make the platform more useful for South African traders.']
      ].map(([Icon,title,body])=>{
       const FeatureIcon=Icon as typeof TrendingUp;
       return (
        <article
         key={String(title)}
         className={`rounded-2xl border p-6 ${
          embedded && isLight
           ? 'border-slate-200 bg-white shadow-xs'
           : 'border-white/10 bg-white/[0.02]'
         }`}
        >
         <FeatureIcon size={25} className={embedded && isLight ? 'text-cyan-600' : 'text-cyan-300'}/>
         <h3 className="mt-6 text-lg font-semibold">{String(title)}</h3>
         <p className={`mt-3 text-sm leading-7 ${embedded && isLight ? 'text-slate-600' : 'text-slate-400'}`}>{String(body)}</p>
        </article>
       );
      })}
     </div>
    </section>

    <section className={`grid md:grid-cols-[1fr_1.2fr] gap-8 rounded-3xl border p-6 sm:p-9 ${
     embedded && isLight
      ? 'border-cyan-200 bg-cyan-50/50'
      : 'border-cyan-300/15 bg-cyan-400/[0.035]'
    }`}>
     <div>
      <ShieldCheck size={28} className={embedded && isLight ? 'text-emerald-600' : 'text-emerald-300'}/>
      <h2 className="mt-4 text-2xl font-semibold">
       A little visibility.<br/>A lot of respect.
      </h2>
      <p className={`mt-4 text-sm leading-7 ${embedded && isLight ? 'text-slate-600' : 'text-slate-400'}`}>
       Partnership should help sustain the experience. It should never take it over.
      </p>
     </div>
     <div className="space-y-5">
      {[
       ['Considered placement','A small number of relevant, clearly labelled placements. No pop-up ads, forced redirects or advertising that interrupts the trading workspace.'],
       ['Clear relationships','Sponsored content and commercial relationships will be disclosed. Sponsorship does not buy a favourable review or a promise of trading results.'],
       ['Community comes first','We consider fit and usefulness before agreeing to a partnership. We do not sell our users’ personal information to partners or require a broker signup to practise.']
      ].map(([title,body])=>(
       <div key={title}>
        <h3 className={`font-semibold text-sm ${embedded && isLight ? 'text-emerald-800' : 'text-emerald-200'}`}>{title}</h3>
        <p className={`mt-2 text-sm leading-6 ${embedded && isLight ? 'text-slate-600' : 'text-slate-400'}`}>{body}</p>
       </div>
      ))}
     </div>
    </section>

    <section className="py-14 sm:py-16 text-center">
     <p className={`text-[10px] tracking-[0.18em] uppercase ${embedded && isLight ? 'text-emerald-700 font-bold' : 'text-emerald-300'}`}>
      Let’s build something worthwhile
     </p>
     <h2 className="mt-4 text-2xl sm:text-4xl font-semibold tracking-tight">
      A stronger platform.<br/>A stronger trading community.
     </h2>
     <p className={`mt-5 mx-auto max-w-xl text-sm leading-7 ${embedded && isLight ? 'text-slate-600' : 'text-slate-400'}`}>
      Tell us who you are, what you do and how you would like to support South African traders. We’ll explore whether there’s a good fit.
     </p>
     <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
      {onOpenContactUs && (
       <button
        type="button"
        onClick={onOpenContactUs}
        className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-4 text-sm font-bold text-slate-950 shadow-lg hover:brightness-110 transition"
       >
        <MessageSquarePlus size={17}/>Open Contact Form
       </button>
      )}
      <a
       href={contact}
       className={`inline-flex items-center gap-3 rounded-xl border px-6 py-4 text-sm font-semibold transition ${
        embedded && isLight
         ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
         : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20'
       }`}
      >
       <Mail size={17}/>Start the conversation<ArrowUpRight size={16}/>
      </a>
     </div>
     <p className="mt-3 text-xs text-slate-500">
      Reach out at {OFFICIAL_CONTACT_EMAIL} or personal email {PERSONAL_CONTACT_EMAIL}.
     </p>
    </section>

    {!embedded && (
     <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-7 text-[11px] text-slate-500">
      <p>Built in South Africa. Technology for practice. Simulated money only.</p>
      <LegalLinks onOpen={onOpenLegal} onOpenSitemap={onOpenSitemap} onOpenContact={onOpenContactUs}/>
     </footer>
    )}
   </div>
  </div>
 );

 if(embedded)return bodyContent;
 return (
  <main className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#080f19] text-slate-200 selection:bg-emerald-400/30">
   {siteHeaderProps && <SiteHeader activePage="partners" {...siteHeaderProps}/>}
   {bodyContent}
  </main>
 );
}
