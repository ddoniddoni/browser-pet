import type { PetSpeciesId } from '../definitions/species';
import { joint, type Rig } from './joints';
import type { Vec } from './clay';

// 목덜미가 받침점이다. 머리는 거의 그대로 두고 아래쪽 몸과 팔다리가 서로 늦게 따라온다.
export function dangleRig(id: PetSpeciesId, frame: number, count: number): Rig {
  const dog = id === 'nurung', duck = id === 'pongdang', still = count === 1;
  const beat = count > 1 ? 2 * Math.PI * frame / count : 0;
  const sway = still ? 0 : Math.sin(beat);
  const follow = still ? 0 : Math.sin(beat - .65);
  const kick = still ? .38 : Math.sin(2 * beat + .24) * (.75 + .25 * Math.cos(beat));
  const flap = still ? .3 : Math.sin(2 * beat - .68);
  const lift = new DOMMatrix().translate(0, dog ? .50 : .13, 0);
  const nape: Vec = dog ? [0,1.13,.31] : [0,1.66,0];
  const body = joint(lift,nape,dog ? -36 + 4*follow : -8 + 4*follow,4*follow,9*sway);
  const head = joint(lift,nape,dog ? -4 : -2,2*sway,-3*follow);

  function fore(side: number) {
    if (duck) return joint(body,[side*.45,1.04,-.08],8+14*flap,0,side*(46+30*flap)+5*sway);
    if (dog) {
      // 엎드린 모형의 앞발을 가슴 앞에 늘어뜨려 뒷발과 다른 박자로 허우적댄다.
      const paw=joint(lift,[side*.34,.60,.48],-4+side*39*flap,0,side*24+6*follow);
      return paw.translate(0,.48,0).scale(1,1.16,1).translate(0,-.48,0);
    }
    // 꼬깃은 한쪽 앞발로 쪽지를 붙잡는다.
    return joint(body,[side*.32,.94,.30],side<0 ? -10 : 10+18*flap,0,side<0 ? 8 : 22+15*flap);
  }
  function hind(side: number) {
    const hip: Vec = dog ? [side*.48,.47,-.36] : duck ? [side*(side>0?.48:.26),.47,.10] : [side*.34,.49,-.04];
    const pedal = side*kick;
    return joint(body,hip,-13 + (duck ? 52 : 48)*pedal,side*8,side*(16+10*pedal));
  }
  const rig: Rig = {body,head,eyes:head,foreL:fore(-1),foreR:fore(1),hindL:hind(-1),hindR:hind(1),
    tail:joint(body,dog ? [.35,.66,-.80] : [-.20,.37,-.48],-9+5*follow,12*follow,-12*sway)};
  if (dog) {
    for (const side of [-1,1]) rig[side<0 ? 'earL' : 'earR'] =
      joint(head,[side*.55,1.26,.44],5*follow,0,8*follow+side*4*flap);
  }
  return rig;
}
