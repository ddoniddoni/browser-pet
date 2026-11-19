import { isImagePetId, originalLook } from '../../../shared/contracts/image-pet';
import { createPageImage } from '../rendering/page-image';
import { type CompanionId, movementLabel, companionFor, companionRoute, projectCompanion, announcementCompanion } from '../../../shared/contracts/companions';
import { agendaWindowRequest } from '../../../shared/contracts/agenda-window';
import { ringKey } from '../../../shared/contracts/agenda';
import { createAlarmCallout } from '../rendering/alarm-callout';
import { t, uiLanguage } from '../../../shared/i18n';
import { browser } from 'wxt/browser';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { CareAction } from '../../../shared/contracts/care';
import { getSharedScene, type PetState } from '../../../shared/contracts/state';
import { envelope, type SceneAction } from '../../../shared/contracts/commands';
import { acknowledgeAlarm, careForPet, sendSceneAction } from '../../../shared/messaging/state';
import { createDragPreview } from '../../../shared/messaging/drag-preview';
import { finishBubbleMs } from '../../../shared/contracts/timer';
import { activeFive, fiveEndsAt } from '../../../shared/contracts/high-five';
import { isMealTime, mealMs } from '../core/meal';
import { mouseUnlockXp } from '../../../shared/contracts/keepsakes';
import { mouseFrame, mouseDuration } from '../core/mouse-game';
import { ballFrame, playDuration } from '../core/ball-game';
import type { Facing } from '../core/patrol';
import { dragPosition, fitToViewport, roamingArea, type Point, type Viewport } from '../core/interaction';
import { habitMs, pinnedHabitAt } from '../core/habit-clock';
import { samplePatrol, sampleScenePatrol } from '../core/shared-patrol';
import { getPetDefinition } from '../definitions/species';
import { createPageToys } from '../sculpture/page-toys';
import { createPageFigure } from '../sculpture/page-figure';
import { wornScarf } from '../../../shared/contracts/character';
import { PetAvatar } from '../rendering/PetAvatar';
import { createPetControls } from '../rendering/pet-controls';
import { createPetTimer } from '../rendering/pet-timer';
import { headCallout, placeBubble, type OccupiedSide } from '../rendering/head-callout';
import { createPetSpeech } from '../rendering/pet-speech';
import { createGripSway } from './grip-sway';
import { bindPetPointer } from './pointer';

const pettingMs = 800;
const pickupDelayMs = 180;
function fraction(value: number, range: number, fallback: number) {
  return range > 0 ? Math.max(0, Math.min(1, value / range)) : fallback;
}

