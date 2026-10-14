# 성능 측정 결과

측정: `node perf/measure.mjs --label <단계>` (Lighthouse 모바일 기본값, JS는 같은 출처 번들만, 크기는 전송량 기준)

### 0-baseline — 로컬 프로덕션 빌드 · 5회 중앙값 · 2026-10-14

| 페이지 | 단계 | 점수 | LCP | FCP | CLS | TBT | SI | JS(KB) | 폰트(KB) | 전체(KB) | 요청 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /login | 0-baseline | 84 | 3.62s | 2.87s | 0.000 | 16ms | 3.41s | 240 | 166 | 472 | 32 |
| /book/tokyo-4days | 0-baseline | 98 | 2.23s | 1.73s | 0.000 | 38ms | 1.73s | 242 | 304 | 619 | 51 |
| /monitor | 0-baseline | 92 | 2.71s | 1.72s | 0.000 | 195ms | 1.91s | 244 | 221 | 533 | 40 |
| /home | 0-baseline | 76 | 4.70s | 2.88s | 0.001 | 99ms | 3.81s | 267 | 384 | 755 | 87 |
| /schedule | 0-baseline | 67 | 6.53s | 2.89s | 0.000 | 202ms | 4.31s | 267 | 371 | 1351 | 138 |
| /budget | 0-baseline | 71 | 5.99s | 2.88s | 0.001 | 105ms | 3.64s | 267 | 260 | 631 | 76 |
| /vault | 0-baseline | 71 | 6.29s | 2.88s | 0.000 | 102ms | 3.56s | 267 | 270 | 641 | 76 |

> 기준선 메모: LCP 요소는 텍스트예요(로그인 `h1.greet`, 기록북 제목, 홈 탑승권 카드). 앱 화면은 CSR이라 HTML → JS → 세션 확인 → Supabase 조회 → 렌더를 거친 뒤에 LCP가 잡혀서, FCP(2.9s)와 LCP(4.7~6.5s) 차이가 커요. `/schedule`은 Google 지도 iframe 때문에 전송량이 1.3MB, 요청이 138개예요.

### 1-next-font — 로컬 프로덕션 빌드 · 5회 중앙값 · 2026-10-14

| 페이지 | 단계 | 점수 | LCP | FCP | CLS | TBT | SI | JS(KB) | 폰트(KB) | 전체(KB) | 요청 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /login | 1-next-font | 71 | 21.70s | 2.26s | 0.000 | 139ms | 3.32s | 240 | 2522 | 2850 | 303 |
| /book/tokyo-4days | 1-next-font | 70 | 21.69s | 2.71s | 0.001 | 86ms | 2.71s | 242 | 2581 | 2926 | 312 |
| /monitor | 1-next-font | 58 | 21.44s | 2.26s | 0.000 | 287ms | 9.23s | 244 | 2517 | 2852 | 304 |
| /home | 1-next-font | 71 | 22.93s | 1.50s | 0.000 | 116ms | 3.49s | 267 | 2604 | 3027 | 341 |
| /schedule | 1-next-font | 60 | 22.39s | 2.78s | 0.000 | 135ms | 12.97s | 267 | 2590 | 3620 | 392 |
| /budget | 1-next-font | 72 | 22.50s | 1.50s | 0.000 | 159ms | 3.28s | 267 | 2539 | 2962 | 337 |
| /vault | 1-next-font | 71 | 22.76s | 2.11s | 0.000 | 144ms | 3.46s | 267 | 2541 | 2964 | 336 |

### 1b-next-font-no-preload — 로컬 프로덕션 빌드 · 5회 중앙값 · 2026-10-14

| 페이지 | 단계 | 점수 | LCP | FCP | CLS | TBT | SI | JS(KB) | 폰트(KB) | 전체(KB) | 요청 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /login | 1b-next-font-no-preload | 85 | 4.06s | 1.51s | 0.000 | 85ms | 2.76s | 240 | 171 | 486 | 32 |
| /book/tokyo-4days | 1b-next-font-no-preload | 79 | 4.22s | 3.32s | 0.000 | 0ms | 3.32s | 242 | 312 | 637 | 51 |
| /monitor | 1b-next-font-no-preload | 78 | 4.06s | 3.16s | 0.027 | 178ms | 3.16s | 244 | 228 | 549 | 40 |
| /home | 1b-next-font-no-preload | 74 | 6.17s | 1.51s | 0.000 | 148ms | 3.56s | 267 | 395 | 774 | 87 |
| /schedule | 1b-next-font-no-preload | 74 | 5.72s | 1.51s | 0.000 | 167ms | 4.13s | 267 | 380 | 1368 | 138 |
| /budget | 1b-next-font-no-preload | 78 | 5.49s | 1.51s | 0.000 | 133ms | 3.23s | 267 | 268 | 647 | 76 |
| /vault | 1b-next-font-no-preload | 77 | 5.34s | 1.51s | 0.000 | 115ms | 2.96s | 267 | 278 | 657 | 76 |

