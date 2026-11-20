import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ImagePetPreview } from '../../components/ImageLookEditor';
import { originalLook, type ImagePet, type ImagePetId } from '../../shared/contracts/image-pet';
import { accessoryCatalog, accessoryKinds, accessorySlots, angleLimit, applyOutfitPatch, photoOutfit, samePiece,
  widthRange, type AccessoryKind, type AccessorySlot, type OutfitPatch, type PhotoAccessory } from '../../shared/contracts/photo-accessories';
import type { PetState } from '../../shared/contracts/state';
import { paintAccessory } from '../../shared/images/photo-accessory-art';
import { t } from '../../shared/i18n';
import { editImagePet } from '../../shared/messaging/state';
import { SaveNotice, useSaveFeedback } from './Preferences';
import './photo-fitting-room.css';

function fitPiece(piece: PhotoAccessory): PhotoAccessory {
  const rad = piece.angle * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const aspect = accessoryCatalog[piece.kind].height / 100;
  const halfX = piece.width * (cos + aspect * sin) / 2;
  const halfY = piece.width * (sin + aspect * cos) / 2;
  return { ...piece, x: Math.max(halfX, Math.min(100 - halfX, piece.x)),
    y: Math.max(halfY, Math.min(100 - halfY, piece.y)) };
}

function AccessorySwatch({ kind }: { kind: AccessoryKind }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 120, 96);
    ctx.save();
    ctx.translate(10, (96 - accessoryCatalog[kind].height) / 2);
    paintAccessory(ctx, kind);
    ctx.restore();
  }, [kind]);
  return <canvas className="accessory-swatch" ref={canvas} width={120} height={96} aria-hidden="true" />;
}

const nudges: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

