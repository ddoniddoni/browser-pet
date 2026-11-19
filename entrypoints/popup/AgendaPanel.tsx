import { useEffect, useId, useState } from 'react';
import { browser } from 'wxt/browser';
import { ToolRow } from './ToolRow';
import { AlarmEditor, clock, newAlarm, scheduleText, shortDate, when } from './AlarmEditor';
import { dueAt, emptyAgenda, ringKey, type Ring, type AgendaChange, type AlarmDraft } from '../../shared/contracts/agenda';
import type { PetState } from '../../shared/contracts/state';
import { acknowledgeAlarm, saveAgenda } from '../../shared/messaging/state';
import { t } from '../../shared/i18n';
import './agenda.css';

export function AgendaPanel({state,standalone=false}:{state:PetState;standalone?:boolean}) {
  const agenda=state.agenda ?? emptyAgenda;
  const [editor,edit]=useState<AlarmDraft|null>(()=>standalone && !agenda.alarms.length ? newAlarm() : null);
  const [busy,lock]=useState(false),[error,fail]=useState('');
  const [perms,permissions]=useState({clock:false,desktop:false});
  useEffect(()=>{
    let active=true;
    async function refresh() {
      const p=await browser.permissions.getAll();
      if(active) permissions({clock:!!p.permissions?.includes('alarms'),desktop:!!p.permissions?.includes('notifications')});
    }
    const update=()=>{void refresh().catch(()=>{});};
    update();
    browser.permissions.onAdded.addListener(update);browser.permissions.onRemoved.addListener(update);
    return ()=>{active=false;browser.permissions.onAdded.removeListener(update);browser.permissions.onRemoved.removeListener(update);};
  },[]);

  async function apply(change:AgendaChange) {
    if(busy) return false;
    lock(true);fail('');
    try {
      if ((change.op==='save' || (change.op==='switch' && change.enabled)) && !perms.clock &&
        !await browser.permissions.request({permissions:['alarms']})) throw new Error(t('agendaClockDenied'));
      await saveAgenda(state,change); return true;
    } catch(e) {fail(e instanceof Error ? e.message : t('badSave'));return false;}
    finally {lock(false);}
  }
  const [showPending,setShowPending]=useState(false), [limit,setLimit]=useState(10);
  const pending=agenda.pending ?? [];
  async function acknowledge(ring:Ring) {
    if (busy) return;
    lock(true); fail('');
    try { await acknowledgeAlarm(state,ring); }
    catch { fail(t('agendaAckFailed')); }
    finally { lock(false); }
  }
  async function allow(kind:'alarms'|'notifications', enabled:boolean) {
    lock(true);fail('');
    try {
      const ok=enabled ? await browser.permissions.request({permissions:[kind]}) : await browser.permissions.remove({permissions:[kind]});
      if (!ok) throw new Error(t(kind==='alarms'?'agendaClockDenied':'agendaNotifyDenied'));
    } catch(e) { fail(e instanceof Error ? e.message : t('badSave')); }
    finally {lock(false);}
  }
  const ordered=[...agenda.alarms].sort((a,b)=>Number(b.enabled)-Number(a.enabled) || dueAt(a)-dueAt(b));
  const next=ordered.find(a=>a.enabled);
  const nextId = useId();
  const Panel=standalone ? 'section' : 'details';
  const panel = <Panel name={standalone ? undefined : "pet-pocket-tools"} className="agenda-panel" onToggle={event=>{
    if(event.target===event.currentTarget && event.currentTarget instanceof HTMLDetailsElement && event.currentTarget.open && !ordered.length && !editor)
      edit(newAlarm());
  }}>
    {standalone && <h1>{editor ? editor.title ? t('agendaEdit') : t('agendaDetails') : t('agendaTitle')}</h1>}
    {!standalone && <ToolRow kind="alarm" title={t('agendaTitle')} describedBy={next ? nextId : undefined}/>}
    <div className="agenda-body">
      {pending.length>0 && <details className="agenda-extra agenda-pending" onToggle={e=>setShowPending(e.currentTarget.open)}>
        <summary>{t('agendaPending',pending.length)}</summary>
        {showPending && <><ul>{pending.slice(0,limit).map(r=><li key={ringKey(r)}>
          <div><time dateTime={new Date(r.due).toISOString()}>{when(r.due)}</time><strong dir="auto">{r.title}</strong></div>
          <button type="button" className="agenda-add" disabled={busy} aria-label={t('agendaAckNamed',r.title)}
            onClick={()=>void acknowledge(r)}>{t('agendaAck')}</button>
        </li>)}</ul>{pending.length>limit && <button type="button" className="link" onClick={()=>setLimit(limit+10)}>{t('agendaMore')}</button>}</>}
      </details>}
      {editor ? <AlarmEditor key={editor.id} initial={editor} busy={busy} apply={apply} close={()=>edit(null)}/> : <>
        <div className="agenda-list-head"><strong>{t('agendaAlarms')} <span>{agenda.alarms.length}</span></strong>
          <button type="button" className="agenda-add" disabled={busy} onClick={()=>{edit(newAlarm());fail('');}}>{t('agendaAdd')}</button></div>
        {!ordered.length && <p>{t('agendaEmpty')}</p>}
        {ordered.length>0 && <ul className="agenda-list">{ordered.map(a=><li key={a.id} data-paused={!a.enabled || undefined}>
          <label className="agenda-enabled"><input type="checkbox" checked={a.enabled} disabled={busy} aria-label={t('agendaToggle',a.title)}
            onChange={e=>void apply({op:'switch',id:a.id,enabled:e.target.checked})}/>
            <span><b dir="auto">{a.title}</b><small>{scheduleText(a)}</small></span></label>
          <div><button type="button" className="link" disabled={busy} aria-label={t('agendaEditNamed',a.title)}
            onClick={()=>{edit(a);fail('');}}>{t('agendaEdit')}</button>
            <button type="button" className="link" disabled={busy} aria-label={t('agendaDeleteNamed',a.title)}
              onClick={()=>void apply({op:'remove',id:a.id})}>{t('agendaDelete')}</button></div>
        </li>)}</ul>}
        {next && !perms.clock && <button type="button" className="secondary" disabled={busy} onClick={()=>void allow('alarms',true)}>{t('agendaRestore')}</button>}
        <details className="agenda-extra"><summary>{t('agendaDelivery')}</summary>
          <label className="agenda-delivery"><input type="checkbox" disabled={busy} checked={perms.desktop} onChange={e=>void allow('notifications',e.target.checked)}/>{t('agendaDesktop')}</label>
          <p>{t('agendaDeliveryHint')}</p></details>
        {agenda.recent.length>0 && <details className="agenda-extra agenda-history"><summary>{t('agendaHistory')}</summary><ul>{agenda.recent.map(r=>
          <li key={r.id+':'+r.due}><time dateTime={new Date(r.due).toISOString()}>{when(r.due)}</time><span dir="auto">{r.title}</span></li>)}</ul></details>}
      </>}
      {error && <p role="alert">{error}</p>}
    </div>
  </Panel>;

  if (standalone || !next) return panel;
  const nextTime = dueAt(next);
  return <>{panel}
    <div className="upcoming-alarm" id={nextId}>
      <div className="upcoming-alarm-meta">
        <span>{t('agendaNextRing')}</span>
        <time dateTime={new Date(nextTime).toISOString()}>
          <span>{shortDate.format(nextTime)}</span>{' '}<span>{clock.format(nextTime)}</span>
        </time>
      </div>
      <bdi>{next.title}</bdi>
    </div>
  </>;
}
