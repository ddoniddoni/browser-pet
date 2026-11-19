import { useId } from 'react';
import type { Cushion as Fabric } from '../../shared/contracts/room';

const fabrics = {
  moss: { top: '#9eaf81', hem: '#75876a', line: '#485f49', thread: '#e8ebbf' },
  apricot: { top: '#efb490', hem: '#c98b6d', line: '#93664d', thread: '#ffebca' },
  indigo: { top: '#7e95ac', hem: '#60758b', line: '#475d76', thread: '#f7dfa3' },
};
const top = 'M5 27C5 17 24 10 49 7C68 4 94 4 117 7C138 9 153 15 156 23C160 32 146 37 125 41C99 46 54 46 30 40C15 37 6 33 5 27Z';

export function Cushion({ fabric }: { fabric: Fabric }) {
  const shape = useId();
  const { top: cloth, hem, line, thread } = fabrics[fabric];
  return <svg viewBox="0 0 162 54" fill="none" aria-hidden="true" focusable="false">
    <defs><clipPath id={shape}><path d={top}/></clipPath></defs>
    <ellipse cx="82" cy="43" rx="72" ry="8" fill="#5f432c" opacity=".18"/>
    <path d="M5 26C3 34 10 41 31 45C58 52 102 52 128 46C148 42 159 35 156 24Z" fill={hem} stroke={line} strokeWidth="1.7"/>
    <path d={top} fill={cloth} stroke={line} strokeWidth="1.7"/>
    <g clipPath={'url(#' + shape + ')'}>
      {fabric === 'apricot' ? <g stroke={thread} strokeWidth="5" opacity=".63">
        {[-20,0,20,40,60,80,100,120,140,160].map(x => <path key={x} d={`M${x} 0l25 55`}/>)}
        <path d="M0 15q80 7 162-2M0 28q80 10 162-2M0 41q80 10 162-2"/></g> :
        fabric === 'indigo' ? <g fill={thread}>
          {[[19,25],[40,13],[55,34],[77,14],[98,36],[128,17],[143,30]].map(([x,y]) =>
            <path key={x} transform={`translate(${x} ${y})`} d="M0-3.5 1-1 3.4 0 1 1 0 3.5-1 1-3.4 0-1-1Z"/>)}</g> :
          <g stroke={thread} strokeWidth="1.6" strokeLinecap="round" fill={thread}>
            {[[16,29],[43,18],[65,34],[94,17],[121,33],[140,22]].map(([x,y]) =>
              <g key={x} transform={`translate(${x} ${y}) rotate(-14)`}><path d="m0 2 9-6M4 0Q-1 0 0-4q4 0 4 4m2-2q1-6 5-6 0 5-5 6" /></g>)}</g>}
    </g>
    <path d="M9 28C24 44 89 49 130 39q16-3 23-10" stroke={thread} strokeWidth="1.1" strokeDasharray="3 3"/>
    <path d="m143 38 6-2 2 3-6 2z" fill="#eed7ac" stroke={line} strokeWidth=".8"/>
  </svg>;
}
