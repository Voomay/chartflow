import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Compass} from 'lucide-react';
import {GuidedTour,TourCloseReason,TourStep} from './GuidedTour';
import type {HubSidebarSection} from './AnalyticsDashboardPage';

interface WorkspaceTourProps {
 userKey:string;name?:string;section:HubSidebarSection;isSessionSetupOpen:boolean;
 onNavigate:(section:HubSidebarSection)=>void;onOpenSessionSetup:()=>void;onCloseSessionSetup:()=>void;
}
export const WorkspaceTour:React.FC<WorkspaceTourProps>=({userKey,name,section,isSessionSetupOpen,onNavigate,onOpenSessionSetup,onCloseSessionSetup})=>{
 const [open,setOpen]=useState(false);
 const key=`chartflow_workspace_tour_v1:${encodeURIComponent(userKey.toLowerCase())}`;
 const firstName=name?.trim().split(/\s+/)[0];
 const steps=useMemo<TourStep[]>(()=>[
  {id:'welcome',title:`Greetings${firstName?`, ${firstName}`:''}.`,body:'Welcome to your trading workspace. Let’s take a quick look at creating a session, setting it up, reviewing your progress, and opening the charts.'},
  {id:'create',target:'hub-create',title:'Start with a new session',body:'Choose New session to build a practice workspace. Click the highlighted button, or use Skip step to preview the setup form.',advanceOn:'click',clickHint:'Click New session to see the form',placement:'right'},
  {id:'setup-mode',target:'setup-mode',title:'Choose how you want to practice',body:'Normal backtesting gives you replay practice. A prop challenge adds profit targets and drawdown rules. Choose the mode that fits your goal.',allowInteraction:true},
  {id:'setup-market',target:'setup-market',title:'Pick your instruments',body:'Choose the instruments you want to test. You can switch between these markets inside the session.',allowInteraction:true},
  {id:'setup-schedule',target:'setup-schedule',title:'Choose your dates and chart time zone',body:'Set your start date, end date, replay start time, and chart time zone. Use a date covered by the instrument’s available history.',allowInteraction:true},
  {id:'setup-details',target:'setup-details',title:'Give your session a clear plan',body:'Choose a starting balance and currency, then add a name and strategy. Your entries stay in the form; this tour won’t create a session for you.',allowInteraction:true},
  {id:'analytics',target:'hub-nav-analytics',title:'Review your progress',body:'Analytics shows your equity curve, outcomes, daily results, and losing streaks. Filter by session, instrument, or date to review what matters.',placement:'right'},
  {id:'notes',target:'hub-nav-notes',title:'Keep the lessons',body:'Your notebook is a space for setup reminders and observations. Notes save automatically for your account in this browser.',placement:'right'},
  {id:'charts',target:'hub-chart',title:'You’re ready for the charts',body:'Open Chart Workspace to continue your active session. To start fresh, finish this tour and create your session. The chart also has a Tour button for its trading tools.',placement:'bottom'},
 ],[firstName]);
 const start=()=>{onCloseSessionSetup();onNavigate('dashboard');setOpen(true);};
 const close=useCallback((reason:TourCloseReason)=>{
  try{localStorage.setItem(key,JSON.stringify({reason,at:new Date().toISOString()}));}catch{/* Manual replay still works when browser storage is unavailable. */}
  setOpen(false);onCloseSessionSetup();
 },[key,onCloseSessionSetup]);
 useEffect(()=>{
  if(section!=='dashboard'||open||isSessionSetupOpen)return;
  try{if(localStorage.getItem(key))return;}catch{return;}
  const timer=setTimeout(()=>setOpen(true),800);return()=>clearTimeout(timer);
 },[key,section,open,isSessionSetupOpen]);
 const changeStep=(step:TourStep)=>{
  if(step.id.startsWith('setup-')){if(!isSessionSetupOpen)onOpenSessionSetup();return;}
  onCloseSessionSetup();
  onNavigate(step.id==='analytics'?'analytics':step.id==='notes'?'notes':'dashboard');
 };
 return <><button type="button" onClick={start} title="Take a guided tour of your workspace" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/20"><Compass className="w-3.5 h-3.5"/><span className="hidden sm:inline">Tour</span></button><GuidedTour isOpen={open} onClose={close} steps={steps} onStepChange={changeStep}/></>;
};
