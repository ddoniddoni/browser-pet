import { PetMiniature } from '../../components/PetMiniature';
import { getPetDefinition } from '../../features/pet/definitions/species';
import type { MemoryCard } from '../../shared/contracts/keepsakes';

export const memoryTitles = { ball: 'firstBall', mouse: 'firstMouse', focus: 'firstFocus', santa: 'firstSanta', highfive: 'firstHighFive' } as const;

export function MemoryPicture({ card }: { card: MemoryCard }) {
  const nudge = getPetDefinition(card.speciesId).play === 'fetch';
  const action = card.kind === 'highfive' ? 'FIVE_HIT' : card.kind === 'mouse' ? nudge ? 'MOUSE_NUDGE' : 'MOUSE_POUNCE' :
    card.kind === 'ball' ? nudge ? 'FETCH' : 'BAT' : card.kind === 'santa' ? 'IDLE' : 'READ';
  return <div className="souvenir-picture" data-kind={card.kind} data-action={action} data-still="" aria-hidden="true">
      <div className="souvenir-portrait"><PetMiniature {...card} action={action} yaw={card.kind === 'highfive' ? 12 : 34}/></div>
    </div>;
}
