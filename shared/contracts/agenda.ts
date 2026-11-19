import { t } from '../i18n';

export type AlarmRule =
  | { repeat: 'once' | 'daily' | 'weekdays' }
  | { repeat: 'weekly'; weekday: number } // Local Sunday = 0.
  | { repeat: 'monthly'; monthDay: number }; // The user's choice, even after a short month.
export type Repeat = AlarmRule['repeat'];
export type AlarmDraft = { id: string; title: string; time: string; date: string } & AlarmRule;
export type PetAlarm = AlarmDraft & { enabled: boolean };
export type Ring = { id: string; title: string; due: number; fired: number };
// payday is read only for compatibility with earlier v4 profiles. It never schedules an alarm.
export type Occurrence = Pick<Ring, 'id' | 'due'>;
export type Agenda = { payday: number | null; alarms: PetAlarm[]; recent: Ring[]; pending?: Ring[] };
export const emptyAgenda: Agenda = { payday: null, alarms: [], recent: [] };
export const alarmLimit = 32;
export const freshWindow = 15 * 60_000;
export type AgendaChange =
  | { op: 'save'; alarm: AlarmDraft }
  | { op: 'switch'; id: string; enabled: boolean }
  | { op: 'remove'; id: string };

const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const keys = (x: Record<string, unknown>, n: number) => Object.keys(x).length === n;
const idOK = (x: unknown): x is string => typeof x === 'string' && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(x);
const titleOK = (x: unknown): x is string => typeof x === 'string' && x === x.trim() && x.length > 0 && x.length <= 60 && !/[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u.test(x);
const dayOK = (x: unknown) => x === null || (typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 31);
const stampOK = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x > 0;
const pad = (n: number) => String(n).padStart(2,'0');
export function localDay(d: Date): string {
  return [d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
}
function dayDate(date: string) {
  // Reject malformed dates by round-tripping the resulting local day in validDraft.
  const y=Number(date.slice(0,4)), m=Number(date.slice(5,7)), d=Number(date.slice(8,10));
  return new Date(y,m-1,d,12);
}
function validRule(x: Record<string, unknown>) {
  if (x.repeat === 'weekly') return Number.isInteger(x.weekday) && Number(x.weekday) >= 0 && Number(x.weekday) <= 6;
  if (x.repeat === 'monthly') return x.monthDay !== null && dayOK(x.monthDay);
  return x.repeat === 'once' || x.repeat === 'daily' || x.repeat === 'weekdays';
}
function ruleFields(x: Record<string, unknown>) {
  return x.repeat === 'weekly' || x.repeat === 'monthly' ? 1 : 0;
}
function validDraft(x: unknown): x is AlarmDraft {
  return record(x) && idOK(x.id) && titleOK(x.title) && typeof x.time === 'string' &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x.time) && validRule(x) &&
    typeof x.date === 'string' && /^[1-9]\d{3}-\d\d-\d\d$/.test(x.date) && localDay(dayDate(x.date)) === x.date;
}
export function validAgendaChange(x: unknown): x is AgendaChange {
  if (!record(x)) return false;
  return (x.op === 'save' && keys(x,2) && record(x.alarm) && keys(x.alarm,5+ruleFields(x.alarm)) && validDraft(x.alarm)) ||
    (x.op === 'switch' && keys(x,3) && idOK(x.id) && typeof x.enabled === 'boolean') ||
    (x.op === 'remove' && keys(x,2) && idOK(x.id));
}
function validRing(r: unknown): r is Ring {
  return record(r) && keys(r,4) && idOK(r.id) && titleOK(r.title) &&
    stampOK(r.due) && stampOK(r.fired) && r.fired>=r.due;
}
export function validOccurrence(x: unknown): x is Occurrence {
  return record(x) && keys(x,2) && idOK(x.id) && stampOK(x.due);
}
export function ringKey(r: Occurrence) { return r.id + ':' + r.due; }
export function validAgenda(x: unknown): x is Agenda {
  if (!record(x)) return false;
  const hasPending = Object.hasOwn(x,'pending');
  return keys(x,hasPending ? 4 : 3) && dayOK(x.payday) && Array.isArray(x.alarms) && x.alarms.length<=alarmLimit &&
    x.alarms.every(a=>record(a) && keys(a,6+ruleFields(a)) && typeof a.enabled==='boolean' && validDraft(a)) &&
    new Set(x.alarms.map(a=>a.id)).size===x.alarms.length && Array.isArray(x.recent) && x.recent.length<=alarmLimit &&
    x.recent.every(validRing) && (!hasPending || (Array.isArray(x.pending) && x.pending.every(validRing) &&
      new Set(x.pending.map(ringKey)).size===x.pending.length));
}
export function dismissOccurrence(base: Agenda, occurrence: Occurrence): Agenda {
  const pending=base.pending?.filter(r=>r.id!==occurrence.id || r.due!==occurrence.due);
  return pending && pending.length!==base.pending?.length ? {...base,pending} : base;
}
export function dueAt(a: Pick<AlarmDraft,'date'|'time'>) {
  const d = dayDate(a.date);
  const h=Number(a.time.slice(0,2)), m=Number(a.time.slice(3,5));
  return d.setHours(h,m,0,0);
}
function matchesDay(a: AlarmDraft, d: Date) {
  if (a.repeat === 'weekdays') return d.getDay() !== 0 && d.getDay() !== 6;
  if (a.repeat === 'weekly') return d.getDay() === a.weekday;
  if (a.repeat === 'monthly') {
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    return d.getDate() === Math.min(a.monthDay, last);
  }
  return true;
}
function repeatDay(a: AlarmDraft, now: number, direction: 1 | -1): string {
  const d = new Date(now);
  // Calendar days, not multiples of 24h: local times survive daylight-saving changes.
  d.setHours(12,0,0,0);
  for (;;) {
    const date = localDay(d), at = dueAt({ date, time:a.time });
    if (matchesDay(a,d) &&
        (direction===1 ? at>now : at<=now)) return date;
    d.setDate(d.getDate()+direction);
  }
}
// Used both by the editor preview and the saved schedule.
export function nextAlarmDate(a: AlarmDraft, now: number) {
  return a.repeat==='once' ? a.date : repeatDay(a,now,1);
}
export function changeAgenda(base: Agenda, edit: AgendaChange, now: number): Agenda {
  if (edit.op==='remove') return { ...base, alarms:base.alarms.filter(a=>a.id!==edit.id), recent:base.recent.filter(r=>r.id!==edit.id) };
  const id = edit.op==='save' ? edit.alarm.id : edit.id;
  const old = base.alarms.find(a=>a.id===id);
  if (edit.op==='switch' && !old) throw new Error(t('agendaGone'));
  if (!old && base.alarms.length>=alarmLimit) throw new Error(t('agendaLimit',alarmLimit));
  const alarm: PetAlarm = edit.op==='save' ? { ...edit.alarm, enabled:true } : { ...old!, enabled:edit.enabled };
  if (alarm.enabled) {
    if (alarm.repeat==='once' && dueAt(alarm)<=now) throw new Error(t('agendaFuture'));
    alarm.date=nextAlarmDate(alarm,now);
  }
  return { ...base, alarms: old ? base.alarms.map(a=>a.id===id ? alarm : a) : [...base.alarms,alarm] };
}
export function ringDue(base: Agenda, now: number) {
  const events: Ring[] = [];
  const alarms = base.alarms.map(a=>{
    if (!a.enabled || dueAt(a)>now) return a;
    const once=a.repeat==='once', date=once ? a.date : repeatDay(a,now,-1);
    events.push({ id:a.id, title:a.title, due:dueAt({...a,date}), fired:now });
    return once ? {...a,enabled:false} : {...a,date:repeatDay(a,now,1)};
  });
  events.sort((a,b)=>b.due-a.due);
  if (!events.length) return {events,agenda:base};
  // 기록(최근 32건)과 미확인함은 별개다. 표시하지 않았던 과거 기록을 다시 울리지 않는다.
  const pending=[...(base.pending ?? [])], queued=new Set(pending.map(ringKey));
  const arrivals=events.filter(r=>r.fired-r.due<=freshWindow).sort((a,b)=>a.due-b.due);
  for (const ring of arrivals) {
    const key=ringKey(ring);
    if (!queued.has(key)) { pending.push(ring); queued.add(key); }
  }
  return { events, agenda:{ ...base, alarms, pending, recent:[...events,...base.recent].slice(0,alarmLimit) } };
}
export function nextWake(agenda: Agenda, now: number) {
  const times=agenda.alarms.filter(a=>a.enabled).map(dueAt);
  if (!times.length) return;
  const midnight=new Date(now);midnight.setHours(24,0,0,0);
  return Math.min(+midnight,...times);
}
