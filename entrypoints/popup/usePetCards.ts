import { useCallback, useSyncExternalStore } from 'react';
import { withFinishedFocus } from '../../shared/contracts/keepsakes';
import type { PetState } from '../../shared/contracts/state';

// 마감 시각에 열린 팝업의 카드 수만 한 번 갱신한다. 저장이나 백그라운드 알람은 필요 없다.
function useDeadline(at: number | undefined) {
  const subscribe = useCallback((notify: () => void) => {
    if (at === undefined || at <= Date.now()) return () => {};
    const id = window.setTimeout(notify, at - Date.now() + 1);
    return () => window.clearTimeout(id);
  }, [at]);
  const read = useCallback(() => at !== undefined && Date.now() >= at, [at]);
  return useSyncExternalStore(subscribe, read);
}

export function usePetCards(state: PetState | null) {
  const endsAt = state?.focusPortrait && state.timer?.phase === 'running' ? state.timer.endsAt : undefined;
  const ended = useDeadline(endsAt);
  if (!state) return [];
  const album = ended && endsAt !== undefined ? withFinishedFocus(state, endsAt) : state;
  return (album.memories ?? []).filter(card => card.speciesId === state.pet.speciesId)
    .reverse().sort((a, b) => b.day.localeCompare(a.day));
}
