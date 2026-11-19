import { mousePaths } from './mouse-art';

// 도구의 채색 면만 따로 두어 고대비 모드에서도 윤곽은 남는다.
export const menuArt = {
  book: ['M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z'],
  sliders: ['M4 7h3m4 0h9M4 17h9m4 0h3', 'M7 4h4v6H7ZM13 14h4v6h-4Z'],
  shirt: ['m8 3-5 4 3 4 2-1v11h8V10l2 1 3-4-5-4a4 4 0 0 1-8 0Z'],
  archive: ['M4 8h16v12H4ZM3 4h18v4H3ZM9 12h6'],
  orbit: ['M8 5a8 8 0 1 1-4 7M3 4l5 1-2 5', 'm12 8 4 2v5l-4 2-4-2v-5Zm-4 2 4 2 4-2m-4 2v5'],
  calendar:['M5 6.5h14v14H5z','M5 10h14M8 4v4m8-4v4m-7 7 2 2 4-4'],
  bell:['M5 16c2-2 2-3 2-6a5 5 0 0 1 10 0c0 3 0 4 2 6v1H5Z','M10 20q2 2 4 0M12 3v1'],
  down:['m7 10 5 5 5-5'], forward:['m10 7 5 5-5 5'],
  mouse: mousePaths,
  highFive: [
    'M8 14.6 5.2 11q-1.5-2 0-2.8 1-.5 2 1l1.6 2.1-1.5-5.1q-.5-2 1-2.3 1.1-.2 1.6 1.4l1.5 4.4-.9-6q-.2-1.7 1.2-1.9 1.3 0 1.6 1.5l.8 6.1.4-4.8q.1-1.7 1.5-1.5 1.2.1 1.1 1.6l-.4 6 1.1-2.5q.6-1.5 1.9-.9 1.1.5.6 1.7l-2 6.2q-1.2 4.6-5.3 4.7-3.1.2-5-3.3Z',
    'm3.2 4.8 1.2 1.4M1.8 8l1.4.6',
  ],
  tag: [
    'M16.6 4.5h-5.1L4.4 11.6a2.2 2.2 0 0 0 0 3.1l4.9 4.9a2.2 2.2 0 0 0 3.1 0l7.1-7.1V7.4a2.9 2.9 0 0 0-2.9-2.9Z',
    'M15.5 8.5h.01M8.4 13.5l2.1 2.1M15.5 8.5l3.8-4.1q1.3-1.6.2-2.5',
  ],
  pet: [
    'M7.6 13.8V8.4a1.5 1.5 0 0 1 3 0v3.5-6a1.5 1.5 0 0 1 3 0v5.5-4.2a1.5 1.5 0 0 1 3 0v5-2.7a1.5 1.5 0 0 1 3 0v4.7c0 4.3-2.7 7-6.7 7-2.4 0-4.4-1.1-5.9-3.1l-3.1-4.3c-1.1-1.5.6-3.1 2-2.1Z',
  ],
  feed: [
    'M5.2 10.6c0-1.3 1.6-2.5 6.8-2.5s6.8 1.2 6.8 2.5l2.2 6.9c.3 1-1.3 2.4-9 2.4s-9.3-1.4-9-2.4Z',
    'M5.4 10.9c2.6 1.9 10.6 1.9 13.2 0M7.5 8.9a2.4 2.4 0 0 1 4.4-1.8 2.4 2.4 0 0 1 4.8 1.8',
  ],
  play: [
    'M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
    'M4.3 15.6c6.4 1.4 13-3.8 13.2-10.1M6.7 18.6c5.3.2 11.7-4.3 13.5-9.3',
  ],
  walk: ['M3.5 18.5h4a3 3 0 0 0 0-6h-1a2.5 2.5 0 0 1 0-5h13M16 4l3.5 3.5L16 11'],
  hide: ['m3 3 18 18M9.5 6.3c.8-.2 1.6-.3 2.5-.3 5.6 0 9.3 6 9.3 6a18 18 0 0 1-3 3.5M6.5 7.6A17 17 0 0 0 2.7 12s3.7 6 9.3 6c1.6 0 3.1-.5 4.4-1.2M9.4 10.1a3.2 3.2 0 0 0 4.5 4.5'],
  settings: [
    'm10.1 3-.5 2.2-1.6.9-2.2-.6L4 8.7l1.6 1.6v2l-1.6 1.6 1.8 3.2 2.2-.6 1.6.9.5 2.2h3.8l.5-2.2 1.6-.9 2.2.6 1.8-3.2-1.6-1.6v-2L20 8.7l-1.8-3.2-2.2.6-1.6-.9-.5-2.2Z',
    'M15 11.3a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  ],
} as const;

export type MenuIcon = keyof typeof menuArt;
export function menuIcon(kind: MenuIcon) {
  const ns = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(ns, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  icon.setAttribute('class', 'pet-icon icon-' + kind);
  for (const d of menuArt[kind]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    icon.append(path);
  }
  return icon;
}
