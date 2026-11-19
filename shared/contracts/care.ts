// 시간 경과는 필요할 때 계산한다. 화면의 미리보기는 저장 기준을 변경하지 않는다.
export interface CareState {
  satiety: number;
  mood: number;
  xp: number;
  lastSettledAt: number;
  lastFedAt: number | null;
  lastPetRewardAt: number | null;
}

export type CareAction = 'feed' | 'pet';
export type CareReward = 'granted' | 'waiting';
const hour = 3_600_000;
export const careRules = {
  feed: { cooldownMs: 600_000, xp: 5, points: 20 },
  pet: { cooldownMs: 60_000, xp: 2, points: 10 },
} as const;

export function createCare(now: number, initial = { satiety: 70, mood: 70 }): CareState {
  return { ...initial, xp: 0, lastSettledAt: now, lastFedAt: null, lastPetRewardAt: null };
}

export function isCareState(value: unknown): value is CareState {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 6) return false;
  const data = value as Record<string, unknown>;
  const counter = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  const gauge = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
  const at = data.lastSettledAt;
  if (!counter(at)) return false;
  const timestamp = (v: unknown) => v === null || (counter(v) && v <= at);
  return gauge(data.satiety) && gauge(data.mood) && counter(data.xp) &&
    timestamp(data.lastFedAt) && timestamp(data.lastPetRewardAt);
}

export function settleCare(care: CareState, now: number): CareState {
  const at = Math.max(care.lastSettledAt, now);
  if (at === care.lastSettledAt) return care;
  const hours = Math.min(8, (at - care.lastSettledAt) / hour);
  return { ...care, lastSettledAt: at, satiety: Math.max(0, care.satiety - 4 * hours),
    mood: Math.max(0, care.mood - 2 * hours) };
}

export function rewardCare(care: CareState, action: CareAction, now: number) {
  const settled = settleCare(care, now);
  const stamp = action === 'feed' ? 'lastFedAt' : 'lastPetRewardAt';
  const last = settled[stamp], rule = careRules[action];
  if (last !== null && settled.lastSettledAt - last < rule.cooldownMs) return { care: settled, rewarded: false };
  const stat = action === 'feed' ? 'satiety' : 'mood';
  return { care: { ...settled, [stamp]: settled.lastSettledAt, [stat]: Math.min(100, settled[stat] + rule.points),
    xp: Math.min(Number.MAX_SAFE_INTEGER, settled.xp + rule.xp) }, rewarded: true };
}
