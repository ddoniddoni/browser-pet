import { envelope } from './commands';
import { isCounter, isId, isPetState, isRecord, type PetState } from './state';

// 미리보기는 해당 탭에서만 쓰고, 영구 설정은 기존 Background 큐가 확정한다.
export type DisplayClick = { requestId: string; at: number; petId: string; enabled: boolean };
export function displayPacket(click: DisplayClick, phase: 'preview' | 'cancel') {
  return { ...envelope, type: 'DISPLAY_CLICK', phase, ...click } as const;
}
export function isDisplayClick(value: unknown): value is ReturnType<typeof displayPacket> {
  return isRecord(value) && value.scope === envelope.scope && value.protocolVersion === envelope.protocolVersion &&
    value.type === 'DISPLAY_CLICK' && (value.phase === 'preview' || value.phase === 'cancel') &&
    isId(value.requestId) && isCounter(value.at) && isId(value.petId) && typeof value.enabled === 'boolean';
}

export function savedDisplayPacket(state: PetState, meet = false) {
  return { ...envelope, type: 'DISPLAY_SAVED', state, ...(meet && { meet: true as const }) } as const;
}
export function isSavedDisplay(value: unknown): value is ReturnType<typeof savedDisplayPacket> {
  return isRecord(value) && value.scope === envelope.scope && value.protocolVersion === envelope.protocolVersion &&
    value.type === 'DISPLAY_SAVED' && isPetState(value.state);
}
