import { useEffect, useRef, useState } from 'react';
import { Chevron } from '../../components/Chevron';
import { dueAt, localDay, nextAlarmDate, type AgendaChange, type AlarmDraft, type AlarmRule, type Repeat } from '../../shared/contracts/agenda';
import { formatLocale, t } from '../../shared/i18n';

const cycles = { once:'agendaOnce', daily:'agendaDaily', weekdays:'agendaWeekdays', weekly:'agendaWeekly', monthly:'agendaMonthly' } as const;
export const shortDate = new Intl.DateTimeFormat(formatLocale,{month:'short',day:'numeric'});
export const clock = new Intl.DateTimeFormat(formatLocale,{hour:'2-digit',minute:'2-digit'});
const dayName = new Intl.DateTimeFormat(formatLocale,{weekday:'long'});
const weekdayName = (day:number) => dayName.format(new Date(2024,0,7+day,12));
export const when = (at:number) => shortDate.format(at)+' · '+clock.format(at);
export function scheduleText(a:AlarmDraft) {
  if (a.repeat==='once') return when(dueAt(a));
  const cycle = a.repeat==='monthly' ? t('agendaMonthDay',a.monthDay) :
    a.repeat==='weekly' ? t('agendaOnWeekday',weekdayName(a.weekday)) : t(cycles[a.repeat]);
  return cycle+' · '+clock.format(dueAt(a));
}

export function newAlarm(): AlarmDraft {
  const next=new Date(Date.now()+3_600_000);
  return {id:crypto.randomUUID(),title:'',repeat:'daily',time:String(next.getHours()).padStart(2,'0')+':00',date:localDay(next)};
}
export type Apply = (change:AgendaChange)=>Promise<boolean>;

export function AlarmEditor({initial,busy,apply,close}:{ initial:AlarmDraft;busy:boolean;apply:Apply;close:()=>void }) {
  const [title,setTitle]=useState(initial.title), [repeat,setRepeat]=useState<Repeat>(initial.repeat);
  const [date,setDate]=useState(initial.date), [time,setTime]=useState(initial.time);
  const today = new Date();
  const [monthDay,setMonthDay]=useState(initial.repeat==='monthly' ? initial.monthDay : today.getDate());
  const [weekday,setWeekday]=useState(initial.repeat==='weekly' ? initial.weekday : today.getDay());
  const name=useRef<HTMLInputElement>(null);
  useEffect(()=>{name.current?.focus({preventScroll:true});},[]);
  const rule:AlarmRule=repeat==='monthly' ? {repeat,monthDay} : repeat==='weekly' ? {repeat,weekday} : {repeat};
  const draft:AlarmDraft={id:initial.id,title:title.trim(),date:repeat==='once'?date:localDay(today),time,...rule};
  const at=time && draft.date ? dueAt({time,date:nextAlarmDate(draft,+today)}) : NaN;
  const heading=initial.title ? t('agendaEditNamed',initial.title) : t('agendaDetails');
  return <form className="agenda-editor" onSubmit={e=>{
    e.preventDefault();
    void apply({op:'save',alarm:draft}).then(ok=>{if(ok) close();});
  }}>
    <fieldset disabled={busy}><legend>{heading}</legend>
      <label>{t('agendaName')}<input ref={name} required maxLength={60} value={title} placeholder={t('agendaNameExample')} onChange={e=>setTitle(e.target.value)}/></label>
      <div className="agenda-pair">
        <label>{t('agendaRepeat')}<span className="agenda-select"><select value={repeat} onChange={e=>setRepeat(e.target.value as Repeat)}>
          {(Object.keys(cycles) as Repeat[]).map(v=><option key={v} value={v}>{t(cycles[v])}</option>)}
        </select><Chevron/></span></label>
        <label>{t('agendaTime')}<input type="time" required value={time} onChange={e=>setTime(e.target.value)}/></label>
      </div>
      {repeat==='once' && <label>{t('agendaDate')}<input required type="date" min={localDay(today)} value={date} onChange={e=>setDate(e.target.value)}/></label>}
      {repeat==='weekly' && <label>{t('agendaWeekday')}<span className="agenda-select"><select value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>
        {[1,2,3,4,5,6,0].map(i=><option value={i} key={i}>{weekdayName(i)}</option>)}</select><Chevron/></span></label>}
      {repeat==='monthly' && <label>{t('agendaMonthDate')}<span className="agenda-select"><select value={monthDay} onChange={e=>setMonthDay(Number(e.target.value))}>
        {Array.from({length:31},(_,n)=><option value={n+1} key={n}>{t('agendaDayNumber',n+1)}</option>)}</select><Chevron/></span>
        {monthDay>28 && <small>{t('agendaShortMonth')}</small>}</label>}
      {at>+today && <output className="agenda-next"><span>{t('agendaNextRing')}</span><time dateTime={new Date(at).toISOString()}>{when(at)}</time></output>}
      <div className="agenda-actions"><button className="link" type="button" onClick={close}>{t('cancel')}</button>
        <button className="primary" type="submit" disabled={!title.trim()}>{t('agendaSave')}</button></div>
    </fieldset>
  </form>;
}
