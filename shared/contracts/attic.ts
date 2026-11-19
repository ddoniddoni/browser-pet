import { companionFor, companionIds, isCompanionId, type CompanionId } from './companions';
import { isRecord, type PetState } from './state';

export interface Attic { order: CompanionId[]; center: CompanionId | null }

export function validAttic(value: unknown): value is Attic {
  return isRecord(value) && Object.keys(value).length === 2 && Array.isArray(value.order) &&
    value.order.every(isCompanionId) && new Set(value.order).size === value.order.length &&
    (value.center === null ? !value.order.length : isCompanionId(value.center) && value.order.includes(value.center));
}

// 예전 저장본에는 꺼낸 순서가 없다. 기존 명단으로 시작하고 새로 켠 친구를 뒤에 붙인다.
export function atticFor(state: PetState, previous = state.attic): Attic {
  const enabled = companionIds(state).filter(id => companionFor(state, id).enabled);
  const order = previous?.order.filter(id => enabled.includes(id)) ?? [];
  for (const id of enabled) if (!order.includes(id)) order.push(id);
  const preferred = previous?.center ?? state.pet.speciesId;
  return { order, center: order.find(id => id === preferred) ?? order[0] ?? null };
}
