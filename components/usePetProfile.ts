import { useEffect, useState } from 'react';
import type { PetState } from '../shared/contracts/state';
import { watchState, type StateIssue } from '../shared/messaging/state';

export function usePetProfile() {
  const [state, setState] = useState<PetState | null>(null);
  const [issue, setIssue] = useState<StateIssue | null>(null);
  useEffect(() => watchState(next => {
    setState(next);
    if (next) setIssue(null);
  }, (message, detail) => setIssue(detail ?? { code: 'UNAVAILABLE', message })), []);
  return { state, issue };
}
