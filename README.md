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
| **보관함** | 검색, 바우처(이미지·PDF) 업로드 및 일정 연결, 영수증 스캔 → 가계부 자동 기록, 오프라인 열람, 여행 기록북 미리보기 |

## 디자인
- 컬러: Navy `#2F4156` · Teal `#567C8D` · Sky Blue `#C8D9E6` · Beige `#F5EFEB` · White
- 글래스모피즘 카드 + 탑승권 모티프, 하단 플로팅 탭바
- Tuddy 로고(핀 + 비행기 궤적)를 SVG로 재구성해 스플래시·로그인·파비콘에 사용 (원본: `image/logo.png`)

## 기술
**Next.js 16 (App Router) · React 19 · TypeScript (strict)** — 데이터는 localStorage에 계정별 저장 (클라이언트 전용).

```
src/
├─ app/                      # App Router
│  ├─ layout.tsx             # 폰트 · 메타데이터 · Provider · 기기 프레임
│  ├─ page.tsx               # / → 로그인 · 새 여행 · 홈으로 분기
│  ├─ login/  onboarding/    # 로그인 · 새 여행 만들기
│  └─ (trip)/                # 여행이 있어야 들어오는 화면 (layout에서 가드)
│     └─ home/ schedule/ budget/ packing/ vault/ pass/
├─ components/
│  ├─ screens/               # 화면 8개 (Auth · Onboarding · Home · Schedule · Budget · Packing · Vault · Pass)
│  ├─ sheets/                # 바텀 시트 (일정 · 지출 · 바우처 · 탑승권 · 계정 …) + useSheets()
│  └─ ui/                    # Icon · MapBlock · 탭바/시트/토스트(AppChrome) · Guard · 공용 조각
├─ lib/                      # destinations(여행지 데이터) · trip(도메인 로직) · map · storage · utils
├─ store/TuddyProvider.tsx   # 계정 데이터 · 화면 간 UI 상태 · 시트 · 토스트 컨텍스트
└─ types/domain.ts           # 도메인 타입 (Trip · ScheduleItem · Expense · VaultItem · Flight …)
```
이전 Vanilla JS 버전은 `legacy/`에 그대로 보관했어요.

## 실행
```bash
npm install
npm run dev        # http://localhost:3000 → 데모 여행으로 둘러보기
npm run build      # 프로덕션 빌드 (타입 검사 포함)
```

## Google 지도
기본은 API 키 없이 동작하는 Google 지도 임베드를 사용해요. 일정 좌표로 지도 중심 · 줌을 계산하고, 같은 메르카토르 투영으로 번호 핀과 연결선을 지도 위에 겹쳐 그려요 (그래서 기본 지도는 드래그 대신 핀 · 칩을 눌러 이동해요). 공식 **Maps Embed API**를 쓰려면 `.env.local`에 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`를 넣으세요 (`.env.example` 참고) (공개 배포 시 HTTP 리퍼러 제한 필수).
새로 추가한 장소의 좌표는 OpenStreetMap Nominatim으로 찾고, 못 찾으면 지도에서 장소 이름으로 검색해요.

## 데모 한계 · 향후 과제
- 항공권/영수증 인식은 실제 OCR 대신 예시 값으로 채워요 → CLOVA OCR / Vision API 연동
- 인증은 브라우저 저장소 기반 데모 → Firebase/Supabase 백엔드 동기화, 일행 공유
- 키 없는 임베드 지도는 비공식 방식 → 배포 시 Maps Embed API 키 사용 권장, Places 자동완성 연동
