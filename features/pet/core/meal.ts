// 먹이 보상이 승인된 시각을 사용하므로 재전송, 대기 중 클릭, 탭 복귀가 장면을 다시 시작하지 않는다.
export const mealMs = 1700;
export function isMealTime(fedAt: number | null, now: number): fedAt is number {
  return fedAt !== null && now >= fedAt && now < fedAt + mealMs;
}
