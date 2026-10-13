/* ---------- 파일 헬퍼 ---------- */
export function pickFile(accept: string, cb: (file: File) => void) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
  i.onchange = () => { if (i.files?.[0]) cb(i.files[0]); };
  i.click();
}

export const readFile = (file: File) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file);
});

/** 이미지를 max 픽셀 이내 JPEG로 줄여요 (이미지가 아니면 data URL 그대로) */
export async function shrink(file: File, max = 1000): Promise<string | null> {
  const url = await readFile(file).catch(() => null); if (!url || !file.type.startsWith('image/')) return url;
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .78));
    };
    img.onerror = () => res(url); img.src = url;
  });
}
