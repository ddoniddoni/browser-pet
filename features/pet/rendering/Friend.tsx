import type { Outfit } from '../../../shared/contracts/character';
import { Garment, Headwear } from './Clothes';
import type { ReactNode } from 'react';
import type { LegacySpeciesId as PetSpeciesId } from '../definitions/species';
import { HighFivePaw } from './HighFivePaw';
import { Eye, Ink, Kerchief } from './Ink';

type FriendId = Exclude<PetSpeciesId, 'cat-default' | 'dog-default'>;
interface Drawing {
  coat: string; cream: string; feet: string;
  ears?: ReactNode; tail?: ReactNode; mask?: ReactNode; muzzle?: ReactNode; back?: ReactNode;
  head?: string; body?: string; bird?: boolean;
}

// 같은 펜으로 그리되 종의 윤곽(귀, 꼬리, 부리, 가시)을 먼저 구분한다. 좌표는 공통 96칸 원화 기준.
const friends: Record<FriendId, Drawing> = {
  rabbit: {
    coat: '#f3e7d9', cream: '#fff6eb', feet: '#dbc6b2',
    ears: <><path fill="#f3e7d9" d="M42 37C36 29 29 8 34 5C40 1 48 17 50 33M55 33C53 20 55 3 61 3C68 4 66 24 63 33"/>
      <path stroke="#d89894" strokeWidth="3" d="M36 11Q40 17 45 29M61 10Q59 19 59 27"/></>,
    tail: <circle cx="20" cy="68" r="10" fill="#fff8ef"/>,
    muzzle: <><path fill="#d39892" d="M60 51Q64 49 67 52L64 55Z"/><path d="M64 55v3m0 0q-3 3-5 0m5 0q2 3 5 0"/></>,
  },
  hamster: {
    coat: '#db9b5d', cream: '#fff0ce', feet: '#e5b4a0',
    head: 'M31 41C29 27 39 19 53 20C66 18 76 22 78 37C92 50 87 61 74 63C66 69 46 68 39 62C25 63 21 51 31 41Z',
    ears: <><circle cx="38" cy="28" r="9" fill="#e8ae78"/><circle cx="69" cy="26" r="8" fill="#e8ae78"/>
      <path d="M34 26q3-5 8 0m23-2q3-4 7 0" stroke="#c38376"/></>,
    mask: <><path fill="#ffebc1" stroke="none" d="M28 47Q34 39 43 45Q51 57 63 52Q78 40 83 47Q90 60 74 63Q58 71 39 61Q26 60 28 47Z"/>
      <path d="m33 54 5 1m38-3 5-2" stroke="#bd8362"/></>,
  },
  fox: {
    coat: '#dd854a', cream: '#ffedce', feet: '#805346',
    head:'M32 37L31 18Q31 13 37 17L48 26Q56 22 66 24L77 13Q81 11 80 18L79 33Q80 42 85 44L77 47L80 49L64 61Q58 65 53 61L33 51L29 47L34 45Z',
    tail:<><path fill="#d77842" d="M35 74C22 80 9 71 7 56Q7 49 5 41Q24 43 32 59L43 68Z"/>
      <path fill="#ffefce" d="M6 42Q17 43 23 50L19 49L21 55L16 53L17 59Q9 56 7 53Z"/></>,
    mask:<><path stroke="none" fill="#654339" d="M34 19L44 27L36 30ZM76 18L69 26L76 28Z"/>
      <path stroke="none" fill="#fff0d8" d="M33 44Q42 40 53 48L62 53L72 46Q78 41 82 44L76 49L79 49L64 61Q58 65 51 59L33 50L30 47Z"/></>,
  },
  otter: {
    coat:'#a87757',cream:'#f4dbb1',feet:'#926147',
    head:'M31 41C31 24 43 21 55 22C71 20 80 29 81 40Q88 48 80 56C69 66 44 65 34 56Q26 50 31 41Z',
    tail:<path fill="#9e6e50" d="M39 65Q28 70 17 71Q8 72 4 66Q4 77 18 79Q33 81 44 72Z"/>,
    ears:<><circle cx="34" cy="32" r="6" fill="#ae8062"/><circle cx="75" cy="32" r="5" fill="#ae8062"/></>,
    muzzle:<><ellipse cx="62" cy="52" rx="15" ry="9" fill="#f3d7ae"/><path fill="#513b34" d="M56 47Q62 45 67 48Q63 54 59 51Z"/>
      <path d="M61 51v3q-3 3-5 1m6-1q3 3 5 0m-14-3-9-2m10 5-9 2m26-6 9-2m-9 5 8 1" strokeWidth="1.5"/></>,
  },
  'red-panda': {
    coat:'#bc6240',cream:'#fee7c8',feet:'#594443',
    head:'M29 39Q29 25 45 24Q57 19 70 25Q80 29 79 41L85 47L79 49L82 51Q71 64 57 63Q41 65 28 53L31 49L26 47Z',
    body:'M25 57Q35 45 52 47Q70 46 72 63Q76 78 62 82Q40 87 25 76Q18 67 25 57Z',
    ears:<><path fill="#ffe8c7" d="M31 37Q23 18 29 15Q38 14 47 25ZM65 27Q74 12 82 15Q86 19 78 37Z"/>
      <path fill="#815249" stroke="none" d="M31 21L39 26L33 31ZM77 21L76 30L71 27Z"/></>,
    tail:<><path fill="#d68753" d="M35 70C26 81 9 76 6 60C4 50 7 39 13 40C19 41 16 51 21 55L37 60Z"/>
      <path d="M9 48l6 1m-7 9 9-2m-5 11 9-6m1 12 5-9" stroke="#9a533b" strokeWidth="4"/></>,
    mask:<><path fill="#fff0d8" stroke="none" d="M33 42Q38 31 47 34L51 38Q45 38 39 47ZM65 37Q74 29 77 40L72 44Q70 37 65 39ZM40 53L47 45L51 48L47 54Q58 49 62 49Q70 48 75 53Q68 62 59 62Q46 63 40 56Z"/></>,
  },
  hedgehog: {
    coat:'#d5ae85',cream:'#fff2d8',feet:'#ce997c',
    body:'M14 70L9 66L14 61L10 56L16 53L13 47L21 46L20 38L28 40L29 32L37 36L42 30L47 36L54 32L59 39Q69 50 66 68Q62 81 39 83Q22 85 14 74Z',
    head:'M41 48Q35 39 43 32Q48 27 54 32Q65 28 73 36L78 45Q81 48 88 49Q89 55 82 58Q68 66 55 64Q41 62 39 54Z',
    back:<path d="m22 53 4-5m4 11 5-6m-14 12 5-4m10 11 3-4" stroke="#8a694e" strokeWidth="2.4"/>,
    muzzle:<><path stroke="none" fill="#f9e8ce" d="M65 52Q74 46 86 49Q89 55 79 59Q70 63 63 62Z"/>
      <ellipse cx="85" cy="50" rx="3.6" ry="2.7" fill="#513b34"/></>,
  },
  penguin: {
    coat:'#465a6c',cream:'#fff5df',feet:'#e8a750',bird:true,
    body:'M25 62C24 47 36 37 50 36C67 35 78 48 77 66Q76 84 52 85Q29 86 25 73Z',
    head:'M31 40C30 23 41 15 55 16C70 15 81 26 80 42Q82 58 62 61Q39 62 33 51Z',
    mask:<path stroke="none" fill="#fff6df" d="M35 43Q35 29 47 30Q54 30 58 39Q63 29 69 31Q81 33 78 49Q76 60 59 60Q39 60 35 48Z"/>,
    muzzle:<path fill="#eaae55" d="M56 50Q62 47 70 51L63 56Q59 56 56 50Z"/>,
  },
  duck: {
    coat:'#efd076',cream:'#fff0b9',feet:'#e8a058',bird:true,
    head:'M36 39Q35 28 46 22L43 17Q46 14 51 19Q51 13 55 14L59 20Q77 19 81 35C88 50 76 61 61 61Q41 63 36 50Z',
    body:'M15 57Q20 61 28 58Q41 50 53 48Q71 47 75 64Q77 79 61 82Q39 89 24 77Q16 71 15 57Z',
    muzzle:<path fill="#e9a05a" d="M61 48Q66 45 73 47Q82 46 87 50Q88 54 78 56Q66 58 61 54Z"/>,
  },
};

