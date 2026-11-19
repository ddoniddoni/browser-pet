import { useState } from 'react';
import { Chevron } from '../../components/Chevron';
import { memoryKinds, type MemoryCard, type MemoryKind } from '../../shared/contracts/keepsakes';
import { t, formatLocale } from '../../shared/i18n';
import { MemoryPicture, memoryTitles } from './MemoryPicture';
import type { RoomDecorator } from './useRoomDecorator';

const dateFormat = new Intl.DateTimeFormat(formatLocale, { dateStyle: 'medium' });

export function MemoryAlbum({ cards, picture, decor }: { cards: MemoryCard[]; picture: MemoryKind | null; decor: RoomDecorator }) {
  const [open, setOpen] = useState(false);
  return <details className="pet-edit memory-album" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>{t('memoryAlbum')}<span className="album-count">{cards.length} / {memoryKinds.length}</span><Chevron/></summary>
    {open && (cards.length ? <ul className="souvenirs">{cards.map(card => <li key={card.kind} className="souvenir">
        <MemoryPicture card={card}/>
        <div className="souvenir-caption"><strong>{t(memoryTitles[card.kind])}</strong><span dir="auto">{card.name}</span>
          <time dateTime={card.day}>{dateFormat.format(new Date(card.day + 'T12:00:00'))}</time></div>
        <button type="button" className="souvenir-hang" data-framed={picture === card.kind} disabled={decor.busy} aria-label={t(picture === card.kind ? 'roomUnhang' : 'roomHang') + ': ' + t(memoryTitles[card.kind])}
          onClick={() => void decor.change({ picture: picture === card.kind ? null : card.kind })}>
          {t(picture === card.kind ? 'roomUnhang' : 'roomHang')}
        </button>
      </li>)}</ul> :
      <p className="album-empty">{t('albumEmpty')}</p>)}
  </details>;
}
