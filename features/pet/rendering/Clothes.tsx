import type { Outfit } from '../../../shared/contracts/character';
import type { LegacySpeciesId as PetSpeciesId } from '../definitions/species';

const fleece = '#fff2d9', red = '#bb4148', pine = '#396c54', gold = '#efbf61';
const ink = '#53382f', denim = '#52758c';

// 몸통과 같은 96칸 원화의 등선, 앞발, 날개 사이에 놓는다. 낮잠 원화는 등을 옆에서 본다.
export function Garment({ outfit, curled = false }: { outfit: Outfit; curled?: boolean }) {
  if (outfit === 'none') return null;
  if (curled) {
    const blanket = 'M11 64Q16 49 35 46Q45 43 54 48Q50 56 43 67Q37 76 29 80Q16 79 11 71Z';
    return <g strokeWidth="1.8">
      <path d={blanket} fill={{ denim, santa: red, elf: pine, reindeer: '#ae754b' }[outfit]} />
      {outfit === 'santa' && <><path fill={fleece} d="M11 65Q23 66 37 55L40 59Q25 74 11 71Z"/>
        <path stroke="#783d37" d="m24 58 8-5"/></>}
      {outfit === 'elf' && <><path fill="#91ad70" d="M12 62Q19 50 34 47L39 47L35 55L28 54L24 61L19 59L15 65Z"/>
        <circle cx="23" cy="63" r="2.1" fill={gold}/></>}
      {outfit === 'reindeer' && <><path stroke={fleece} strokeWidth="3" d="m17 59 4 1 2-5 4 1 2-5 4 1"/>
        <path fill={fleece} d="M11 67Q15 73 29 75L25 79Q14 78 11 72Z"/></>}
      {outfit === 'denim' && <><path fill="#aac1c9" d="m19 54 5-3 8 10-4 4Z"/>
        <path fill="#6c8ea2" d="m20 65 10-4 2 6-4 4-6-1Z"/><circle fill={gold} cx="28" cy="61" r="1.6"/></>}
    </g>;
  }
  return <g strokeWidth="1.85">
    {outfit === 'santa' && <>
      <path fill={red} d="M34 51Q46 47 62 49L71 57Q74 65 75 74Q56 83 23 75Q24 61 34 51Z"/>
      <path fill={fleece} d="M24 71Q49 78 74 69L75 75Q52 84 23 76Z"/>
      <path d="M54 58L52 75" stroke={fleece} strokeWidth="4.5"/>
      <path fill="#563e39" d="M24 65Q48 71 73 62L74 66Q50 75 24 69Z"/>
      <path fill={gold} d="m49 67 8-1 .6 5-8 1Z"/>
    </>}
    {outfit === 'elf' && <>
      <path fill={pine} d="M35 52Q50 47 64 51L70 58L76 74L68 72L65 79L55 75L48 81L40 76L31 79L30 73L22 75Q26 59 35 52Z"/>
      <path fill="#91ad70" d="M34 52Q51 49 66 51L69 59L64 66L58 61L52 69L48 62L39 66L39 60L29 61Z"/>
      <circle cx="53" cy="70" r="2.8" fill={gold}/>
    </>}
    {outfit === 'reindeer' && <>
      <path fill="#aa754e" d="M34 51L45 49Q48 60 57 65Q65 61 66 53L72 59L74 75Q49 84 24 75Q25 60 34 51Z"/>
      <path fill={fleece} d="M39 50L45 48Q49 58 57 62Q63 58 65 52L69 55Q65 65 57 69Q44 62 39 53Z"/>
      <path d="m32 69 4 3 4-3 4 3" stroke="#f5d49a" strokeWidth="2.2"/>
      <circle cx="57" cy="70" r="3.7" fill={gold}/><path d="M56 72h2" strokeWidth="1.15"/>
    </>}
    {outfit === 'denim' && <>
      <path fill={denim} d="M25 61Q34 63 42 61L47 56L65 54L68 63L74 67L72 78Q63 81 55 79L50 76L44 80L29 80Q22 75 25 61Z"/>
      <path fill="#7f9fad" d="m33 52 5-2 12 12-5 3Z"/>
      <path fill="#7394a6" d="m46 65 12-1 .5 7-5.5 3-6-2Z"/>
      <circle cx="47" cy="62" r="2" fill={gold}/><circle cx="64" cy="60" r="2" fill={gold}/>
      <path stroke="#d9c29a" d="m29 75 8 1" strokeWidth="1.4"/>
    </>}
  </g>;
}

// 모자 챙 중앙을 기준으로 귀와 눈 사이에 맞춘다. 토끼 귀와 고슴도치 가시는 모자 뒤로 남긴다.
const hatFit: Record<PetSpeciesId, [number, number, number]> = {
  'cat-default': [56, 25, .92], 'dog-default': [58, 21, .89], rabbit: [57, 32, .84],
  hamster: [54, 26, .91], fox: [56, 27, .87], otter: [54, 26, .95],
  'red-panda': [55, 27, .92], hedgehog: [59, 34, .8], penguin: [55, 21, .91], duck: [59, 25, .88],
};
export function Headwear({ outfit, species, curled = false }: { outfit: Outfit; species: PetSpeciesId; curled?: boolean }) {
  if (outfit === 'none' || outfit === 'denim') return null;
  const [x, y, scale] = curled ? (species === 'cat-default' ? [62, 56, .65] : [65, 57, .66]) : hatFit[species];
  return <g transform={`translate(${x} ${y}) rotate(${curled ? -12 : -5}) scale(${scale})`} strokeWidth="2">
    {outfit === 'santa' && <>
      <path fill={red} d="M-17-3Q-13-15-4-20Q2-23 9-18L19-9L15-5L5-11L9-2Q-2 3-17-3Z"/>
      <path d="M4-14Q6-16 9-15" stroke="#883941" strokeWidth="1.5"/>
      <circle cx="19" cy="-7" r="5" fill={fleece}/>
      <path fill={fleece} d="M-18-4Q-9-7 6-6Q11-7 12-3L12-1Q12 2 8 2Q-6 1-16 4Q-20 5-20 1Q-21-2-18-4Z"/>
    </>}
    {outfit === 'elf' && <>
      <path fill={pine} d="M-17-2Q-12-16-20-20Q-10-24-2-17Q8-8 15-6L14-1Z"/>
      <path fill="#af4548" d="M-17-5Q-5-7 14-5L17-1L10 1L6 5L1 1L-6 5L-9 2L-18 4Z"/>
      <circle cx="-20" cy="-19" r="3.3" fill={gold}/>
    </>}
    {outfit === 'reindeer' && <>
      {[ink, '#ce9761'].map((color, i) => <path key={color} fill="none" stroke={color} strokeWidth={i ? 3.1 : 6.5}
        d="M-11-1Q-15-7-13-17M-14-9Q-20-10-21-14M9-2Q15-8 14-17M14-10Q20-12 21-16"/>)}
      <path fill="#a84942" d="M-16 0Q-2-7 14-3L15 1Q0-2-14 5Z"/>
    </>}
  </g>;
}
