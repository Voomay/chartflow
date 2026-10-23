const prefix = 'chart_replay_motivation_v1:';
const seenInMemory = new Set<string>();
export const encouragements = [
  {title: 'One chart. One clear plan.', message: 'Take a breath, trust your preparation, and give yourself time to learn. You do not have to rush your progress.', focus: 'Focus on the process'},
  {title: 'Small steps build real confidence.', message: 'Every session is a chance to notice something new. Stay curious, practise patiently, and let the lessons add up.', focus: 'Learn one thing today'},
  {title: 'Patience is part of your edge.', message: 'You can wait, observe, and choose your moment. A calm decision is a step forward, even when that decision is to pause.', focus: 'Clarity before action'},
  {title: 'Progress starts with showing up.', message: 'You are here to practise, and that matters. Bring your focus to this session, one careful decision at a time.', focus: 'One decision at a time'},
  {title: 'A fresh session. A fresh perspective.', message: 'Leave the last result behind. Take what you learned, reset your focus, and make room for a little more progress today.', focus: 'Reset. Refocus. Learn.'},
  {title: 'Give yourself room to grow.', message: 'You do not need a perfect session to learn something valuable. Follow your plan, reflect honestly, and keep going.', focus: 'Practice over perfection'},
];
export function motivationEnabled(userKey: string): boolean {
  try { return localStorage.getItem(prefix + userKey + ':enabled') !== '0'; } catch { return true; }
}
export function setMotivationEnabled(userKey: string, enabled: boolean): void {
  try { localStorage.setItem(prefix + userKey + ':enabled', enabled ? '1' : '0'); } catch { /* Optional preference. */ }
}
export function resetMotivationVisit(userKey: string): void {
  seenInMemory.delete(userKey);
  try { sessionStorage.removeItem(prefix + userKey + ':seen'); } catch { /* Memory fallback. */ }
}
// Claim only when actually presented, so setup dialogs do not consume the welcome.
export function claimMotivation(userKey: string): typeof encouragements[number] | null {
  if (!motivationEnabled(userKey) || seenInMemory.has(userKey)) return null;
  try { if (sessionStorage.getItem(prefix + userKey + ':seen')) return null; } catch { /* Memory fallback. */ }
  let index = 0;
  try {
    const saved = Number(localStorage.getItem(prefix + userKey + ':next') || 0);
    if (Number.isSafeInteger(saved) && saved >= 0) index = saved % encouragements.length;
    localStorage.setItem(prefix + userKey + ':next', String((index + 1) % encouragements.length));
  } catch { /* The first message remains available without storage. */ }
  seenInMemory.add(userKey);
  try { sessionStorage.setItem(prefix + userKey + ':seen', '1'); } catch { /* Memory fallback. */ }
  return encouragements[index];
}
