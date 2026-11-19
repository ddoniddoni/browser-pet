import { t } from '../../../shared/i18n';
import type { PetDefinition } from './sprite';

const inkPet = {defaultFacing:'right', renderer:'vector', clips:{}, fallbackAnimation:'idle'} as const;
function friend<const Id extends string>(id:Id, displayName:string, satiety:number, mood:number, play:'bat'|'fetch') {
  return {...inkPet,id,displayName,initialCare:{satiety,mood},play} satisfies PetDefinition & {
    initialCare:{satiety:number;mood:number};play:'bat'|'fetch'
  };
}

export const petDefinitions=[
  friend('kkogit',t('kkogit'),76,70,'bat'),
  friend('nurung',t('nurung'),62,84,'fetch'),
  friend('pongdang',t('pongdang'),68,76,'bat'),
] as const;
export type SignatureId=(typeof petDefinitions)[number]['id'];
export const defaultSpeciesId='nurung' as const;

// 이전 ID는 보관된 이름, 방, 카드의 유효성 확인과 일회성 이관에만 사용한다.
export const legacyIds=['cat-default','dog-default','rabbit','hamster','fox','otter','red-panda','hedgehog','penguin','duck'] as const;
export type LegacySpeciesId=(typeof legacyIds)[number];
export type PetSpeciesId=SignatureId;
export type AlbumSpeciesId=SignatureId | LegacySpeciesId;
export const isLegacySpeciesId=(id:unknown):id is LegacySpeciesId=>legacyIds.some(key=>key===id);
export const isPetSpeciesId=(id:unknown):id is SignatureId=>petDefinitions.some(p=>p.id===id);
export const isAlbumSpeciesId=(id:unknown):id is AlbumSpeciesId=>isPetSpeciesId(id)||isLegacySpeciesId(id);
export function getPetDefinition(id:unknown) {
  return petDefinitions.find(p=>p.id===id) ?? petDefinitions[1];
}
export const legacyNameKeys={'cat-default':'nabi','dog-default':'dog',rabbit:'rabbit',hamster:'hamster',fox:'fox',otter:'otter','red-panda':'redPanda',hedgehog:'hedgehog',penguin:'penguin',duck:'duck'} as const;
// v1에는 돌봄 수치가 없었다. 당시 종의 시작값으로 v2와 같은 기록을 만든다.
const oldCare:Record<LegacySpeciesId,[number,number]>={
  'cat-default':[70,70], 'dog-default':[62,84], rabbit:[76,65], hamster:[82,68], fox:[66,78],
  otter:[64,82], 'red-panda':[78,74], hedgehog:[74,62], penguin:[72,80], duck:[68,76],
};
export function legacyStartingCare(id:LegacySpeciesId) {
  const [satiety,mood]=oldCare[id];
  return {satiety,mood};
}
export function defaultPetName(id:string) {
  return isLegacySpeciesId(id)?t(legacyNameKeys[id]):isPetSpeciesId(id)?getPetDefinition(id).displayName:t('petGeneric');
}
