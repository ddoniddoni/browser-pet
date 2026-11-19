import {getPetDefinition} from '../definitions/species';
import type {Outfit,Scarf} from '../../../shared/contracts/character';
import kkogit from '../../../assets/signatures/kkogit.png?inline';
import nurung from '../../../assets/signatures/nurung.png?inline';
import pongdang from '../../../assets/signatures/pongdang.png?inline';

const portraits={kkogit,nurung,pongdang};
// Canvas를 쓸 수 없는 페이지에서도 같은 모형에서 렌더한 원래 친구를 표시한다.
export function PetAvatar({name,speciesId}:{name:string;speciesId:string;scarf?:Scarf;outfit?:Outfit}) {
  return <span className="pet-avatar"><img src={portraits[getPetDefinition(speciesId).id]} alt={name} draggable={false} style={{display:'block',width:'100%',height:'100%'}}/></span>;
}
