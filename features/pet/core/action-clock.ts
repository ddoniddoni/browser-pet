// 시각은 공유 장면의 시작 시각을 기준으로 한다. 마지막 자세에서는 더 깨우지 않는다.
export interface MotionSpan { at: number; ms: number }

export const dangleCycle = { frames: 16, stepMs: 66 } as const;

export function samplePose(action: string, reduced: boolean, now: number, span?: MotionSpan, loopStart = 0) {
  if (reduced) return { index: 0, count: 1, nextAt: Infinity };
  if (action === 'DRAG') {
    const step = Math.floor(Math.max(0,now-loopStart) / dangleCycle.stepMs);
    return { index: step % dangleCycle.frames, count: dangleCycle.frames, nextAt: loopStart+(step+1)*dangleCycle.stepMs };
  }
  if (span) {
    const count = Math.min(20, Math.max(5, Math.ceil(span.ms / 64) + 1));
    const step = span.ms / (count - 1);
    const index = Math.min(count - 1, Math.max(0, Math.floor((now - span.at) / step)));
    return { index, count, nextAt: index < count - 1 ? Math.ceil(span.at + (index + 1) * step) : Infinity };
  }
  if (action === 'HOP' || action === 'FLOAT') {
    const step = action === 'HOP' ? 85 : 160;
    return { index: Math.floor(now / step) % 12, count: 12, nextAt: (Math.floor(now / step) + 1) * step };
  }
  if (action === 'WALK') return { index: Math.floor(now / 90) % 8, count: 8, nextAt: (Math.floor(now / 90) + 1) * 90 };
  return { index: 0, count: 1, nextAt: Infinity };
}
