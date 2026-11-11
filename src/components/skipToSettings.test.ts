import { describe, expect, it } from 'vitest';
import { defaultSkipSettings, resolveSkipSettings } from './ReplayAndSessionsDock';
import type { TradingSession } from '../types/trading';

const session = (overrides: Partial<TradingSession> = {}): TradingSession =>
  ({
    id: 'session-1',
    mode: 'BACKTESTING',
    replayTimestamp: Math.floor(Date.parse('2026-10-05T08:00:00Z') / 1000),
    ...overrides,
  }) as unknown as TradingSession;

describe('Skip To settings persistence', () => {
  it('defaults to 10:00 when a session has no saved settings', () => {
    const s = defaultSkipSettings(session());
    expect(s.customSkipTime).toBe('10:00');
    expect(s.exactTimePinned).toBe(false);
  });

  it('restores a saved 09:15 instead of the 10:00 default', () => {
    const saved = {
      customSkipTime: '09:15',
      customSkipTz: 'Africa/Johannesburg',
      quickSkipTarget: 'DAILY_TIME' as const,
      exactSkipDate: '2026-10-06',
      exactSkipTime: '09:15',
      exactSkipTz: 'UTC' as const,
      exactTimePinned: true,
    };
    const s = resolveSkipSettings(session({ skipToSettings: saved }));
    expect(s.customSkipTime).toBe('09:15');
    expect(s.exactSkipTime).toBe('09:15');
    expect(s.exactSkipDate).toBe('2026-10-06');
    expect(s.exactTimePinned).toBe(true);
  });

  it('restores saved settings on a prop-firm challenge session too', () => {
    const s = resolveSkipSettings(
      session({
        id: 'challenge-2',
        mode: 'PROP_FIRM',
        skipToSettings: {
          customSkipTime: '09:15',
          customSkipTz: 'UTC',
          quickSkipTarget: 'NEW_YORK',
          exactSkipDate: '2026-10-12',
          exactSkipTime: '09:15',
          exactSkipTz: 'UTC',
          exactTimePinned: true,
        },
      })
    );
    expect(s.customSkipTime).toBe('09:15');
    expect(s.quickSkipTarget).toBe('NEW_YORK');
  });

  it('falls back safely when stored values are corrupt', () => {
    const s = resolveSkipSettings(
      session({
        skipToSettings: {
          customSkipTime: 'not-a-time',
          customSkipTz: '',
          quickSkipTarget: 'DAILY_TIME',
          exactSkipDate: 'bad',
          exactSkipTime: '99:99',
          exactSkipTz: 'Africa/Johannesburg',
        },
      })
    );
    expect(s.customSkipTime).toBe('10:00');
    expect(s.exactSkipDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(s.exactSkipTime).not.toBe('99:99');
  });
});
