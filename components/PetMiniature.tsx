import { useEffect, useRef, useState } from 'react';
import { getPetDefinition } from '../features/pet/definitions/species';
import { PetAvatar } from '../features/pet/rendering/PetAvatar';
import { mountMiniature, type Mode } from '../features/pet/sculpture/miniature';
import { wornScarf, type Outfit, type Scarf } from '../shared/contracts/character';

interface Props {
  speciesId: string; name: string; scarf?: Scarf; outfit?: Outfit;
  action?: string; yaw?: number; mode?: Mode; still?: boolean; startedAt?: number;
}
export function PetMiniature({speciesId, name, scarf, outfit='none', action='IDLE', yaw=24,
  mode='still', still=false, startedAt}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [useVector, setUseVector] = useState(false);
  const id = getPetDefinition(speciesId).id, neck = wornScarf(id,scarf);
  useEffect(() => {
    if (!canvas.current || useVector) return;
    return mountMiniature(canvas.current,{id,scarf:neck,outfit,action,yaw,mode,still,startedAt},() => setUseVector(true));
  },[id,neck,outfit,action,yaw,mode,still,startedAt,useVector]);
  return useVector ? <PetAvatar {...{speciesId,name,scarf,outfit}}/> :
    <canvas className="pet-miniature" ref={canvas} width="96" height="96" role="img" aria-label={name}/>;
}
