import {getPetDefinition, type PetSpeciesId} from '../definitions/species';
import type { Facing } from '../core/patrol';
import {smooth} from './clay';
import {joint,type Rig} from './joints';

export const habitNames={kkogit:'habitKkogit',nurung:'habitNurung',pongdang:'habitPongdang'} as const;

export function habitRig(stored:PetSpeciesId,t:number,facing:Facing):Rig {
  const id=getPetDefinition(stored).id, a=smooth(t/.22)*smooth((1-t)/.20),wave=Math.sin(t*Math.PI*4)*a;
  const dog=id==='nurung', duck=id==='pongdang';
  const body=joint(new DOMMatrix().translate(0,duck?.035*Math.abs(wave):0,0),[0,.50,0],0,0,duck?9*wave:0);
  const head=joint(body.translate(dog?.15*a:0,dog?-.16*a:0,0),[0,dog?.81:1.10,.1],
    dog?6*a:duck?-5*a:9*a,(duck?-15*wave:-18*a)*facing,dog?-16*a:6*wave);
  const ey=dog?.975:1.57;
  const eyes=head.translate(0,ey,0).scale(1,dog?1-.86*a:1,1).translate(0,-ey,0);
  return {body,head,eyes,tail:joint(body,[-.20,.37,-.48],id==='kkogit'?-14*a:0,id==='kkogit'?-52*a:0,id==='kkogit'?-16*a:0),
    foreL:joint(body,[-.46,.9,0],0,0,duck?-20*a:0),foreR:joint(body,[.46,.9,0],0,0,duck?20*a:0),
    hindL:body.translate(0,duck?.10*Math.max(0,-wave):0,0),hindR:body.translate(0,duck?.18*Math.max(0,wave):0,0)};
}
export function boxRig(stored:PetSpeciesId,t:number):Rig {
  const id=getPetDefinition(stored).id,a=smooth(t/.65),body=new DOMMatrix(),dog=id==='nurung',bird=id==='pongdang';
  const head=joint(body.translate(0,dog?.12*a:-.20*a,.12*a),[0,1,.1],6*a,-12*a,8*a);
  return {body,head,eyes:head,tail:joint(body,[-.2,.37,-.48],-12*a,-14*a),
    foreL:joint(body,[-.45,.8,0],0,0,bird?-52*a:0),foreR:joint(body,[.45,.8,0],0,0,bird?52*a:0)};
}
