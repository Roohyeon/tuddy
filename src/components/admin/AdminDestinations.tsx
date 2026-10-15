'use client';
/**
 * 여행지 관리 (어드민) — 목록 · 검색 · 나라 필터 · 정렬 + 등록 · 수정 · 삭제 모달
 * 데이터 흐름: useDestinations(조회) → 화면에서 필터 · 정렬 → 모달 저장 → 낙관적 mutation(src/queries/destinations.ts)
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { toRow, countryName, type DestinationInput } from '@/lib/admin/destinationSchema';
import type { DestinationRow } from '@/lib/supabase/database.types';
import { useCreateDestination, useDeleteDestination, useDestinations, usePendingDestinationKeys, useUpdateDestination } from '@/queries/destinations';
import { useToastStore } from '@/stores/toast';
import { AdminGate, AdminSignOut } from './AdminGate';
import { DestinationFormDialog } from './DestinationFormDialog';
import s from './admin.module.css';

type SortKey = 'city' | 'country' | 'flight' | 'rating' | 'updated';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'country', label: '나라순' }, { key: 'city', label: '도시순' }, { key: 'flight', label: '비행 시간순' },
  { key: 'rating', label: '평점 높은 순' }, { key: 'updated', label: '최근 수정순' },
];
const ko = (a: string, b: string) => a.localeCompare(b, 'ko');
const compare: Record<SortKey, (a: DestinationRow, b: DestinationRow) => number> = {
  country: (a, b) => ko(countryName(a.country_code), countryName(b.country_code)) || ko(a.city, b.city),
  city: (a, b) => ko(a.city, b.city),
  flight: (a, b) => a.flight_min - b.flight_min || ko(a.city, b.city),
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || ko(a.city, b.city),
  // 저장 중(updated_at 빈 값)인 새 항목이 맨 위
  updated: (a, b) => (b.updated_at || '9999').localeCompare(a.updated_at || '9999'),
};
const fmtDate = (iso: string) => {
  const d = new Date(iso), p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function AdminDestinations() {
  return (
    <main className={s.page}>
      <AdminGate>{email => <DestinationManager email={email} />}</AdminGate>
      <AdminToast />
    </main>
  );
}

function DestinationManager({ email }: { email: string }) {
  const { data, isPending, error, refetch } = useDestinations(true);
  const create = useCreateDestination(), update = useUpdateDestination(), remove = useDeleteDestination();
  const pending = new Set(usePendingDestinationKeys());

  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState<SortKey>('country');
  const query = useDeferredValue(q.trim().toLowerCase());

  const all = useMemo(() => data ?? [], [data]);
  const countries = useMemo(() => [...new Set(all.map(d => d.country_code))].sort((a, b) => ko(countryName(a), countryName(b))), [all]);
  const rows = useMemo(() => all
    .filter(d => !country || d.country_code === country)
    .filter(d => !query || [d.key, d.city, d.city_en, countryName(d.country_code), d.airport_code, d.airport_name].some(v => v.toLowerCase().includes(query)))
    .sort(compare[sort]), [all, country, query, sort]);
  const takenKeys = useMemo(() => new Set(all.map(d => d.key)), [all]);

  // 모달: undefined = 닫힘, null = 등록, 행 = 수정
  const [editing, setEditing] = useState<DestinationRow | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<DestinationRow | null>(null);

  const save = (v: DestinationInput) => {
    const row = toRow(v);
    if (editing) update.mutate({ key: editing.key, row, expectedUpdatedAt: editing.updated_at });
    else create.mutate({ key: row.key, row });
  };

  return (
    <>
      <header className={s.top}>
        <div>
          <p className={s.kicker}>TUDDY ADMIN</p>
          <h1 className={s.h1}>여행지 관리</h1>
          <p className={s.lede}>
            {data ? <><b>{all.length}</b>곳 · <b>{countries.length}</b>개국</> : '불러오는 중…'} — 저장하면 서버 응답을 기다리지 않고 바로 반영돼요. 실패하면 자동으로 되돌려요.
          </p>
        </div>
        <div className={s.account}><span>{email}</span><AdminSignOut /></div>
      </header>

      <div className={s.toolbar}>
        <input className={`${s.input} ${s.search}`} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="도시 · 나라 · 영문 · 공항 코드 검색" aria-label="여행지 검색" />
        <select className={s.input} value={country} onChange={e => setCountry(e.target.value)} aria-label="나라 필터">
          <option value="">모든 나라</option>
          {countries.map(cc => <option key={cc} value={cc}>{countryName(cc)}</option>)}
        </select>
        <select className={s.input} value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="정렬">
          {SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <button type="button" className={s.btnPrimary} onClick={() => setEditing(null)} disabled={!data}>+ 여행지 등록</button>
      </div>

      <div className={s.card}>
        {error ? (
          <div className={s.state}>
            <p>{error.message}</p>
            <button type="button" className={s.btnGhost} onClick={() => refetch()}>다시 시도</button>
          </div>
        ) : isPending ? (
          <div className={s.state} aria-busy="true">여행지를 불러오는 중…</div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <caption className={s.srOnly}>여행지 {rows.length}곳</caption>
              <thead>
                <tr><th scope="col">여행지</th><th scope="col">나라</th><th scope="col">공항</th><th scope="col">비행</th><th scope="col">평점</th><th scope="col">설명</th><th scope="col">수정</th><th scope="col"><span className={s.srOnly}>작업</span></th></tr>
              </thead>
              <tbody>
                {rows.map(d => {
                  const busy = pending.has(d.key);
                  return (
                    <tr key={d.key} data-pending={busy || undefined} aria-busy={busy || undefined}>
                      <th scope="row">
                        <div className={s.dest}>
                          <span className={s.thumb}>{d.image_url ? <img src={d.image_url} alt="" loading="lazy" /> : d.city[0]}</span>
                          <span><b>{d.city}</b><small>{d.city_en} · <code>{d.key}</code></small></span>
                        </div>
                      </th>
                      <td>{countryName(d.country_code)}{d.hot && <span className={s.tag}>더운 곳</span>}</td>
                      <td><code>{d.airport_code}</code><small className={s.sub}>{d.airport_name}</small></td>
                      <td className={s.num}>{d.flight_min >= 60 ? `${Math.floor(d.flight_min / 60)}시간 ${d.flight_min % 60 ? `${d.flight_min % 60}분` : ''}` : `${d.flight_min}분`}</td>
                      <td className={s.num}>{d.rating == null ? <span className={s.muted}>—</span> : <span className={s.star}>★ {d.rating.toFixed(1)}</span>}</td>
                      <td className={s.desc} title={d.description}>{d.description || <span className={s.muted}>—</span>}</td>
                      <td className={s.num}>{busy ? <span className={s.saving}>저장 중…</span> : d.updated_at ? fmtDate(d.updated_at) : ''}</td>
                      <td>
                        <div className={s.actions}>
                          <button type="button" className={s.btnSmall} onClick={() => setEditing(d)} disabled={busy} aria-label={`${d.city} 수정`}>수정</button>
                          <button type="button" className={`${s.btnSmall} ${s.danger}`} onClick={() => setDeleting(d)} disabled={busy} aria-label={`${d.city} 삭제`}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <p className={s.state}>조건에 맞는 여행지가 없어요.</p>}
          </div>
        )}
      </div>

      {editing !== undefined && (
        <DestinationFormDialog key={editing?.key ?? 'new'} target={editing} takenKeys={takenKeys} onSubmit={save} onClose={() => setEditing(undefined)} />
      )}
      {deleting && (
        <ConfirmDialog
          title={`${deleting.city}을(를) 삭제할까요?`}
          body="삭제한 여행지는 새 여행을 만들 때 검색되지 않아요. 이미 만든 여행에는 영향이 없어요."
          confirmLabel="삭제"
          onConfirm={() => remove.mutate({ key: deleting.key })}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose }: { title: string; body: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className={`${s.dialog} ${s.confirm}`} aria-labelledby="confirm-title" onCancel={e => { e.preventDefault(); onClose(); }}>
      <h2 id="confirm-title" className={s.dialogTitle}>{title}</h2>
      <p className={s.confirmBody}>{body}</p>
      <div className={s.dialogFoot}>
        <button type="button" className={s.btnGhost} onClick={onClose} autoFocus>취소</button>
        <button type="button" className={`${s.btnPrimary} ${s.dangerFill}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}

/** 실패 · 되돌림 알림 — 앱과 같은 토스트 스토어를 써요 */
function AdminToast() {
  const t = useToastStore(st => st.current), dismiss = useToastStore(st => st.dismiss);
  return (
    <div className={s.toastRoot} aria-live="polite">
      {t && (
        <div className={s.toast} role="status" key={t.id}>
          <span>{t.msg}</span>
          <button type="button" onClick={() => { dismiss(); t.action?.fn(); }}>{t.action?.label ?? '닫기'}</button>
        </div>
      )}
    </div>
  );
}
