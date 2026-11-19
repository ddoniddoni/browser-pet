import { t } from '../i18n';
export const personalities = [
  { value: 'calm', label: t('calm') }, { value: 'lively', label: t('lively') },
] as const;
export type Personality = typeof personalities[number]['value'];

export const scarves = [
  { value: 'none', label: t('removeScarf') }, { value: 'leaf', label: t('pineGreen') },
  { value: 'berry', label: t('berryRed') }, { value: 'sky', label: t('skyBlue') },
] as const;
export type Scarf = typeof scarves[number]['value'];
export function wornScarf(species: string, choice?: Scarf): Scarf {
  return choice ?? (species === 'dog-default' ? 'leaf' : 'none');
}

export const outfits = [
  { value: 'none', rail: 'everyday', label: t('noOutfit') },
  { value: 'denim', rail: 'everyday', label: t('denim') },
  { value: 'santa', rail: 'christmas', label: t('santa') },
  { value: 'elf', rail: 'christmas', label: t('elf') },
  { value: 'reindeer', rail: 'christmas', label: t('reindeer') },
] as const;
export type Outfit = typeof outfits[number]['value'];