### prod-google-fonts — https://tuddy-gold.vercel.app · 5회 중앙값 · 2026-10-14

| 페이지 | 단계 | 점수 | LCP | FCP | CLS | TBT | SI | JS(KB) | 폰트(KB) | 전체(KB) | 요청 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /login | prod-google-fonts | 80 | 4.22s | 3.02s | 0.000 | 8ms | 3.89s | 242 | 166 | 474 | 30 |
| /book/tokyo-4days | prod-google-fonts | 96 | 2.41s | 1.88s | 0.000 | 91ms | 1.88s | 243 | 304 | 621 | 49 |
| /monitor | prod-google-fonts | 90 | 2.86s | 1.89s | 0.000 | 207ms | 2.61s | 243 | 221 | 532 | 38 |

> 1단계 메모 (next/font)
> - `1-next-font`: `subsets: ['latin']`이어도 IBM Plex Sans KR의 **한글 조각 280여 개가 모두 preload**돼 폰트 2.5MB · 요청 300개 → LCP 21s. preload를 끈 `1b`가 실제 적용안이에요.
> - `1b`: 렌더링을 막던 외부 CSS가 사라져 **FCP 2.88s → 1.51s**(앱 화면). 하지만 LCP는 나빠졌어요(기록북 2.23s → 4.22s, 홈 4.70s → 6.17s).
> - 추정 원인: 로컬 `next start`는 HTTP/1.1이라 같은 출처로 옮긴 폰트 조각이 JS와 연결 6개를 나눠 써요. 예전엔 `fonts.gstatic.com`(HTTP/2, 별도 연결)이었어요. 운영(`prod-google-fonts`)이 로컬 기준선과 비슷한 걸 보면 로컬 측정이 HTTP 프로토콜 차이를 반영하지 못할 수 있어요 → **Vercel Preview(HTTP/2)에서 재측정해 유지 여부를 결정**해요.

### 2-lazy-sheets — 로컬 프로덕션 빌드 · 5회 중앙값 · 2026-10-14

| 페이지 | 단계 | 점수 | LCP | FCP | CLS | TBT | SI | JS(KB) | 폰트(KB) | 전체(KB) | 요청 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /login | 2-lazy-sheets | 85 | 4.20s | 1.51s | 0.000 | 105ms | 2.80s | 243 | 171 | 489 | 33 |
| /book/tokyo-4days | 2-lazy-sheets | 79 | 4.07s | 3.46s | 0.000 | 0ms | 3.46s | 244 | 312 | 639 | 52 |
| /monitor | 2-lazy-sheets | 78 | 4.51s | 3.17s | 0.000 | 143ms | 3.17s | 244 | 228 | 549 | 40 |
| /home | 2-lazy-sheets | 75 | 6.03s | 1.51s | 0.000 | 148ms | 3.68s | 281 | 395 | 788 | 93 |
| /schedule | 2-lazy-sheets | 73 | 5.72s | 1.51s | 0.000 | 196ms | 4.47s | 281 | 380 | 1385 | 144 |
| /budget | 2-lazy-sheets | 76 | 5.42s | 1.51s | 0.000 | 183ms | 3.29s | 281 | 268 | 661 | 82 |
| /vault | 2-lazy-sheets | 78 | 5.57s | 1.50s | 0.000 | 86ms | 2.90s | 281 | 278 | 671 | 82 |

> 2단계 메모 (시트 지연 로딩)
> - 초기 JS(gzip, `perf/initial-js.mjs`): 홈 290.9 → 279.1KB(−12KB, −4%), 일정 · 가계부 · 보관함 · 탑승권도 −11~12KB. 시트를 쓰지 않는 체크리스트 · 로그인은 `next/dynamic` 런타임으로 +2KB.
> - Lighthouse JS 전송량은 267 → 281KB로 늘었어요: 화면이 뜬 뒤 한가할 때 시트를 미리 받는(prefetch) 양까지 측정 구간에 잡혀서예요. LCP · TBT 변화는 측정 오차 범위 안이에요 → **효과 작음**.
> - 앱 초기 JS의 가장 큰 덩어리는 supabase-js(+ 쓰지 않는 Realtime 클라이언트) · React Query 청크(86KB gzip)예요.
