# Tuddy (터디) — 나의 여행 버디

여행 전 준비물 챙기기부터 탑승권, 일정, 가계부, 바우처 보관까지 한 곳에서 해결하는 모바일 여행 앱 프론트엔드 프로토타입입니다.

> 기록의 번거로움은 줄이고, 여행의 순간에 집중하게 한다.

## 화면
| 화면 | 주요 기능 |
| --- | --- |
| **로그인 / 회원가입** | 이메일 가입·로그인, 로그인 상태 유지, 데모 여행으로 둘러보기 (계정별 데이터 분리) |
| **새 여행 만들기** | 37개 나라 · 80개 도시 검색(도시·나라·영문·공항 코드) → 날짜·동행 → 예산. 여행지·계절(남반구 포함)·일수에 맞춰 준비물/출국 체크리스트, 비자·ETA, 콘센트, 통화 자동 설정 |
| **홈 (PASS)** | 탑승권 카드(D-Day, 동행 선택, 여행 날짜 변경), 항공권 캡처 → 편명·좌석·게이트 자동 입력, 출국 당일 체크, 준비 현황, 빠른 추가, 일자별 동선 |
| **나의 탑승권** | 가는 편/오는 편, QR, 정보 수정, 출국 당일 공항 타임라인, 알림 토글, 공유 |
| **일정** | 일자 탭, 실제 Google 지도 위에 번호 핀 + 점선 동선(멀리 떨어진 공항 등은 가장자리에 거리 표시), 장소별 보기, 크게 보기 · 실제 경로 보기, 앱에서 길찾기, 장소 좌표 자동 검색, 이동 시간 자동 계산, 장소 추가/수정/삭제, 순서 편집 |
| **가계부** | 남은 예산·환율 환산, 원화/현지 통화 입력, 카테고리 차트, 하루 권장 예산 대비 일자별 지출, 영수증 스캔, 실시간 환율 |
| **체크리스트** | 진행률, 준비물/출국 당일 탭, 입력하면 분류 자동 추천, 체크·삭제(되돌리기) |
| **보관함** | 검색, 바우처(이미지·PDF) 업로드 및 일정 연결, 영수증 스캔 → 가계부 자동 기록, 오프라인 열람, 여행 기록북 미리보기 · 공유 링크 |
| **공유용 여행 기록북** | 로그인 없이 링크로 보는 여행 요약 페이지 — 표지, 일자별 동선, 카테고리별 지출, SNS 미리보기 이미지 (SSR/SSG) |

## 디자인
- 컬러: Navy `#2F4156` · Teal `#567C8D` · Sky Blue `#C8D9E6` · Beige `#F5EFEB` · White
- 글래스모피즘 카드 + 탑승권 모티프, 하단 플로팅 탭바
- Tuddy 로고(핀 + 비행기 궤적)를 SVG로 재구성해 스플래시·로그인·파비콘에 사용 (원본: `image/logo.png`)

## 렌더링 전략
한 프로젝트 안에서 **페이지의 성격에 따라 렌더링 방식을 나눴어요.** 누구나 링크로 열어 보는 *공유용 여행 기록북*은 서버에서 HTML을 완성해 보내고(SSR/SSG), 로그인한 사용자가 계속 조작하는 *앱 화면*은 브라우저에서 그려요(CSR).

| 구분 | 경로 | 방식 | 빌드 결과 |
| --- | --- | --- | --- |
| 샘플 여행 기록북 | `/book/tokyo-4days`, `/book/osaka-3days` | **SSG**: `generateStaticParams`로 빌드할 때 HTML 생성, `dynamicParams = false` | ● SSG |
| 샘플 기록북 OG 이미지 | `/book/[slug]/opengraph-image` | **SSG**: 빌드할 때 PNG 생성 | ● SSG |
| 공유 링크 기록북 | `/book/share?d=…` | **SSR**: 요청마다 링크 데이터를 검증한 뒤 HTML과 메타 태그 생성 | ƒ Dynamic |
| 공유 링크 OG 이미지 | `/book/share/og?d=…` | **SSR**: Route Handler에서 `ImageResponse`로 생성 | ƒ Dynamic |
| sitemap | `/sitemap.xml` | 정적 생성 (샘플 기록북만 포함) | ○ Static |
| 앱 화면 | `/login` `/onboarding` `/home` `/schedule` `/budget` `/packing` `/vault` `/pass` | **CSR**: 빈 앱 껍데기만 정적으로 받고, 데이터는 브라우저(localStorage)에서 읽어 그림 | ○ Static 껍데기 + CSR |

