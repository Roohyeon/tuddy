/* 기록북 SNS 미리보기 이미지 (1200×630)
   next/og 기본 글꼴에는 한글이 없어서 영문 도시명 · 숫자로만 그려요. */
import { ImageResponse } from 'next/og';
import type { TravelBook } from '@/types/domain';
import { bookSummary } from './book';

export const OG_SIZE = { width: 1200, height: 630 };

export function bookOgImage(book: TravelBook) {
  const { d, n, places, total } = bookSummary(book);
  const dates = `${book.start.replaceAll('-', '.')} – ${book.end.slice(5).replace('-', '.')}`;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72,
        background: 'linear-gradient(160deg,#2f4156 0%,#3b5068 55%,#567c8d 100%)', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, letterSpacing: 8, color: 'rgba(255,255,255,.75)' }}>
          <span>TUDDY · TRAVEL BOOK</span><span>{d.cc}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 112, fontWeight: 700, lineHeight: 1.05 }}>{d.en}</div>
          <div style={{ fontSize: 40, marginTop: 14, color: 'rgba(255,255,255,.85)' }}>{`${d.countryEn} · ${n - 1} nights ${n} days`}</div>
        </div>
        <div style={{ display: 'flex', gap: 64, fontSize: 30, borderTop: '3px dashed rgba(255,255,255,.3)', paddingTop: 32 }}>
          <span>{dates}</span>
          <span>{`${places} places`}</span>
          {total > 0 && <span>{`KRW ${total.toLocaleString('en-US')}`}</span>}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
