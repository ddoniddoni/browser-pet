import { browser } from 'wxt/browser';
import { agendaWindowSearch } from '../contracts/agenda-window';

let opening: Promise<void> | undefined;
export function openAgendaWindow(tabId:number,windowId:number,x:number|null,y:number|null) {
  if(opening) return opening;
  opening=open(tabId,windowId,x,y).finally(()=>{opening=undefined;});
  return opening;
}

async function open(tabId:number,windowId:number,x:number|null,y:number|null) {
  const [parent, [active]]=await Promise.all([browser.windows.get(windowId), browser.tabs.query({windowId,active:true})]);
  if(parent.type!=='normal' || parent.state==='minimized' || !parent.focused || active?.id!==tabId) throw new Error();
  const url=browser.runtime.getURL('/popup.html')+agendaWindowSearch;
  // 워커가 다시 시작돼도 이 확장의 일정 편집창만 찾아 기존 초안을 보존한다.
  if(browser.runtime.getContexts) {
    const contexts=await browser.runtime.getContexts({documentUrls:[url]}).catch(()=>[]);
    for (const ctx of contexts) {
      if(ctx.frameId!==0 || ctx.windowId<0) continue;
      const win=await browser.windows.get(ctx.windowId).catch(()=>undefined);
      if(win?.type==='popup') {
        try {
          await browser.windows.update(ctx.windowId, {focused:true,...(win.state==='minimized' && {state:'normal' as const})});
          return;
        } catch { /* 확인하는 동안 닫힌 경우 새 창을 연다. */ }
      }
    }
  }
  const width=Math.min(396,parent.width||396),height=Math.min(560,parent.height||560);
  const originX=parent.left??0, originY=parent.top??0;
  const bound=(v:number,low:number,range:number)=> Math.round(Math.min(low+Math.max(0,range),Math.max(low,v)));
  const left=bound(x===null ? originX+((parent.width??width)-width)/2 : x+12,originX,(parent.width??width)-width);
  const top=bound(y===null ? originY+40 : y-52,originY,(parent.height??height)-height);
  await browser.windows.create({type:'popup',url,focused:true,width,height,left,top});
}
