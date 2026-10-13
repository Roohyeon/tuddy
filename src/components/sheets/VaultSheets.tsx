'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { VaultItem, VaultType } from '@/types/domain';
import { VKIND } from '@/lib/constants';
import { buildBook, shareUrl } from '@/lib/book';
import { readFile, shrink } from '@/lib/files';
import { compLabel, D, ddayInfo, spent, tripDays, vIcon } from '@/lib/trip';
import { iso, md, mdw, toDate, today, toMin, uid, won } from '@/lib/utils';
import { useNav } from '@/hooks/useNav';
import { useAccount, useTrip, useUndoable, useUpdateAccount } from '@/queries/account';
import { useSheetStore } from '@/stores/sheet';
import { useToast } from '@/stores/toast';
import { Icon } from '@/components/ui/Icon';
import { Opts, SheetHead } from '@/components/ui/common';

const guessKind = (name: string): VaultType =>
  /호텔|hotel|숙소|airbnb|booking/i.test(name) ? 'stay'
  : /티켓|ticket|항공|flight|eticket/i.test(name) ? 'ticket'
  : /입장|admission|museum|sky/i.test(name) ? 'entry'
  : /버스|train|rail|pass|교통/i.test(name) ? 'move' : 'stay';

/** 바우처 올리기 */
export function VoucherSaveSheet({ file }: { file: File }) {
  const t = useTrip();
  const update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet), toast = useToast();
  const isImg = file.type.startsWith('image/');
  const [data, setData] = useState<string | null | undefined>(undefined);
  const [title, setTitle] = useState(file.name.replace(/\.[^.]+$/, ''));
  const [type, setType] = useState<VaultType>(guessKind(file.name));
  const [sub, setSub] = useState('');
  const [link, setLink] = useState('');

  useEffect(() => {
    let alive = true;
    (isImg ? shrink(file, 1100) : file.size < 700 * 1024 ? readFile(file).catch(() => null) : Promise.resolve(null))
      .then(x => { if (alive) setData(x); });
    return () => { alive = false; };
  }, [file, isImg]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim(); if (!name) return;
    const meta = { name: file.name, type: isImg ? 'image/jpeg' : file.type };
    const v: VaultItem = { id: uid(), type, title: name, sub: sub.trim() || file.name, date: iso(today()), file: data ? { ...meta, data } : meta, link: link || null };
    closeSheet();
    update((_, tr) => {
      if (v.link) { const s = tr.schedule.find(x => x.id === v.link); if (s && !s.memo) s.memo = `${VKIND[v.type]} 보관함에 저장됨`; }
      tr.vault.push(v);
    }).then(saved => {
      if (saved) return toast('보관함에 저장했어요 · 오프라인에서도 열 수 있어요');
      // 저장 공간이 부족하면 파일 이름만 남겨요
      update((_, tr) => { const it = tr.vault.find(x => x.id === v.id); if (it) it.file = meta; });
      toast('저장 공간이 부족해 파일 이름만 저장했어요');
    });
  };

  return <>
    <SheetHead title="바우처 저장" />
    <div className="preview">
      {isImg && data
        ? <img src={data} alt="미리보기" />
        : <div className="scan-box" style={{ border: 0 }}><Icon name="folder" /><span>{file.name}<br /><small className="muted">{(file.size / 1024).toFixed(0)}KB{data === null ? ' · 큰 파일은 이름만 저장돼요' : ''}</small></span></div>}
    </div>
    <form className="form" onSubmit={submit} style={{ marginTop: 14 }}>
      <label className="field"><span>제목</span><input className="input" value={title} onChange={e => setTitle(e.target.value)} required maxLength={30} /></label>
      <div className="field"><span>종류</span><Opts list={(Object.entries(VKIND) as [VaultType, string][]).filter(([k]) => k !== 'receipt')} value={type} onChange={setType} /></div>
      <label className="field"><span>메모</span><input className="input" value={sub} onChange={e => setSub(e.target.value)} placeholder="예: 11.17 17:30 입장 · 2매" maxLength={40} /></label>
      <label className="field"><span>일정에 연결 (선택)</span><select className="input" value={link} onChange={e => setLink(e.target.value)}>
        <option value="">연결 안 함</option>
        {t.schedule.slice().sort((a, b) => a.day - b.day || toMin(a.time) - toMin(b.time)).map(s => <option key={s.id} value={s.id}>{s.day + 1}일차 {s.time} · {s.title}</option>)}
      </select></label>
      <button className="btn primary" type="submit" disabled={data === undefined}>보관함에 저장</button>
    </form>
  </>;
}

