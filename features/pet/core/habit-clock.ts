// 산책과 고정 위치 모두 같은 기준 시각을 사용한다. 행동을 저장하거나 페이지마다 추첨하지 않는다.
export const habitMs = 2400;
export function pinnedHabitAt(anchorAt: number, now: number) {
  const first = anchorAt + 15_000 + anchorAt % 6000;
  const period = 55_000 + anchorAt % 11_000;
  if (now < first) return first;
  const current = first + Math.floor((now-first)/period)*period;
  return now < current+habitMs ? current : current+period;
}
