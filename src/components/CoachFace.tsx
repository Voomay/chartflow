import React,{useId} from 'react';
import {CoachMoment} from '../services/coachMessages';

// A code-native mascot keeps the face crisp at every size without image downloads.
export function CoachFace({mood='idle'}:{mood?:CoachMoment|'idle'}){
  const happy=mood==='win'||mood==='affirm';
  const id=useId().replace(/:/g,'');
  return <svg className={`coach-face coach-face-${mood}`} viewBox="0 0 72 72" fill="none" role="img" aria-label="Friendly trading coach">
    <defs><linearGradient id={`shell-${id}`} x1="17" y1="9" x2="60" y2="66" gradientUnits="userSpaceOnUse"><stop stopColor="#C6FFF0"/><stop offset=".55" stopColor="#56D5BC"/><stop offset="1" stopColor="#249C94"/></linearGradient><linearGradient id={`screen-${id}`} x1="20" y1="24" x2="52" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#153F44"/><stop offset="1" stopColor="#142C3C"/></linearGradient></defs>
    <path d="M36 9v8" stroke="#6AD6BF" strokeWidth="3" strokeLinecap="round"/><circle cx="36" cy="8" r="4" fill="#BBF5D9"/><circle cx="36" cy="8" r="2" fill="#49BFA5"/>
    <rect x="7" y="32" width="7" height="17" rx="3.5" fill="#4EB5AC"/><rect x="58" y="32" width="7" height="17" rx="3.5" fill="#4EB5AC"/>
    <rect x="12" y="17" width="48" height="45" rx="18" fill={`url(#shell-${id})`}/><path d="M21 22c6-4 15-4 23-2" stroke="white" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round"/>
    <rect x="17" y="25" width="38" height="29" rx="12" fill={`url(#screen-${id})`}/>
    <g className="coach-eyes">{happy?<><path d="m24 36 4-3 4 3M40 36l4-3 4 3" stroke="#B3FFE7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></>:<><rect x="25" y="32" width="5" height="8" rx="2.5" fill="#B3FFE7"/><rect x="42" y="32" width="5" height="8" rx="2.5" fill="#B3FFE7"/></>}</g>
    <ellipse cx="23" cy="42" rx="3" ry="1.5" fill="#EC9FAF" fillOpacity=".55"/><ellipse cx="49" cy="42" rx="3" ry="1.5" fill="#EC9FAF" fillOpacity=".55"/>
    <path d={happy?'M30 42q6 9 12 0Z':'M31 44q5 5 10 0'} stroke="#B3FFE7" fill={happy?'#B3FFE7':'none'} strokeWidth="2" strokeLinecap="round"/>
    <path d="m30 62 6 5 6-5" fill="#4CBDAD"/>
    {mood==='win'&&<><path d="m61 14 1.5 4.5L67 20l-4.5 1.5L61 26l-1.5-4.5L55 20l4.5-1.5L61 14Z" fill="#F5C34C"/><circle cx="8" cy="18" r="2" fill="#B8A2F1"/></>}
  </svg>;
}