export function mountPagePet(container: HTMLElement, initialRoot: PetState, speciesId?: CompanionId) {
  const initial = speciesId ? projectCompanion(initialRoot, speciesId) : initialRoot;
  let announcer = !speciesId || announcementCompanion(initialRoot) === speciesId;
  const timerLabel = createPetTimer(container);
  container.lang = uiLanguage;
  const reminder = createAlarmCallout(container);
  const uploaded = !!speciesId && isImagePetId(speciesId);
  const controls = createPetControls(container, timerLabel.badge, reminder.bubble, speciesId ? '-' + speciesId : '', uploaded);
  const { button, facing, menu, notice } = controls;
  const sway=createGripSway(controls.grip);
  const imageFigure = uploaded ? createPageImage(facing) : undefined;
  const figure = uploaded ? undefined : createPageFigure(facing);
  container.toggleAttribute('data-image', uploaded);
  container.toggleAttribute('data-clay',!!figure);
  const paintToy=figure && createPageToys({mouse:controls.mouseSprite,ball:controls.ball});
  const root=figure || imageFigure ? undefined : createRoot(facing);
  controls.rotation.hidden=!figure;
  if (uploaded) {
    controls.play.hidden = true;
    const toys = controls.highFive.closest('fieldset');
    if (toys) toys.hidden = true;
  }
  let inspectYaw:number|undefined;
  const speech = createPetSpeech(container, button, initial.pet.createdAt, speciesId ? '-' + speciesId : '');
  const events = new AbortController();
  const { signal } = events;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let state = initial;
  let overAlarm=false;
  let scene = getSharedScene(state);
  let area: ReturnType<typeof roamingArea>;
  let viewport: Viewport;
  let position: Point = { x: 0, y: 0 };
  let direction: Facing = -1;
  let painted = false;
  let waveAt = -Infinity;
  let pressed = false;
  let pickupAt = 0;
  let focused = false;
  let clockRequest: 'SCENE_HOLD'|'SCENE_UNHOLD'|undefined;
  let retryClockAt=0;
  let lastPatrolFrame: number|undefined;
  let windowBlurred=false;
  let heldPoint: Point | null = null;
  let localDrag: Point | null = null;
  let pendingPin: Point | null = null;
  let remoteDrag: Point | null = null;
  let frame: number | undefined;
  let timer: number | undefined;

  function wantsQuiet() {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return !document.hasFocus() || !!document.fullscreenElement || document.designMode === 'on' ||
      !!active?.matches('input, textarea, select, iframe, [role="textbox"]') ||
      (active instanceof HTMLElement && active.isContentEditable);
  }
  let quietPage = wantsQuiet();
  function refreshQuiet() {
    if (signal.aborted) return;
    const quiet = wantsQuiet();
    if (quietPage === quiet) return;
    quietPage = quiet;
    render();
  }
  const preview = createDragPreview(initial.pet.id, point => {
    remoteDrag = point;
    render();
  }, speciesId);

  function pixelPoint(ratio: Point): Point {
    return { x: ratio.x * (viewport.width - viewport.size), y: ratio.y * (viewport.height - viewport.size) };
  }
  function asRatio(point: Point): Point {
    return {
      x: fraction(point.x, viewport.width - viewport.size, scene.anchor.x),
      y: fraction(point.y, viewport.height - viewport.size, scene.anchor.y),
    };
  }
  function patrolPoint(): Point {
    return {
      x: fraction(position.x - area.x, area.width, scene.anchor.x),
      y: fraction(position.y - area.y, area.height, scene.anchor.y),
    };
  }

  function unschedule() {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    if (timer !== undefined) window.clearTimeout(timer);
    frame = timer = undefined;
  }

  // 메뉴는 이 탭만 소유한다. 산책 정지는 공유하고, 해당 메뉴가 없는 다음 활성 탭도 이어갈 수 있다.
  function syncPatrolClock(wantsHold:boolean, now:number) {
    const {anchor}=scene, token=anchor.clock?.hold;
    if (anchor.kind==='pin' || wantsHold===!!token || clockRequest || windowBlurred || !document.hasFocus()) return;
    const action:SceneAction|undefined = wantsHold && !token
      ? {type:'SCENE_HOLD',payload:{anchorAt:anchor.at,at:lastPatrolFrame ?? now}}
      : !wantsHold && token ? {type:'SCENE_UNHOLD',payload:{token}} : undefined;
    if (!action) return;
    if (now<retryClockAt) return retryClockAt;
    clockRequest=action.type;
    void sendSceneAction(state,action).then(saved=>{
      retryClockAt=0;
      if (!signal.aborted) update(saved);
    },()=>{ retryClockAt=Date.now()+2000; }).finally(()=>{
      clockRequest=undefined;
      if (!signal.aborted) render();
    });
  }

  // 각 페이지에는 그리기만 맡긴다. 행동 선택이나 좌표 누적은 프레임/탭마다 하지 않는다.
  function render() {
    unschedule();
    if (signal.aborted || document.hidden) return;
    const reduced = motion.matches || state.settings.reduceMotion === 'always';
    const oldDirection = direction;

    const now = Date.now();
    const pending = announcer ? state.agenda?.pending : undefined;
    const alarm = pending?.[0];
    const session = state.timer;
    const studying = !!session && (session.phase === 'paused' || now < session.endsAt);
    const reactionEnds = scene.pettedAt + pettingMs;
    const petted = !reduced && now >= scene.pettedAt && now < reactionEnds;
    const fedAt = state.care.lastFedAt;
    const eating = isMealTime(fedAt, now) && fedAt >= scene.pettedAt;
    const displayedDrag = localDrag ?? pendingPin ?? remoteDrag;
    const pinned = scene.anchor.kind === 'pin';
    const five = menu.hidden && !displayedDrag ? activeFive(scene.five, state.pet.speciesId, now) : undefined;
    // 메뉴에서 놀이로 넘어가도 손을 거둘 때까지 같은 산책 지점을 유지한다.
    const interacting = focused || pressed || !menu.hidden || !!five || (!!alarm && overAlarm);
    const retryAt=syncPatrolClock(interacting && !reduced,now);
    const held = interacting || !!scene.anchor.clock?.hold || clockRequest==='SCENE_HOLD';
    let walkYaw: number | undefined;
    let next: number | undefined;
    let habitAt: number | undefined;
    let action: string;
    let point: Point;
    if (displayedDrag || pinned) {
      point = pixelPoint(displayedDrag ?? scene.anchor);
      direction = -1;
      action = localDrag || (remoteDrag && !pendingPin) ? 'DRAG' : 'PINNED';
      if (pinned) habitAt = pinnedHabitAt(scene.anchor.at, now);
    } else {
      const sampleAt = eating ? fedAt : petted ? scene.pettedAt : now;
      const sample = reduced ? samplePatrol(companionRoute(state),scene.anchor,scene.anchor.at,state.settings.speed) :
        sampleScenePatrol(companionRoute(state),scene.anchor,sampleAt,state.settings.speed,session);
      if (!held) {
        heldPoint=null;
        lastPatrolFrame=sampleAt!==now || sample.action==='WALK' ? sampleAt : undefined;
      }
      const ratio = heldPoint ?? sample;
      point = { x: area.x + ratio.x * area.width, y: area.y + ratio.y * area.height };
      direction = heldPoint === null || reduced ? sample.facing : direction;
      action = held || reduced ? 'IDLE' : sample.action;
      if (action === 'WALK') walkYaw = Math.atan2(sample.dx * area.width, sample.dy * area.height) * 180 / Math.PI;
      if (!held && !reduced && !studying) {
        next = sample.nextAt;
        if (sample.habitAt !== undefined) habitAt = sample.habitAt;
      }
    }
    const reading = studying && !held && !displayedDrag;
    if (reading) action = 'SIT';
    if (pressed && !localDrag) {
      action = now >= pickupAt ? 'DRAG' : 'IDLE';
      if (now < pickupAt) next = Math.min(next ?? Infinity,pickupAt);
    }
    if (petted && !pressed && !displayedDrag) { action = 'PETTED'; next = reactionEnds; }

    if (eating && !pressed && !displayedDrag) { action = 'EAT'; next = fedAt + mealMs; }
    const play = scene.play;
    const sampleGame = play?.toy === 'mouse' ? mouseFrame : ballFrame;
    const game = play && !pressed && !displayedDrag && menu.hidden && play.at >= (fedAt ?? 0) &&
      play.at >= scene.pettedAt ? sampleGame(play, now, viewport, point, getPetDefinition(state.pet.speciesId).play === 'fetch',
        state.settings.personality ?? 'calm', reduced) : null;
    controls.ball.hidden = !game || !('ball' in game);
    controls.mouseSprite.hidden = !game || !('mouse' in game);
    if (game && play) {
      point = game.point;
      direction = game.facing;
      action = game.action;
      const isMouse = 'mouse' in game;
      const prop = isMouse ? game.mouse : game.ball;
      const sprite = isMouse ? controls.mouseSprite : controls.ball;
      const clay=paintToy?.(isMouse?'mouse':'ball',2*game.radius,isMouse?game.mouseFacing:1,game.roll);
      sprite.style.width = sprite.style.height = (2 * game.radius) + 'px';
      sprite.style.transform = `translate(${prop.x - point.x - game.radius}px, ${prop.y - point.y - game.radius}px)` +
        (isMouse && !clay ? ` scaleX(${game.mouseFacing})` : '');
      next = play.at + (isMouse ? mouseDuration : playDuration);
    }

    if (five) {
      point = pixelPoint(five);
      direction = five.facing;
      action = five.phase === 'ready' ? 'FIVE_READY' : 'FIVE_HIT';
      next = fiveEndsAt(five);
    }
    if (figure && habitAt !== undefined && !reduced && !quietPage && !held && !studying && !game && !five &&
        !displayedDrag && (action === 'SIT' || action === 'PINNED')) {
      if (now < habitAt) next = Math.min(next ?? Infinity,habitAt);
      else if (now < habitAt+habitMs) {
        action = 'HABIT';
        next = Math.min(next ?? Infinity,habitAt+habitMs);
      }
    }
    const waveMs = 1400;
    // 사용자가 인사를 끊고 메뉴를 열면, 닫은 뒤 남은 인사를 다시 재생하지 않는다.
    if (held || displayedDrag || five || game || studying || eating || petted) waveAt = -Infinity;
    if (now < waveAt + waveMs) {
      action = 'WAVE';
      next = Math.min(next ?? Infinity, waveAt + waveMs);
    }
    const ready = five?.phase === 'ready';
    if (controls.touch.hidden === ready) {
      controls.touch.hidden = !ready;
      button.setAttribute('aria-label', ready ? t('fivePrompt') : t('petMenu', state.pet.name));
    }
    controls.smack.hidden = five?.phase !== 'hit';
    let fiveSpace:OccupiedSide|undefined;
    if (five) {
      const tag=ready ? controls.touch : controls.smack;
      const height=tag.offsetHeight, gap=7;
      const layout=headCallout(point,viewport,tag.offsetWidth,height,6,gap);
      placeBubble(tag,layout);
      fiveSpace={below:layout.below,depth:height+gap};
    }
    // 알림을 맡지 않은 친구도 공부 종료 시각에는 산책을 다시 그린다.
    if (studying && session?.phase === 'running') next = Math.min(next ?? Infinity, session.endsAt);
    const showBook = reading && action === 'SIT';
    if (container.hasAttribute('data-reading') !== showBook) container.toggleAttribute('data-reading', showBook);
    const badgeWasHidden = timerLabel.badge.hidden;
    const occupied = reminder.sync(alarm,pending?.length ?? 0,point,viewport,fiveSpace);
    const tickAt = timerLabel.sync(announcer ? session : undefined, now, point, viewport, occupied);
    if (tickAt !== undefined) next = Math.min(next ?? Infinity, tickAt);
    const moved = !painted || position.x !== point.x || position.y !== point.y;
    position = point;
    if (moved) container.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    if (menu.hidden) inspectYaw=undefined;
    const swayAt=sway.paint(now,!!localDrag && !reduced);
    if (swayAt!==undefined) next=Math.min(next ?? Infinity,swayAt);
    if (figure) {
      const span = action === 'WAVE' ? { at: waveAt, ms: waveMs } : five ? {at:five.at, ms:ready?360:fiveEndsAt(five)-five.at} : game ? game.motion :
        action==='EAT' && fedAt!==null ? {at:fedAt,ms:mealMs} :
        action==='PETTED' ? {at:scene.pettedAt,ms:pettingMs} :
        action==='HABIT' && habitAt!==undefined ? {at:habitAt,ms:habitMs} : undefined;
      const movement = speciesId ? companionFor(state, speciesId).movement : 'walk';
      const pose = action === 'WALK' && movement === 'bounce' ? 'HOP' : action === 'WALK' && movement === 'float' ? 'FLOAT' : action;
      const repaintAt=figure.paint(showBook?'READ':pose,direction,reduced,now,viewport.size,inspectYaw,span,game ? undefined : walkYaw);
      if(repaintAt!==undefined)next=Math.min(next??Infinity,repaintAt);
      if(!painted||oldDirection!==direction) facing.dataset.side=direction===1?'right':'left';
    } else if (!imageFigure && (!painted || oldDirection !== direction)) facing.style.transform = `scaleX(${direction})`;
    if (imageFigure && speciesId && isImagePetId(speciesId)) {
      const faces = state.imagePets?.[speciesId]?.look?.faces;
      const flip = faces && (direction === 1) !== (faces === 'right');
      const transform = flip ? 'scaleX(-1)' : '';
      if (facing.style.transform !== transform) facing.style.transform = transform;
      imageFigure.paint(viewport.size, inspectYaw ?? (direction === 1 ? 18 : -18), reduced);
    }
    painted = true;
    if (container.dataset.action !== action) {
      if (action === 'WALK') container.style.setProperty('--pet-step-offset', -(now % 720) + 'ms');
      container.dataset.action = action;
    }
    const quiet = !!five || held || !!displayedDrag || !!game || eating || action === 'SLEEP' || action === 'HABIT' ||
      (now >= scene.pettedAt && now < reactionEnds) || quietPage;
    const justEnded = session?.phase === 'running' && now >= session.endsAt && now < session.endsAt + finishBubbleMs;
    const completion = justEnded ? { key: session.token, text: session.mode === 'exam' ? t('speechExamOver') : t('speechFocusOver'),
      until: session.endsAt + finishBubbleMs } : undefined;
    const speechAt = speech.sync(now, announcer && !alarm && !studying && (state.settings.ambientSpeech !== false || !!completion),
      completion ? !!five || held || !!displayedDrag : quiet, point, viewport, completion, fiveSpace);
    if (speechAt !== undefined) next = Math.min(next ?? Infinity, speechAt);
    if (!menu.hidden && (moved || badgeWasHidden !== timerLabel.badge.hidden)) controls.place();
    if (retryAt!==undefined) next=Math.min(retryAt,next ?? Infinity);
    if (action === 'WALK' || ((action === 'WAVE' || game) && !reduced)) frame = window.requestAnimationFrame(render);
    else if (next !== undefined) timer = window.setTimeout(render, Math.max(1, next - now));
  }

  function refreshControls() {
    container.toggleAttribute('data-paused', motion.matches || state.settings.reduceMotion === 'always');
    const pinned = scene.anchor.kind === 'pin';
    controls.resume.hidden = !pinned;
    controls.mouse.disabled = state.care.xp < mouseUnlockXp;
    controls.progress.textContent = controls.mouse.disabled ? t('toyProgress', state.care.xp + ' / ' + mouseUnlockXp) : t('toyPlay');
    const movement = speciesId ? companionFor(state, speciesId).movement : 'walk';
    container.dataset.movement = movement;
    const mode = pinned ? t('pinned') : t(movement === 'walk' ? 'walkMode' : movementLabel[movement]);
    if (controls.mode.textContent !== mode) controls.mode.textContent = mode;
  }

  function resize() {
    const grabbed = localDrag ? pixelPoint(localDrag) : null;
    const element = document.compatMode === 'BackCompat' && document.body ? document.body : document.documentElement;
    const width = element.clientWidth, height = element.clientHeight;
    viewport = { width, height, size: Math.min(width, height, state.settings.sizePx) };
    area = roamingArea(viewport, scene.anchor.kind === 'patrol');
    if (grabbed) {
      localDrag = asRatio(fitToViewport(grabbed, viewport));
      preview.move(localDrag);
    }
    container.style.width = container.style.height = viewport.size + 'px';
    render();
    controls.place();
  }
  function refreshAppearance() {
    const { name, speciesId } = state.pet;
    const definition = getPetDefinition(speciesId);
    button.setAttribute('aria-label', controls.touch.hidden ? t('petMenu', name) : t('fivePrompt'));
    menu.setAttribute('aria-label', t('petMenu', uploaded ? name : definition.displayName));
    controls.caption.textContent = name;
    if (imageFigure && isImagePetId(speciesId)) {
      const pet = state.imagePets?.[speciesId];
      if (pet) {
        imageFigure.dress(pet.image, pet.look ?? originalLook, pet.animation);
        controls.rotation.hidden = !pet.look?.relief;
      }
    }
    if(figure)figure.dress(definition.id,wornScarf(definition.id,state.settings.scarf),state.settings.outfit??'none');
    root?.render(createElement(PetAvatar, { name, speciesId, scarf: state.settings.scarf, outfit: state.settings.outfit }));
    controls.place();
  }

  function update(rootState: PetState) {
    if (signal.aborted || rootState.pet.id !== state.pet.id || rootState.revision <= state.revision) return;
    if (uploaded && !rootState.imagePets?.[speciesId]) return;
    announcer = !speciesId || announcementCompanion(rootState) === speciesId;
    const next = speciesId ? projectCompanion(rootState, speciesId) : rootState;
    if (next.pet.speciesId !== state.pet.speciesId) notice.hidden = true;
    const currentImage = uploaded ? state.imagePets?.[speciesId] : undefined;
    const nextImage = uploaded ? next.imagePets?.[speciesId] : undefined;
    const appearanceChanged = currentImage?.image !== nextImage?.image ||
      currentImage?.look?.cutout !== nextImage?.look?.cutout || currentImage?.look?.relief !== nextImage?.look?.relief ||
      next.pet.name !== state.pet.name || next.pet.speciesId !== state.pet.speciesId ||
      next.settings.scarf !== state.settings.scarf || next.settings.outfit !== state.settings.outfit;
    const resized = next.settings.sizePx !== state.settings.sizePx;
    const newScene = getSharedScene(next);
    const old = scene.anchor, anchor = newScene.anchor;
    if (anchor.kind !== old.kind || anchor.at !== old.at || anchor.x !== old.x || anchor.y !== old.y) {
      // 정지 응답은 기준 시각만 바꾼다. 누르고 있는 동안의 표시 좌표는 유지한다.
      if (!anchor.clock?.hold || anchor.kind!==old.kind || anchor.x!==old.x || anchor.y!==old.y) heldPoint=null;
      lastPatrolFrame=undefined;
      remoteDrag = null;
    }
    if (!next.agenda?.pending?.length) overAlarm=false;
    state = next;
    scene = newScene;
    refreshControls();
    if (appearanceChanged) refreshAppearance();
    if (resized) resize();
    else {
      if (anchor.kind !== old.kind) area = roamingArea(viewport, anchor.kind === 'patrol');
      render();
    }
    if (!menu.hidden) controls.place();
  }

  async function command(action: SceneAction) {
    notice.hidden = true;
    try {
      const saved = await sendSceneAction(state, action);
      if (!signal.aborted && saved.settings.enabled) update(saved);
      return true;
    } catch (reason) {
      if (!signal.aborted && !document.hidden) {
        notice.textContent = reason instanceof Error ? reason.message : t('shareError');
        notice.hidden = false;
        controls.show(true);
        render();
      }
      return false;
    }
  }
  function closeMenu(restoreFocus: boolean) {
    if (menu.hidden) return;
    controls.show(false);
    if (restoreFocus) button.focus({ preventScroll: true });
    // Escape로 키보드 포커스를 돌려줘도 메뉴 정지는 끝난다.
    focused=false;
    render();
  }
  function openMenu() {
    if (signal.aborted || document.hidden) return;
    controls.yaw.value = String(uploaded ? direction * 18 : direction === 1 ? 24 : 336);
    inspectYaw=Number(controls.yaw.value);
    controls.show(true);
    controls.pet.focus({ preventScroll: true });
    render();
    controls.stampPortrait();
    void command({ type: 'SCENE_PET', payload: {} });
  }

  const cancelPointer = bindPetPointer(button, {
    press(pointer) {
      const origin = { ...position };
      const now=Date.now();
      sway.begin(pointer,origin,now);
      pickupAt=now+pickupDelayMs;
      heldPoint = patrolPoint();
      pressed = true;
      render();
      return origin;
    },
    drag(pointer, grab) {
      if (!localDrag) controls.show(false);
      sway.move(pointer.x,Date.now());
      localDrag = asRatio(dragPosition(pointer, grab, viewport));
      preview.move(localDrag);
      render();
    },
    end(result) {
      if (signal.aborted) return;
      pressed = false;
      sway.end();
      if (result === 'click') {
        const five = activeFive(scene.five, state.pet.speciesId, Date.now());
        if (five && menu.hidden) {
          if (five.phase === 'ready') void hitFive();
          render();
          return;
        }
        return openMenu();
      }
      const drop = localDrag;
      localDrag = null;
      if (result === 'drop' && drop) {
        pendingPin = drop;
        void command({ type: 'SCENE_PIN', payload: drop }).finally(() => {
          if (pendingPin !== drop || signal.aborted) return;
          pendingPin = null;
          if (!localDrag) preview.end();
          render();
        });
      } else {
        preview.end();
      }
      render();
    },
  }, signal);

  function interrupt() {
    cancelPointer();
    preview.end();
    remoteDrag = null;
    heldPoint = null;
    focused=false;
    controls.show(false);
    render();
  }
  let caring = false;
  async function care(event: MouseEvent, action: CareAction) {
    if (!event.isTrusted || caring || menu.hidden || document.hidden || signal.aborted) return;
    const speciesId = state.pet.speciesId;
    caring = true;
    notice.hidden = true;
    let feedback: string;
    try {
      const saved = await careForPet(state, action);
      if (signal.aborted || !saved.state.settings.enabled) return;
      update(saved.state);
      if (action === 'feed') {
        feedback = saved.careReward === 'granted' ? t('fedReward') : t('fedWait');
      } else {
        feedback = saved.careReward === 'granted' ? t('pattedReward') : t('pattedWait');
      }
    } catch (reason) {
      feedback = reason instanceof Error ? reason.message : t('careResultError');
    } finally {
      caring = false;
    }
    if (!signal.aborted && !document.hidden && !menu.hidden && state.pet.speciesId === speciesId) {
      notice.textContent = feedback;
      notice.hidden = false;
      controls.place();
    }
  }
  function inspect(angle:number){
    if (menu.hidden || controls.rotation.hidden) return;
    inspectYaw=angle; controls.yaw.value=String(angle); render();
  }
  controls.yaw.addEventListener('input',()=>inspect(Number(controls.yaw.value)),{signal});
  controls.backView.addEventListener('click',()=>inspect(uploaded ? 0 : 180),{signal});
  controls.pet.addEventListener('click', event => { void care(event, 'pet'); }, { signal });
  controls.feed.addEventListener('click', event => { void care(event, 'feed'); }, { signal });
  let fiveBusy = false;
  async function hitFive() {
    const five = activeFive(scene.five, state.pet.speciesId, Date.now());
    if (fiveBusy || five?.phase !== 'ready' || !menu.hidden || signal.aborted || document.hidden) return;
    fiveBusy = true;
    try {
      const first = !state.memories?.some(c => c.kind === 'highfive' && c.speciesId === five.speciesId);
      if (await command({ type: 'SCENE_FIVE_HIT', payload: { token: five.token } }) && !signal.aborted)
        controls.announcement.textContent = first ? t('fiveFirst') : t('fiveDone');
    } finally { fiveBusy = false; }
  }
  controls.highFive.addEventListener('click', async event => {
    if (!event.isTrusted || fiveBusy || menu.hidden || document.hidden || signal.aborted) return;
    fiveBusy = true;
    try {
      const payload = { ...asRatio(position), facing: direction, speciesId: state.pet.speciesId };
      if (await command({ type: 'SCENE_FIVE_READY', payload }) && !signal.aborted && !menu.hidden) {
        closeMenu(event.detail === 0);
        controls.announcement.textContent = t('fivePrompt');
      }
    } finally { fiveBusy = false; }
  }, { signal });
  controls.touch.addEventListener('click', event => { if (event.isTrusted) void hitFive(); }, { signal });
  let tossing = false;
  async function playToy(event: MouseEvent, mouse: boolean) {
    if (!event.isTrusted || signal.aborted || document.hidden || menu.hidden || tossing) return;
    tossing = true;
    try {
      const location = asRatio(position);
      const play: SceneAction = mouse ? { type: 'SCENE_MOUSE', payload: { ...location, speciesId: state.pet.speciesId } } :
        { type: 'SCENE_PLAY', payload: location };
      if (await command(play) && !signal.aborted) {
        closeMenu(event.detail === 0);
        controls.announcement.textContent = mouse ? t('mouseReleased') : getPetDefinition(state.pet.speciesId).play === 'fetch'
          ? t('fetchAnnounce') : t('batAnnounce');
      }
    } finally { tossing = false; }
  }
  controls.play.addEventListener('click', e => { void playToy(e, false); }, { signal });
  controls.mouse.addEventListener('click', e => { void playToy(e, true); }, { signal });
  controls.resume.addEventListener('click', event => {
    if (scene.anchor.kind !== 'pin') return;
    void command({ type: 'SCENE_RESUME', payload: {} }).then(ok => {
      if (ok && !signal.aborted) closeMenu(event.detail === 0);
    });
  }, { signal });
  reminder.bubble.addEventListener('pointerenter', e=>{
    if (e.pointerType==='mouse' && !overAlarm) {
      if (!focused && area) heldPoint=patrolPoint();
      overAlarm=true; render();
    }
  },{signal});
  reminder.bubble.addEventListener('pointerleave', ()=>{
    if (overAlarm) { overAlarm=false; render(); }
  },{signal});
  let acknowledging=false, pressedRing:string|undefined;
  function rememberRing() {
    const first=state.agenda?.pending?.[0];
    pressedRing=first && ringKey(first);
  }
  reminder.ack.addEventListener('pointerdown', rememberRing, {signal});
  reminder.ack.addEventListener('pointercancel', ()=>{ pressedRing=undefined; }, {signal});
  reminder.ack.addEventListener('keydown', e=>{
    if (e.key==='Enter' || e.key===' ') { if (e.repeat) e.preventDefault(); else rememberRing(); }
  },{signal});
  reminder.ack.addEventListener('blur', ()=>{ pressedRing=undefined; }, {signal});
  reminder.ack.addEventListener('click', async event=>{
    const ring=state.agenda?.pending?.[0];
    const intended=pressedRing;
    pressedRing=undefined;
    if (!event.isTrusted || !ring || acknowledging || document.hidden || (intended && intended!==ringKey(ring))) return;
    acknowledging=true;
    reminder.ack.setAttribute('aria-disabled','true');
    reminder.error();
    try {
      const saved=await acknowledgeAlarm(state,ring);
      if (signal.aborted) return;
      update(saved);
      if (reminder.bubble.hidden && event.detail===0 && document.hasFocus()) button.focus({preventScroll:true});
      else if (reminder.bubble.hidden && focused && !container.matches(':focus-within')) { focused=false; render(); }
    } catch {
      if (!signal.aborted && state.agenda?.pending?.[0]?.id===ring.id && state.agenda.pending[0].due===ring.due) {
        reminder.error(t('agendaAckFailed')); render(); controls.place();
      }
    } finally {
      acknowledging=false;
      reminder.ack.removeAttribute('aria-disabled');
    }
  },{signal});
  const agenda=controls.agenda;
  let openingAgenda=false;
  agenda.manage.addEventListener('click',async event=>{
    if (!event.isTrusted || openingAgenda || menu.hidden || document.hidden) return;
    openingAgenda=true;
    notice.hidden=true;
    try {
      const reply=await browser.runtime.sendMessage({...agendaWindowRequest,
        x:event.detail ? Math.round(event.screenX) : null,y:event.detail ? Math.round(event.screenY) : null});
      if(reply?.ok!==true) throw new Error();
      if(!signal.aborted) closeMenu(false);
    } catch {
      if(!signal.aborted && !menu.hidden) { notice.textContent=t('agendaWindowFailed'); notice.hidden=false; controls.place(); }
    } finally { openingAgenda=false; }
  },{signal});
  let openingSettings = false;
  controls.settings.addEventListener('click', async event => {
    if (!event.isTrusted || openingSettings || menu.hidden) return;
    openingSettings = true;
    notice.hidden = true;
    try {
      const reply = await browser.runtime.sendMessage({ ...envelope, type: 'OPEN_OPTIONS' });
      if (reply?.ok !== true) throw new Error();
      if (!signal.aborted) closeMenu(false);
    } catch {
      if (!signal.aborted && !document.hidden) {
        notice.textContent = t('openInPopup');
        notice.hidden = false;
        controls.place();
      }
    } finally {
      openingSettings = false;
    }
  }, { signal });
  controls.hide.addEventListener('click', () => { void command({ type: 'SCENE_HIDE', payload: {} }); }, { signal });
  container.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (menu.hidden) {
      const five = activeFive(scene.five, state.pet.speciesId, Date.now());
      if (five?.phase !== 'ready') return;
      event.stopPropagation();
      event.preventDefault();
      void command({ type: 'SCENE_FIVE_CANCEL', payload: { token: five.token } });
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    closeMenu(true);
  }, { signal });
  container.addEventListener('focusin', () => {
    if (!focused && area) heldPoint = patrolPoint();
    focused = true;
    render();
  }, { signal });
  container.addEventListener('focusout', event => {
    if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;
    focused = false;
    closeMenu(false);
    render();
  }, { signal });
  document.addEventListener('pointerdown', event => {
    if (!menu.hidden && !event.composedPath().includes(container)) closeMenu(false);
  }, { capture: true, signal });
  document.addEventListener('focusin', refreshQuiet, { capture: true, signal });
  document.addEventListener('focusout', () => queueMicrotask(refreshQuiet), { capture: true, signal });
  document.addEventListener('fullscreenchange', refreshQuiet, { signal });
  // 숨겨진 탭에서 받은 설정을 다시 보이는 첫 프레임에 반영한다.
  document.addEventListener('visibilitychange', render, { signal });
  window.addEventListener('focus', () => { windowBlurred=false; refreshQuiet(); render(); }, { signal });
  window.addEventListener('blur', () => { windowBlurred=true; quietPage = true; interrupt(); }, { signal });
  window.addEventListener('resize', resize, { signal });
  motion.addEventListener('change', () => { refreshControls(); render(); }, { signal });

  refreshControls();
  refreshAppearance();
  resize();
  return {
    update,
    greet() { waveAt = Date.now(); render(); },
    remove() {
      if (signal.aborted) return;
      events.abort();
      cancelPointer();
      preview.dispose();
      unschedule();
      speech.hide();
      figure?.dispose();
      imageFigure?.dispose();
      root?.unmount();
    },
  };
}
