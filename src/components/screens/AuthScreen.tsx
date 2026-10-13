'use client';
/* 1. 로그인 / 회원가입 */
import { useState, type FormEvent } from 'react';
import { cx } from '@/lib/utils';
import { useDemoLogin, useLogin, useOAuthLogin, useSignup } from '@/queries/auth';
import { CheckBox, Icon, Logo } from '@/components/ui/Icon';

type Mode = 'login' | 'signup';
const EMAIL_RE = /^\S+@\S+\.\S+$/;
/** Supabase에서 Google 공급자를 켠 뒤 true로 */
const GOOGLE = process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_AUTH === 'true';

export function AuthScreen() {
  const login = useLogin(), signupM = useSignup(), demoLogin = useDemoLogin(), oauth = useOAuthLogin();
  const busy = login.isPending || signupM.isPending || demoLogin.isPending || oauth.isPending;
  const [mode, setMode] = useState<Mode>('login');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const signup = mode === 'signup';

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr(''); setNotice('');
    const f = new FormData(e.currentTarget), get = (k: string) => String(f.get(k) ?? '');
    const email = get('email').trim().toLowerCase(), pw = get('pw');
    if (signup) {
      const name = get('name').trim();
      if (!name) return setErr('이름을 입력해 주세요.');
      if (!EMAIL_RE.test(email)) return setErr('이메일 형식을 확인해 주세요.');
      if (pw.length < 6) return setErr('비밀번호는 6자 이상이어야 해요.');
      if (pw !== get('pw2')) return setErr('비밀번호가 서로 달라요.');
      signupM.mutate({ name, email, pw }, {
        onSuccess: r => { if ('confirm' in r) { setMode('login'); setNotice(`${email}로 인증 메일을 보냈어요. 링크를 누른 뒤 로그인해 주세요.`); } },
        onError: e => setErr(e.message),
      });
    } else {
      if (!EMAIL_RE.test(email)) return setErr('이메일 형식을 확인해 주세요.');
      login.mutate({ email, pw, remember }, { onError: e => setErr(e.message) });
    }
  };

  const demo = () => { setErr(''); demoLogin.mutate(undefined, { onError: e => setErr(e.message) }); };
  const google = () => { setErr(''); oauth.mutate('google', { onError: e => setErr(e.message) }); };

  const switchMode = (m: Mode) => { setMode(m); setShowPw(false); setErr(''); setNotice(''); };

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
          {notice && <p className="muted" role="status" style={{ fontSize: 13 }}>{notice}</p>}
          <p className="err" role="alert">{err}</p>
          <button className="btn primary" type="submit" disabled={busy}>{signup ? '가입하고 여행 만들기' : '로그인'}</button>
        </form>
        <div className="or">또는</div>
        {GOOGLE && <button className="demo-btn" onClick={google} disabled={busy} style={{ marginBottom: 10 }}>
          <span className="di" style={{ background: '#fff' }}><GoogleMark /></span>
          <span className="grow"><b>Google로 계속하기</b><small>구글 계정으로 바로 시작해요</small></span>
          <Icon name="chev" size="sm" />
        </button>}
        <button className="demo-btn" onClick={demo} disabled={busy}>
          <span className="di"><Icon name="plane" size="sm" /></span>
          <span className="grow"><b>데모 여행으로 둘러보기</b><small>도쿄 3박 4일 샘플 데이터가 채워져 있어요</small></span>
          <Icon name="chev" size="sm" />
        </button>
      </div>
      <p className="fine">계정과 여행 데이터는 Supabase에 안전하게 저장돼 어느 기기에서든 이어서 볼 수 있어요</p>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l8-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.2-13.4-9.8l-8 6.2C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
