import { browser } from 'wxt/browser';
import { emptyAgenda, freshWindow, nextWake, type Ring } from '../contracts/agenda';
import type { StateReply } from '../contracts/commands';
import { t } from '../i18n';

const wakeName = 'browser-pet:agenda';
async function desktop(rings: Ring[]) {
  const fresh = rings.filter(r=>r.fired-r.due<=freshWindow);
  const first=fresh[0];
  if (!first || !await browser.permissions.contains({permissions:['notifications']})) return;
  // Simultaneous reminders share one notification. The popup keeps each individual entry.
  const joined=fresh.map(r=>r.title).join(' · ');
  await browser.notifications.create(wakeName+':'+first.due+':'+first.id,{
    type:'basic',iconUrl:browser.runtime.getURL('/icon/128.png'),title:t('agendaNotification'),
    message:joined.length>180 ? joined.slice(0,177)+'…' : joined, eventTime:first.due,
  });
}

export function registerAlarmClock(tick: ()=>Promise<StateReply>) {
  // Only this queue touches the named OS wakeup: a late rebuild cannot overwrite a newer edit.
  let pending:Promise<void>=Promise.resolve();
  async function reconcile() {
    if (!await browser.permissions.contains({permissions:['alarms']})) return;
    const reply=await tick();
    if (!reply.ok) throw new Error(reply.message);
    const planned=nextWake(reply.state.agenda ?? emptyAgenda,Date.now());
    const existing=await browser.alarms.get(wakeName);
    if (planned===undefined) {
      if (existing) await browser.alarms.clear(wakeName);
    } else if (!existing || Math.abs(existing.scheduledTime-planned)>500) {
      await browser.alarms.create(wakeName,{when:planned});
    }
    if (reply.rings?.length) await desktop(reply.rings).catch(()=>{ /* The local inbox remains available. */ });
  }
  function sync() {
    const next=pending.then(reconcile);
    pending=next.catch(()=>{});
    return next;
  }
  const wake=()=>{ void sync().catch(()=>{}); };
  const onAlarm=(alarm:{name:string})=>{ if (alarm.name===wakeName) wake(); };
  function listen() {
    const event=browser.alarms?.onAlarm;
    if (event && !event.hasListener(onAlarm)) event.addListener(onAlarm);
  }
  listen();
  browser.permissions.onAdded.addListener(p=>{ if (p.permissions?.includes('alarms')) {listen(); wake();} });
  browser.runtime.onStartup.addListener(wake);
  browser.runtime.onInstalled.addListener(wake);
  wake();
  return sync;
}
