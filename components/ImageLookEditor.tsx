import { useEffect, useId, useRef, useState } from 'react';
import { movements, movementLabel, type Movement } from '../shared/contracts/companions';
import { sameAnimation, type ImageLook, type PetPicture } from '../shared/contracts/image-pet';
import { createStickerPlayer, type PreviewStatus } from '../shared/images/sticker-player';
import { t } from '../shared/i18n';
import { Chevron } from './Chevron';
import './pet-motion.css';

interface PreviewProps extends PetPicture {
  look: ImageLook;
  angle?: number;
  size?: number;
  still?: boolean;
  onStatus?: (status: PreviewStatus) => void;
}
export function ImagePetPreview({ image, animation, look, angle = 18, size = 128, still = false, onStatus }: PreviewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<ReturnType<typeof createStickerPlayer> | null>(null);
  const last = useRef<Pick<PreviewProps, 'image' | 'look' | 'animation'> | null>(null);
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    player.current = createStickerPlayer(surface, status => {
      surface.hidden = status === 'error';
      onStatus?.(status);
    });
    return () => { player.current?.dispose(); player.current = null; last.current = null; };
  }, [onStatus]);
  useEffect(() => {
    if (!canvas.current || !player.current) return;
    const old = last.current;
    // 저장 이벤트는 같은 그림도 새 객체로 전달한다. 등록된 프레임은 교체하지 않는다.
    if (old && image === old.image && sameAnimation(animation, old.animation) &&
        look.cutout === old.look.cutout && look.relief === old.look.relief) return;
    last.current = { image, look, animation };
    canvas.current.hidden = true;
    player.current.load(image, look, animation);
  }, [image, look, animation, onStatus]);
  useEffect(() => { player.current?.configure(size, angle, still); }, [size, angle, still, onStatus]);
  return <span className="image-pet-preview">
    <canvas ref={canvas} width={size} height={size} aria-hidden="true" />
    <img src={image} alt="" />
  </span>;
}

export function ImageLookEditor({image, animation, look, movement, onChange, onMove, disabled, still}: PetPicture & {
  look: ImageLook; movement: Movement; onChange: (next: ImageLook) => void; onMove: (value: Movement) => void;
  disabled: boolean; still: boolean;
}) {
  const group = useId();
  const [angle, setAngle] = useState(18);
  const [status, setStatus] = useState<PreviewStatus>('original');
  return <fieldset className="image-look-editor" disabled={disabled}>
    <legend>{t('imageAppearance')}</legend>
    <div className="motion-layout">
      <div className="image-look-stage motion-stage" role="img" aria-label={t('imagePetPreview')} data-still={still || undefined}>
        <div className="motion-journey" data-faces={look.faces} data-movement={movement}>
          <div className="preview-heading"><div className="preview-sprite">
            <ImagePetPreview {...{image, animation, look, angle, still}} size={256} onStatus={setStatus} />
          </div></div>
        </div>
      </div>
      <fieldset className="motion-options"><legend>{t('friendMovement')}</legend>{movements.map(value =>
        <label key={value}><input type="radio" checked={movement === value} onChange={() => onMove(value)}
          name={group} />{t(movementLabel[value])}</label>)}</fieldset>
    </div>
    <label className="image-look-check"><input type="checkbox" checked={look.cutout}
      onChange={e => onChange({ ...look, cutout: e.target.checked })} />{t('imageCutout')}</label>
    <label className="image-look-check"><input type="checkbox" checked={look.relief}
      onChange={e => onChange({ ...look, relief: e.target.checked })} />{t('imageRelief')}</label>
    <label className="image-orientation">{t('imageHeading')}<span className="image-select"><select value={look.faces ?? ''}
      onChange={e => {
        const next = { ...look };
        if (e.target.value === 'left' || e.target.value === 'right') next.faces = e.target.value;
        else delete next.faces;
        onChange(next);
      }}><option value="">{t('keepFacing')}</option><option value="left">{t('facesLeft')}</option>
      <option value="right">{t('facesRight')}</option></select><Chevron /></span></label>
    {look.relief && <label className="image-look-angle">{t('imageTilt')}
      <input type="range" min="-36" max="36" step="3" value={angle} onChange={e => setAngle(Number(e.target.value))} />
    </label>}
    <p role="status" className="image-status">{status === 'error' ? t('imagePreviewError')
      : look.cutout && status === 'uncertain' ? t('imageBackgroundUncertain') : ''}</p>
  </fieldset>;
}