### 1. 공유용 여행 기록북에 SSR/SSG를 적용한 이유
- **SNS 공유 미리보기**: 카카오톡 · 슬랙 · X · 페이스북의 링크 미리보기 봇은 대부분 JavaScript를 실행하지 않아요. CSR로 만들면 봇에게는 빈 `<div>`만 보여서 제목 · 설명 · 썸네일이 비게 돼요. 서버에서 `og:title` · `og:description` · `og:image` · `twitter:card`를 HTML에 넣어 보내야 미리보기 카드가 제대로 나와요. 썸네일도 `next/og`로 여행지 · 날짜 · 방문 수를 담은 1200×630 이미지를 서버에서 만들어요.
- **SEO 최적화**: 검색엔진이 받는 첫 HTML에 일정 · 장소 · 지출 내용이 모두 들어 있어서 그대로 색인돼요. 정적 샘플 기록북은 `canonical`과 `sitemap.xml`까지 갖춰 검색 노출용 페이지로 써요.
- **빠른 초기 로딩**: 기록북은 읽기만 하는 페이지라 서버 컴포넌트로만 만들었어요(`TravelBookView`, `'use client'` 없음). 그래서 이 페이지를 위한 클라이언트 JavaScript가 거의 없고, JavaScript가 꺼져 있어도 내용이 그대로 보여요. 링크를 처음 여는 사람은 앱을 설치하거나 로그인한 적이 없으니, 받자마자 바로 보이는 HTML이 가장 좋은 경험이에요.
- **SSG와 SSR을 나눈 기준**
  - **SSG (샘플 기록북)**: 내용이 바뀌지 않으니 빌드할 때 한 번만 만들어 CDN에서 캐시된 파일로 내려줘요(`x-nextjs-cache: HIT`). 서버 비용이 들지 않고 가장 빨라요.
  - **SSR (공유 링크)**: 사용자마다 내용이 다른 기록북이라 미리 만들 수 없어요. 요청 시점에 링크(`?d=`)의 데이터를 서버가 읽어 HTML과 OG 태그를 만들어요.
- **공유 데이터를 다루는 방식**
  - 지금은 서버 DB가 없어서, 공개해도 되는 요약만 base64url JSON으로 링크에 담아요. 예약번호 · 탑승객 이름 · 첨부 파일 · 메모는 넣지 않아요.
  - 서버는 링크 값을 믿지 않고 `decodeBook()`에서 타입 · 길이 · 날짜 범위를 하나씩 검사하고, 잘못된 링크는 404로 처리해요.
  - 개인 여행이라 공유 링크 페이지는 `noindex`로 검색에서 빼요. 그래도 SNS 미리보기는 OG 태그로 정상적으로 나와요.

