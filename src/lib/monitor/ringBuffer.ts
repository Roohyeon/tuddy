/**
 * 고정 크기 원형 버퍼
 * 실시간 지표는 끝없이 들어오지만 메모리는 capacity만큼만 써요.
 * 가득 차면 가장 오래된 값을 덮어써서 push가 항상 O(1)이에요 (Array.shift처럼 전체를 당기지 않아요).
 */
export class RingBuffer<T> {
  private readonly items: (T | undefined)[];
  private head = 0; // 다음에 쓸 자리
  private count = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity는 1 이상의 정수여야 해요');
    this.items = new Array(capacity);
  }

  get size() {
    return this.count;
  }

  push(item: T) {
    this.items[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** 가장 최근 값 (비어 있으면 undefined) */
  last(): T | undefined {
    return this.count ? this.items[(this.head - 1 + this.capacity) % this.capacity] : undefined;
  }

  /** 오래된 것 → 최근 것 순서의 새 배열 */
  toArray(): T[] {
    const out = new Array<T>(this.count);
    const start = (this.head - this.count + this.capacity) % this.capacity;
    for (let i = 0; i < this.count; i++) out[i] = this.items[(start + i) % this.capacity] as T;
    return out;
  }

  clear() {
    this.items.fill(undefined);
    this.head = 0;
    this.count = 0;
  }
}
