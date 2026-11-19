import { agendaWindowRequest, isScreenPoint } from '../shared/contracts/agenda-window';
import { openAgendaWindow } from '../shared/messaging/agenda-window';
import { t } from '../shared/i18n';
import { registerAlarmClock } from '../shared/messaging/alarm-clock';
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { envelope, getState, identifySender, parseCommand, type StateCommand } from '../shared/contracts/commands';
import { replyToPing } from '../shared/contracts/ping';
import { isRecord, stateKey } from '../shared/contracts/state';
import { createStateWriter } from '../shared/storage/writer';
import { registerDragRelay } from '../shared/messaging/drag-relay';
import { mayDisplayInTab, registerWindowChanges, windowVisibilityRequest } from '../shared/messaging/window-visibility';

export default defineBackground(() => {
  registerDragRelay();
  registerWindowChanges();
  const run = createStateWriter({
    read: async () => (await browser.storage.local.get(stateKey))[stateKey],
    write: state => browser.storage.local.set({ [stateKey]: state }),
  });
  const syncAlarms = registerAlarmClock(()=>run({type:'AGENDA_TICK'}));
  browser.runtime.onInstalled.addListener(() => { void run(getState); });
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!isRecord(message) || message.scope !== envelope.scope) return;
    const source = identifySender(sender, browser.runtime.id);
    if (message.type === windowVisibilityRequest.type) {
      const tabId = sender.tab?.id;
      if (source !== 'content' || tabId === undefined || message.protocolVersion !== envelope.protocolVersion || Object.keys(message).length !== 3) {
        sendResponse(false);
        return;
      }
      void mayDisplayInTab(tabId).then(sendResponse);
      return true;
    }
    if (message.type === 'PING') {
      sendResponse(replyToPing(message, source !== null));
      return;
    }
    if (message.type === agendaWindowRequest.type) {
      const {x,y}=message;
      const tab=sender.tab;
      if (source!=='content' || tab?.id===undefined || tab.windowId===undefined ||
          message.protocolVersion!==envelope.protocolVersion || Object.keys(message).length!==5 || !isScreenPoint(x,y)) {
        sendResponse({ok:false});
        return;
      }
      void openAgendaWindow(tab.id,tab.windowId,typeof x==='number'?x:null,typeof y==='number'?y:null)
        .then(()=>sendResponse({ok:true}),()=>sendResponse({ok:false}));
      return true;
    }
    if (message.type === 'OPEN_OPTIONS') {
      if (source !== 'content' || message.protocolVersion !== envelope.protocolVersion || Object.keys(message).length !== 3) {
        sendResponse({ ok: false });
        return;
      }
      void browser.runtime.openOptionsPage().then(
        () => sendResponse({ ok: true }),
        () => sendResponse({ ok: false }),
      );
      return true;
    }
    const command = parseCommand(message, source, sender.url);
    if ('ok' in command) {
      sendResponse(command);
      return;
    }
    async function submit(cmd: StateCommand) {
      if (cmd.type==='GET_STATE' && source==='popup') await syncAlarms().catch(()=>{});
      const changes = cmd.type==='AGENDA_CHANGE' ? cmd.payload : undefined;
      const needsClock = changes?.op==='save' || (changes?.op==='switch' && changes.enabled);
      if (needsClock && !await browser.permissions.contains({permissions:['alarms']}))
        return {ok:false, code:'FORBIDDEN', message:t('agendaClockDenied')};
      const reply=await run(cmd);
      // 복원은 이미 디스크에 반영됐다. 시스템 알람 오류로 파일 쓰기를 재시도하지 않는다.
      if (reply.ok && cmd.type === 'RESTORE_BACKUP') {
        await syncAlarms().catch(() => {});
      }
      if (reply.ok && (cmd.type==='RESET_ALL' || changes)) {
        await syncAlarms();
      }
      return reply;
    }
    void submit(command).then(sendResponse,()=>sendResponse({ok:false,code:'STORAGE_ERROR',message:t('agendaScheduleError')}));
    return true;
  });
});
