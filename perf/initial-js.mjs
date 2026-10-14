/* 라우트별 초기 JS — 빌드된 HTML의 <script src>만 합쳐요 (지연 로딩 청크는 빠져요). gzip 크기 기준
   사용: npm run build 후 node perf/initial-js.mjs [라벨] → perf/results/initial-js-<라벨>.json */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const ROUTES = { '/login': 'login', '/home': 'home', '/schedule': 'schedule', '/budget': 'budget', '/packing': 'packing', '/vault': 'vault', '/pass': 'pass', '/monitor': 'monitor', '/book/tokyo-4days': 'book/tokyo-4days' };
const label = process.argv[2] || 'now';

const out = {};
for (const [route, file] of Object.entries(ROUTES)) {
  const html = `.next/server/app/${file}.html`;
  if (!existsSync(html)) continue;
  const srcs = [...new Set([...readFileSync(html, 'utf8').matchAll(/<script[^>]+src="\/_next\/([^"]+\.js)"/g)].map(m => m[1]))];
  const kb = srcs.reduce((s, src) => s + gzipSync(readFileSync(`.next/${src}`)).length, 0) / 1024;
  out[route] = { files: srcs.length, gzipKB: Math.round(kb * 10) / 10 };
}
mkdirSync('perf/results', { recursive: true });
writeFileSync(`perf/results/initial-js-${label}.json`, JSON.stringify(out, null, 2));
console.table(out);
