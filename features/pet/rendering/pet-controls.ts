import { createAgendaTools } from './agenda-tools';
import { t, uiLanguage } from '../../../shared/i18n';
import { menuIcon, type MenuIcon } from './menu-icon';

export function createPetControls(container: HTMLElement, timerBadge: HTMLElement, alarmBubble: HTMLElement, suffix = '', imagePet = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pet-trigger';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'pet-actions' + suffix);
  const facing = document.createElement('span');
  facing.className = 'pet-facing';
  const grip=document.createElement('span');
  grip.className='pet-grip';
  grip.append(facing);
  button.append(grip);

  const menu = document.createElement('div');
  menu.className = 'pet-menu';
  menu.id = 'pet-actions' + suffix;
  menu.lang = uiLanguage;
  menu.dir = 'ltr';
  menu.hidden = true;
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-labelledby', 'pet-menu-name' + suffix);
  const caption = document.createElement('strong');
  caption.className = 'pet-name';
  caption.id = 'pet-menu-name' + suffix;
  caption.dir = 'auto';
  const heading = document.createElement('div');
  heading.className = 'pet-menu-heading';
  const mode = document.createElement('span');
  mode.className = 'pet-location-mode';
  const stamp = document.createElement('span');
  stamp.className = 'pet-menu-stamp';
  stamp.setAttribute('aria-hidden', 'true');
  const portrait = document.createElement('canvas');
  portrait.width = portrait.height = 96;
  portrait.hidden = true;
  stamp.append(menuIcon('tag'), portrait);
  heading.append(stamp, caption, mode);
  function stampPortrait() {
    const source = facing.querySelector('canvas');
    const ctx = portrait.getContext('2d');
    if (!source?.width || !source.height || !ctx) return;
    ctx.clearRect(0, 0, 96, 96);
    ctx.drawImage(source, 0, 0, 96, 96);
    portrait.hidden = false;
  }
  const agenda = createAgendaTools();
  const tools = document.createElement('div');
  tools.className = 'pet-care-tools';
  const footer = document.createElement('div');
  footer.className = 'pet-menu-footer';
  const action = (kind: MenuIcon, label: string, iconOnly = false) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.append(menuIcon(kind));
    if (iconOnly) {
      item.setAttribute('aria-label', label);
      item.title = label;
    } else {
      const text = document.createElement('span');
      text.textContent = label;
      item.append(text);
    }
    return item;
  };
  const rotation=document.createElement('details');
  rotation.className='pet-rotation';
  const orbitLabel=document.createElement('summary');
  orbitLabel.append(menuIcon('orbit'), document.createTextNode(t(imagePet ? 'imageTilt' : 'sculptOpen')), menuIcon('down'));
  rotation.addEventListener('toggle', place);
  const orbitTools=document.createElement('div');
  const yaw=document.createElement('input');
  yaw.type='range'; yaw.min=imagePet ? '-36' : '0'; yaw.max=imagePet ? '36' : '360'; yaw.step=imagePet ? '3' : '6';
  yaw.setAttribute('aria-label',t(imagePet ? 'imageTilt' : 'sculptAngle'));
  const backView=document.createElement('button');
  backView.type='button'; backView.textContent=t(imagePet ? 'imageFront' : 'sculptBack');
  orbitTools.append(yaw,backView); rotation.append(orbitLabel,orbitTools);
  const pet = action('pet', t('petAction'));
  const feed = action('feed', t('feed'));
  const play = action('play', t('throwBall'));
  const toyBox = document.createElement('fieldset');
  toyBox.className = 'pet-toy-box';
  const toyTitle = document.createElement('legend');
  toyTitle.textContent = t('toyBox');
  const mouse = action('mouse', t('windupMouse'));
  const highFive = action('highFive', t('highFive'));
  const touch = action('highFive', t('fiveTap'));
  touch.className = 'pet-five-touch pet-callout';
  touch.tabIndex = -1; // 같은 동작을 펫 버튼에서도 키보드로 실행한다.
  touch.hidden = true;
  const smack = document.createElement('span');
  smack.className = 'pet-five-note pet-callout';
  smack.setAttribute('aria-hidden', 'true');
  smack.textContent = t('fiveDone');
  smack.hidden = true;
  const progress = document.createElement('small');
  mouse.append(progress);
  toyBox.append(toyTitle, highFive, mouse);
  const mouseSprite = document.createElement('span');
  mouseSprite.className = 'pet-mouse';
  mouseSprite.hidden = true;
  mouseSprite.setAttribute('aria-hidden', 'true');
  mouseSprite.append(menuIcon('mouse'));
  const ball = document.createElement('span');
  ball.className = 'pet-ball';
  ball.hidden = true;
  ball.setAttribute('aria-hidden', 'true');
  const announcement = document.createElement('span');
  announcement.className = 'pet-announcement';
  announcement.setAttribute('role', 'status');
  const resume = action('walk', t('resumeWalk'));
  resume.className = 'pet-resume';
  resume.hidden = true;
  const hide = action('hide', t('hideAllTabs'));
  const settings = action('settings', t('openSettings'), true);
  const notice = document.createElement('span');
  notice.setAttribute('role', 'status');
  notice.className = 'pet-notice';
  notice.hidden = true;
  tools.append(pet, feed, play);
  footer.append(hide, settings);
  menu.append(heading, agenda.group, tools, rotation, toyBox, notice, resume, footer);
  container.append(button, ball, mouseSprite, touch, smack, menu, announcement);

  function place() {
    if (menu.hidden) return;
    const anchor = button.getBoundingClientRect();
    const viewport = document.compatMode === 'BackCompat' ? document.body : document.documentElement;
    const timer = timerBadge.hidden ? anchor : timerBadge.getBoundingClientRect();
    const alarm = alarmBubble.hidden ? anchor : alarmBubble.getBoundingClientRect();
    const inset = 6, gap = 8;
    const above = Math.min(anchor.top, timer.top, alarm.top) - gap;
    const below = Math.max(anchor.bottom, timer.bottom, alarm.bottom) + gap;
    const roomAbove = above - inset, roomBelow = viewport.clientHeight - inset - below;
    const room = Math.max(roomAbove, roomBelow);
    // 아주 낮은 창에서는 펫과 겹치더라도 조작할 수 있는 스크롤 영역부터 확보한다.
    const limit = Math.max(1, Math.floor(room >= 84 ? room : viewport.clientHeight - 2 * inset));
    const maxWidth = Math.max(1, viewport.clientWidth - 2 * inset) + 'px';
    if (menu.style.maxWidth !== maxWidth) menu.style.maxWidth = maxWidth;
    const maxHeight = limit + 'px';
    if (menu.style.maxHeight !== maxHeight) menu.style.maxHeight = maxHeight;
    const box = menu.getBoundingClientRect();
    const centered = anchor.left + (anchor.width - box.width) / 2;
    const left = Math.max(inset, Math.min(viewport.clientWidth - inset - box.width, centered));
    const preferred = roomAbove >= box.height || roomAbove >= roomBelow ? above - box.height : below;
    const top = Math.max(inset, Math.min(viewport.clientHeight - inset - box.height, preferred));
    menu.style.left = (left - anchor.left) + 'px';
    menu.style.top = (top - anchor.top) + 'px';
  }
  function show(open: boolean) {
    const opening = open && menu.hidden;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (opening) {
      rotation.open = false;
      menu.scrollTop = 0;
    }
    if (open) place();
  }
  return { button, facing, grip, rotation, yaw, backView, menu, caption, mode, agenda, pet, feed, play, ball, mouse, mouseSprite, progress, highFive, touch, smack, announcement, resume, hide, settings, notice, show, place, stampPortrait };
}
