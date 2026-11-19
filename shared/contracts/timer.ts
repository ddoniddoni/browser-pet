import { t } from '../i18n';
// 초 단위 카운터를 저장하지 않는다. 워커가 잠들어도 같은 마감 시각으로 복원한다.
export type TimerMode = 'focus' | 'exam';
export const timerModes = { focus: { title: t('focus'), minutes: 25 }, exam: { title: t('exam'), minutes: 50 } } as const;
export const maxMinutes = 180;
export const finishBubbleMs = 8_000;
type Common = { token: string; mode: TimerMode; minutes: number; startedAt: number };
export type StudyTimer = Common & ({ phase: 'running'; endsAt: number } | { phase: 'paused'; remainingMs: number });
export type TimerAction =
  | { action: 'start'; mode: TimerMode; minutes: number }
  | { action: 'pause' | 'resume' | 'clear'; token: string };

const counter = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const mode = (v: unknown): v is TimerMode => v === 'focus' || v === 'exam';
const token = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128 && v.trim() === v;
export const validMinutes = (v: unknown): v is number => counter(v) && v >= 1 && v <= maxMinutes;

export function isStudyTimer(v: unknown): v is StudyTimer {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  return Object.keys(x).length === 6 && token(x.token) && mode(x.mode) && validMinutes(x.minutes) && counter(x.startedAt) &&
    (x.phase === 'running' ? counter(x.endsAt) && x.endsAt >= x.startedAt :
      x.phase === 'paused' && counter(x.remainingMs) && x.remainingMs > 0 && x.remainingMs <= x.minutes * 60_000);
}
export function isTimerAction(x: Record<string, unknown>): x is Record<string, unknown> & TimerAction {
  return x.action === 'start' ? Object.keys(x).length === 3 && mode(x.mode) && validMinutes(x.minutes) :
    Object.keys(x).length === 2 && (x.action === 'pause' || x.action === 'resume' || x.action === 'clear') && token(x.token);
}
export function formatTimerClock(seconds: number) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  return minutes + ':' + String(seconds % 60).padStart(2, '0');
}

export function timeLeft(timer: StudyTimer, now: number) {
  return timer.phase === 'paused' ? timer.remainingMs : Math.max(0, Math.min(timer.minutes * 60_000, timer.endsAt - now));
}
// undefined: 오래된 조작을 거절한다. null: 사용자가 세션을 지웠다.
export function changeTimer(current: StudyTimer | undefined, op: TimerAction, now: number, nextToken: string): StudyTimer | null | undefined {
  if (op.action === 'start') {
    if (current || !validMinutes(op.minutes)) return undefined;
    return { token: nextToken, mode: op.mode, minutes: op.minutes, startedAt: now, phase: 'running', endsAt: now + op.minutes * 60_000 };
  }
  if (!current || op.token !== current.token) return undefined;
  if (op.action === 'clear') return null;
  const base = { mode: current.mode, minutes: current.minutes, startedAt: current.startedAt, token: nextToken };
  const remainingMs = timeLeft(current, now);
  if (op.action === 'pause' && current.phase === 'running' && remainingMs > 0) return { ...base, phase: 'paused', remainingMs };
  if (op.action === 'resume' && current.phase === 'paused') return { ...base, phase: 'running', endsAt: Math.max(now, current.startedAt) + remainingMs };
  return undefined;
}

// 고정 좌표는 건드리지 않고 산책의 시계만 멈춘다. 도중에 새로 놓은 자리는 새 기준으로 삼는다.
export function patrolDelay(timer: StudyTimer | undefined, anchorAt: number, now: number) {
  if (!timer) return 0;
  const until = timer.phase === 'paused' ? now : Math.min(now, timer.endsAt);
  return Math.max(0, until - Math.max(anchorAt, timer.startedAt));
}
