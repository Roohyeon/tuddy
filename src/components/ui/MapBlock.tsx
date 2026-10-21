'use client';
import { useEffect, useRef, useState } from 'react';
import type { Trip } from '@/types/domain';
import { computeMap } from '@/lib/map';
import { D, dayItems } from '@/lib/trip';
import { cx } from '@/lib/utils';
import { useIdleVisible } from '@/hooks/useIdleVisible';
import { Icon } from './Icon';

/** 번호 동선 지도 — 구글 지도 위에 같은 투영으로 핀과 점선 동선을 겹쳐 그려요 */
export function MapBlock({ t, day, big, onExpand }: { t: Trip; day: number; big?: boolean; onExpand?: () => void }) {
  const items = dayItems(t, day);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  // 선택한 핀 · 경로 보기는 일차(여행)별 값이에요. 일차가 바뀌면 전체 동선으로 돌아가요
  const viewKey = `${t.id}:${day}`;
  const [sel, setSel] = useState({ key: viewKey, focus: null as string | null, route: false });
  const { focus, route } = sel.key === viewKey ? sel : { focus: null, route: false };

  useEffect(() => {
    const el = box.current; if (!el) return;
    let tm: ReturnType<typeof setTimeout>;
    const measure = () => setSize([el.clientWidth, el.clientHeight]);
    const ro = new ResizeObserver(() => { clearTimeout(tm); tm = setTimeout(measure, 120); });
    ro.observe(el); measure();
    return () => { ro.disconnect(); clearTimeout(tm); };
  }, []);

  // Google 지도 iframe(수백 KB · 요청 100여 개)은 화면에 보이고 한가해진 뒤 붙여요.
  // 그 전에도 핀 · 점선 동선 오버레이는 바로 그려지고, 자리는 .gmap 높이와 shimmer 배경이 지켜요
  const showMap = useIdleVisible(box);

  const [W, H] = size;
  const f = items.find(s => s.id === focus) || null;
  const view = W && H ? computeMap(t, items, f?.id ?? null, route, W, H) : null;
  const pick = (id: string | null) => setSel({ key: viewKey, focus: id, route: false });
  const line = view?.line.map(p => p.join(',')).join(' ');

  return (
    <div>
      <div ref={box} className={cx('gmap', big && 'big', route && 'route')}>
        {view && showMap && <iframe src={view.src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={`${D(t).city} 지도`} tabIndex={-1} />}
        <svg className="ov" aria-hidden="true">
          {line && <>
            <polyline points={line} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
            <polyline points={line} fill="none" stroke="#1b1b1b" strokeWidth="2.6" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />
          </>}
          {view?.markers.map(m => (
            <g key={m.id} className={cx('mk', m.on && 'on', m.far && 'far')} onClick={() => pick(m.on ? null : m.id)}>
              <title>{`${m.n}. ${m.title}`}</title>
              {m.label && <text x={m.label.x} y={m.y + 4} textAnchor={m.label.anchor} fontSize="11" fontWeight="700" fill="#1b1b1b" stroke="#fff" strokeWidth="3" paintOrder="stroke">{m.label.text}</text>}
              <circle cx={m.x} cy={m.y} r={m.on ? 15 : 13} fill={m.on ? '#f5f5f5' : '#1b1b1b'} stroke={m.on ? '#1b1b1b' : '#fff'} strokeWidth="3" strokeDasharray={m.far ? '4 3' : undefined} />
              <text x={m.x} y={m.y + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={m.on ? '#1b1b1b' : '#fff'}>{m.n}</text>
            </g>
          ))}
        </svg>
        {!big && items.length > 0 && <button className="expand" onClick={onExpand}><Icon name="expand" size="sm" /> 크게 보기</button>}
        {big && items.length > 1 && <button className="expand" onClick={() => setSel({ key: viewKey, focus, route: !route })}><Icon name="map" size="sm" /> {route ? '번호 동선 보기' : '실제 경로 보기'}</button>}
      </div>
      {items.length > 1 && (
        <div className="map-chips">
          <button className={cx(!f && 'on')} onClick={() => pick(null)}><Icon name="map" size="xs" /> 전체 동선</button>
          {items.map((s, i) => <button key={s.id} className={cx(f?.id === s.id && 'on')} onClick={() => pick(s.id)}><span className="n">{i + 1}</span>{s.title}</button>)}
        </div>
      )}
    </div>
  );
}
