import type { Outfit } from '../../../shared/contracts/character';
import { Garment, Headwear } from './Clothes';
import { HighFivePaw } from './HighFivePaw';
import { Eye, Ink, Kerchief } from './Ink';

const apricot = '#efa963', cream = '#ffebc8', marmalade = '#be663d';

function CatNap({ outfit }: { outfit: Outfit }) {
  return <g className="ink-nest">
    <path fill={apricot} d="M9 72C8 58 18 45 35 42C51 38 64 45 71 54Q85 60 86 73C86 83 71 87 47 87C25 88 11 85 9 72Z" />
    <path stroke="none" fill={marmalade} d="M21 49Q25 47 29 46Q25 57 19 58Q17 57 21 49ZM32 45L39 43Q37 51 33 53Q30 54 32 45Z" />
    <Garment outfit={outfit} curled />
    <path className="pet-scarf" fill="var(--scarf)" d="M42 65Q47 59 57 59L55 75L43 79Z" />
    <path fill={apricot} d="M43 65L44 49Q45 45 48 48L55 54Q62 52 70 54L77 48Q80 46 80 50L80 60Q88 66 87 72C87 80 76 84 63 83Q46 83 43 71Z" />
    <path fill="#ed9b89" stroke="none" d="M47 52L52 56L47 59ZM74 56L78 52L78 59Z" />
    <path fill={cream} stroke="none" d="M50 73Q55 68 61 72Q69 68 78 73Q82 75 80 78Q72 83 60 81Q50 81 50 73Z" />
    <path d="M51 67Q54 70 58 67M70 66Q73 69 77 66" strokeWidth="2" />
    <path fill="#955548" stroke="none" d="M61 72Q65 70 68 72Q67 75 64 75Z" />
    <path fill={apricot} d="M12 65C8 74 16 82 28 83C39 85 50 79 58 76C64 74 68 76 67 80C64 89 38 92 22 87C12 84 7 77 9 70" />
    <path fill={cream} stroke="none" d="M51 80Q64 72 66 78Q68 83 54 86Q56 82 51 80Z" />
    <Headwear outfit={outfit} species="cat-default" curled />
  </g>;
}

export function Cat({ name, outfit }: { name: string; outfit: Outfit }) {
  return <Ink name={name} species="cat">
    <g className="ink-awake">
      <g className="ink-tail">
        <path fill={apricot} d="M32 74C20 82 9 74 8 61C6 52 8 44 14 42C21 39 25 45 22 50C21 53 18 53 17 55C15 60 19 68 26 65Z" />
        <path fill={cream} stroke="none" d="M10 50Q11 42 16 43Q23 42 22 48Q21 51 17 53Q14 50 10 50Z" />
        <path d="M11 64Q14 62 16 63" stroke={marmalade} strokeWidth="3.3" />
      </g>
      <g className="ink-back-paws" fill="#c78350">
        <path d="M33 69L35 82Q37 86 44 84L46 72ZM61 68L64 81Q66 85 73 83L72 69Z" />
      </g>
      <g className="ink-torso">
        <path fill={apricot} d="M25 61C27 50 37 46 49 45Q66 43 73 56C80 70 74 80 58 81L39 81C25 82 20 74 25 61Z" />
        <path stroke="none" fill={cream} d="M49 58Q59 51 68 58Q79 68 65 76Q56 81 42 78Q50 72 49 58Z" />
        <path d="M28 58Q31 60 32 63M26 64Q29 65 30 68" stroke={marmalade} strokeWidth="3" />
        <Garment outfit={outfit} />
      </g>
      <g className="ink-haunch"><path fill={apricot} d="M39 68Q30 65 26 71C21 79 26 84 31 85L42 85Q47 83 44 80L39 78" /></g>
      <g className="ink-forepaw"><path fill={cream} d="M62 69Q59 73 60 80Q59 85 65 85L72 85Q77 84 74 80L70 78L72 69" /></g>
      <Kerchief />
      <g className="ink-head">
        <path fill={apricot} d="M30 33Q28 21 33 12Q34 9 37 12L49 22Q59 19 67 22L76 14Q80 10 81 16L82 32Q89 40 87 48L90 48Q88 55 82 57C76 65 66 68 54 66Q40 66 31 59L26 56L29 52C24 47 26 39 30 33Z" />
        <path fill="#e99081" stroke="none" d="M33 30Q32 22 35 16L44 24Q38 25 33 30ZM72 24L77 18L79 29Z" />
        <path fill={marmalade} stroke="none" d="M49 23Q54 21 58 22Q58 28 53 32Q50 33 52 28ZM59 22Q63 22 66 23Q65 28 61 29Q59 29 60 26Z" />
        <path fill={cream} stroke="none" d="M34 50Q41 52 47 49Q52 46 58 49Q62 52 66 50Q75 45 82 50L85 53Q81 62 69 64Q49 69 35 57Z" />
        <g fill="#d87e70" stroke="none"><ellipse cx="42" cy="50" rx="4.5" ry="2.1" /><ellipse cx="79" cy="47" rx="3.1" ry="1.65" /></g>
        <Eye x={49} y={43} /><Eye x={73} y={41.5} small />
        <path fill="#995844" stroke="none" d="M58 48Q62 45.8 66 48Q65 51 62 52Q59 51 58 48Z" />
        <path d="M62 51Q62 56 58 55M62 52Q63 56 67 53.5" strokeWidth="1.45" />
        <path d="M33 47L38 48M32 51L37 51" stroke="#82583e" strokeWidth="1.45" />
        <Headwear outfit={outfit} species="cat-default" />
      </g>
      <HighFivePaw fur={cream}/>
    </g>
    <CatNap outfit={outfit} />
  </Ink>;
}
