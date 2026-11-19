import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { browser } from 'wxt/browser';
import { t } from '../shared/i18n';
import { normalizePetName, type PetState } from '../shared/contracts/state';
import { maxImagePets, newImagePetLook, originalLook, type ImagePet, type ImagePetEdit, type ImagePetId, type PetPicture } from '../shared/contracts/image-pet';
import type { Movement } from '../shared/contracts/companions';
import { addImagePet, editImagePet, patchCompanion, removeImagePet } from '../shared/messaging/state';
import { preparePetImage } from '../shared/images/prepare-pet-image';
import { ImageLookEditor, ImagePetPreview } from './ImageLookEditor';
import { PetTile } from './PetTile';
import { Chevron } from './Chevron';
import './image-pets.css';

const formats = 'image/png,image/jpeg,image/webp,image/gif';
const errorText = (e: unknown) => e instanceof Error ? e.message : t('saveError');
type Editor = { id: ImagePetId; pet: ImagePet } | { picture: PetPicture; name: string };

function PetEditor({ editor, state, close }: { editor: Editor; state: PetState; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), title = useId();
  const pet = 'pet' in editor ? editor.pet : undefined;
  const [name, setName] = useState('pet' in editor ? editor.pet.name : editor.name);
  const [look, setLook] = useState(pet ? pet.look ?? originalLook : newImagePetLook);
  const [movement, setMovement] = useState<Movement>(pet?.companion.movement ?? 'walk');
  const [size, setSize] = useState(pet?.companion.settings.sizePx ?? 96);
  const [picture, setPicture] = useState<PetPicture>('picture' in editor ? editor.picture : editor.pet);
  const [pending, setPending] = useState(false), [reading, setReading] = useState(false);
  const [confirm, setConfirm] = useState(false), [error, setError] = useState('');
  const locked = useRef(false), generation = useRef(0);
  useEffect(() => {
    const node = dialog.current, tickets = generation;
    node?.showModal();
    return () => { tickets.current++; node?.close(); };
  }, []);
  async function replace(file?: File) {
    if (!file) return;
    const ticket = ++generation.current;
    setReading(true); setError('');
    try { const next = await preparePetImage(file); if (ticket === generation.current) setPicture(next); }
    catch (e) { if (ticket === generation.current) setError(errorText(e)); }
    finally { if (ticket === generation.current) setReading(false); }
  }
  async function commit(remove = false) {
    if (locked.current || reading) return;
    const valid = normalizePetName(name);
    if (!remove && !valid) return setError(t('nameValidation'));
    setError(''); setPending(true); locked.current = true;
    try {
      if ('pet' in editor) {
        if (remove) await removeImagePet(state, editor.id);
        else {
          const old = editor.pet;
          const patch: ImagePetEdit = {};
          if (name.trim() !== old.name) patch.name = valid!;
          if (size !== old.companion.settings.sizePx) patch.sizePx = size;
          if (movement !== old.companion.movement) patch.movement = movement;
          const was = old.look ?? originalLook;
          if (look.cutout !== was.cutout || look.relief !== was.relief || look.faces !== was.faces) patch.look = look;
          if (Object.keys(patch).length) await editImagePet(state, editor.id, patch);
        }
      } else {
        await addImagePet(state, { id: `image-${crypto.randomUUID()}`, name: valid!, ...picture, look, movement });
      }
      close();
    } catch (e) { setError(errorText(e)); }
    finally { locked.current = false; setPending(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); if (!confirm) void commit(); }
  return <dialog ref={dialog} className="pet-editor-dialog" aria-labelledby={title}
    onCancel={e => { e.preventDefault(); if (!locked.current) close(); }}>
    <form className="pet-editor-form" onSubmit={submit}>
      <header><h2 id={title}>{t(pet ? 'imageLookEdit' : 'createCharacter')}</h2>
        <button type="button" className="editor-close" aria-label={t('cancel')} disabled={pending} onClick={close}>×</button></header>
      <fieldset className="pet-editor-fields" disabled={pending}>
        <label className="pet-editor-name">{t('petName')}<input type="text" value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>
        <ImageLookEditor {...picture} look={look} movement={movement} onChange={setLook} onMove={setMovement}
          disabled={reading || pending} still={state.settings.reduceMotion === 'always'} />
        {pet ? <label className="image-orientation">{t('friendSize')}<span className="image-select">
          <select value={size} onChange={e => setSize(Number(e.target.value) as typeof size)}>
            <option value={32}>{t('sizeSmall')}</option><option value={64}>{t('sizeMedium')}</option><option value={96}>{t('sizeLarge')}</option>
          </select><Chevron /></span></label> :
          <label className="editor-replace">{t(reading ? 'imagePetReading' : 'imagePetChangeFile')}
            <input type="file" accept={formats} onChange={e => { void replace(e.target.files?.[0]); e.target.value = ''; }} /></label>}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {confirm ? <div className="pet-delete-check"><p>{t('imageRemovePrompt', name)}</p>
        <button type="button" disabled={pending} onClick={() => setConfirm(false)}>{t('cancel')}</button>
        <button type="button" disabled={pending} onClick={() => void commit(true)}>{t('imageRemoveConfirm')}</button></div> :
        <footer>{pet && <button type="button" className="editor-delete" disabled={pending} onClick={() => setConfirm(true)}>{t('imageRemove')}</button>}
          <button type="submit" className="editor-submit" disabled={pending || reading}>{t(pending ? 'saving' : pet ? 'imageLookSave' : 'imagePetRegister')}</button></footer>}
    </form>
  </dialog>;
}

export function ImagePets({ state, compact = false }: { state: PetState; compact?: boolean }) {
  const group = useId(), generation = useRef(0);
  const [editor, setEditor] = useState<Editor>();
  const [reading, setReading] = useState(false), [error, setError] = useState('');
  const [saving, setSaving] = useState<ImagePetId>();
  const pets = Object.entries(state.imagePets ?? {}) as [ImagePetId, ImagePet][];
  const full = pets.length >= maxImagePets;
  useEffect(() => () => { generation.current++; }, []);
  async function pick(file?: File) {
    if (!file) return;
    const ticket = ++generation.current;
    setReading(true); setError('');
    try {
      const picture = await preparePetImage(file);
      if (ticket !== generation.current) return;
      const name = normalizePetName(Array.from(file.name.replace(/\.[^.]+$/, '')).slice(0,20).join('')) ?? t('imagePetDefault');
      setEditor({ picture, name });
    } catch (e) { if (ticket === generation.current) setError(errorText(e)); }
    finally { if (ticket === generation.current) setReading(false); }
  }
  async function toggle(id: ImagePetId, enabled: boolean) {
    setSaving(id); setError('');
    try { await patchCompanion(state, id, { enabled }); }
    catch (e) { setError(errorText(e)); }
    finally { setSaving(undefined); }
  }
  const openSettings = () => void browser.runtime.openOptionsPage().catch(e => setError(errorText(e)));
  return <section className={'image-pets' + (compact ? ' image-pets-compact' : '')} aria-labelledby={group}>
    <div className="image-pets-title"><h2 id={group}>{t('customFriends')}</h2><span>{pets.length} / {maxImagePets}</span></div>
    <div className="pet-tile-grid">
      {compact ? <button type="button" className="pet-add-tile" onClick={openSettings}>
        <span aria-hidden="true">＋</span>{t(full ? 'imagePetManage' : 'addCharacter')}</button> :
        <label className="pet-add-tile" onDragOver={e => e.preventDefault()} onDrop={e => {
          e.preventDefault(); if (!full && !reading) void pick(e.dataTransfer.files[0]);
        }}><span aria-hidden="true">＋</span>{t(reading ? 'imagePetReading' : 'addCharacter')}
          <input type="file" accept={formats} disabled={full || reading} onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} /></label>}
      {pets.map(([id, pet]) => <PetTile key={id} name={pet.name} enabled={pet.companion.enabled}
        disabled={!!saving} toggle={enabled => void toggle(id, enabled)} edit={() => setEditor({ id, pet })}
        portrait={<ImagePetPreview image={pet.image} look={pet.look ?? originalLook} size={128} />} />)}
    </div>
    {!compact && <p className="image-pets-note">{t(full ? 'imagePetLimit' : 'imagePetFileHint')}</p>}
    {error && <p role="alert">{error}</p>}
    {editor && (!('id' in editor) || state.imagePets?.[editor.id]) && <PetEditor editor={editor} state={state} close={() => setEditor(undefined)} />}
  </section>;
}