/** 보관함 항목 보기 */
export function VoucherViewSheet({ id }: { id: string }) {
  const t = useTrip(), update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet), undoable = useUndoable(), { go } = useNav();
  const v = t.vault.find(x => x.id === id);
  if (!v) return null;
  const link = t.schedule.find(s => s.id === v.link);
  const isImg = !!v.file?.data && !!v.file.type?.startsWith('image/');
  const remove = () => {
    let at = -1;
    update((_, tr) => { at = tr.vault.findIndex(x => x.id === v.id); if (at >= 0) tr.vault.splice(at, 1); });
    closeSheet();
    undoable(`'${v.title}' 삭제됨`, (_, tr) => { tr.vault.splice(at, 0, v); });
  };
  return <>
    <SheetHead title={VKIND[v.type]} />
    {isImg
      ? <div className="preview"><img src={v.file!.data!} alt={v.title} /></div>
      : <div className="pass" style={{ padding: 20 }}>
        <div className="pass-top"><span className="mono">{VKIND[v.type].toUpperCase()}</span><Icon name={vIcon(v)} /></div>
        <h3 style={{ fontSize: 20, marginTop: 16 }}>{v.title}</h3>
        <p style={{ color: 'rgb(255 255 255 / .75)', fontSize: 13, marginTop: 4 }}>{v.sub}</p>
        <div className="perf" />
        <p className="mono" style={{ fontSize: 11, marginTop: 12, color: 'rgb(255 255 255 / .7)' }}>TUDDY · OFFLINE COPY</p>
      </div>}
    <dl className="kv" style={{ marginTop: 12 }}>
      <dt>제목</dt><dd>{v.title}</dd>
      <dt>저장일</dt><dd>{md(toDate(v.date))}</dd>
      {link && <><dt>연결 일정</dt><dd>{link.day + 1}일차 {link.time} · {link.title}</dd></>}
      {v.file && <><dt>파일</dt><dd>{v.file.name}</dd></>}
    </dl>
    <div className="form" style={{ marginTop: 14 }}>
      {v.type === 'ticket' && <button className="btn primary" onClick={() => go('pass')}><Icon name="ticket" size="sm" /> 탑승권 열기</button>}
      {v.type === 'receipt' && <button className="btn primary" onClick={() => go('budget')}><Icon name="wallet" size="sm" /> 가계부에서 보기</button>}
      {v.file?.data && !isImg && <a className="btn soft" href={v.file.data} download={v.file.name}>파일 열기</a>}
      <button className="btn danger" onClick={remove}><Icon name="trash" size="sm" /> 삭제</button>
    </div>
  </>;
}

/** 여행 기록북 미리보기 */
export function BookSheet() {
  const t = useTrip(), d = D(t), n = tripDays(t), dd = ddayInfo(t), { db } = useAccount(), toast = useToast();
  // 공유 페이지는 서버에서 그려지므로(SSR) 공개해도 되는 요약만 링크에 담아요
  const url = shareUrl(buildBook(t, db?.name || '여행자'), location.origin);
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: `${d.city} 여행 기록북`, url }); return; }
      await navigator.clipboard.writeText(url); toast('기록북 링크를 복사했어요');
    } catch (e) { if ((e as Error)?.name !== 'AbortError') toast('공유할 수 없어요'); }
  };
  return <>
    <SheetHead title="여행 기록북" />
    <div className="pass" style={{ padding: 22 }}>
      <span className="mono" style={{ fontSize: 11, color: 'rgb(255 255 255 / .75)' }}>TRAVEL BOOK · {d.cc}</span>
      <h3 style={{ fontFamily: 'var(--f-serif)', fontSize: 30, fontWeight: 500, marginTop: 14 }}>{d.city}, {n - 1}박 {n}일</h3>
      <p style={{ color: 'rgb(255 255 255 / .75)', fontSize: 13 }}>{mdw(toDate(t.start))} – {mdw(toDate(t.end))} · {compLabel(t)}</p>
      <div className="perf" />
      <div className="fl"><div><label>방문</label><b>{t.schedule.length}곳</b></div><div><label>지출</label><b>{won(spent(t))}</b></div><div><label>보관</label><b>{t.vault.length}개</b></div></div>
    </div>
    <p className="muted" style={{ fontSize: 13, margin: '14px 4px' }}>{dd.phase === 2 ? '여행이 끝났어요! 링크로 기록북을 공유해 보세요.' : `여행이 끝나면(${md(toDate(t.end))} 이후) 일정 · 지출 · 사진을 한 권으로 묶어드려요. 지금은 미리보기예요.`}</p>
    <div className="form">
      <button className="btn primary" onClick={share}><Icon name="share" size="sm" /> 기록북 링크 공유</button>
      <a className="btn soft" href={url} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}><Icon name="book" size="sm" /> 공유 페이지 미리 보기</a>
    </div>
  </>;
}
