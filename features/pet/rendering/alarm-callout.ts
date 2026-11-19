import { formatLocale, t } from '../../../shared/i18n';
import { ringKey, type Ring } from '../../../shared/contracts/agenda';
import type { Point, Viewport } from '../core/interaction';
import { headCallout, placeBubble, type OccupiedSide } from './head-callout';
import { menuIcon } from './menu-icon';

// 시계에 의존하지 않는다. 워커가 확인한 회차만 다음 스냅샷에서 빠진다.
export function createAlarmCallout(container: HTMLElement) {
  const bubble=document.createElement('div');
  bubble.className='pet-alarm pet-callout';
  bubble.hidden=true;
  const label=document.createElement('div');
  label.className='pet-alarm-label';
  label.setAttribute('role','status');
  label.setAttribute('aria-atomic','true');
  const meta=document.createElement('small');
  const name=document.createElement('strong');
  name.dir='auto';
  label.append(meta,name);
  const ack=document.createElement('button');
  ack.type='button';
  ack.textContent=t('agendaAck');
  const problem=document.createElement('small');
  problem.className='pet-alarm-error';
  problem.setAttribute('role','alert');
  problem.hidden=true;
  bubble.append(menuIcon('bell'),label,ack,problem);
  container.append(bubble);
  const time=new Intl.DateTimeFormat(formatLocale,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  let shown='', count=0, width=0, height=0, viewportWidth=0;
  function error(message='') {
    problem.textContent=message;
    problem.hidden=!message;
    viewportWidth=0;
  }
  function sync(ring: Ring | undefined, total: number, point: Point, view: Viewport, occupied?: OccupiedSide): OccupiedSide | undefined {
    if (!ring) {
      if (!bubble.hidden) { bubble.hidden=true; shown=''; error(); }
      return occupied;
    }
    const key=ringKey(ring);
    if (shown!==key || count!==total) {
      if (shown!==key) {
        name.textContent=ring.title;
        ack.setAttribute('aria-label',t('agendaAckNamed',ring.title));
        error();
      }
      meta.textContent=t('agendaPending',total)+' · '+time.format(ring.due);
      count=total; shown=key; viewportWidth=0;
    }
    if (bubble.hidden) bubble.hidden=false;
    if (viewportWidth!==view.width) {
      width=bubble.offsetWidth; height=bubble.offsetHeight; viewportWidth=view.width;
    }
    const gap=7, layout=headCallout(point,view,width,height,6,gap,occupied);
    placeBubble(bubble,layout);
    return { below:layout.below, depth:layout.below ? layout.top+height-view.size : -layout.top,
      oppositeDepth:occupied && occupied.below!==layout.below ? occupied.depth : 0 };
  }
  return {bubble,ack,sync,error};
}
