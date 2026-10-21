import type { CityRow, CountryCode, CountryRow, CurrencyCode, CurrencyRow, DestKey, Destination, PlaceRow, ReceiptRow } from '@/types/domain';
/* =========================================================
   Tuddy — 여행지 데이터
   나라(통화 · 콘센트 · 사전 입국 허가) + 도시(공항 · 비행 시간 · 좌표)
   환율은 기본값이며 가계부에서 실시간 환율로 바꿀 수 있어요.
   ========================================================= */

// code: [이름, 기호, 원/단위 기본 환율, 표시 단위, 소수 자리]
export const CURRENCIES: Record<CurrencyCode, CurrencyRow> = {
  KRW:['원화','₩',1,1,0], JPY:['엔화','¥',9.1,100,0], CNY:['위안','CN¥',190,1,2], HKD:['홍콩달러','HK$',177,1,1], MOP:['파타카','MOP$',172,1,1],
  TWD:['대만달러','NT$',43,1,0], THB:['바트','฿',40,1,0], VND:['동','₫',0.055,1000,0], PHP:['페소','₱',24,1,0], SGD:['싱가포르달러','S$',1030,1,2],
  MYR:['링깃','RM',300,1,2], IDR:['루피아','Rp',0.085,1000,0], LAK:['킵','₭',0.064,1000,0], MNT:['투그릭','₮',0.4,100,0], INR:['루피','₹',16.5,1,0],
  AED:['디르함','AED ',375,1,2], TRY:['리라','₺',40,1,0], USD:['달러','$',1380,1,2], CAD:['캐나다달러','C$',1000,1,2], MXN:['멕시코 페소','MX$',75,1,0],
  AUD:['호주달러','A$',900,1,2], NZD:['뉴질랜드달러','NZ$',820,1,2], GBP:['파운드','£',1750,1,2], EUR:['유로','€',1480,1,2], CHF:['스위스 프랑','CHF ',1580,1,2],
  CZK:['코루나','Kč ',59,1,0], HUF:['포린트','Ft ',3.8,100,0], EGP:['이집트 파운드','E£',28,1,0],
};

// cc: [나라, 영문, 통화, 콘센트, 사전 입국 허가]
export const COUNTRIES: Record<CountryCode, CountryRow> = {
  KR:['대한민국','Korea','KRW','',''],
  JP:['일본','Japan','JPY','A타입 콘센트 · 110V',''],
  CN:['중국','China','CNY','A·C·I타입 혼용','중국 비자 (무비자 여부 확인)'],
  HK:['홍콩','Hong Kong','HKD','G타입 · 변환 플러그 필요',''],
  MO:['마카오','Macau','MOP','G타입 · 변환 플러그 필요',''],
  TW:['대만','Taiwan','TWD','A타입 · 110V',''],
  TH:['태국','Thailand','THB','A·C타입 혼용',''],
  VN:['베트남','Vietnam','VND','A·C타입 혼용',''],
  PH:['필리핀','Philippines','PHP','A타입 · 변환 플러그 필요','eTravel 등록'],
  SG:['싱가포르','Singapore','SGD','G타입 · 변환 플러그 필요','SG Arrival Card 등록'],
  MY:['말레이시아','Malaysia','MYR','G타입 · 변환 플러그 필요','MDAC 입국 카드 등록'],
  ID:['인도네시아','Indonesia','IDR','C타입 · 한국 플러그 사용 가능','도착 비자 (e-VOA)'],
  KH:['캄보디아','Cambodia','USD','A·C타입 혼용','캄보디아 e-Visa'],
  LA:['라오스','Laos','LAK','A·C타입 혼용',''],
  MN:['몽골','Mongolia','MNT','C타입 · 한국 플러그 사용 가능',''],
  IN:['인도','India','INR','C·D타입 혼용','인도 e-Visa'],
  AE:['아랍에미리트','UAE','AED','G타입 · 변환 플러그 필요',''],
  TR:['튀르키예','Türkiye','TRY','C·F타입 · 한국 플러그 사용 가능',''],
  US:['미국','USA','USD','A타입 · 110V','ESTA 승인'],
  CA:['캐나다','Canada','CAD','A타입 · 110V','캐나다 eTA 승인'],
  MX:['멕시코','Mexico','MXN','A타입 · 110V',''],
  AU:['호주','Australia','AUD','I타입 · 변환 플러그 필요','호주 ETA 승인'],
  NZ:['뉴질랜드','New Zealand','NZD','I타입 · 변환 플러그 필요','NZeTA 승인'],
  GB:['영국','United Kingdom','GBP','G타입 · 변환 플러그 필요','영국 ETA 승인'],
  FR:['프랑스','France','EUR','C·E타입 · 한국 플러그 사용 가능',''],
  IT:['이탈리아','Italy','EUR','C·F·L타입 · 한국 플러그 대부분 사용 가능',''],
  ES:['스페인','Spain','EUR','C·F타입 · 한국 플러그 사용 가능',''],
  DE:['독일','Germany','EUR','C·F타입 · 한국 플러그 사용 가능',''],
  CH:['스위스','Switzerland','CHF','J타입 · 변환 플러그 필요',''],
  AT:['오스트리아','Austria','EUR','C·F타입 · 한국 플러그 사용 가능',''],
  CZ:['체코','Czechia','CZK','C·E타입 · 한국 플러그 사용 가능',''],
  HU:['헝가리','Hungary','HUF','C·F타입 · 한국 플러그 사용 가능',''],
  NL:['네덜란드','Netherlands','EUR','C·F타입 · 한국 플러그 사용 가능',''],
  PT:['포르투갈','Portugal','EUR','C·F타입 · 한국 플러그 사용 가능',''],
  GR:['그리스','Greece','EUR','C·F타입 · 한국 플러그 사용 가능',''],
  HR:['크로아티아','Croatia','EUR','C·F타입 · 한국 플러그 사용 가능',''],
  EG:['이집트','Egypt','EGP','C·F타입 · 한국 플러그 사용 가능','이집트 e-Visa'],
};

