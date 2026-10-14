/** 차트 x축 시간 눈금 · 표기 */

const pad = (n: number) => String(n).padStart(2, '0');

/** 14:05:09 */
export const formatClock = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** 1분 30초 · 12초 */
export const formatSpan = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}분${s % 60 ? ` ${s % 60}초` : ''}` : `${s}초`;
};

const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600].map(s => s * 1000);

/**
 * 구간 안의 '반듯한' 시각(10초 · 1분 단위 등)에만 눈금을 둬요.
 * 눈금이 데이터와 함께 흘러가서, 실시간으로 밀려도 라벨이 매 초 바뀌며 깜빡이지 않아요.
 */
export function timeTicks(from: number, to: number, maxTicks = 7): number[] {
  const span = to - from;
  if (!(span > 0)) return [];
  const step = STEPS.find(s => span / s < maxTicks) ?? STEPS[STEPS.length - 1];
  const ticks: number[] = [];
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) ticks.push(t);
  return ticks;
}
