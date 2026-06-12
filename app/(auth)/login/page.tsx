'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('ops@goflipo.in')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // signIn with redirect:false — never trust result.error alone
    // because proxy redirects can make it look like an error
    await signIn('credentials', { email, password, redirect: false })

    // Instead: poll the session directly to confirm login succeeded
    // Wait a tick for cookie to be set
    await new Promise(r => setTimeout(r, 200))
    const session = await getSession()

    setLoading(false)

    if (session?.user) {
      // Login confirmed — hard navigate to bypass proxy token race
      window.location.href = '/dashboard'
    } else {
      setError('Invalid operator ID or passcode.')
    }
  }

  return (
    <div className="login-root">
      {/* ── TOP-LEFT BRAND ── */}
      <header className="brand">
        <div className="brand-icon">G</div>
        <span className="brand-name">
          GoFlipo<span className="brand-slash">/</span>Support
        </span>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content">
        {/* LEFT: Hero */}
        <section className="hero">
          <p className="hero-eyebrow">INTERNAL OPERATIONS CONSOLE</p>
          <h1 className="hero-headline">
            See every{' '}
            <span className="accent-teal">message</span>
            <span className="dot-sep"> · </span>
            every{' '}
            <span className="accent-orange">DLR</span>
            <br />
            before{' '}
            <span className="accent-red">they ask.</span>
          </h1>
          <p className="hero-sub">
            Real-time delivery, scrubbing &amp; latency telemetry across the
            GoFlipo SMS chain — Principle Entities, Telemarketers,
            OAP/TAP, and operators.
          </p>
        </section>

        {/* RIGHT: Login Card */}
        <section className="card-wrap">
          <div className="login-card">
            <p className="card-eyebrow">SIGN IN</p>
            <h2 className="card-title">Welcome back, ops.</h2>
            <p className="card-subtitle">Sign in with your operator credentials.</p>

            {error && (
              <div className="error-box" role="alert">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="field">
                <label htmlFor="email" className="field-label">OPERATOR ID</label>
                <input
                  id="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input" placeholder="ops@goflipo.in"
                  autoComplete="username" required
                />
              </div>
              <div className="field">
                <label htmlFor="password" className="field-label">PASSCODE</label>
                <input
                  id="password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input" placeholder="••••••••"
                  autoComplete="current-password" required
                />
              </div>
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? 'AUTHENTICATING...' : 'ENTER CONSOLE →'}
              </button>
            </form>

            <div className="card-footer">
              <span className="footer-left">SSO · SAML</span>
              <span className="footer-right">SESSION · 8H</span>
            </div>
          </div>
          <p className="authorized-text">AUTHORIZED PERSONNEL ONLY</p>
        </section>
      </main>

      <footer className="status-bar">
        <span className="status-dot" aria-hidden="true" />
        <span className="status-text">CLICKHOUSE · LIVE&nbsp;&nbsp;&nbsp;V 0.3 · PROTOTYPE</span>
      </footer>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .login-root {
          min-height: 100vh; display: flex; flex-direction: column;
          background:
            radial-gradient(ellipse 55% 45% at 100% 0%,   rgba(160,220,210,0.28) 0%, transparent 65%),
            radial-gradient(ellipse 50% 50% at 0%   100%, rgba(200,180,230,0.22) 0%, transparent 60%),
            #f5f4f0;
          font-family: 'DM Sans', 'Inter', system-ui, sans-serif;
          position: relative; overflow: hidden;
        }
        .brand { display: flex; align-items: center; gap: 10px; padding: 20px 36px; }
        .brand-icon {
          width: 34px; height: 34px; background: #e8f5f3; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 700; color: #1a9e8c;
          border: 1px solid rgba(26,158,140,0.2);
        }
        .brand-name { font-size: 15px; font-weight: 500; color: #1a1a1a; letter-spacing: -0.01em; }
        .brand-slash { color: #9ca3af; }
        .main-content {
          flex: 1; display: flex; align-items: center;
          padding: 20px 36px 40px; gap: 40px;
          max-width: 1280px; width: 100%; margin: 0 auto;
        }
        .hero { flex: 1; max-width: 540px; }
        .hero-eyebrow { font-size: 11px; font-weight: 500; letter-spacing: 0.14em; color: #5b9e98; margin-bottom: 20px; }
        .hero-headline { font-size: clamp(36px, 4vw, 52px); font-weight: 700; line-height: 1.15; color: #111; margin-bottom: 24px; letter-spacing: -0.02em; }
        .accent-teal   { color: #1a9e8c; }
        .dot-sep       { color: #111; font-weight: 700; }
        .accent-orange { color: #e07b18; }
        .accent-red    { color: #d94f3d; }
        .hero-sub { font-size: 14px; line-height: 1.7; color: #6b7280; max-width: 420px; }
        .card-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; flex-shrink: 0; }
        .login-card {
          background: #ffffff; border: 1px solid rgba(0,0,0,0.09);
          border-radius: 18px; padding: 36px 40px 28px; width: 380px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04);
        }
        .card-eyebrow { font-size: 10.5px; font-weight: 600; letter-spacing: 0.12em; color: #1a9e8c; margin-bottom: 8px; }
        .card-title { font-size: 22px; font-weight: 600; color: #111; margin-bottom: 4px; letter-spacing: -0.02em; }
        .card-subtitle { font-size: 13px; color: #9ca3af; margin-bottom: 24px; }
        .error-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #dc2626; margin-bottom: 16px; }
        .login-form { display: flex; flex-direction: column; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; color: #6b7280; }
        .field-input {
          height: 42px; border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 0 14px; font-size: 14px; color: #111; background: #fafafa;
          outline: none; transition: border-color 0.15s, box-shadow 0.15s; font-family: inherit;
        }
        .field-input::placeholder { color: #d1d5db; }
        .field-input:focus { border-color: #1a9e8c; box-shadow: 0 0 0 3px rgba(26,158,140,0.12); background: #fff; }
        .submit-btn {
          margin-top: 4px; height: 44px; background: #1a9e8c; color: #fff;
          border: none; border-radius: 8px; font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; cursor: pointer;
          transition: background 0.15s, transform 0.1s; font-family: inherit;
        }
        .submit-btn:hover:not(:disabled) { background: #158a7a; }
        .submit-btn:active:not(:disabled) { transform: scale(0.99); }
        .submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .card-footer {
          display: flex; justify-content: space-between; margin-top: 20px;
          padding-top: 16px; border-top: 1px solid #f3f4f6;
          font-size: 11px; color: #9ca3af; letter-spacing: 0.05em;
        }
        .authorized-text { font-size: 10px; letter-spacing: 0.14em; color: #bbb; }
        .status-bar { padding: 14px 36px; display: flex; align-items: center; gap: 8px; }
        .status-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #1a9e8c;
          display: inline-block; animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        .status-text { font-size: 10.5px; letter-spacing: 0.1em; color: #9ca3af; }
        @media (max-width: 768px) {
          .main-content { flex-direction: column; align-items: center; padding: 20px 20px 40px; }
          .hero { text-align: center; max-width: 100%; }
          .login-card { width: 100%; max-width: 380px; }
        }
      `}</style>
    </div>
  )
}
