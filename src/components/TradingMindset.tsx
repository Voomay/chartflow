import {coachFlow,coachDismissDelay,CoachBubble} from '../services/coachFlow';
import {CoachMoment,coachName,nextCoachCopy} from '../services/coachMessages';
import {isReturningLogin,markCoachIntroSeen,motivationEnabled} from '../services/motivation';
import {syncUserPreferencesToSupabase} from '../services/supabaseClient';
import {CoachFace} from './CoachFace';
import React,{useEffect,useLayoutEffect,useReducer,useRef,useState} from 'react';
import {Check,GripHorizontal,Maximize2,PartyPopper,Pin,PenLine,StickyNote,X} from 'lucide-react';
import {TradingSession} from '../types/trading';
import {createMindsetTracker,nextMindsetMoment,fitMindsetNote,MindsetMoment,NoteBounds} from '../services/mindsetEvents';

const starter='MY TRADING PLAN\n\n• Wait for my setup. No chasing.\n• Define my risk before entry.\n• Respect my stop.\n• Review the process, not just the P&L.\n\nPatience is a position, too.';
const memoryMindsetStore=new Map<string,string>();
function read<T,>(key:string,fallback:T,legacyKey?:string):T{
  for(const k of [key,legacyKey].filter((x):x is string=>Boolean(x))){
    try{
      if(typeof localStorage!=='undefined'){
        const rawLocal=localStorage.getItem(k);
        if(rawLocal!==null){
          memoryMindsetStore.set(key,rawLocal);
          return JSON.parse(rawLocal)??fallback;
        }
      }
    }catch{/* ignore */}
    try{
      const rawMem=memoryMindsetStore.get(k);
      if(rawMem!==undefined)return JSON.parse(rawMem)??fallback;
    }catch{/* ignore */}
  }
  return fallback;
}
function save(key:string,value:unknown){
  const serialized=JSON.stringify(value);
  try{memoryMindsetStore.set(key,serialized);}catch{/* ignore */}
  try{if(typeof localStorage!=='undefined')localStorage.setItem(key,serialized);}catch{/* Keep the note usable without storage. */}
}
type Note=NoteBounds&{text:string;pinned:boolean};
const viewport=()=>({width:window.innerWidth,height:window.innerHeight});

