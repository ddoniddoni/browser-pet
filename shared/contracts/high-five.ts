export interface HighFive {
  phase: 'ready' | 'hit';
  token: string;
  speciesId: string;
  x: number;
  y: number;
  facing: 1 | -1;
  at: number;
}

export function fiveEndsAt(five: HighFive) {
  return five.at + (five.phase === 'ready' ? 15_000 : 1_100);
}

export function activeFive(five: HighFive | undefined, speciesId: string, now: number) {
  return five && five.speciesId === speciesId && now >= five.at && now < fiveEndsAt(five) ? five : undefined;
}
