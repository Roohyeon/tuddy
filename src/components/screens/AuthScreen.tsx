'use client';
/* 1. 로그인 / 회원가입 */
import { useState, type FormEvent } from 'react';
import { cx } from '@/lib/utils';
import { useDemoLogin, useLogin, useSignup } from '@/queries/auth';
import { CheckBox, Icon, Logo } from '@/components/ui/Icon';

type Mode = 'login' | 'signup';
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function AuthScreen() {
  const login = useLogin(), signupM = useSignup(), demoLogin = useDemoLogin();
  const busy = login.isPending || signupM.isPending || demoLogin.isPending;
  const [mode, setMode] = useState<Mode>('login');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const signup = mode === 'signup';

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr('');
    const f = new FormData(e.currentTarget), get = (k: string) => String(f.get(k) ?? '');
    const email = get('email').trim().toLowerCase(), pw = get('pw');
    if (signup) {
      const name = get('name').trim();
      if (!name) return setErr('이름을 입력해 주세요.');
      if (!EMAIL_RE.test(email)) return setErr('이메일 형식을 확인해 주세요.');
      if (pw.length < 6) return setErr('비밀번호는 6자 이상이어야 해요.');
      if (pw !== get('pw2')) return setErr('비밀번호가 서로 달라요.');
      signupM.mutate({ name, email, pw }, { onError: e => setErr(e.message) });
    } else {
      if (!EMAIL_RE.test(email)) return setErr('이메일 형식을 확인해 주세요.');
      login.mutate({ email, pw, remember }, { onError: e => setErr(e.message) });
    }
  };

  const demo = () => demoLogin.mutate();

  const switchMode = (m: Mode) => { setMode(m); setShowPw(false); setErr(''); };

  const Pw = ({ name, ph, ac }: { name: string; ph: string; ac: string }) => (
    <div className="pw">
      <input className="input" name={name} type={showPw ? 'text' : 'password'} placeholder={ph} autoComplete={ac} required minLength={6} />
      <button type="button" onClick={() => setShowPw(v => !v)} aria-label="비밀번호 보기"><Icon name={showPw ? 'eyeOff' : 'eye'} size="sm" /></button>
    </div>
  );

  return (
    <main className="auth fade-in">
      <div className="brand"><Logo /><div className="word">Tuddy</div><p>여행 준비부터 기록까지, 나의 여행 버디</p></div>
      <div className="auth-card">
        <div className="auth-tabs" role="tablist">
          <button role="tab" className={cx(!signup && 'on')} onClick={() => switchMode('login')} aria-selected={!signup}>로그인</button>
          <button role="tab" className={cx(signup && 'on')} onClick={() => switchMode('signup')} aria-selected={signup}>회원가입</button>
        </div>
        <form className="form" onSubmit={onSubmit} noValidate key={mode}>
          {signup ? <>
            <label className="field"><span>이름</span><input className="input" name="name" placeholder="여행에서 불릴 이름 (예: 블리)" maxLength={12} autoComplete="nickname" required /></label>
            <label className="field"><span>이메일</span><input className="input" name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
            <label className="field"><span>비밀번호</span>{Pw({ name: 'pw', ph: '6자 이상', ac: 'new-password' })}</label>
            <label className="field"><span>비밀번호 확인</span>{Pw({ name: 'pw2', ph: '한 번 더 입력', ac: 'new-password' })}</label>
          </> : <>
            <label className="field"><span>이메일</span><input className="input" name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
            <label className="field"><span>비밀번호</span>{Pw({ name: 'pw', ph: '비밀번호', ac: 'current-password' })}</label>
            <label className="remember"><input type="checkbox" className="sr" checked={remember} onChange={e => setRemember(e.target.checked)} /><CheckBox on={remember} />로그인 상태 유지</label>
          </>}
          <p className="err" role="alert">{err}</p>
          <button className="btn primary" type="submit" disabled={busy}>{signup ? '가입하고 여행 만들기' : '로그인'}</button>
        </form>
        <div className="or">또는</div>
        <button className="demo-btn" onClick={demo} disabled={busy}>
          <span className="di"><Icon name="plane" size="sm" /></span>
          <span className="grow"><b>데모 여행으로 둘러보기</b><small>도쿄 3박 4일 샘플 데이터가 채워져 있어요</small></span>
          <Icon name="chev" size="sm" />
        </button>
      </div>
      <p className="fine">데모 버전 · 계정과 여행 데이터는 이 기기의 브라우저에만 저장돼요</p>
    </main>
  );
}
