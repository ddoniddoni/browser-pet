import {defaultPetName,isLegacySpeciesId,legacyNameKeys,type SignatureId,type LegacySpeciesId} from '../../features/pet/definitions/species';
import type {PetState} from '../contracts/state';
import type {MemoryCard,Portrait} from '../contracts/keepsakes';

const successors:Record<LegacySpeciesId,SignatureId>={
  'dog-default':'nurung',fox:'nurung',otter:'nurung',
  'cat-default':'kkogit',rabbit:'kkogit',hamster:'kkogit','red-panda':'kkogit',hedgehog:'kkogit',
  penguin:'pongdang',duck:'pongdang'
};
// 원래 프로필과 같은 표시 언어가 아니어도 예전 기본 이름을 알아본다.
const oldDefaults:Record<typeof legacyNameKeys[LegacySpeciesId],readonly string[]>={"nabi": ["나비", "Nabi", "ナビ", "Nabi"], "dog": ["강아지", "Dog", "犬", "Perro"], "rabbit": ["토끼", "Rabbit", "うさぎ", "Conejo"], "hamster": ["햄스터", "Hamster", "ハムスター", "Hámster"], "fox": ["여우", "Fox", "キツネ", "Zorro"], "otter": ["수달", "Otter", "カワウソ", "Nutria"], "redPanda": ["레서판다", "Red panda", "レッサーパンダ", "Panda rojo"], "hedgehog": ["고슴도치", "Hedgehog", "ハリネズミ", "Erizo"], "penguin": ["펭귄", "Penguin", "ペンギン", "Pingüino"], "duck": ["오리", "Duck", "アヒル", "Pato"]};
function inheritedName(name:string,source:LegacySpeciesId,target:SignatureId) {
  return oldDefaults[legacyNameKeys[source]].includes(name)?defaultPetName(target):name;
}

export function adoptSignatureRoster(state:PetState):PetState {
  const active=state.pet.speciesId;
  if (!isLegacySpeciesId(active)) return state;
  const target=successors[active];
  const resting={...state.restingPets,[active]:{name:state.pet.name,care:state.care}};
  const sources=new Map<SignatureId,LegacySpeciesId>([[target,active]]);
  // 같은 후임으로 모이는 기록을 합치거나 지우지 않는다. 현재 친구를 우선한다.
  for(const id of ['dog-default','cat-default','duck',...Object.keys(resting)]){
    if(isLegacySpeciesId(id) && resting[id] && !sources.has(successors[id])) sources.set(successors[id],id);
  }
  const rooms={...state.rooms}, cards=[...(state.memories??[])];
  let focus=state.focusPortrait;
  function portrait<T extends Portrait>(p:T,id:SignatureId,old:LegacySpeciesId):T {
    return {...p,speciesId:id,name:inheritedName(p.name,old,id)};
  }
  for(const [id,old] of sources){
    const record=resting[old]!;
    if(id!==target && !resting[id]) resting[id]={...record,name:inheritedName(record.name,old,id)};
    for(const card of state.memories??[]) if(card.speciesId===old && !cards.some(c=>c.speciesId===id && c.kind===card.kind))
      cards.push(portrait<MemoryCard>(card,id,old));
    if(state.rooms?.[old] && !rooms[id]) rooms[id]=state.rooms[old];
    if(focus?.speciesId===old) focus=portrait(focus,id,old);
  }
  delete resting[target];
  const scene=state.scene && {...state.scene};
  if(scene?.five) delete scene.five;
  return {...state,pet:{...state.pet,speciesId:target,name:inheritedName(state.pet.name,active,target)},restingPets:resting,
    ...(state.rooms && {rooms}),...(state.memories && {memories:cards}),...(focus && {focusPortrait:focus}),...(scene && {scene})};
}
