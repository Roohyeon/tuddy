'use client';
/**
 * 어드민 접근 게이트 — 로그인 → 관리자(app_metadata.role = 'admin') 확인
 * 화면 숨김은 편의일 뿐이고, 실제 보호는 DB RLS예요 (관리자가 아니면 쓰기 요청이 거부돼요).
 * role은 사용자가 바꿀 수 없는 app_metadata에 있어서 클라이언트가 조작해도 권한이 생기지 않아요.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { useSessionStore } from '@/stores/session';
import s from './admin.module.css';

export function useAdminSession() {
  const user = useSessionStore(st => st.user), hydrated = useSessionStore(st => st.hydrated), listen = useSessionStore(st => st.listen);
  useEffect(() => listen(), [listen]);
  return { user, hydrated, isAdmin: user?.app_metadata?.role === 'admin' };
}

const logout = () => supabase().auth.signOut();

export function AdminGate({ children }: { children: (email: string) => ReactNode }) {
  const { user, hydrated, isAdmin } = useAdminSession();
  if (!isSupabaseConfigured) return <Notice title="Supabase 연결이 필요해요">.env.local에 Supabase 주소와 공개 키를 넣어 주세요.</Notice>;
  if (!hydrated) return <div className={s.gateSkeleton} aria-busy="true" />;
  if (!user || user.is_anonymous) return <AdminLogin />;
  if (!isAdmin) {
    return (
      <Notice title="관리자 권한이 없어요">
        <p><b>{user.email}</b> 계정은 관리자가 아니에요. 관리자 지정 뒤에는 다시 로그인해야 권한이 반영돼요.</p>
        <button type="button" className={s.btnGhost} onClick={logout}>다른 계정으로 로그인</button>
      </Notice>
    );
  }
  return children(user.email ?? '');
}

export function AdminSignOut() {
  return <button type="button" className={s.btnGhost} onClick={logout}>로그아웃</button>;
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.gate}>
      <p className={s.kicker}>TUDDY ADMIN</p>
      <h1 className={s.gateTitle}>{title}</h1>
      <div className={s.gateBody}>{children}</div>
    </section>
  );
}

/* 로그인 폼도 react-hook-form + zod — 같은 패턴을 작게 */
const loginSchema = z.object({
  email: z.string().trim().min(1, { error: '이메일을 입력해 주세요', abort: true }).pipe(z.email('이메일 형식이 아니에요')),
  password: z.string().min(1, '비밀번호를 입력해 주세요'),
});
type LoginValues = z.infer<typeof loginSchema>;

function AdminLogin() {
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });
  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError('');
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    // 성공하면 세션 리스너가 user를 채워 게이트가 다음 화면으로 넘어가요
    if (error) setServerError(/invalid login credentials/i.test(error.message) ? '이메일 또는 비밀번호가 맞지 않아요.' : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.');
  });
  return (
    <Notice title="관리자 로그인">
      <form className={s.loginForm} onSubmit={onSubmit} noValidate>
        <label className={s.field}>
          <span className={s.label}>이메일</span>
          <input className={s.input} type="email" autoComplete="username" aria-invalid={!!errors.email} {...register('email')} />
          {errors.email && <span className={s.error} role="alert">{errors.email.message}</span>}
        </label>
        <label className={s.field}>
          <span className={s.label}>비밀번호</span>
          <input className={s.input} type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
          {errors.password && <span className={s.error} role="alert">{errors.password.message}</span>}
        </label>
        {serverError && <p className={s.formError} role="alert">{serverError}</p>}
        <button type="submit" className={s.btnPrimary} disabled={isSubmitting}>{isSubmitting ? '확인 중…' : '로그인'}</button>
      </form>
    </Notice>
  );
}