### 2. 앱 화면에 CSR을 적용한 이유
- **사용자 인터랙션이 많아요**: 체크 토글, 바텀 시트, 순서 편집, 되돌리기 토스트, 지도 핀 선택, 일차 탭 전환처럼 화면을 바꾸는 조작이 매우 잦아요. 조작할 때마다 서버를 거치면 반응이 느려지니, 브라우저에서 바로 상태를 바꾸고 다시 그려요.
- **클라이언트 상태 관리**: 계정과 여행 데이터는 브라우저 localStorage에 계정별로 저장돼요. 서버는 이 데이터를 볼 수 없으니 서버에서 미리 그릴 수 없어요. 계정 데이터는 TanStack Query가, 화면 사이에서 이어지는 UI 상태(선택한 일차, 체크리스트 탭, 탑승권 방향, 시트, 토스트)는 Zustand가 브라우저에서 관리해요. 자세한 기준은 아래 [상태 관리](#상태-관리)에 있어요.
- **동적 데이터 처리**: 실시간 환율(open.er-api), 장소 좌표 검색(Nominatim), 지도 크기에 맞춘 핀 위치 계산(`ResizeObserver`), 이미지 축소 · 캡처 인식(Canvas · FileReader), Web Share · 클립보드 API처럼 브라우저에서만 할 수 있는 처리가 대부분이에요.
- **검색 노출이 필요 없어요**: 로그인한 사람만 보는 개인 대시보드라 검색엔진이 볼 내용이 없어요. 그래서 `(app)` 레이아웃에 `noindex`를 걸어 두었어요.
- **동작 방식**: 앱 경로도 빌드 결과는 ○ Static이지만, 서버가 내려주는 건 데이터 없는 껍데기(기기 프레임 · 스플래시)뿐이에요. `Guard`가 localStorage를 읽은 뒤 로그인 · 여행 여부에 따라 `/login` · `/onboarding` · `/home`으로 보내고, 그 다음 화면을 그려요. 그래서 정적 호스팅이나 CDN만으로 배포할 수 있어요.

### 3. 기술 스택 · 렌더링 구조 요약
| 영역 | 사용 기술 |
| --- | --- |
| 프레임워크 | **Next.js 16** (App Router, Turbopack) · **React 19** |
| 언어 | **TypeScript 5.9** (`strict`), 도메인 타입은 `src/types/domain.ts` |
| SSG | `generateStaticParams` + `dynamicParams = false`, 파일 기반 `opengraph-image`, `sitemap.ts` |
| SSR | 비동기 `searchParams`를 읽는 서버 컴포넌트, `generateMetadata`(OG · Twitter · robots), Route Handler + `next/og` `ImageResponse` |
| CSR | `'use client'` 컴포넌트, localStorage 저장, 클라이언트 라우트 가드 |
| 서버 상태 | **TanStack Query v5** — 계정 조회 · 저장 뮤테이션, 로그인 · 회원가입, 실시간 환율, 장소 좌표 |
| 클라이언트 상태 | **Zustand v5** — 세션, 화면 선택 값, 바텀 시트, 토스트 |
| 스타일 | 전역 CSS(앱, 기존 디자인 그대로) + CSS Modules(기록북) |
| 외부 API | Google 지도 임베드, OpenStreetMap Nominatim, open.er-api 환율 |

라우트 그룹으로 레이아웃을 나눠서 렌더링 방식이 섞이지 않게 했어요. 루트 `layout.tsx`는 html · 폰트 · 메타데이터만 담당하고, 클라이언트 Provider와 기기 프레임은 `(app)` 그룹에서만 감싸요. 그래서 `/book/*`는 클라이언트 번들 없이 서버에서 바로 렌더링돼요.

```
src/
├─ app/
│  ├─ layout.tsx                 # 공통: html · 폰트 · metadataBase (서버)
│  ├─ sitemap.ts                 # 샘플 기록북 sitemap
│  ├─ (app)/                     # ── CSR 영역 ──
│  │  ├─ layout.tsx              # QueryProvider + AppChrome(탭바 · 시트 · 토스트), noindex
│  │  ├─ page.tsx                # / → 로그인 · 새 여행 · 홈으로 분기
│  │  ├─ login/  onboarding/
│  │  └─ (trip)/                 # 여행이 있어야 들어오는 화면 (Guard)
│  │     └─ home/ schedule/ budget/ packing/ vault/ pass/
│  └─ book/                      # ── SSR/SSG 영역 ──
│     ├─ [slug]/page.tsx         # SSG 샘플 기록북
│     ├─ [slug]/opengraph-image.tsx
│     └─ share/page.tsx          # SSR 공유 링크 기록북
│        └─ og/route.tsx         # SSR OG 이미지
├─ api/                         # 서버 역할 계층 (컴포넌트는 직접 부르지 않음)
│  ├─ account.ts                 # 계정 조회 · 저장 · 로그인 · 회원가입 (지금은 localStorage)
│  └─ external.ts                # 지오코딩 · 실시간 환율 fetch
├─ queries/                      # TanStack Query 훅 (서버 상태)
│  ├─ keys.ts                    # 쿼리 키
│  ├─ account.ts                 # useAccount · useTrip · useUpdateAccount · useUndoable · useResetDemo
│  ├─ auth.ts                    # useLogin · useSignup · useDemoLogin · useLogout
│  └─ external.ts                # useLiveRate · useGeocodeStop
├─ stores/                       # Zustand 스토어 (클라이언트 상태)
│  └─ session · ui · sheet · toast
├─ hooks/useNav.ts               # 탭 이동 · 뒤로 가기
├─ components/
│  ├─ providers/QueryProvider.tsx
│  ├─ book/                      # TravelBookView (서버 컴포넌트) + book.module.css
│  ├─ screens/                   # 앱 화면 8개 (클라이언트 컴포넌트)
│  ├─ sheets/                    # 바텀 시트 + useSheets()
│  └─ ui/                        # Icon · MapBlock · AppChrome · Guard · 공용 조각
├─ lib/
│  ├─ book.ts                    # 여행 → 기록북 요약 · 링크 인코딩/검증 · 샘플 데이터
│  ├─ bookOg.tsx                 # OG 이미지 렌더러
│  └─ destinations · trip · map · storage · files · utils
└─ types/domain.ts               # 도메인 타입 (Trip · TravelBook …)
```
이전 Vanilla JS 버전은 `legacy/`에 그대로 보관했어요.

## 상태 관리
예전에는 `TuddyProvider`(React Context) 하나가 계정 데이터, 저장, 화면 선택 값, 시트, 토스트를 모두 들고 있었어요. 값 하나만 바뀌어도 앱 전체가 다시 그려졌고, "서버에서 오는 데이터"와 "이 화면에서만 쓰는 값"이 섞여 있었어요. 지금은 역할에 따라 둘로 나눴어요.

| 구분 | 담당 | 기준 | 예 |
| --- | --- | --- | --- |
| 서버 상태 | **TanStack Query** | 저장소(지금은 localStorage, 나중엔 백엔드)나 외부 API에 원본이 있고, 불러오기 · 저장 · 로딩 · 에러 · 캐시가 필요한 값 | 계정 · 여행 데이터, 로그인 결과, 실시간 환율, 장소 좌표 |
| 클라이언트 상태 | **Zustand** | 이 브라우저 화면에서만 의미 있고, 저장하지 않아도 되는 값 | 로그인한 이메일, 선택한 일차 · 탭 · 탑승권 방향, 열린 시트, 토스트 |
| 지역 상태 | `useState` | 한 컴포넌트 안에서만 쓰는 값 | 폼 입력값, 순서 편집 모드 |

### 데이터 흐름
```
컴포넌트 ──useAccount()/useTrip()──▶ useQuery(['account', email]) ──▶ api/account.fetchAccount
    │
    └─update(db => …)──▶ ① 캐시를 복사해 고친 값으로 바로 교체 (낙관적 업데이트, 화면 즉시 반영)
                         ② useMutation(scope: 'account') ──▶ api/account.putAccount
                         ③ 저장 실패 → 토스트 · Promise<false> (보관함은 파일 없이 다시 저장)
```
- **컴포넌트는 역할별 훅만 불러요.** 데이터는 `useTrip()`과 `useUpdateAccount()`, 화면 값은 `useUIStore(s => s.sday)`처럼 필요한 필드만 구독해요. 시트를 열고 닫아도 데이터 화면은 다시 그려지지 않아요.
- **`api/`는 서버를 대신하는 비동기 계층이에요.** 지금은 localStorage를 감싸고 있어서, 백엔드를 붙일 때는 `api/account.ts`의 함수 본문만 `fetch`로 바꾸면 돼요. 훅과 컴포넌트는 그대로예요.
- **저장은 순서대로 처리돼요.** 같은 `scope`로 묶인 뮤테이션은 줄을 서서 실행되므로, 빠르게 여러 번 바꿔도 마지막 상태가 저장돼요.
- **시트가 닫혀도 끝까지 처리해요.** 좌표 찾기처럼 시트를 닫은 뒤에 끝나는 작업은 결과 처리를 `useMutation` 옵션에 두어서, 컴포넌트가 사라져도 결과가 저장돼요.
- **로딩 · 에러는 쿼리가 알려 줘요.** 실시간 환율은 `isFetching`과 `isError`로 안내 문구와 버튼 상태를 정하고, 로그인 실패는 뮤테이션 에러 메시지를 폼에 그대로 보여 줘요.

## 실행
```bash
npm install
npm run dev        # http://localhost:3000 → 데모 여행으로 둘러보기
npm run build      # 프로덕션 빌드 (타입 검사 포함, 라우트별 렌더링 방식 표시)
npm start          # 빌드 결과 실행
```
- 샘플 기록북 (SSG): http://localhost:3000/book/tokyo-4days
- 내 기록북 공유 (SSR): 앱 → 보관함 → **여행 기록북** → *기록북 링크 공유* / *공유 페이지 미리 보기*
- 배포할 때는 `.env.local`에 `NEXT_PUBLIC_SITE_URL`을 넣어 주세요. 공유 링크 · OG 이미지 · sitemap의 절대 URL에 쓰여요.

## Google 지도
기본은 API 키 없이 동작하는 Google 지도 임베드를 사용해요. 일정 좌표로 지도 중심 · 줌을 계산하고, 같은 메르카토르 투영으로 번호 핀과 연결선을 지도 위에 겹쳐 그려요 (그래서 기본 지도는 드래그 대신 핀 · 칩을 눌러 이동해요). 공식 **Maps Embed API**를 쓰려면 `.env.local`에 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`를 넣으세요 (`.env.example` 참고) (공개 배포 시 HTTP 리퍼러 제한 필수).
새로 추가한 장소의 좌표는 OpenStreetMap Nominatim으로 찾고, 못 찾으면 지도에서 장소 이름으로 검색해요.

## 데모 한계 · 향후 과제
- 항공권/영수증 인식은 실제 OCR 대신 예시 값으로 채워요 → CLOVA OCR / Vision API 연동
- 인증은 브라우저 저장소 기반 데모 → Firebase/Supabase 백엔드 동기화, 일행 공유
- 공유 링크는 서버 저장소 없이 데이터를 URL에 담아요 (긴 일정은 링크가 길어짐) → 백엔드에 저장하고 짧은 ID로 SSR · ISR 재검증
- 키 없는 임베드 지도는 비공식 방식 → 배포 시 Maps Embed API 키 사용 권장, Places 자동완성 연동