export function Friend({ id, name, outfit }: { id: FriendId; name: string; outfit: Outfit }) {
  const a = friends[id];
  return <Ink species={id} name={name}><g className="ink-friend">
    <g className="ink-awake">
      <g className="ink-tail">{a.tail}</g>
      <g className="ink-back-paws" fill={a.feet}>
        <ellipse cx="39" cy="82" rx={a.bird ? 10 : 7} ry="3.6"/>
        <ellipse cx="61" cy="82" rx={a.bird ? 10 : 7} ry="3.6"/>
      </g>
      <g className="ink-torso">
        <path fill={id === 'hedgehog' ? '#977657' : a.coat} d={a.body ?? 'M24 62Q27 49 43 47Q61 43 69 55Q80 74 65 81Q43 88 27 77Q20 72 24 62Z'}/>
        {a.back}
        <path fill={a.cream} stroke="none" d="M47 63Q62 55 69 63Q77 76 63 80Q51 84 41 79Q39 69 47 63Z"/>
        <Garment outfit={outfit} />
      </g>
      <g className="ink-haunch"><path fill={a.coat} d={a.bird ? 'M29 59Q37 52 48 56Q48 69 33 73Q26 70 29 59Z' : 'M33 69Q23 70 27 79Q30 84 43 82Q48 80 42 77'}/></g>
      <g className="ink-forepaw"><path fill={a.bird ? a.coat : a.feet} d={a.bird ? 'M62 58Q73 53 75 62Q76 70 69 73Q66 68 62 58Z' : 'M58 69L58 78Q54 84 62 85L70 84Q74 82 68 78L68 68'}/></g>
      <Kerchief/>
      <g className="ink-head">
        <g className="ink-ear">{a.ears}</g>
        <path fill={id === 'hedgehog' ? a.cream : a.coat} d={a.head ?? 'M32 41Q30 26 47 24Q68 18 78 34Q88 51 75 58Q60 68 42 60Q27 55 32 41Z'}/>
        {a.mask}
        <Eye x={id === 'hedgehog' ? 55 : 46} y={42} small/>
        <Eye x={id === 'hedgehog' ? 72 : 69} y={41} small/>
        {a.muzzle ?? <><path fill="#594039" d="M58 51Q62 48 67 51L63 55Q60 55 58 51Z"/>
          <path d="M63 55v2m0 0q-3 3-5 0m5 0q3 2 5-1" strokeWidth="1.5"/></>}
        <Headwear outfit={outfit} species={id} />
      </g>
      <HighFivePaw fur={a.bird ? a.coat : a.feet} wing={a.bird}/>
    </g>
  </g></Ink>;
}
