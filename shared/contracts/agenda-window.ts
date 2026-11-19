import { envelope } from './commands';

export const agendaWindowRequest={...envelope,type:'OPEN_AGENDA'} as const;
export const agendaWindowSearch='?panel=agenda';

export function isScreenPoint(x:unknown,y:unknown) {
  return (x===null && y===null) ||
    (typeof x==='number' && Number.isSafeInteger(x) && typeof y==='number' && Number.isSafeInteger(y));
}
