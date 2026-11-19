// 손바닥을 보이는 포즈. 같은 선화를 페이지, 추억 카드, 방의 액자에 쓴다.
export function HighFivePaw({ fur, wing = false, double = false }: { fur: string; wing?: boolean; double?: boolean }) {
  return <g className="ink-five">
    {double && <g className="ink-five-other">
      <path fill={fur} d="M48 70Q43 71 40 67L34 60Q29 59 29 54Q28 50 32 50Q35 46 38 50Q43 48 43 54L44 57Q49 60 54 63"/>
      <ellipse cx="36.5" cy="54.5" rx="3.1" ry="2.4" fill="#d58e79" stroke="none"/>
    </g>}
    <g className="ink-five-limb">{wing
      ? <><path fill={fur} d="M62 62Q67 58 73 56Q82 53 88 43Q92 38 93 44Q94 55 85 63Q76 73 66 73Q60 72 62 62Z"/>
          <path d="M82 60q5-4 7-9" stroke="#fff3d9" strokeWidth="1.4" opacity=".7"/></>
      : <><path fill={fur} d="M59 65Q62 59 71 61L76 58Q76 53 79 52Q80 47 84 49Q88 46 90 50Q94 51 92 56Q94 62 88 64L78 71Q69 78 62 73"/>
          <g fill="#d68c78" stroke="none"><path d="M80 57q3-5 6-2 5 3 1 6-3 1-6 0-3-1-1-4Z"/>
            <circle cx="80.5" cy="53.2" r="1.2"/><circle cx="84.8" cy="51.4" r="1.3"/><circle cx="89.1" cy="52.4" r="1.2"/></g></>}
    </g>
    <g className="ink-five-glint" stroke="#ab692c" strokeWidth="2.2">
      <path d="m87 39 2-5m4 8 4-2m-16-2-1-3"/>
    </g>
  </g>;
}
