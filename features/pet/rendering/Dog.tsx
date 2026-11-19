import type { Outfit } from '../../../shared/contracts/character';
import { Garment, Headwear } from './Clothes';
import { HighFivePaw } from './HighFivePaw';
import { Eye, Ink, Kerchief } from './Ink';

const biscuit = '#eec084', cocoa = '#875640', milk = '#fff0cf';

function DogNap({ outfit }: { outfit: Outfit }) {
  return <g className="ink-nest">
    <path fill={biscuit} d="M8 72C7 59 18 48 32 47Q52 45 65 58L77 70Q88 83 66 85L35 86C20 87 10 84 8 72Z" />
    <path fill={cocoa} stroke="none" d="M12 60C17 52 24 49 34 49Q45 48 47 52C46 59 38 60 32 59Q27 59 25 65Q21 71 13 69Q10 67 12 60Z" />
    <Garment outfit={outfit} curled />
    <path fill={milk} d="M13 70Q8 70 6 64Q4 61 3 66C1 75 7 83 20 84L33 84Q40 83 37 79Q35 76 26 77Q18 77 13 70Z" />
    <path className="pet-scarf" fill="var(--scarf)" d="M40 65Q45 59 53 60L51 75L39 80Z" />
    <path fill={biscuit} d="M45 65Q46 54 57 53Q74 50 81 61L85 66Q92 68 91 73Q90 81 77 82L58 82Q44 81 45 65Z" />
    <path fill={milk} stroke="none" d="M70 55Q79 56 82 64L85 68Q94 70 88 76Q84 82 67 81Q64 77 69 72Q73 66 70 55Z" />
    <path fill={milk} d="M56 76Q60 73 66 76Q69 76 74 78Q80 79 79 82Q78 85 69 85L59 85Q52 84 56 76Z" />
    <path d="M71 66Q75 69 79 66" strokeWidth="2" />
    <path fill="#402f2f" stroke="none" d="M84 67Q89 65 91 68Q91 71 87 72Q83 71 84 67Z" />
    <path fill={cocoa} d="M56 55C48 52 39 58 37 68Q36 72 33 75C30 79 36 82 42 80C51 77 58 67 59 61" />
    <path d="M39 76Q46 74 50 67" stroke="#ac7956" strokeWidth="2" />
    <Headwear outfit={outfit} species="dog-default" curled />
  </g>;
}

export function Dog({ name, outfit }: { name: string; outfit: Outfit }) {
  return <Ink name={name} species="dog">
    <g className="ink-awake">
      <g className="ink-tail">
        <path fill={biscuit} d="M29 65C21 66 17 60 16 54Q15 48 11 48C6 48 5 53 7 60Q5 59 4 61C7 75 21 79 31 74Z" />
        <path fill={milk} stroke="none" d="M9 61Q5 50 11 50Q14 50 15 55L17 61L13 59L12 63Z" />
      </g>
      <g className="ink-back-paws" fill="#c69066">
        <path d="M32 68L34 81Q35 85 42 84L45 69ZM61 66L65 81Q68 85 74 82L71 67Z" />
      </g>
      <g className="ink-torso">
        <path fill={biscuit} d="M22 62Q25 50 40 48L56 44C68 44 76 50 75 63C75 75 68 80 53 80L37 80C24 81 18 75 22 62Z" />
        <path fill={cocoa} stroke="none" d="M24 61Q28 51 40 50L50 47Q53 53 46 57Q41 60 35 58Q32 58 30 62Q27 66 23 64Z" />
        <path fill={milk} stroke="none" d="M49 64Q53 53 67 53Q78 59 69 70Q61 80 41 78Q49 73 49 64Z" />
        <Garment outfit={outfit} />
      </g>
      <g className="ink-haunch"><path fill={biscuit} d="M37 67Q28 65 24 72Q19 83 29 85L41 85Q46 83 42 79L38 77" /></g>
      <g className="ink-forepaw"><path fill={milk} d="M58 70L59 79Q57 85 64 85L72 85Q76 84 74 80L69 77L70 68" /></g>
      <Kerchief />
      <g className="ink-head">
        <path fill={cocoa} d="M69 21Q79 15 84 25Q88 33 83 38L72 32Z" />
        <path fill={biscuit} d="M33 35C33 23 43 16 54 17Q58 12 62 13L61 17Q73 15 79 23Q83 28 83 35L87 41Q93 44 90 51C86 59 77 62 62 62Q44 64 36 56Q29 48 33 35Z" />
        <path fill={milk} stroke="none" d="M63 18Q68 17 72 19Q70 24 71 29Q73 37 78 37Q85 37 89 44Q94 51 82 57Q66 65 52 58Q46 55 48 50Q50 44 60 41Q66 39 65 32Q63 24 63 18Z" />
        <Eye x={59} y={37} /><Eye x={78} y={35.5} small />
        <path fill="#d6977a" stroke="none" d="M50 44Q54 41 58 44Q58 47 53 47Q49 47 50 44Z" />
        <path fill="#423230" strokeWidth="1.55" d="M77 41Q83 38 87 41Q89 44 85 47Q82 49 80 47Q76 44 77 41Z" />
        <path d="M82 48Q80 54 74 52" strokeWidth="1.8" />
        <g className="ink-ear">
          <path fill={cocoa} d="M49 22C44 18 36 19 30 27Q26 33 21 38Q15 44 20 49Q25 55 35 50C43 46 49 35 51 28" />
          <path d="M23 46Q28 47 33 42" stroke="#b98761" strokeWidth="2.6" />
        </g>
        <Headwear outfit={outfit} species="dog-default" />
      </g>
      <HighFivePaw fur={milk} double/>
    </g>
    <DogNap outfit={outfit} />
  </Ink>;
}
