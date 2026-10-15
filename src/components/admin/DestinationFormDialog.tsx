'use client';
/**
 * 여행지 등록 · 수정 모달 — react-hook-form + zod
 *
 * - zodResolver: 검증 규칙은 스키마 한곳에. 폼 값(문자열) → 저장 값(숫자 · null)으로 변환까지 해 줘요
 *   useForm<입력 타입, 컨텍스트, 출력 타입> 세 번째 제네릭 덕분에 onSubmit은 변환된 값을 받아요
 * - mode 'onTouched': 처음엔 칸을 떠날 때 검사하고, 그 뒤로는 입력할 때마다 다시 검사해요
 *   (아직 다 치지도 않았는데 빨간 글씨가 뜨지 않으면서, 고치는 순간 에러가 사라져요)
 * - 저장을 누르면 서버 응답을 기다리지 않고 바로 닫아요 → 목록은 낙관적 업데이트로 이미 바뀌어 있어요
 * - <dialog>.showModal(): 포커스 가두기 · ESC 닫기 · 배경 비활성화를 브라우저가 해 줘요
 */
import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { useForm, useWatch, type Control, type FieldError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  COUNTRY_CODES, EMPTY_FORM, countryName, destinationSchema, makeDestinationSchema, toFormValues,
  type DestinationFormValues, type DestinationInput,
} from '@/lib/admin/destinationSchema';
import type { DestinationRow } from '@/lib/supabase/database.types';
import s from './admin.module.css';

type Props = {
  /** 없으면 등록, 있으면 그 여행지 수정 */
  target: DestinationRow | null;
  /** 등록할 때 중복 검사용 */
  takenKeys: ReadonlySet<string>;
  onSubmit: (values: DestinationInput) => void;
  onClose: () => void;
};

export function DestinationFormDialog({ target, takenKeys, onSubmit, onClose }: Props) {
  const editing = !!target;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);

  const schema = useMemo(() => (editing ? destinationSchema : makeDestinationSchema(takenKeys)), [editing, takenKeys]);
  const { register, handleSubmit, control, formState: { errors } } = useForm<DestinationFormValues, unknown, DestinationInput>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: target ? toFormValues(target) : EMPTY_FORM,
  });

  const submit = handleSubmit(values => { onSubmit(values); onClose(); });
  const titleId = useId();

  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      aria-labelledby={titleId}
      onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}   // 바깥(배경) 클릭
    >
      <form className={s.form} onSubmit={submit} noValidate>
        <header className={s.dialogHead}>
          <div>
            <p className={s.kicker}>{editing ? 'EDIT DESTINATION' : 'NEW DESTINATION'}</p>
            <h2 id={titleId} className={s.dialogTitle}>{editing ? `${target.city} 수정` : '새 여행지 등록'}</h2>
          </div>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="닫기">✕</button>
        </header>

        <div className={s.formBody}>
          <Preview control={control} />

          <fieldset className={s.group}>
            <legend>기본 정보</legend>
            <Field label="키 (주소에 쓰는 ID)" error={errors.key} hint={editing ? '키는 바꿀 수 없어요' : '예: kyoto'}>
              {p => <input {...p} className={`${s.input} ${s.mono}`} readOnly={editing} autoComplete="off" spellCheck={false} {...register('key')} />}
            </Field>
            <Field label="나라" error={errors.countryCode}>
              {p => (
                <select {...p} className={s.input} {...register('countryCode')}>
                  {COUNTRY_CODES.map(cc => <option key={cc} value={cc}>{countryName(cc)} ({cc})</option>)}
                </select>
              )}
            </Field>
            <Field label="도시 이름" error={errors.city}>
              {p => <input {...p} className={s.input} autoComplete="off" {...register('city')} />}
            </Field>
            <Field label="영문 이름" error={errors.cityEn}>
              {p => <input {...p} className={s.input} autoComplete="off" spellCheck={false} {...register('cityEn')} />}
            </Field>
          </fieldset>

          <fieldset className={s.group}>
            <legend>공항 · 위치</legend>
            <Field label="공항 코드" error={errors.airportCode} hint="IATA 3글자">
              {p => <input {...p} className={`${s.input} ${s.mono} ${s.upper}`} maxLength={3} autoComplete="off" spellCheck={false} {...register('airportCode')} />}
            </Field>
            <Field label="공항 표시 이름" error={errors.airportName} hint="예: 오사카 · 간사이">
              {p => <input {...p} className={s.input} autoComplete="off" {...register('airportName')} />}
            </Field>
            <Field label="비행 시간 (분)" error={errors.flightMin} hint="인천 · 김포 출발 기준">
              {p => <input {...p} className={s.input} inputMode="numeric" autoComplete="off" {...register('flightMin')} />}
            </Field>
            <div className={s.pair}>
              <Field label="위도" error={errors.lat}>
                {p => <input {...p} className={s.input} inputMode="decimal" autoComplete="off" {...register('lat')} />}
              </Field>
              <Field label="경도" error={errors.lng}>
                {p => <input {...p} className={s.input} inputMode="decimal" autoComplete="off" {...register('lng')} />}
              </Field>
            </div>
            <label className={s.check}>
              <input type="checkbox" {...register('hot')} /> 더운 여행지 (준비물에 얇은 옷 · 수영복 추천)
            </label>
          </fieldset>

          <fieldset className={s.group}>
            <legend>소개</legend>
            <Field label="설명 (선택)" error={errors.description} hint={<DescriptionCount control={control} />} wide>
              {p => <textarea {...p} className={`${s.input} ${s.textarea}`} rows={3} {...register('description')} />}
            </Field>
            <Field label="대표 이미지 주소 (선택)" error={errors.imageUrl} hint="https:// 로 시작하는 주소" wide>
              {p => <input {...p} className={s.input} inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://" {...register('imageUrl')} />}
            </Field>
            <Field label="평점 (선택)" error={errors.rating} hint="0~5, 0.5 단위">
              {p => <input {...p} className={s.input} inputMode="decimal" autoComplete="off" placeholder="4.5" {...register('rating')} />}
            </Field>
          </fieldset>
        </div>

        <footer className={s.dialogFoot}>
          {Object.keys(errors).length > 0 && <p className={s.formError} role="alert">빨간 칸 {Object.keys(errors).length}곳을 확인해 주세요</p>}
          <button type="button" className={s.btnGhost} onClick={onClose}>취소</button>
          <button type="submit" className={s.btnPrimary}>{editing ? '수정 저장' : '등록'}</button>
        </footer>
      </form>
    </dialog>
  );
}

