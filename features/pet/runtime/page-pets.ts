import { announcementCompanion, companionFor, companionIds, type CompanionId } from '../../../shared/contracts/companions';
import type { PetState } from '../../../shared/contracts/state';
import { mountPagePet } from './page-cat';

export function mountPagePets(container: HTMLElement, initial: PetState) {
  const mounted = new Map<CompanionId, { node: HTMLElement; pet: ReturnType<typeof mountPagePet> }>();
  function update(state: PetState) {
    const ids = companionIds(state);
    for (const [id, current] of mounted) if (!ids.includes(id)) {
      current.pet.remove(); current.node.remove(); mounted.delete(id);
    }
    for (const id of ids) {
      const current = mounted.get(id);
      if (!companionFor(state, id).enabled) {
        current?.pet.remove(); current?.node.remove(); mounted.delete(id);
      } else if (current) current.pet.update(state);
      else {
        const node = document.createElement('div');
        node.className = 'pet-companion'; node.dataset.companion = id;
        container.append(node);
        mounted.set(id, { node, pet: mountPagePet(node, state, id) });
      }
    }
  }
  update(initial);
  return { update, greet(state: PetState) {
    const id = announcementCompanion(state);
    if (id) mounted.get(id)?.pet.greet();
  }, remove() {
    for (const { node, pet } of mounted.values()) { pet.remove(); node.remove(); }
    mounted.clear();
  } };
}
