/* 공유용 여행 기록북 — 서버 컴포넌트 (브라우저 JS 없이 HTML로 바로 그려져요) */
import Link from 'next/link';
import type { TravelBook } from '@/types/domain';
import { bookSummary } from '@/lib/book';
import { EXCAT, STYPE } from '@/lib/constants';
import { addDays, josa, mdw, toDate, won } from '@/lib/utils';
import { Icon, Logo } from '@/components/ui/Icon';
import s from './book.module.css';

export function TravelBookView({ book, sample }: { book: TravelBook; sample?: boolean }) {
  const { d, n, places, total, title } = bookSummary(book);
  const start = toDate(book.start), end = toDate(book.end);
  const who = book.companion === '혼자' ? '혼자 떠난 여행' : `${josa(book.companion, '과와')} ${book.people}명이 함께`;

  return (
    <div className={s.page}>
      <header className={s.top}>
        <Link href="/" className={s.brand}><Logo className={s.logo} /><span>Tuddy</span></Link>
        <span className={s.kicker}>TRAVEL BOOK</span>
      </header>

      <article className={s.book}>
        <section className={s.cover} aria-label="표지">
          <span className={s.mono}>TRAVEL BOOK · {d.cc}{sample ? ' · SAMPLE' : ''}</span>
          <h1 className={s.title}>{d.city}, {n - 1}박 {n}일</h1>
          <p className={s.sub}>{d.country} · {d.en}, {d.countryEn}</p>
          <p className={s.meta}>{mdw(start)} – {mdw(end)} · {who}</p>
          <div className={s.perf} />
          <dl className={s.stats}>
            <div><dt>방문</dt><dd>{places}곳</dd></div>
            <div><dt>지출</dt><dd>{won(total)}</dd></div>
            <div><dt>보관</dt><dd>{book.vault}개</dd></div>
          </dl>
          <p className={s.by}>기록 · {book.author}</p>
        </section>

        <h2 className={s.h2}>여행의 하루하루</h2>
        {book.days.map((day, i) => (
          <section key={i} className={s.day} aria-labelledby={`day-${i}`}>
            <div className={s.dayH}>
              <span className={s.dayN}>DAY {i + 1}</span>
              <span className={s.dayDate}>{mdw(addDays(start, i))}</span>
            </div>
            <h3 id={`day-${i}`} className={s.dayTitle}>{day.title || '자유 일정'}</h3>
            {day.stops.length ? (
              <ol className={s.stops}>
                {day.stops.map((st, k) => (
                  <li key={k}>
                    <time>{st.time}</time>
                    <span className={s.dot}>{k + 1}</span>
                    <span className={s.stopBody}><b>{st.title}</b>{st.area && <small>{st.area}</small>}</span>
                    <span className={s.tag}>{STYPE[st.type].label}</span>
                  </li>
                ))}
              </ol>
            ) : <p className={s.empty}>여유롭게 쉬어 간 날</p>}
          </section>
        ))}

        {total > 0 && <>
          <h2 className={s.h2}>어디에 썼을까</h2>
          <section className={s.day}>
            <div className={s.stack} role="img" aria-label="카테고리별 지출 비율">
              {book.spend.map(([c, v]) => <i key={c} style={{ width: `${v / total * 100}%`, background: EXCAT[c].paper }} />)}
            </div>
            <ul className={s.legend}>
              {book.spend.map(([c, v]) => (
                <li key={c}><span className={s.sw} style={{ background: EXCAT[c].paper }} /><span>{EXCAT[c].label}</span><span className={s.pct}>{Math.round(v / total * 100)}%</span><b>{won(v)}</b></li>
              ))}
            </ul>
            <p className={s.note}>1인 기준 · 총 {won(total)}</p>
          </section>
        </>}

        <footer className={s.cta}>
          <p>{title}은 Tuddy로 만들었어요.</p>
          <Link href="/" className={s.ctaBtn}><Icon name="plane" size="sm" /> 나도 Tuddy로 여행 기록하기</Link>
        </footer>
      </article>
    </div>
  );
}