export function TradingMindset({session,userKey,displayName,open,onClose,onOpen,rightPanelOpen=false,welcomeBlocking=false,planToggleCount=0,onPlanPinnedChange,onUpdatePlanNote}:{session:TradingSession;userKey:string;displayName?:string;open:boolean;onClose:()=>void;onOpen:()=>void;rightPanelOpen?:boolean;welcomeBlocking?:boolean;planToggleCount?:number;onPlanPinnedChange?:(pinned:boolean)=>void;onUpdatePlanNote?:(note:Note)=>void}){
  const safeUserKey=encodeURIComponent((userKey||'guest').trim().toLowerCase());
  const prefKey=`chart_mindset_v1:${safeUserKey}`,legacyPrefKey=`chart_mindset_v1:${userKey}`;
  const noteKey=`${prefKey}:plan:${session.id}`,legacyNoteKey=`${legacyPrefKey}:plan:${session.id}`;
  const [prefs,setPrefs]=useState(()=>{const saved=read<Partial<{coachEnabled:boolean;celebrate:boolean}>>(prefKey,{},legacyPrefKey);return {coachEnabled:saved.coachEnabled??true,celebrate:saved.celebrate??true};});
  const [note,setNote]=useState<Note>(()=>{
    const saved=read<Partial<Note>>(noteKey,{},legacyNoteKey);
    const hasCustomSaved=Boolean(saved.text && saved.text!==starter);
    const hasCustomSession=Boolean(session.mindsetNote?.text && session.mindsetNote.text!==starter);
    const resolvedText=hasCustomSaved?saved.text!:hasCustomSession?session.mindsetNote!.text:saved.text||session.mindsetNote?.text||starter;
    return {...{text:starter,pinned:false,x:28,y:110,width:286,height:300},...(session.mindsetNote||{}),...saved,text:resolvedText};
  });
  const lastToggleCount=useRef(planToggleCount);
  useEffect(()=>{if(planToggleCount!==lastToggleCount.current){lastToggleCount.current=planToggleCount;setNote(n=>({...n,pinned:!n.pinned}));}},[planToggleCount]);
  useEffect(()=>{onPlanPinnedChange?.(note.pinned);},[note.pinned,onPlanPinnedChange]);
  useEffect(()=>{
    if(session.mindsetNote?.text && session.mindsetNote.text!==starter){
      setNote(prev=>prev.text===starter?{...prev,...session.mindsetNote}:prev);
    }
  },[session.mindsetNote?.text]);
  const [expanded,setExpanded]=useState(false);
  const [editing,setEditing]=useState(false);
  const [overflowing,setOverflowing]=useState(false);
  const content=useRef<HTMLDivElement>(null);
  const collapsed=useRef<NoteBounds|null>(null);
  const fontSize=Math.max(10,Math.min(16,13*Math.sqrt(note.width*note.height/(286*300))));
  useLayoutEffect(()=>{const el=content.current;if(el)setOverflowing(el.scrollHeight>el.clientHeight+2);},[note.text,note.width,note.height,expanded,editing,fontSize]);
  const expand=()=>{collapsed.current=note;setExpanded(true);setNote(n=>({...n,...fitMindsetNote({...n,width:Math.max(n.width,430),height:Math.max(n.height,480)},viewport())}));};
  const collapse=()=>{setExpanded(false);setEditing(false);const bounds=collapsed.current;if(bounds)setNote(n=>({...n,...fitMindsetNote({...bounds,x:n.x,y:n.y},viewport())}));};
  const [flow,dispatchCoach]=useReducer(coachFlow,{current:null,queued:null});
  const [confettiBurst,setConfettiBurst]=useState<{id:number}|null>(null);
  const moment=flow.current;
  const momentRef=useRef(moment);
  momentRef.current=moment;
  const [mobileBottom,setMobileBottom]=useState(130);
  const [mobileTop,setMobileTop]=useState<number|null>(null);
  const [mobileBelow,setMobileBelow]=useState(false);
  const previousCopy=useRef<Partial<Record<CoachMoment,number>>>({});
  const introShown=useRef(false);
  const showMoment=(kind:CoachMoment,preview=false,answer=false)=>{
    const nowId=Date.now();
    if(kind==='win' && (preview || prefs.celebrate)){
      setConfettiBurst({id:nowId});
    }
    const copy=nextCoachCopy(kind,displayName,previousCopy.current[kind]);
    previousCopy.current[kind]=copy.index;
    const bubble:CoachBubble={kind,preview,id:nowId,title:copy.title,body:copy.body};
    if(!preview && !answer && (kind==='win'||kind==='loss'||kind==='flat') && momentRef.current && (momentRef.current.kind==='entry'||momentRef.current.kind==='affirm')){
      dispatchCoach({type:'dismiss'});
    }
    dispatchCoach({type:answer?'answer':preview?'preview':'show',bubble});
  };
  useEffect(()=>{
    if(!confettiBurst)return;
    const timer=setTimeout(()=>setConfettiBurst(null),3200);
    return()=>clearTimeout(timer);
  },[confettiBurst]);
  const tracker=useRef(createMindsetTracker(session.positions||[],session.replayTimestamp||0));
  const panel=useRef<HTMLDivElement>(null);
  const gesture=useRef<{mode:'move'|'resize';x:number;y:number;bounds:NoteBounds}|null>(null);
  const hasMountedPrefs=useRef(false);
  const hasMountedNote=useRef(false);
  useEffect(()=>{
    save(prefKey,prefs);
    if(hasMountedPrefs.current && userKey && userKey!=='guest'){
      void syncUserPreferencesToSupabase(userKey,{coachEnabled:prefs.coachEnabled,celebrateWins:prefs.celebrate});
    }
    hasMountedPrefs.current=true;
  },[prefKey,prefs,userKey]);
  useEffect(()=>{
    save(noteKey,note);
    if(hasMountedNote.current){
      onUpdatePlanNote?.(note);
    }
    hasMountedNote.current=true;
  },[noteKey,note]);
  useEffect(()=>{
    if(welcomeBlocking||!prefs.coachEnabled||!motivationEnabled(userKey)||introShown.current)return;
    const timer=setTimeout(()=>{
      introShown.current=true;
      const name=coachName(displayName);
      const returning=isReturningLogin(userKey);
      const title=returning
        ?(name==='trader'?'Hey, welcome back! Are you ready to perfect your strategy?':`Hey ${name}, welcome back! Are you ready to perfect your strategy?`)
        :(name==='trader'?'Hi, I am Michael, your psychology coach.':`Hi ${name}, I am Michael, your psychology coach.`);
      const body=returning
        ?'I am Michael, your psychology coach. I will guide you, check in on you, and make sure you follow your plan.'
        :'I will guide you, check in on you, and make sure you follow your plan — but you can also disable me if you don’t need my assistance.';
      markCoachIntroSeen(userKey);
      dispatchCoach({type:'show',bubble:{kind:'affirm',preview:false,id:Date.now(),title,body}});
    },350);
    return()=>clearTimeout(timer);
  },[welcomeBlocking,prefs.coachEnabled,displayName,userKey]);
  useEffect(()=>{
    const kind=nextMindsetMoment(tracker.current,session.positions||[],session.replayTimestamp||0,{enabled:prefs.coachEnabled,celebrate:prefs.celebrate},Date.now());
    if(kind)showMoment(kind);
  },[session.positions,session.replayTimestamp,prefs]);
  useEffect(()=>{if(moment && !prefs.coachEnabled && !moment.preview)dispatchCoach({type:'disable'});},[prefs,moment]);
  useEffect(()=>{if(!moment)return;const delay=(moment.title.includes('Michael')||moment.title.toLowerCase().includes('welcome back'))?11000:coachDismissDelay(moment.kind);if(delay===null)return;const timer=setTimeout(()=>dispatchCoach({type:'dismiss'}),delay);return()=>clearTimeout(timer);},[moment]);
  useEffect(()=>{const fit=()=>setNote(n=>({...n,...fitMindsetNote(n,viewport())}));fit();window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit);},[]);
  useEffect(()=>{
    if(!open)return;
    const close=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node) && !(e.target as Element).closest('[aria-label="Trading mindset"],[aria-label="Open psychology coach"]'))onClose();};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};
  },[open,onClose]);
  const start=(e:React.PointerEvent<HTMLElement>,mode:'move'|'resize')=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);if(mode==='resize'){setExpanded(false);setEditing(false);}gesture.current={mode,x:e.clientX,y:e.clientY,bounds:note};};
  const move=(e:React.PointerEvent<HTMLElement>)=>{const g=gesture.current;if(!g)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;const next=g.mode==='move'?{...g.bounds,x:g.bounds.x+dx,y:g.bounds.y+dy}:{...g.bounds,width:g.bounds.width+dx,height:g.bounds.height+dy};setNote(n=>({...n,...fitMindsetNote(next,viewport())}));};
  const end=()=>{gesture.current=null;};
  const keyMove=(e:React.KeyboardEvent<HTMLElement>,resize=false)=>{const keys:Record<string,[number,number]>={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};const d=keys[e.key];if(!d)return;e.preventDefault();setNote(n=>({...n,...fitMindsetNote(resize?{...n,width:n.width+d[0],height:n.height+d[1]}:{...n,x:n.x+d[0],y:n.y+d[1]},viewport())}));};
  const preview=(kind:MindsetMoment)=>{showMoment(kind,true);onClose();};
  const confirmPlan=()=>showMoment('affirm',moment?.preview||false,true);
  const declinePlan=()=>showMoment('reset',moment?.preview||false,true);
  useLayoutEffect(()=>{
    const dock=document.querySelector('#replay-workspace-content')?.parentElement;
    const update=()=>{
      if(window.innerWidth>=768){setMobileTop(null);return;}
      const controls=document.querySelector('[aria-label="Mobile trading actions"]');
      if(controls){
        const cRect=controls.getBoundingClientRect();
        if(cRect.height>0){
          setMobileTop(Math.min(Math.round(cRect.bottom+8),window.innerHeight-62));
          setMobileBelow(false);
          return;
        }
      }
      setMobileTop(null);
      const rect=dock?.getBoundingClientRect();
      const bottom=Math.max(130,Math.min(window.innerHeight-120,rect?window.innerHeight-rect.top+12:130));
      setMobileBottom(bottom);
      setMobileBelow(bottom>window.innerHeight/2);
    };
    update();
    const timer=setTimeout(update,120);
    const observer=new ResizeObserver(update);
    if(dock)observer.observe(dock);
    const controlsEl=document.querySelector('[aria-label="Mobile trading actions"]');
    if(controlsEl)observer.observe(controlsEl);
    window.addEventListener('resize',update);
    return()=>{clearTimeout(timer);observer.disconnect();window.removeEventListener('resize',update);};
  },[rightPanelOpen,session.id]);
  return <>

    {note.pinned && <aside className="mindset-paper mindset-pinned" aria-label="Pinned trading plan" style={{left:note.x,top:note.y,width:note.width,height:note.height}}>
      <div className="mindset-drag" tabIndex={0} aria-label="Move trading plan" title="Drag to move · Arrow keys also work" onKeyDown={e=>keyMove(e)} onPointerDown={e=>start(e,'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><span><GripHorizontal size={14}/> MY TRADING PLAN</span><div className="mindset-note-tools"><button aria-label={editing?"Save trading plan":"Edit trading plan"} title={editing?"Done editing":"Edit plan"} onPointerDown={e=>e.stopPropagation()} onClick={()=>{if(editing){setEditing(false);}else{if(!expanded)expand();setEditing(true);}}}>{editing?<Check size={14}/>:<PenLine size={13}/>}</button><button aria-label="Hide trading plan" title="Hide note · Bring it back from My plan or Mindset" onPointerDown={e=>e.stopPropagation()} onClick={()=>setNote(n=>({...n,pinned:false}))}><X size={15}/></button></div></div>
      {editing?<textarea className="mindset-note-editor" autoFocus aria-label="Edit trading plan text" style={{fontSize}} maxLength={4000} value={note.text} onChange={e=>setNote(n=>({...n,text:e.target.value}))}/>:<div ref={content} tabIndex={expanded?0:undefined} aria-label="Trading plan text" className={`mindset-note-content ${expanded?'is-expanded':''} ${!expanded&&overflowing?'is-faded':''}`} style={{fontSize}}>{note.text}</div>}
      <div className="mindset-note-footer"><span className="mindset-paper-foot">Your plan. Your pace.</span>{editing?<button onClick={()=>setEditing(false)}>Done <Check size={11}/></button>:(overflowing||expanded)&&<button onClick={()=>expanded?collapse():expand()}>{expanded?'View less':'View more'}</button>}</div>
      <button className="mindset-resize" aria-label="Resize trading plan" title="Drag to resize · Arrow keys also work" onKeyDown={e=>keyMove(e,true)} onPointerDown={e=>start(e,'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><Maximize2 size={13}/></button>
    </aside>}
    {(confettiBurst || moment?.kind==='win') && prefs.celebrate && <div key={confettiBurst?.id ?? moment?.id} className="mindset-confetti" aria-hidden="true">{Array.from({length:64},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,background:['#2dd4bf','#fbbf24','#c4b5fd','#fb7185','#7dd3fc'][i%5],animationDelay:`${(i%4)*.012}s`,['--drift' as string]:`${(i%2?-1:1)*(20+i%7*15)}px`,['--turn' as string]:`${i%2?640:-580}deg`}}/>)}</div>}
    <div className="mindset-coach-cluster" data-popover-below={mobileBelow?"true":"false"} data-under-controls={mobileTop!==null?"true":"false"} data-panel-open={rightPanelOpen?'true':'false'} style={{'--coach-mobile-bottom':`${mobileBottom}px`,...(mobileTop!==null?{'--coach-mobile-top':`${mobileTop}px`}:{})} as React.CSSProperties}>
    <button data-panel-open={rightPanelOpen?'true':'false'} className={`mindset-coach-dock ${moment?.kind==='affirm'||moment?.kind==='win'?'is-happy':''} ${!prefs.coachEnabled?'is-paused':''}`} aria-label="Open psychology coach" title={prefs.coachEnabled?'Michael, your psychology coach · Click for options':'Michael (Coach paused) · Click to enable'} onClick={onOpen}><CoachFace mood={moment?.kind||'idle'}/><span className="mindset-coach-dot"/></button>
    {open && <div className="mindset-menu" ref={panel} role="dialog" aria-label="Mindset options">
      <header><span><CoachFace/>Michael · Psychology coach</span><button autoFocus aria-label="Close mindset options" onClick={onClose}><X size={16}/></button></header>
      <button className="mindset-plan-toggle" onClick={()=>{setNote(n=>({...n,pinned:!n.pinned}));onClose();}}><StickyNote size={17}/><span>{note.pinned?'Hide sticky note':'Show my trading plan'}<small>Drag to move or resize. Always saved.</small></span><Pin size={13}/></button>
      <label className="mindset-toggle"><span><strong>Michael · Your psychology coach</strong><small>Guides you, checks in on entries, wins & losses, and helps you follow your plan.</small></span><input aria-label="Psychology coach" type="checkbox" checked={prefs.coachEnabled} onChange={e=>setPrefs(p=>({...p,coachEnabled:e.target.checked}))}/></label>
      <label className="mindset-toggle"><span><strong>Celebrate my wins</strong><small>A quick congratulations + confetti.</small></span><input aria-label="Celebrate my wins" type="checkbox" checked={prefs.celebrate} onChange={e=>setPrefs(p=>({...p,celebrate:e.target.checked}))}/></label>
      <div className="mindset-samples"><span>PREVIEW A NOTIFICATION</span><div><button onClick={()=>preview('entry')}>Plan check</button><button onClick={()=>preview('loss')}>Loss</button><button onClick={()=>preview('win')}><PartyPopper size={12}/>Win</button></div></div>
    </div>}
    {moment && <section data-panel-open={rightPanelOpen?'true':'false'} key={moment.id} className={`mindset-toast mindset-${moment.kind}`} role="status" aria-live="polite"><div className="mindset-toast-copy">{moment.preview&&<small>PREVIEW</small>}<strong>{moment.title}</strong><p>{moment.body}</p>{moment.kind==='entry'&&<div className="mindset-toast-actions"><button onClick={confirmPlan}>Yes <Check size={12}/></button><button className="mindset-no" onClick={declinePlan}>No</button><button onClick={()=>{setNote(n=>({...n,pinned:true}));}}>View plan</button></div>}{moment.kind==='entry'&&<small className="mindset-trade-context">Check-in for your open trade. Take your time to answer.</small>}{moment.kind==='reset'&&<div className="mindset-toast-actions"><button onClick={()=>{setNote(n=>({...n,pinned:true}));}}>Review my plan</button><button onClick={()=>dispatchCoach({type:'dismiss'})}>Got it</button></div>}<button className="mindset-disable-coach" onClick={()=>{setPrefs(p=>({...p,coachEnabled:false}));dispatchCoach({type:'disable'});}}>Disable coach</button></div><button className="mindset-dismiss" aria-label="Dismiss mindset message" onClick={()=>dispatchCoach({type:'dismiss'})}><X size={14}/></button></section>}
    </div>
  </>;
}
