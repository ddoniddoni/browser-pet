import type { Facing } from '../core/patrol';
import type { PetSpeciesId } from '../definitions/species';
import { smooth, type Vec } from './clay';
import { joint, type Rig } from './joints';
import { dangleRig } from './dangle';
import { habitRig, boxRig } from './character-acts';
export { joint, type Rig } from './joints';

const ramp = (t: number, from: number, to: number) => smooth((t - from) / (to - from));
const pulse = (t: number, from: number, crest: number, until: number) =>
  ramp(t, from, crest) * (1 - ramp(t, crest, until));

// 발을 방석에 둔 채 관절을 접는다. 머리와 모자가 상속하는 변환에는 확대/축소가 없다.
function restingRig(id: PetSpeciesId, settle: number): Rig {
  const r = smooth(settle), bird = id === 'pongdang';
  const floor = new DOMMatrix();
  const body = joint(floor.translate(0,-.05*r,.05*r),[0,.54,0],7*r);
  const head = joint(body.translate(0,-.09*r,.025*r),[0,1.10,.06],10*r,-19*r,-6*r);
  function fore(side: number) {
    if (bird) return joint(body,[side*.48,.94,-.09],15*r,0,-side*8*r);
    return joint(floor.translate(-side*.025*r,0,-.075*r),[side*.204,.14,.32],-23*r,0,side*4*r);
  }
  function hind(side: number) {
    const foot: Vec = bird ? [side*.25,.116,.14] : [side*.396,.144,.061];
    return joint(floor.translate(-side*.025*r,0,.025*r),foot,6*r,-side*8*r);
  }
  return {body,head,eyes:jointEyes(head,1-.88*r,id),foreL:fore(-1),foreR:fore(1),
    hindL:hind(-1),hindR:hind(1),tail:joint(body,[.04,.32,-.38],-10*r,-14*r,12*r)};
}