// [key, 도시, 영문, 나라, 공항 코드, 공항 표시, 비행 시간(분), 위도, 경도, 더운 곳]
export const CITIES: CityRow[] = [
  ['jeju','제주','Jeju','KR','CJU','제주',70,33.4996,126.5312],
  ['seogwipo','서귀포','Seogwipo','KR','CJU','제주',70,33.2541,126.5600],
  ['busan','부산','Busan','KR','PUS','부산 · 김해',60,35.1796,129.0756],
  ['gangneung','강릉','Gangneung','KR','YNY','양양',55,37.7519,128.8761],
  ['sokcho','속초','Sokcho','KR','YNY','양양',55,38.2070,128.5918],
  ['yeosu','여수','Yeosu','KR','RSU','여수',60,34.7604,127.6622],
  ['gyeongju','경주','Gyeongju','KR','KPO','포항경주',55,35.8562,129.2247],
  ['pohang','포항','Pohang','KR','KPO','포항경주',55,36.0190,129.3435],
  ['daegu','대구','Daegu','KR','TAE','대구',55,35.8714,128.6014],
  ['ulsan','울산','Ulsan','KR','USN','울산',60,35.5384,129.3114],
  ['gwangju','광주','Gwangju','KR','KWJ','광주',55,35.1595,126.8526],
  ['tongyeong','통영','Tongyeong','KR','HIN','사천',60,34.8544,128.4332],
  ['jeonju','전주','Jeonju','KR','KUV','군산',50,35.8242,127.1480],
  ['tokyo','도쿄','Tokyo','JP','NRT','도쿄 · 나리타',140,35.6812,139.7671],
  ['osaka','오사카','Osaka','JP','KIX','오사카 · 간사이',105,34.6937,135.5023],
  ['kyoto','교토','Kyoto','JP','KIX','오사카 · 간사이',105,35.0116,135.7681],
  ['fukuoka','후쿠오카','Fukuoka','JP','FUK','후쿠오카',80,33.5902,130.4017],
  ['sapporo','삿포로','Sapporo','JP','CTS','삿포로 · 신치토세',165,43.0618,141.3545],
  ['okinawa','오키나와','Okinawa','JP','OKA','오키나와 · 나하',135,26.2124,127.6809,1],
  ['nagoya','나고야','Nagoya','JP','NGO','나고야 · 주부',115,35.1815,136.9066],
  ['matsuyama','마쓰야마','Matsuyama','JP','MYJ','마쓰야마',90,33.8392,132.7657],
  ['beijing','베이징','Beijing','CN','PEK','베이징 · 서우두',125,39.9042,116.4074],
  ['shanghai','상하이','Shanghai','CN','PVG','상하이 · 푸둥',115,31.2304,121.4737],
  ['qingdao','칭다오','Qingdao','CN','TAO','칭다오',85,36.0671,120.3826],
  ['zhangjiajie','장자제','Zhangjiajie','CN','DYG','장자제',230,29.1171,110.4792],
  ['hongkong','홍콩','Hong Kong','HK','HKG','홍콩',220,22.2988,114.1722,1],
  ['macau','마카오','Macau','MO','MFM','마카오',215,22.1987,113.5439,1],
  ['taipei','타이베이','Taipei','TW','TPE','타이베이 · 타오위안',150,25.0330,121.5654,1],
  ['kaohsiung','가오슝','Kaohsiung','TW','KHH','가오슝',180,22.6273,120.3014,1],
  ['bangkok','방콕','Bangkok','TH','BKK','방콕 · 수완나품',345,13.7563,100.5018,1],
  ['chiangmai','치앙마이','Chiang Mai','TH','CNX','치앙마이',340,18.7883,98.9853,1],
  ['phuket','푸껫','Phuket','TH','HKT','푸껫',380,7.8804,98.3923,1],
  ['danang','다낭','Da Nang','VN','DAD','다낭',270,16.0544,108.2022,1],
  ['hanoi','하노이','Hanoi','VN','HAN','하노이 · 노이바이',270,21.0278,105.8342,1],
  ['hochiminh','호찌민','Ho Chi Minh','VN','SGN','호찌민 · 떤선녓',320,10.7769,106.7009,1],
  ['nhatrang','나트랑','Nha Trang','VN','CXR','나트랑 · 깜라인',330,12.2388,109.1967,1],
  ['phuquoc','푸꾸옥','Phu Quoc','VN','PQC','푸꾸옥',360,10.2899,103.9840,1],
  ['cebu','세부','Cebu','PH','CEB','세부 · 막탄',290,10.3157,123.8854,1],
  ['manila','마닐라','Manila','PH','MNL','마닐라',240,14.5995,120.9842,1],
  ['boracay','보라카이','Boracay','PH','MPH','보라카이 · 칼리보',270,11.9674,121.9248,1],
  ['bohol','보홀','Bohol','PH','TAG','보홀 · 팡라오',300,9.6496,123.8547,1],
  ['singapore','싱가포르','Singapore','SG','SIN','싱가포르 · 창이',380,1.2903,103.8520,1],
  ['kualalumpur','쿠알라룸푸르','Kuala Lumpur','MY','KUL','쿠알라룸푸르',390,3.1390,101.6869,1],
  ['kotakinabalu','코타키나발루','Kota Kinabalu','MY','BKI','코타키나발루',300,5.9804,116.0735,1],
  ['bali','발리','Bali','ID','DPS','발리 · 응우라라이',420,-8.6500,115.2167,1],
  ['siemreap','시엠레아프','Siem Reap','KH','SAI','시엠레아프 · 앙코르',350,13.3671,103.8448,1],
  ['vientiane','비엔티안','Vientiane','LA','VTE','비엔티안',330,17.9757,102.6331,1],
  ['ulaanbaatar','울란바토르','Ulaanbaatar','MN','UBN','울란바토르 · 칭기즈칸',210,47.8864,106.9057],
  ['delhi','델리','Delhi','IN','DEL','델리',520,28.6139,77.2090,1],
  ['dubai','두바이','Dubai','AE','DXB','두바이',570,25.2048,55.2708,1],
  ['istanbul','이스탄불','Istanbul','TR','IST','이스탄불',720,41.0082,28.9784],
  ['newyork','뉴욕','New York','US','JFK','뉴욕 · JFK',840,40.7128,-74.0060],
  ['losangeles','로스앤젤레스','Los Angeles','US','LAX','로스앤젤레스',660,34.0522,-118.2437],
  ['sanfrancisco','샌프란시스코','San Francisco','US','SFO','샌프란시스코',640,37.7749,-122.4194],
  ['lasvegas','라스베이거스','Las Vegas','US','LAS','라스베이거스',690,36.1699,-115.1398],
  ['seattle','시애틀','Seattle','US','SEA','시애틀',600,47.6062,-122.3321],
  ['hawaii','하와이','Honolulu','US','HNL','하와이 · 호놀룰루',510,21.2793,-157.8292,1],
  ['guam','괌','Guam','US','GUM','괌',260,13.4443,144.7937,1],
  ['saipan','사이판','Saipan','US','SPN','사이판',270,15.1850,145.7467,1],
  ['vancouver','밴쿠버','Vancouver','CA','YVR','밴쿠버',600,49.2827,-123.1207],
  ['toronto','토론토','Toronto','CA','YYZ','토론토',780,43.6532,-79.3832],
  ['cancun','칸쿤','Cancun','MX','CUN','칸쿤',1080,21.1619,-86.8515,1],
  ['sydney','시드니','Sydney','AU','SYD','시드니',600,-33.8688,151.2093],
  ['melbourne','멜버른','Melbourne','AU','MEL','멜버른',640,-37.8136,144.9631],
  ['brisbane','브리즈번','Brisbane','AU','BNE','브리즈번',580,-27.4698,153.0251],
  ['auckland','오클랜드','Auckland','NZ','AKL','오클랜드',690,-36.8485,174.7633],
  ['queenstown','퀸스타운','Queenstown','NZ','ZQN','퀸스타운',840,-45.0312,168.6626],
  ['london','런던','London','GB','LHR','런던 · 히드로',860,51.5074,-0.1278],
  ['paris','파리','Paris','FR','CDG','파리 · 샤를 드골',830,48.8566,2.3522],
  ['nice','니스','Nice','FR','NCE','니스',900,43.7102,7.2620],
  ['rome','로마','Rome','IT','FCO','로마 · 피우미치노',790,41.9028,12.4964],
  ['milan','밀라노','Milan','IT','MXP','밀라노 · 말펜사',770,45.4642,9.1900],
  ['venice','베네치아','Venice','IT','VCE','베네치아',800,45.4408,12.3155],
  ['florence','피렌체','Florence','IT','FLR','피렌체',820,43.7696,11.2558],
  ['barcelona','바르셀로나','Barcelona','ES','BCN','바르셀로나',850,41.3874,2.1686],
  ['madrid','마드리드','Madrid','ES','MAD','마드리드',870,40.4168,-3.7038],
  ['frankfurt','프랑크푸르트','Frankfurt','DE','FRA','프랑크푸르트',780,50.1109,8.6821],
  ['munich','뮌헨','Munich','DE','MUC','뮌헨',760,48.1351,11.5820],
  ['berlin','베를린','Berlin','DE','BER','베를린',800,52.5200,13.4050],
  ['zurich','취리히','Zurich','CH','ZRH','취리히',800,47.3769,8.5417],
  ['interlaken','인터라켄','Interlaken','CH','ZRH','취리히',800,46.6863,7.8632],
  ['vienna','빈','Vienna','AT','VIE','빈',770,48.2082,16.3738],
  ['prague','프라하','Prague','CZ','PRG','프라하',790,50.0755,14.4378],
  ['budapest','부다페스트','Budapest','HU','BUD','부다페스트',800,47.4979,19.0402],
  ['amsterdam','암스테르담','Amsterdam','NL','AMS','암스테르담 · 스히폴',800,52.3676,4.9041],
  ['lisbon','리스본','Lisbon','PT','LIS','리스본',900,38.7223,-9.1393],
  ['porto','포르투','Porto','PT','OPO','포르투',920,41.1579,-8.6291],
  ['athens','아테네','Athens','GR','ATH','아테네',880,37.9838,23.7275],
  ['santorini','산토리니','Santorini','GR','JTR','산토리니',960,36.3932,25.4615],
  ['dubrovnik','두브로브니크','Dubrovnik','HR','DBV','두브로브니크',900,42.6507,18.0944],
  ['cairo','카이로','Cairo','EG','CAI','카이로',780,30.0444,31.2357,1],
];

