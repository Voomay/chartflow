import { syncUserPreferencesToSupabase } from './supabaseClient';

const prefix = 'chart_replay_motivation_v1:';
const seenInMemory = new Set<string>();
const memoryMotivationStore = new Map<string, string>();

function isTestEnvironment(): boolean {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env || {};
  return env.MODE === 'test' || Boolean(env.VITEST);
}

function normalizeUserKey(userKey: string): string {
  return encodeURIComponent((userKey || 'guest').trim().toLowerCase());
}

function readStore(key: string): string | null {
  if (isTestEnvironment()) {
    try {
      if (typeof localStorage !== 'undefined') {
        const fromLocal = localStorage.getItem(key);
        if (fromLocal !== null) {
          memoryMotivationStore.set(key, fromLocal);
          return fromLocal;
        }
      }
    } catch { /* ignore */ }
  }
  try {
    const fromMem = memoryMotivationStore.get(key);
    if (fromMem !== undefined) return fromMem;
  } catch { /* ignore */ }
  return null;
}

function writeStore(key: string, value: string): void {
  try { memoryMotivationStore.set(key, value); } catch { /* ignore */ }
  if (isTestEnvironment()) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch { /* ignore */ }
  }
}

function deleteStore(key: string): void {
  try { memoryMotivationStore.delete(key); } catch { /* ignore */ }
  if (isTestEnvironment()) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch { /* ignore */ }
  }
}

function readUserStore(userKey: string, suffix: string): string | null {
  const norm = normalizeUserKey(userKey);
  const val = readStore(`${prefix}${norm}:${suffix}`);
  if (val !== null) return val;
  if (norm !== userKey) {
    return readStore(`${prefix}${userKey}:${suffix}`);
  }
  return null;
}

function writeUserStore(userKey: string, suffix: string, value: string): void {
  const norm = normalizeUserKey(userKey);
  writeStore(`${prefix}${norm}:${suffix}`, value);
  if (norm !== userKey) {
    try { memoryMotivationStore.set(`${prefix}${userKey}:${suffix}`, value); } catch { /* ignore */ }
  }
}

function deleteUserStore(userKey: string, suffix: string): void {
  const norm = normalizeUserKey(userKey);
  deleteStore(`${prefix}${norm}:${suffix}`);
  if (norm !== userKey) {
    deleteStore(`${prefix}${userKey}:${suffix}`);
  }
}

export const encouragements = [
  {title: 'One chart. One clear plan.', message: 'Take a breath, trust your preparation, and give yourself time to learn. You do not have to rush your progress.', focus: 'Focus on the process'},
  {title: 'Small steps build real confidence.', message: 'Every session is a chance to notice something new. Stay curious, practise patiently, and let the lessons add up.', focus: 'Learn one thing today'},
  {title: 'Patience is part of your edge.', message: 'You can wait, observe, and choose your moment. A calm decision is a step forward, even when that decision is to pause.', focus: 'Clarity before action'},
  {title: 'Progress starts with showing up.', message: 'You are here to practise, and that matters. Bring your focus to this session, one careful decision at a time.', focus: 'One decision at a time'},
  {title: 'A fresh session. A fresh perspective.', message: 'Leave the last result behind. Take a breath, look for your plan, and trade your plan one setup at a time.', focus: 'Pause. Refocus. Learn.'},
  {title: 'Give yourself room to grow.', message: 'You do not need a perfect session to learn something valuable. Follow your plan, reflect honestly, and keep going.', focus: 'Practice over perfection'},
];
export function motivationEnabled(userKey: string): boolean {
  try { return readUserStore(userKey, 'enabled') !== '0'; } catch { return true; }
}
export function setMotivationEnabled(userKey: string, enabled: boolean, syncRemote = true): void {
  writeUserStore(userKey, 'enabled', enabled ? '1' : '0');
  if (syncRemote && userKey && userKey !== 'guest') {
    void syncUserPreferencesToSupabase(userKey, { skipWelcome: !enabled });
  }
}
export function markReturningLogin(userKey: string, isReturning = true): void {
  if (!userKey) return;
  writeUserStore(userKey, 'returning', isReturning ? '1' : '0');
  if (isReturning) {
    writeUserStore(userKey, 'welcomed_once', '1');
  }
}
export function isReturningLogin(userKey: string): boolean {
  if (!userKey) return false;
  const explicit = readUserStore(userKey, 'returning');
  if (explicit === '1') return true;
  if (explicit === '0') return false;
  return readUserStore(userKey, 'welcomed_once') === '1';
}
export function markCoachIntroSeen(userKey: string): void {
  if (!userKey) return;
  writeUserStore(userKey, 'welcomed_once', '1');
}
export function resetMotivationVisit(userKey: string, isReturning?: boolean): void {
  const norm = normalizeUserKey(userKey);
  seenInMemory.delete(norm);
  seenInMemory.delete(userKey);
  deleteUserStore(userKey, 'seen');
  if (typeof isReturning === 'boolean') {
    markReturningLogin(userKey, isReturning);
  }
}
// Claim only when actually presented, so setup dialogs do not consume the welcome.
export function claimMotivation(userKey: string): typeof encouragements[number] | null {
  const norm = normalizeUserKey(userKey);
  if (!motivationEnabled(userKey) || seenInMemory.has(norm) || seenInMemory.has(userKey)) return null;
  if (readUserStore(userKey, 'seen') === '1') return null;
  let index = 0;
  try {
    const saved = Number(readUserStore(userKey, 'next') || 0);
    if (Number.isSafeInteger(saved) && saved >= 0) index = saved % encouragements.length;
    writeUserStore(userKey, 'next', String((index + 1) % encouragements.length));
  } catch { /* The first message remains available without storage. */ }
  seenInMemory.add(norm);
  seenInMemory.add(userKey);
  writeUserStore(userKey, 'seen', '1');
  return encouragements[index];
}
