import type { ReactNode } from 'react';

export function Ink({ name, species, children }: {
  name: string; species: string; children: ReactNode;
}) {
  return <svg className={'pet-ink pet-' + species} viewBox="0 0 96 96" role="img" aria-label={name}
    xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#53382f" strokeWidth="2.35"
    strokeLinecap="round" strokeLinejoin="round" focusable="false">
    {children}
  </svg>;
}

export function Eye({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  return <g transform={`translate(${x} ${y})`}>
    <g className="ink-eye" stroke="none">
      <ellipse rx={small ? 2.5 : 3.05} ry={small ? 3.45 : 4} fill="#382a2c" />
      <circle cx="-.65" cy="-1.45" r=".95" fill="#fff7e5" />
    </g>
    <path className="ink-smile" strokeWidth="2.15" d="M-3 1Q0 -2.8 3 .3" />
  </g>;
}

export function Kerchief() {
  return <g className="pet-scarf">
    <path fill="var(--scarf)" d="M37 54Q52 60 72 52Q74 56 70 60L58 70Q55 72 53 69L49 63Q41 63 37 59Z" />
    <path d="M52 62Q58 63 65 59" stroke="#fff5db" strokeWidth="1.45" opacity=".75" />
  </g>;
}