export function rigFor(id: PetSpeciesId, action: string, frame: number, frames: number, facing: Facing, settle = 1): Rig {
  if (action === 'DRAG') return dangleRig(id,frame,frames);
  if (action === 'HABIT') return habitRig(id,frames>1?frame/(frames-1):.42,facing);
  if (action === 'BOX') return boxRig(id,frames>1?frame/(frames-1):1);
  if (action === 'SLEEP') return restingRig(id,settle);
  const hopping = action === 'HOP', floating = action === 'FLOAT';
  const phase = frame * Math.PI * 2 / Math.max(1, frames);
  const lift = hopping ? .10 * (1 - Math.cos(phase)) : floating ? .10 + .04 * Math.sin(phase) : 0;
  const walking = action === 'WALK', eat = action === 'EAT';
  const pat = action === 'PETTED', read = action === 'READ';
  const ready = action === 'FIVE_READY', hit = action === 'FIVE_HIT';
  const watch = action === 'PLAY_LOOK', crouch = action === 'MOUSE_CROUCH';
  const pounce = action === 'MOUSE_POUNCE', nudge = action === 'MOUSE_NUDGE';
  const swat = action === 'BAT', fetch = action === 'FETCH';
  const bird = id === 'pongdang', dog = id === 'nurung';
  // 동작 줄이기에서는 한 장으로도 각 행동을 구분할 수 있는 시점을 고른다.
  const t = frames > 1 ? frame / (frames - 1) : ready || crouch || watch ? 1 : hit ? .28 : .42;
  const gait = walking ? Math.sin(frame * Math.PI * 2 / frames) : 0;
  const wave = Math.sin(t * Math.PI * 2), wiggle = Math.sin(t * Math.PI * 4);
  const five = ready ? .76*ramp(t,0,.93) : hit ? (.76+.24*ramp(t,0,.19))*(1-ramp(t,.48,1)) : 0;
  const tap = hit ? pulse(t,0,.20,.55) : 0;
  // 착지(.414)는 장난감 이동이 끝나는 시점. 이후 잠깐 눌렀다가 앞발을 뗀다.
  const reach = pounce ? ramp(t,0,.29)*(1-ramp(t,.60,1)) : 0;
  const land = pounce ? pulse(t,.29,.45,.81) : 0;
  const tuck = crouch ? .28+.72*ramp(t,0,1) : pounce ? (1-ramp(t,0,.28))+land : 0;
  const nose = nudge ? pulse(t,0,.32,.96) : fetch ? pulse(t,0,.27,.86) : 0;
  const bat = swat ? pulse(t,0,.30,1) : 0;
  const bite = eat ? .5-.5*Math.cos(t*Math.PI*6) : 0;
  const lean = eat ? 16+12*bite : read ? 9 : 13*tuck+11*reach+14*nose-8*five+7*tap;
  const torso = new DOMMatrix().translate(0, lift + (walking ? .045*Math.abs(gait) : .055*five), .13*nose+.05*reach);
  if (action === 'SIT' || action === 'PINNED' || read) torso.scaleSelf(1.04,.92,1.04);
  if (tuck) torso.scaleSelf(1+.055*tuck,1-.25*tuck,1+.10*tuck);
  const body = joint(torso,[0,.54,0],lean,0,bird && walking ? gait*5 : -4*five*facing);
  const neck = eat ? 16+17*bite : read ? 19 : watch ? 4-15*t :
    5*tuck+9*land+22*nose+(fetch?10:0)-5*five+gait*2;
  const head = joint(body,[0,1.10,.06],neck,watch ? (1-t)*14 : 0,
    pat ? -8-6*Math.sin(t*Math.PI) : -6*five*facing);
  const blink = hit && id === 'kkogit' ? 1-.91*pulse(t,.13,.48,.85) : 1;
  const eyes = jointEyes(head, pat || eat ? .12 : blink,id);
  function limb(side: number, front: boolean) {
    const at: Vec = front ? bird ? [side*.48,.94,-.09] : [side*.204,.54,.22] : [side*.39,.38,-.12];
    // 누룽은 엎드린 채 뒷발을 올리고, 퐁당은 양 날개를 내민다.
    if (dog && !front && side===facing && five>0) {
      const pose=body.translate(side*.32*five,.96*five,.47*five);
      return joint(pose,[side*.51,.25,-.48],-122*five,side*20*five,side*20*five);
    }
    if (action === 'WAVE' && front && side === facing) {
      const lift = frames > 1 ? pulse(t, 0, .24, 1) : 1;
      return joint(body.translate(0, .24*lift, .10*lift), at, -100*lift, 0, side*lift*(32+13*Math.sin(4*Math.PI*t)));
    }
    const greet = front && !dog && (bird || side===facing) ? five : 0;
    const strike = front ? (side === facing ? bat : 0)+reach*(side > 0 ? 1 : .73) : 0;
    const stride = walking ? gait*side*(front?1:-1)*(bird?20:32) : 0;
    const pitch = stride + (hopping ? (front ? -1 : 1) * 22 * Math.sin(phase) : floating ? (front ? -15 : 10) : 0) - greet*(bird?39:115) - strike*(bird?34:82) +
      (!front ? 23*reach-15*land : 0);
    const spread = side*((floating ? 15 + 5 * Math.sin(phase) : 0) + greet*(bird?110:42)+strike*(bird?57:17));
    const mount = body.translate(0, (bird?0:.38)*greet+.042*Math.max(0,stride/32),
      .24*greet + .21*tap*(greet>0?1:0) + .13*strike);
    return joint(mount,at,pitch,0,spread);
  }
  return {body,head,eyes,foreL:limb(-1,true),foreR:limb(1,true),hindL:limb(-1,false),hindR:limb(1,false),
    tail:joint(body,[.04,.32,-.38],-18*tuck+12*reach, dog && (pat||hit||fetch)?24*wiggle:
      id==='kkogit' && five ? -30*five : walking?8*gait:crouch?14*wiggle:8*wave*reach)};
}

function jointEyes(head: DOMMatrix, height: number,id:PetSpeciesId) {
  const y=id==='nurung'?.975:1.57;
  return head.translate(0,y,0).scale(1,height,1).translate(0,-y,0);
}
