'use client';
/* 7. 보관함 */
import { useState } from 'react';
import type { VaultFilter } from '@/types/domain';
import { VKIND } from '@/lib/constants';
import { vGroup, vIcon } from '@/lib/trip';
import { cx, md, toDate } from '@/lib/utils';
import { useTrip } from '@/store/TuddyProvider';
import { useSheets } from '@/components/sheets/useSheets';
import { Icon } from '@/components/ui/Icon';
import { Empty } from '@/components/ui/common';

const FILTERS: [VaultFilter, string][] = [['all', '전체'], ['voucher', '바우처'], ['receipt', '영수증'], ['ticket', 'e-티켓']];

export function VaultScreen() {
  const t = useTrip(), sheets = useSheets();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<VaultFilter>('all');
  const c: Record<VaultFilter, number> = { all: t.vault.length, voucher: 0, receipt: 0, ticket: 0 };
  t.vault.forEach(v => c[vGroup(v)]++);
  const query = q.trim().toLowerCase();
  const items = t.vault
    .filter(v => (filter === 'all' || vGroup(v) === filter) && (!query || (v.title + v.sub + VKIND[v.type]).toLowerCase().includes(query)))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <main className="screen fade-in">
      <div className="page-h"><div><span className="eyebrow">ARCHIVE</span><h1>보관함</h1><p className="sub">{t.vault.length}개 저장 · 모두 오프라인에서 열 수 있어요</p></div></div>
      <div className="search"><Icon name="search" size="sm" /><input className="input" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="바우처, 영수증, 예약번호 검색" aria-label="보관함 검색" /></div>
      <div className="up-row">
        <button className="up dark" onClick={sheets.scanVoucher}><span className="ui"><Icon name="upload" /></span><span><b>바우처 올리기</b><small>캡처 · PDF · 메일</small></span></button>
        <button className="up light" onClick={sheets.scanReceipt}><span className="ui"><Icon name="scan" /></span><span><b>영수증 스캔</b><small>가계부에 자동 기록</small></span></button>
      </div>
      <div className="filters">{FILTERS.map(([k, l]) => <button key={k} className={cx('fchip', filter === k && 'on')} onClick={() => setFilter(k)}>{l} {c[k]}</button>)}</div>
      <div>
        {items.length ? items.map(v => {
          const img = v.file?.data && v.file.type?.startsWith('image/') ? v.file.data : null;
          return (
            <button key={v.id} className="vcard" onClick={() => sheets.viewVoucher(v.id)}>
              <span className={cx('vi', v.type)}>{img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} /> : <Icon name={vIcon(v)} size="lg" />}</span>
              <span className="grow"><span className="k">{VKIND[v.type]}</span><b>{v.title}</b><small>{v.sub}</small></span>
              <span className="d num">{md(toDate(v.date))}<Icon name="chev" size="sm" /></span>
            </button>
          );
        }) : <Empty card icon="folder" title={query ? `'${q}' 검색 결과가 없어요` : '저장된 항목이 없어요'}>{query ? '다른 단어로 찾아보세요.' : '바우처 · 영수증 캡처를 올려 보세요.'}</Empty>}
      </div>
      <button className="book" onClick={sheets.book}><span className="bi"><Icon name="book" /></span><span><b>여행 기록북</b><small>여행이 끝나면 일정 · 지출 · 사진을 한 권으로 묶어드려요</small></span></button>
    </main>
  );
}
