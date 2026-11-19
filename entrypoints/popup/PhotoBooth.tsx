import { useEffect, useId, useRef, useState } from 'react';
import { ToolRow } from './ToolRow';
import { t } from '../../shared/i18n';
import type { Portrait } from '../../shared/contracts/keepsakes';
import type { Stock } from './photo-print';
import './photo-booth.css';

const papers = [['apricot','photoApricot'],['sage','photoSage'],['blue','photoBlue']] as const;
type Session = {kind:'idle'|'error'} | {kind:'shooting'; count:number} | {kind:'ready'; url:string; filename:string};
function Darkroom({pet, still}: {pet: Portrait; still:boolean}) {
  const [stock,setStock] = useState<Stock>('apricot');
  const [session,setSession] = useState<Session>({kind:'idle'});
  const canvas = useRef<HTMLCanvasElement>(null), controller = useRef<AbortController | null>(null);
  const url = useRef<string | null>(null), group = useId();
  useEffect(() => () => {
    controller.current?.abort();
    if (url.current) URL.revokeObjectURL(url.current);
  },[]);
  function clearPrint() {
    if (url.current) { URL.revokeObjectURL(url.current); url.current = null; }
    setSession({kind:'idle'});
  }
  async function take() {
    const sheet = canvas.current;
    if (!sheet || controller.current) return;
    clearPrint();
    const job = new AbortController(); controller.current = job;
    const date = new Date();
    setSession({kind:'shooting',count:0});
    try {
      const {exposePrint} = await import('./photo-print');
      const print = await exposePrint(sheet,pet,stock,date,still || matchMedia('(prefers-reduced-motion: reduce)').matches,
        job.signal,n => setSession({kind:'shooting',count:n}));
      if (job.signal.aborted) return;
      url.current = URL.createObjectURL(print.blob);
      setSession({kind:'ready',url:url.current,filename:print.filename});
    } catch {
      if (!job.signal.aborted) setSession({kind:'error'});
    } finally { if (controller.current === job) controller.current = null; }
  }
  const busy = session.kind === 'shooting';
  return <div className="booth-controls">
    <p className="booth-intro">{t('photoHint')}</p>
    <fieldset className="booth-stocks" disabled={busy}>
      <legend>{t('photoPaper')}</legend>
      {papers.map(([id,label]) => <label key={id}>
        <input type="radio" name={group} checked={stock===id} onChange={()=>{clearPrint();setStock(id);}}/>
        <span className={'booth-chip '+id} aria-hidden="true"/>{t(label)}
      </label>)}
    </fieldset>
    <canvas ref={canvas} className="booth-print" width="840" height="956"
      hidden={session.kind==='idle'||session.kind==='error'||(session.kind==='shooting' && session.count===0)}
      role="img" aria-label={t('photoDescription',pet.name)}/>
    <div className="booth-actions">
      {session.kind==='ready' && <a className="primary" href={session.url} download={session.filename}>{t('photoSave')}</a>}
      <button className={session.kind==='ready'?'secondary':'primary'} type="button" disabled={busy} onClick={()=>void take()}>
        {busy?t('photoProgress',session.count):session.kind==='ready'?t('photoRetake'):t('photoShoot')}</button>
    </div>
    <span role="status" className="booth-status">{session.kind==='ready'?t('photoReady'):''}</span>
    {session.kind==='error' && <p role="alert">{t('photoError')}</p>}
  </div>;
}
export function PhotoBooth(props: {pet: Portrait; still:boolean}) {
  const [open,setOpen] = useState(false);
  return <details name="pet-pocket-tools" className="photo-booth" onToggle={e=>setOpen(e.currentTarget.open)}>
    <ToolRow kind="photo" title={t('photoTitle')}/>
    {open && <Darkroom {...props}/>}
  </details>;
}