/** 라벨 · 입력 · 에러를 묶고, 입력에 접근성 속성(id · aria-invalid · aria-describedby)을 넘겨요 */
function Field({ label, error, hint, wide, children }: {
  label: string;
  error?: FieldError;
  hint?: ReactNode;
  wide?: boolean;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string }) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={`${s.field} ${wide ? s.wide : ''}`}>
      <label className={s.label} htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': `${id}-msg` })}
      <span id={`${id}-msg`} className={error ? s.error : s.hint} role={error ? 'alert' : undefined}>{error?.message ?? hint}</span>
    </div>
  );
}

function DescriptionCount({ control }: { control: Control<DestinationFormValues, unknown, DestinationInput> }) {
  const v = useWatch({ control, name: 'description' }) ?? '';
  return <span className={v.trim().length > 300 ? s.over : undefined}>{v.trim().length} / 300</span>;
}

/** 입력하는 대로 카드 미리보기 — 이미지 주소가 https일 때만 불러와요 */
function Preview({ control }: { control: Control<DestinationFormValues, unknown, DestinationInput> }) {
  const [city, cityEn, cc, imageUrl, rating, airportCode] = useWatch({ control, name: ['city', 'cityEn', 'countryCode', 'imageUrl', 'rating', 'airportCode'] });
  const img = /^https:\/\/\S+$/.test(imageUrl ?? '') ? imageUrl : '';
  const score = Number(rating);
  return (
    <div className={s.preview} aria-label="미리보기">
      <div className={s.previewImg}>{img ? <img src={img} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span>{city?.trim()?.[0] ?? '?'}</span>}</div>
      <div>
        <b>{city?.trim() || '도시 이름'}</b> <small>{cityEn?.trim()}</small>
        <p>{countryName(cc)} · {airportCode?.toUpperCase() || '---'}{rating && score >= 0 && score <= 5 ? ` · ★ ${score}` : ''}</p>
      </div>
    </div>
  );
}