// 주요 도시는 추천 장소 · 영수증 예시까지 준비 — [이름, 유형, 지역, 위도, 경도]
const CITY_EXTRA: Partial<Record<DestKey, { cashTip?: string; places: PlaceRow[]; receipts: ReceiptRow[] }>> = {
  tokyo:{cashTip:'츠키지 시장은 현금 위주',
    places:[['나리타 공항','move','나리타',35.7720,140.3929],['신주쿠 호텔','stay','신주쿠',35.6938,139.7034],['센소지','sight','아사쿠사',35.7148,139.7967],['도쿄 스카이트리','sight','오시아게',35.7101,139.8107],['츠키시마 몬자 거리','food','츠키시마',35.6628,139.7810],['메이지 신궁','sight','하라주쿠',35.6764,139.6993],['다케시타 거리','shop','하라주쿠',35.6717,139.7036],['긴자 식스','shop','긴자',35.6696,139.7640],['시부야 스카이','sight','시부야',35.6585,139.7024],['츠키지 장외시장','food','츠키지',35.6654,139.7707],['팀랩 플래닛','sight','도요스',35.6492,139.7898],['오다이바 해변공원','sight','오다이바',35.6294,139.7766],['우에노 아메요코 시장','shop','우에노',35.7100,139.7745],['이치란 라멘 시부야','food','시부야',35.6614,139.7010],['블루보틀 기요스미','food','기요스미',35.6810,139.7978],['하네다 공항','move','하네다',35.5494,139.7798]],
    receipts:[['세븐일레븐 신주쿠점','food',1280],['이치란 라멘 시부야','food',2360],['돈키호테 긴자점','shop',6480],['스시잔마이 츠키지','food',4200],['도쿄 메트로 72시간권','move',1500]]},
  osaka:{cashTip:'구로몬 시장은 현금 위주',
    places:[['간사이 공항','move','간사이',34.4320,135.2304],['난바 호텔','stay','난바',34.6659,135.5013],['도톤보리','food','난바',34.6687,135.5013],['오사카성','sight','모리노미야',34.6873,135.5262],['유니버설 스튜디오 재팬','sight','베이 에어리어',34.6654,135.4323],['구로몬 시장','food','닛폰바시',34.6655,135.5065],['우메다 스카이빌딩','sight','우메다',34.7053,135.4906],['신세카이','food','신세카이',34.6525,135.5063]],
    receipts:[['쿠쿠루 타코야키','food',800],['돈키호테 도톤보리점','shop',5240],['이치란 라멘 도톤보리','food',1180]]},
  fukuoka:{cashTip:'포장마차는 현금 위주',
    places:[['후쿠오카 공항','move','하카타',33.5859,130.4507],['하카타 호텔','stay','하카타',33.5902,130.4207],['캐널시티 하카타','shop','하카타',33.5897,130.4110],['나카스 포장마차','food','나카스',33.5930,130.4045],['오호리 공원','sight','오호리',33.5862,130.3765],['다자이후 텐만구','sight','다자이후',33.5215,130.5349]],
    receipts:[['하카타 잇푸도','food',1190],['캐널시티 무인양품','shop',3980]]},
  bangkok:{cashTip:'야시장은 현금 위주',
    places:[['수완나품 공항','move','수완나품',13.6900,100.7501],['수쿰빗 호텔','stay','수쿰빗',13.7380,100.5600],['왓 아룬','sight','톤부리',13.7437,100.4888],['왓 포','sight','라따나꼬신',13.7465,100.4927],['짜뚜짝 주말시장','shop','짜뚜짝',13.7999,100.5503],['아이콘시암','shop','짜런나콘',13.7266,100.5106],['쩟페어 야시장','food','라마 9',13.7570,100.5660]],
    receipts:[['쩟페어 야시장','food',380],['아이콘시암 푸드코트','food',260],['빅씨 마트','shop',920]]},
  danang:{cashTip:'한시장은 현금 위주',
    places:[['다낭 공항','move','하이쩌우',16.0439,108.1994],['미케 비치 호텔','stay','미케',16.0600,108.2470],['한시장','shop','하이쩌우',16.0686,108.2241],['용다리','sight','하이쩌우',16.0611,108.2272],['바나힐','sight','호아방',15.9977,107.9880],['호이안 올드타운','sight','호이안',15.8770,108.3260],['미케 비치','sight','미케',16.0544,108.2470]],
    receipts:[['콩카페 한강점','food',85000],['한시장','shop',320000],['반미 프엉','food',35000]]},
  paris:{
    places:[['샤를 드골 공항','move','루아시',49.0097,2.5479],['마레 호텔','stay','마레',48.8590,2.3620],['에펠탑','sight','7구',48.8584,2.2945],['루브르 박물관','sight','1구',48.8606,2.3376],['몽마르트르','sight','18구',48.8867,2.3431],['오르세 미술관','sight','7구',48.8600,2.3266],['르 마레 브런치','food','마레',48.8575,2.3590]],
    receipts:[['Café de Flore','food',18.5],['Monoprix','shop',32.8],['Pierre Hermé','food',14.2]]},
};

