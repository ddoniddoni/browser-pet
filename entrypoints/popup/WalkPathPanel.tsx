import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { browser } from 'wxt/browser';
import { Chevron } from '../../components/Chevron';
import type { Point } from '../../features/pet/core/interaction';
import type { CompanionId } from '../../shared/contracts/companions';
import type { PetState } from '../../shared/contracts/state';
import { isWalkPath, maxWalkPathPoints } from '../../shared/contracts/walk-path';
import { t } from '../../shared/i18n';
import { startDrawnWalk } from '../../shared/messaging/state';
import { readPage } from './CurrentPageStatus';
import './walk-path.css';

const padWidth = 320;
const padHeight = 160;
const unit = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
const distance = (a: Point, b: Point) => Math.hypot((a.x - b.x) * padWidth, (a.y - b.y) * padHeight);
const polyline = (points: Point[]) => points.map(p => [p.x * padWidth, p.y * padHeight].join(',')).join(' ');

// 긴 획에서도 처음과 끝, 급하게 꺾인 모서리를 살린다.
function addPoint(points: Point[], next: Point, final = false) {
  const last = points.at(-1);
  if (last && distance(last, next) < (final ? 0.01 : 2)) return;
  points.push(next);
  if (points.length <= maxWalkPathPoints) return;
  let least = Infinity;
  let remove = 1;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]!, b = points[i]!, c = points[i + 1]!;
    const bend = distance(a, b) + distance(b, c) - distance(a, c);
    if (bend < least) { least = bend; remove = i; }
  }
  points.splice(remove, 1);
  if (distance(points[remove - 1]!, points[remove]!) === 0) points.splice(remove, 1);
}

const heart = Array.from({ length: 41 }, (_, i) => {
  const angle = Math.PI + i * Math.PI / 20;
  const y = 13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle);
  return { x: unit(0.5 + 0.21 * Math.sin(angle) ** 3), y: unit(0.44 - y * 0.024) };
});

const steps: Record<string, Point> = {
  ArrowLeft: { x: -0.05, y: 0 }, ArrowRight: { x: 0.05, y: 0 },
  ArrowUp: { x: 0, y: -0.1 }, ArrowDown: { x: 0, y: 0.1 },
};

export function WalkPathPanel({ state, friend }: { state: PetState; friend: CompanionId }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const pending = useRef(false);
  const stroke = useRef<{ pointer: number; points: Point[]; bounds: DOMRect } | null>(null);
  const trace = useRef<SVGPolylineElement>(null);
  const id = useId();
  const endpoint = points.at(-1);

  function edit(path: Point[]) {
    setError('');
    setSent(false);
    setPoints(path);
  }

  function sample(event: PointerEvent<SVGSVGElement>, final = false) {
    const current = stroke.current;
    if (!current || current.pointer !== event.pointerId) return;
    const { left, top, width, height } = current.bounds;
    addPoint(current.points, { x: unit((event.clientX - left) / width), y: unit((event.clientY - top) / height) }, final);
    trace.current?.setAttribute('points', polyline(current.points));
  }

  function endStroke(event: PointerEvent<SVGSVGElement>, commit: boolean) {
    const current = stroke.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (commit) {
      sample(event, true);
      if (isWalkPath(current.points)) edit(current.points);
    }
    stroke.current = null;
    trace.current?.removeAttribute('points');
    delete event.currentTarget.dataset.drawing;
  }

  function keyboardDraw(event: KeyboardEvent<SVGSVGElement>) {
    const step = steps[event.key];
    if (!step || pending.current || stroke.current || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const path = points.length ? [...points] : [{ x: 0.5, y: 0.5 }];
    const last = path[path.length - 1]!;
    addPoint(path, { x: unit(last.x + step.x), y: unit(last.y + step.y) });
    edit(path);
  }

  async function start() {
    if (pending.current || stroke.current || !isWalkPath(points)) return;
    setSent(false);
    setError('');
    if (state.settings.reduceMotion === 'always' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setError(t('walkPathReduced'));
      return;
    }
    if (state.timer && (state.timer.phase === 'paused' || state.timer.endsAt > Date.now())) {
      setError(t('walkPathTimer'));
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const toolbar = !await browser.tabs.getCurrent();
      if (toolbar && await readPage() !== 'visible') throw new Error(t('walkPathPage'));
      await startDrawnWalk(state, friend, points);
      setSent(true);
      if (toolbar) window.close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('saveError'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <details className="walk-path-panel">
    <summary>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="4" cy="18" r="1.8" /><path d="M7 18c5 0 7-5 3-7s-5-6-1-7c5-2 6 7 11 5" strokeDasharray="2 3" />
        <circle cx="20" cy="9" r="1.9" fill="currentColor" />
      </svg>
      {t('walkPathTitle')}<Chevron />
    </summary>
    <div className="walk-path-editor" aria-busy={busy}>
      <p id={id + '-hint'}>{t('walkPathHint', state.pet.name)}</p>
      <svg className="walk-path-pad" role="application" tabIndex={0} aria-label={t('walkPathPad')}
        aria-describedby={id + '-hint ' + id + '-position'} viewBox={`0 0 ${padWidth} ${padHeight}`} preserveAspectRatio="none"
        onKeyDown={keyboardDraw}
        onPointerDown={event => {
          if (pending.current || stroke.current || !event.isPrimary || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.dataset.drawing = '';
          stroke.current = { pointer: event.pointerId, points: [], bounds: event.currentTarget.getBoundingClientRect() };
          setSent(false); setError('');
          sample(event);
        }}
        onPointerMove={event => sample(event)}
        onPointerUp={event => endStroke(event, true)}
        onPointerCancel={event => endStroke(event, false)}
        onLostPointerCapture={event => endStroke(event, false)}>
        <defs>
          <marker id={id + '-start'} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="3.5" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
          </marker>
          <marker id={id + '-end'} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="4" fill="currentColor" />
          </marker>
        </defs>
        <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          markerStart={`url(#${id}-start)`} markerEnd={`url(#${id}-end)`}>
          <polyline className="walk-path-saved" points={polyline(points)} />
          <polyline ref={trace} />
        </g>
      </svg>
      <span id={id + '-position'} className="walk-path-position" role="status" aria-atomic="true">
        {endpoint ? t('walkPathPosition', Math.round(endpoint.x * 100) + '%, ' + Math.round(endpoint.y * 100) + '%')
          : t('walkPathOrigin')}
      </span>
      <div className="walk-path-actions">
        <button type="button" className="secondary" disabled={busy} onClick={() => edit(heart)}>{t('walkPathHeart')}</button>
        <button type="button" className="link" disabled={busy || !points.length} onClick={() => edit([])}>{t('walkPathClear')}</button>
        <button type="button" className="primary" disabled={!isWalkPath(points)} aria-disabled={busy || undefined}
          onClick={() => void start()}>{t('walkPathStart')}</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {sent && <p role="status">{t('walkPathStarted')}</p>}
    </div>
  </details>;
}
