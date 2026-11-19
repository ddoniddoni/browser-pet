import { expect,it } from 'vitest';
import { changeAgenda, dismissOccurrence, emptyAgenda, nextWake, validAgenda, validAgendaChange, ringDue, type AlarmDraft } from '../../shared/contracts/agenda';
import { envelope,parseCommand } from '../../shared/contracts/commands';

const common={id:crypto.randomUUID(),title:'물 주기',date:'2028-01-01',time:'09:00'};
it('stores the original month day through February and rings once per occurrence',()=>{
  for(const [year,last] of [[2027,28],[2028,29]] as const) {
    const due=+new Date(year,1,last,9), march=year+'-03-31';
    const alarm:AlarmDraft={...common,repeat:'monthly',monthDay:31};
    const agenda=changeAgenda({...emptyAgenda,payday:25},{op:'save',alarm},+new Date(year,0,31,10));
    expect(agenda.alarms[0]?.date).toBe(year+'-02-'+last);
    expect(validAgenda(agenda)).toBe(true);
    const fired=ringDue(agenda,due);
    expect(fired.events.map(e=>e.due)).toEqual([due]);
    expect(fired.agenda.alarms[0]).toMatchObject({date:march,monthDay:31});
    expect(ringDue(fired.agenda,due+1).events).toEqual([]);
  }
});
it('resumes on the chosen weekday across New Year and skips missed weeks',()=>{
  const alarm:AlarmDraft={...common,repeat:'weekly',weekday:1};
  let agenda=changeAgenda(emptyAgenda,{op:'save',alarm},+new Date(2026,11,28,9));
  expect(agenda.alarms[0]?.date).toBe('2027-01-04');
  agenda=changeAgenda(agenda,{op:'switch',id:alarm.id,enabled:false},+new Date(2027,0,3));
  expect(nextWake(agenda,+new Date(2027,0,3))).toBeUndefined();
  agenda=changeAgenda(agenda,{op:'switch',id:alarm.id,enabled:true},+new Date(2027,0,5));
  expect(agenda.alarms[0]?.date).toBe('2027-01-11');
  const late=ringDue(agenda,+new Date(2027,0,28,10));
  expect(late.events.map(e=>e.due)).toEqual([+new Date(2027,0,25,9)]);
  expect(late.agenda.alarms[0]?.date).toBe('2027-02-01');
});
it('reads old profiles without scheduling a payday; accepts only fields for the selected repeat',()=>{
  expect(validAgenda({...emptyAgenda,payday:17,alarms:[{...common,repeat:'daily',enabled:true}]})).toBe(true);
  expect(nextWake({...emptyAgenda,payday:17},Date.now())).toBeUndefined();
  for(const rule of [{repeat:'monthly'}, {repeat:'monthly',monthDay:32},{repeat:'weekly',weekday:7},{repeat:'daily',weekday:0}])
    expect(validAgendaChange({op:'save',alarm:{...common,...rule}})).toBe(false);
});
it('같은 시각의 두 알람을 한 번씩 기록하고 평일 예약은 월요일에 재개한다',()=>{
  const friday=+new Date(2026,10,20,8,59), due=+new Date(2026,10,20,9);
  const base:AlarmDraft={id:crypto.randomUUID(),title:'A',time:'09:00',date:'2026-11-20',repeat:'once'};
  let agenda=changeAgenda(emptyAgenda,{op:'save',alarm:base},friday);
  agenda=changeAgenda(agenda,{op:'save',alarm:{...base,id:crypto.randomUUID(),repeat:'weekdays',title:'B'}},friday);
  const fired=ringDue(agenda,due+2000);
  expect(fired.events.map(e=>e.title).sort()).toEqual(['A','B']);
  expect(fired.agenda.alarms.map(a=>[a.enabled,a.date])).toEqual([[false,'2026-11-20'],[true,'2026-11-23']]);
  expect(ringDue(fired.agenda,due+4000).events).toEqual([]);
});
it('알람 변경은 확장 창에서만 받는다',()=>{
  const base={...envelope,type:'AGENDA_CHANGE',expectedPetId:'pet',requestId:'edit'};
  expect(parseCommand({...base,payload:{op:'payday',day:25}},'content')).toMatchObject({ok:false,code:'FORBIDDEN'});
  const message={...base,payload:{op:'remove',id:crypto.randomUUID()}};
  expect(parseCommand(message,'content')).toMatchObject({ok:false,code:'FORBIDDEN'});
  expect(parseCommand(message,'popup')).toMatchObject({type:'AGENDA_CHANGE'});
});

it('미확인 회차는 최근 기록이 바뀌어도 쌓이고 확인은 같은 반복 알람의 다음 회차를 건드리지 않는다',()=>{
  const due=+new Date(2028,0,1,9);
  const first=changeAgenda(emptyAgenda,{op:'save',alarm:{...common,repeat:'daily'}},due-10_000);
  const another={...common,id:crypto.randomUUID(),title:'회의',repeat:'once'} as const;
  const both=changeAgenda(first,{op:'save',alarm:another},due-5_000);
  let saved=ringDue(both,due).agenda;
  for(let n=1;n<=32;n++) saved=ringDue(saved,+new Date(2028,0,1+n,9)).agenda;
  expect(saved.recent).toHaveLength(32);
  const original=saved.pending!;
  expect(original).toHaveLength(34);
  expect(original.slice(0,2).map(r=>r.title)).toEqual([common.title,'회의']);
  const closed=dismissOccurrence(structuredClone(saved),original[0]!);
  expect(closed.pending).toEqual(original.slice(1));
  expect(closed.alarms).toEqual(saved.alarms);
  expect(closed.recent).toEqual(saved.recent);
  expect(dismissOccurrence(closed,original[0]!)).toBe(closed);
  expect(validAgenda(closed)).toBe(true);
});
it('갱신 전 기록과 절전 중 15분 넘게 지난 알람은 미확인함에 되살리지 않는다',()=>{
  const due=+new Date(2028,0,1,9);
  const old={...emptyAgenda,recent:[{id:common.id,title:'예전 알람',due:due-100_000,fired:due-99_000}]};
  const late=ringDue(changeAgenda(old,{op:'save',alarm:{...common,repeat:'once'}},due-1),due+16*60_000).agenda;
  expect(late.recent).toHaveLength(2);
  expect(late.pending).toEqual([]);
});
it('페이지에서는 특정 회차 확인만 할 수 있고 전체 확인이나 예약 변경은 허용하지 않는다',()=>{
  const ack={...envelope,type:'AGENDA_DISMISS',expectedPetId:'pet',requestId:'ack',payload:{id:common.id,due:1234}};
  expect(parseCommand(ack,'content')).toMatchObject({type:'AGENDA_DISMISS',payload:ack.payload});
  expect(parseCommand({...ack,payload:{id:common.id}},'content')).toMatchObject({ok:false});
  expect(parseCommand({...ack,payload:{...ack.payload,all:true}},'content')).toMatchObject({ok:false});
  expect(parseCommand(ack,'options')).toMatchObject({ok:false,code:'FORBIDDEN'});
});
