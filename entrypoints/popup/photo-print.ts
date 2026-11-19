import type { Portrait } from '../../shared/contracts/keepsakes';
import { sculpt } from '../../features/pet/sculpture/model';
import { createRaster } from '../../features/pet/sculpture/raster';
import { getPetDefinition } from '../../features/pet/definitions/species';
import { rigFor } from '../../features/pet/sculpture/pose';

export type Stock = 'apricot' | 'sage' | 'blue';
const stocks = {
  apricot: ['#f6e4d5','#dda586','#704d45'],
  sage: ['#e4eadc','#adbda3','#42574d'],
  blue: ['#dbe5ee','#9eafcb','#3e4967'],
} as const;

const poses = [
  {action:'IDLE',yaw:2,frame:0,count:1},
  {action:'WALK',yaw:83,frame:2,count:8},
  {action:'FIVE_HIT',yaw:-12,frame:3,count:12},
  {action:'SLEEP',yaw:38,frame:0,count:1},
] as const;
const width = 840, height = 956, tile = 380, margin = 32, gap = 16;
const mono = 'ui-monospace, SFMono-Regular, Consolas, monospace';
const sans = 'system-ui, sans-serif';

function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  return ctx;
}
function localDate(time: Date) {
  return [time.getFullYear(), String(time.getMonth()+1).padStart(2,'0'), String(time.getDate()).padStart(2,'0')].join('-');
}

function paper(ctx: CanvasRenderingContext2D, stock: Stock, name: string, date: string) {
  ctx.fillStyle = '#fffbf1'; ctx.fillRect(0,0,width,height);
  ctx.fillStyle = stocks[stock][2];
  ctx.font = '600 24px ' + mono;
  ctx.fillText('BROWSER PET', margin,47);
  // 필름 가장자리의 구멍 네 개를 촬영 매수와 맞춘다.
  for (let n=0;n<4;n++) ctx.fillRect(width-margin-77+n*21,31,13,9);
  ctx.fillRect(margin,870,width-2*margin,2);
  ctx.font = '600 36px ' + sans;
  ctx.fillText(name,margin,921,width-2*margin-212);
  ctx.font = '20px ' + mono;
  ctx.textAlign = 'right'; ctx.fillText(date.replaceAll('-','.'),width-margin,919); ctx.textAlign = 'left';
}

function setBackdrop(ctx: CanvasRenderingContext2D, x: number, y: number, stock: Stock, index: number) {
  const [light,shade,ink] = stocks[stock];
  ctx.save(); ctx.translate(x,y);
  ctx.beginPath(); ctx.rect(0,0,tile,tile); ctx.clip();
  const wall = ctx.createLinearGradient(0,0,tile,tile);
  wall.addColorStop(0,light); wall.addColorStop(1,shade);
  ctx.fillStyle = wall; ctx.fillRect(0,0,tile,tile);
  // 같은 촬영실, 한쪽 벽에만 비치는 오후의 창빛.
  ctx.fillStyle = '#ffffff2e'; ctx.transform(1,0,-.36,1,0,0);
  ctx.fillRect(47+index*5,0,46,tile); ctx.fillRect(101+index*5,0,13,tile);
  ctx.restore();
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle = ink; ctx.font = '600 17px ' + mono;
  ctx.fillText('0'+String(index+1),15,28);
  ctx.translate(tile*.5,tile*.889); ctx.scale(1,.14);
  const shadow = ctx.createRadialGradient(0,0,2,0,0,107);
  shadow.addColorStop(0,'#443c363b'); shadow.addColorStop(1,'#443c3600');
  ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(0,0,107,0,2*Math.PI); ctx.fill(); ctx.restore();
}

function pause(ms: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve,reject) => {
    const timer = window.setTimeout(() => { signal.removeEventListener('abort',cancel); resolve(); }, ms);
    function cancel() { clearTimeout(timer); reject(signal.reason); }
    signal.addEventListener('abort',cancel,{once:true});
  });
}

export async function exposePrint(canvas: HTMLCanvasElement, pet: Portrait, stock: Stock,
  time: Date, reduced: boolean, signal: AbortSignal, advance: (n: number) => void) {
  signal.throwIfAborted();
  canvas.width = width; canvas.height = height;
  const ctx = context(canvas), date = localDate(time);
  paper(ctx,stock,pet.name,date);
  const layer = document.createElement('canvas');
  layer.width = layer.height = tile;
  const art = context(layer), buffer = art.createImageData(tile,tile);
  const render = createRaster(sculpt(getPetDefinition(pet.speciesId).id,pet.scarf,pet.outfit,1));
  for (const [index,pose] of poses.entries()) {
    await pause(reduced || index===0 ? 0 : 145,signal);
    signal.throwIfAborted();
    const x = margin + (index%2)*(tile+gap), y = 72 + Math.floor(index/2)*(tile+gap);
    setBackdrop(ctx,x,y,stock,index);
    render(buffer,pose.yaw,rigFor(getPetDefinition(pet.speciesId).id,pose.action,pose.frame,pose.count,1));
    art.putImageData(buffer,0,0);
    ctx.drawImage(layer,x,y); advance(index+1);
  }
  const blob = await new Promise<Blob>((resolve,reject) =>
    canvas.toBlob(file => file ? resolve(file) : reject(new Error('png')), 'image/png'));
  signal.throwIfAborted();
  const name = pet.name.replace(/[\\/:*?"<>|]/g,'_').trim();
  return {blob,filename:'BrowserPet-'+name+'-'+date+'.png'};
}