export function PhotoFittingRoom({ state, id, pet }: { state: PetState; id: ImagePetId; pet: ImagePet }) {
  const [draft, setDraft] = useState<OutfitPatch>({});
  const [selectedSlot, setSelectedSlot] = useState<AccessorySlot>('head');
  const [walking, setWalking] = useState(false);
  const { feedback, save } = useSaveFeedback();
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; left: number; top: number; piece: PhotoAccessory } | null>(null);
  const hint = useId();
  const saved = photoOutfit(pet);
  const outfit = applyOutfitPatch(saved, draft);
  const slot = outfit[selectedSlot] ? selectedSlot : outfit.head ? 'head' : 'neck';
  const piece = outfit[slot];
  const dirtySlots = accessorySlots.filter(key => !samePiece(saved?.[key], outfit[key]));
  const busy = feedback.kind === 'pending';
  const look = pet.look ?? originalLook;

  function changeSlot(target: AccessorySlot, next: PhotoAccessory | null) {
    setDraft(previous => ({ ...previous, [target]: next }));
  }
  function choose(kind: AccessoryKind) {
    const { slot: target, start } = accessoryCatalog[kind];
    setSelectedSlot(target);
    setWalking(false);
    if (outfit[target]?.kind !== kind) {
      const previous = saved?.[target];
      changeSlot(target, previous?.kind === kind ? previous : { kind, ...start });
    }
  }
  function place(next: PhotoAccessory) {
    changeSlot(accessoryCatalog[next.kind].slot, fitPiece(next));
  }
  function grab(e: PointerEvent<HTMLButtonElement>) {
    if (!piece || !e.isPrimary || e.button !== 0) return;
    drag.current = { id: e.pointerId, left: e.clientX, top: e.clientY, piece };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const held = drag.current, rect = stage.current?.getBoundingClientRect();
    if (!held || held.id !== e.pointerId || !rect?.width) return;
    place({ ...held.piece, x: held.piece.x + (e.clientX - held.left) * 100 / rect.width,
      y: held.piece.y + (e.clientY - held.top) * 100 / rect.height });
  }
  function nudge(e: KeyboardEvent<HTMLButtonElement>) {
    const delta = nudges[e.key];
    if (!piece || !delta) return;
    e.preventDefault();
    place({ ...piece, x: piece.x + delta[0], y: piece.y + delta[1] });
  }
  function commit() {
    const patch: OutfitPatch = {};
    for (const key of dirtySlots) patch[key] = outfit[key] ?? null;
    void save(async () => {
      const result = await editImagePet(state, id, { accessories: patch });
      setDraft({});
      return result;
    }, t('lookSaved'));
  }

  return <div className="photo-fitting">
    <fieldset disabled={busy} className="photo-fitting-fields">
      <legend>{t('photoAccessories')}</legend>
      <div className="photo-mirror motion-stage" data-still={state.settings.reduceMotion === 'always' || undefined}>
        <div ref={stage} className={walking ? 'photo-square motion-journey' : 'photo-square'}
          data-faces={look.faces} data-movement={walking ? pet.companion.movement : undefined}>
          <div className="preview-heading"><div className="preview-sprite">
            <ImagePetPreview image={pet.image} accessories={outfit} look={look} angle={0} size={384} still />
          </div></div>
          {piece && !walking && <button type="button" className="accessory-handle"
            aria-label={t(piece.kind) + ' · ' + t('accessoryPosition')} aria-describedby={hint}
            style={{ left: piece.x + '%', top: piece.y + '%', width: piece.width + '%',
              aspectRatio: String(100 / accessoryCatalog[piece.kind].height),
              transform: 'translate(-50%, -50%) rotate(' + piece.angle + 'deg)' }}
            onPointerDown={grab} onPointerMove={move} onLostPointerCapture={() => { drag.current = null; }}
            onKeyDown={nudge} />}
        </div>
      </div>
      <div className="accessory-shelves">
        {accessorySlots.map(target => <fieldset key={target} className="accessory-shelf">
          <legend>{t(target === 'head' ? 'headAccessories' : 'neckAccessories')}</legend>
          <div>{accessoryKinds.filter(kind => accessoryCatalog[kind].slot === target).map(kind =>
            <button key={kind} className="accessory-choice" type="button" aria-pressed={outfit[target]?.kind === kind}
              onClick={() => choose(kind)}>
              <AccessorySwatch kind={kind} /><span>{t(kind)}</span>
            </button>)}</div>
        </fieldset>)}
      </div>
      {piece && <div className="photo-controls">
        <div className="accessory-tools-heading"><strong>{t(piece.kind)}</strong>
          <button type="button" className="link" onClick={() => { setWalking(false); changeSlot(slot, null); }}>{t('removeAccessory')}</button>
        </div>
        {!walking && <p id={hint} className="accessory-instruction">{t('accessoryMoveHint')}</p>}
        <label className="accessory-range"><span>{t('accessorySize')}</span>
          <input type="range" min={widthRange.min} max={widthRange.max} value={piece.width}
            onChange={e => place({ ...piece, width: Number(e.target.value) })} />
          <output>{piece.width}%</output></label>
        <label className="accessory-range"><span>{t('hatAngle')}</span>
          <input type="range" min={-angleLimit} max={angleLimit} value={piece.angle}
            onChange={e => place({ ...piece, angle: Number(e.target.value) })} />
          <output>{piece.angle}°</output></label>
        <button className="hat-preview-toggle" type="button" aria-pressed={walking} onClick={() => setWalking(!walking)}>
          {t(walking ? 'hatPlaceAgain' : 'hatWalkPreview')}</button>
      </div>}
    </fieldset>
    <div className="fitting-actions">
      <button type="button" className="primary" disabled={!dirtySlots.length || busy} onClick={commit}>{t('applyLook')}</button>
      {dirtySlots.length > 0 && <button type="button" className="link" disabled={busy}
        onClick={() => { setDraft({}); setWalking(false); }}>{t('chooseAgain')}</button>}
    </div>
    <SaveNotice feedback={feedback} />
  </div>;
}