export const DEST: Record<DestKey, Destination> = {};
for (const [key, city, en, cc, code, airport, flight, lat, lng, hot] of CITIES){
  const [country, countryEn, cur, adapter, visa] = COUNTRIES[cc];
  const [curName, sym, rate, unit, dec] = CURRENCIES[cur];
  const dom = cc === 'KR';
  DEST[key] = {key, city, en, cc, country, countryEn, code, airport, flight, lat, lng, hot:!!hot, dom,
    cur, sym, curName, rate, unit, dec, adapter, visa, cashTip:'소액 현금 준비',
    from:dom ? 'GMP' : 'ICN', fromName:dom ? '서울 · 김포' : '서울 · 인천', places:[], receipts:null, ...(CITY_EXTRA[key] || {})};
}
export const DEST_KEYS: DestKey[] = Object.keys(DEST);
export const POPULAR: DestKey[] = ['tokyo','osaka','fukuoka','danang','bangkok','taipei','hongkong','cebu','singapore','paris','hawaii','jeju'];
export const POPULAR_DOM: DestKey[] = ['jeju','busan','gangneung','yeosu','gyeongju','sokcho','jeonju','tongyeong','seogwipo','daegu','gwangju','pohang','ulsan'];

/** 국내 · 해외 */
export type DestScope = 'dom' | 'intl';
export const inScope = (d: Destination, scope?: DestScope) => !scope || (scope === 'dom') === d.dom;
export const popularOf = (scope: DestScope) => (scope === 'dom' ? POPULAR_DOM : POPULAR).map(k => DEST[k]).filter(d => inScope(d, scope));

// 검색: 도시 · 나라 · 영문 · 공항 코드 (초성/공백 무시) — scope를 주면 국내/해외 안에서만 찾아요
export function searchDest(q: string, scope?: DestScope): Destination[] {
  const n = (s: string) => s.toLowerCase().replace(/\s|·/g, '');
  q = n(q); if (!q) return [];
  const score = (d: Destination) => {
    if (n(d.city) === q || n(d.code) === q) return 0;
    if (n(d.city).startsWith(q) || n(d.en).startsWith(q)) return 1;
    if (n(d.country) === q || n(d.countryEn) === q) return 2;
    if (n(d.country).startsWith(q) || n(d.countryEn).startsWith(q)) return 3;
    if ((n(d.city) + n(d.en) + n(d.country) + n(d.countryEn) + n(d.airport)).includes(q)) return 4;
    return -1;
  };
  return DEST_KEYS.filter(k => inScope(DEST[k], scope)).map(k => [DEST[k], score(DEST[k])] as const).filter(x => x[1] >= 0).sort((a, b) => a[1] - b[1]).map(x => x[0]);
}
