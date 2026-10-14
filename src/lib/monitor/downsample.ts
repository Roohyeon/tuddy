/**
 * 차트 렌더링용 데이터 줄이기
 * - sliceByTime: 시간순 정렬된 배열에서 보이는 구간만 이진 탐색으로 잘라요
 * - downsample: LTTB(Largest-Triangle-Three-Buckets)로 모양(봉우리 · 골짜기)은 지키면서 점 개수를 줄여요
 *   값이 null인 점은 '끊김'(일시정지 구간) 표시라서 지우지 않고, 그 사이 구간별로 따로 줄여요
 */

type Timed = { timestamp: number };

/** arr[i].timestamp >= t (inclusive) 또는 > t 인 첫 인덱스 */
const bound = (arr: readonly Timed[], t: number, inclusive: boolean) => {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (inclusive ? arr[mid].timestamp < t : arr[mid].timestamp <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/** [from, to] 구간 + 양 끝 바깥 한 점씩 (선이 축 끝까지 이어지도록) */
export function sliceByTime<T extends Timed>(points: readonly T[], from: number, to: number): T[] {
  if (!points.length) return [];
  const start = Math.max(0, bound(points, from, true) - 1);
  const end = Math.min(points.length, bound(points, to, false) + 1);
  return points.slice(start, end);
}

/** 연속 구간 하나를 LTTB로 threshold개까지 줄여요 */
function lttb<T>(run: readonly T[], threshold: number, x: (p: T) => number, y: (p: T) => number): T[] {
  if (run.length <= threshold) return [...run];
  if (threshold < 3) return [run[0], run[run.length - 1]];
  const out: T[] = [run[0]];
  const every = (run.length - 2) / (threshold - 2);
  let a = 0; // 직전에 고른 점

  for (let i = 0; i < threshold - 2; i++) {
    // 다음 버킷의 평균점
    const nextStart = Math.floor((i + 1) * every) + 1;
    const nextEnd = Math.min(Math.floor((i + 2) * every) + 1, run.length);
    let avgX = 0;
    let avgY = 0;
    for (let j = nextStart; j < nextEnd; j++) {
      avgX += x(run[j]);
      avgY += y(run[j]);
    }
    const n = nextEnd - nextStart || 1;
    avgX /= n;
    avgY /= n;

    // 현재 버킷에서 (직전 점, 다음 버킷 평균)과 만드는 삼각형이 가장 큰 점
    const start = Math.floor(i * every) + 1;
    const end = Math.floor((i + 1) * every) + 1;
    const ax = x(run[a]);
    const ay = y(run[a]);
    let maxArea = -1;
    let pick = start;
    for (let j = start; j < end; j++) {
      const area = Math.abs((ax - avgX) * (y(run[j]) - ay) - (ax - x(run[j])) * (avgY - ay));
      if (area > maxArea) {
        maxArea = area;
        pick = j;
      }
    }
    out.push(run[pick]);
    a = pick;
  }
  out.push(run[run.length - 1]);
  return out;
}

export function downsample<T extends Timed>(points: readonly T[], maxPoints: number, value: (p: T) => number | null): T[] {
  if (points.length <= maxPoints) return points as T[];

  // null(끊김) 기준으로 연속 구간을 나눠요
  const runs: T[][] = [];
  const gaps: T[] = [];
  let cur: T[] = [];
  for (const p of points) {
    if (value(p) === null) {
      runs.push(cur);
      gaps.push(p);
      cur = [];
    } else cur.push(p);
  }
  runs.push(cur);

  const budget = Math.max(maxPoints - gaps.length, runs.length * 2);
  const valued = points.length - gaps.length;
  const out: T[] = [];
  runs.forEach((run, i) => {
    const share = Math.max(2, Math.round((run.length / valued) * budget));
    out.push(...lttb(run, share, p => p.timestamp, p => value(p) as number));
    if (i < gaps.length) out.push(gaps[i]);
  });
  return out;
}
