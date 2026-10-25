import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import '../theme/tokens.css';
import './auth.css';
import { V2Button, V2Toast } from '../components/primitives';
import { api } from '../../lib/api';
import { UserAccount } from '../../lib/types';

/*
 * V2 Auth page. Keeps every V1 sign-in / sign-up behavior intact:
 *   - Supabase email+password (with graceful fallback to the mock /api/auth/*
 *     routes when Supabase isn't configured — same api.signIn / api.signUp
 *     surface V1 uses, no new auth paths)
 *   - Optional phone + country code on sign-up
 *   - Password strength meter
 *   - Trial-result banner (shown when a signed-out visitor finished a drill)
 *   - Demo credentials shortcut when Supabase isn't configured
 *
 * New in V2:
 *   - Two-column layout per the mockup (left hero + features, right card)
 *   - Topbar with brand, nav links, theme toggle, mode-switch CTA
 *   - Google / GitHub OAuth via api.signInWithOAuth (Supabase; the providers
 *     must be enabled in the Supabase dashboard — see the api comment)
 *
 * On success the user lands on /v2/ (the V2 dashboard).
 */

type Mode = 'signin' | 'signup';
type Theme = 'light' | 'dark';

// Social sign-in is wired (api.signInWithOAuth) but hidden until the Google and
// GitHub providers are enabled in Supabase. Flip to true to show the buttons.
const OAUTH_ENABLED = false;

const COUNTRY_CODES = [
  { code: '+1', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
  { code: '+44', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
  { code: '+91', flag: '\uD83C\uDDEE\uD83C\uDDF3' },
  { code: '+61', flag: '\uD83C\uDDE6\uD83C\uDDFA' },
  { code: '+49', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
  { code: '+33', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { code: '+81', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
  { code: '+65', flag: '\uD83C\uDDF8\uD83C\uDDEC' },
  { code: '+41', flag: '\uD83C\uDDE8\uD83C\uDDED' },
  { code: '+31', flag: '\uD83C\uDDF3\uD83C\uDDF1' },
];

type AuthPageProps = {
  initialMode?: Mode;
  trialResult?: { correct: boolean; concept: string } | null;
  onSuccess?: (user: UserAccount) => void;
};

export default function V2AuthPage({
  initialMode = 'signin',
  trialResult = null,
  onSuccess,
}: AuthPageProps) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [oauthBusy, setOauthBusy] = useState<'google' | 'github' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const formId = useId();
  const isSupabase = api.isSupabaseConfigured();
  const toastTimer = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  // ---------- validation ----------
  const emailTrimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const isEmailValid = emailRegex.test(emailTrimmed);

  const hasMinLength = password.length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumberOrSymbol =
    /\d/.test(password) || /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  let passwordStrengthScore = 0;
  if (hasMinLength) passwordStrengthScore++;
  if (hasMixedCase) passwordStrengthScore++;
  if (hasNumberOrSymbol) passwordStrengthScore++;
  if (password.length >= 12) passwordStrengthScore++;
  const isPasswordValid = hasMinLength;

  const rawPhoneDigits = phoneNumber.replace(/\D/g, '');
  const isPhoneValid =
    rawPhoneDigits.length === 0 || (rawPhoneDigits.length >= 10 && rawPhoneDigits.length <= 15);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '');
    if (countryCode === '+1' && digits.length <= 10) {
      if (digits.length === 0) setPhoneNumber('');
      else if (digits.length <= 3) setPhoneNumber(`(${digits}`);
      else if (digits.length <= 6)
        setPhoneNumber(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
      else
        setPhoneNumber(
          `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`,
        );
    } else {
      setPhoneNumber(raw);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setOauthBusy(provider);
    setGeneralError(null);
    const res = await api.signInWithOAuth(provider);
    // On success the browser is already navigating to the provider.
    if (!res.ok) {
      setOauthBusy(null);
      setGeneralError(res.message || 'Could not start social sign-in.');
    }
  };

  const handleSuccess = (user: UserAccount) => {
    if (onSuccess) {
      onSuccess(user);
      return;
    }
    // Default: back to where the user was headed (same-origin /v2/ paths only),
    // otherwise the V2 dashboard.
    const next = new URLSearchParams(window.location.search).get('next');
    const safe = next && /^\/v2\/(?!\/)/.test(next) && !next.startsWith('/v2/auth') ? next : '/v2/';
    window.location.href = safe;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!isEmailValid) {
      setGeneralError('Please enter a valid email address.');
      return;
    }
    if (!isPasswordValid) {
      setGeneralError('Password must contain at least 8 characters.');
      return;
    }
    if (!isPhoneValid) {
      setGeneralError('Please enter a valid 10-15 digit telephone number.');
      return;
    }
    setIsSubmitting(true);
    try {
      const fullPhone =
        rawPhoneDigits.length > 0 ? `${countryCode} ${phoneNumber.trim()}` : '';
      const result = await api.signUp(emailTrimmed, password, fullPhone, countryCode);
      handleSuccess(result.user);
    } catch (err: any) {
      setGeneralError(err?.message || 'Registration failed. Please check your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!email.trim()) {
      setGeneralError('Please enter your email address or phone number.');
      return;
    }
    if (!password) {
      setGeneralError('Please enter your password.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await api.signIn(email.trim(), password);
      handleSuccess(result.user);
    } catch (err: any) {
      setGeneralError(err?.message || 'Invalid credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoCredentials = () => {
    setMode('signin');
    setEmail('alex.dev@nabbit.io');
    setPassword('Password123!');
    setGeneralError(null);
  };

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  const switchMode = (next: Mode) => {
    setMode(next);
    setGeneralError(null);
  };

  const isSignUp = mode === 'signup';

  return (
    <div className="v2-root v2-auth-root" data-theme={theme}>
      <header className="v2-auth-topbar">
        <div className="v2-brand">
          <div className="v2-brand-mark">N</div>
          <div className="v2-brand-copy">
            <div className="v2-brand-name">Nabbit</div>
            <div className="v2-brand-tag">catch the nit</div>
          </div>
        </div>
        <nav className="v2-auth-nav" aria-label="Primary">
          <a href="/v2/">Video Library</a>
          <a href="/v2/challenge/react-state-batching">Bug Hunt Drill</a>
        </nav>
        <div className="v2-auth-topbar-spacer" />
        <button
          type="button"
          className="v2-theme-switch"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <span aria-hidden>☀</span>
          <span aria-hidden>☾</span>
        </button>
        <button
          type="button"
          className="v2-topbar-cta"
          onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
        >
          {isSignUp ? 'Sign in' : 'Create an account'}
        </button>
      </header>

      <main className="v2-auth-main">
        <section className="v2-auth-hero">
          <span className="v2-auth-eyebrow-pill">TURN YOUTUBE VIDEOS INTO PRACTICE</span>
          <h1>
            Learn from any YouTube video.
            <span className="accent">Actually remember it.</span>
          </h1>
          <p>
            Nabbit turns YouTube tutorials into hands-on drills, so you don't just watch — you
            learn, practise, and remember.
          </p>

          <ul className="v2-auth-features">
            <li className="v2-auth-feature">
              <div className="v2-auth-feature-ico" aria-hidden>▶</div>
              <div>
                <strong>Turn videos into drills</strong>
                <span>Get coding challenges, quizzes and debug exercises.</span>
              </div>
            </li>
            <li className="v2-auth-feature">
              <div className="v2-auth-feature-ico" aria-hidden>🧠</div>
              <div>
                <strong>Spaced recall</strong>
                <span>Revisit concepts at the right time to retain for the long term.</span>
              </div>
            </li>
            <li className="v2-auth-feature">
              <div className="v2-auth-feature-ico" aria-hidden>📊</div>
              <div>
                <strong>Track your progress</strong>
                <span>See what you've learned and what to practise next.</span>
              </div>
            </li>
          </ul>

          <span className="v2-auth-caption">From video to mastery</span>
        </section>

        <section className="v2-auth-card" aria-labelledby={`${formId}-title`}>
          <div className="v2-auth-card-head">
            <div>
              <h2 id={`${formId}-title`}>{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
              <p>
                {isSignUp
                  ? 'Save your progress and get spaced-recall reviews.'
                  : 'Sign in to continue your learning journey'}
              </p>
            </div>
            <div className="v2-auth-card-switch">
              {isSignUp ? 'Already a member?' : 'New to Nabbit?'}
              <br />
              <button type="button" onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}>
                {isSignUp ? 'Sign in →' : 'Create an account →'}
              </button>
            </div>
          </div>

          {trialResult && (
            <div className="v2-auth-trial" role="status">
              <strong>
                {trialResult.correct ? 'Nice catch! ✅' : 'Not quite — close one. 🔍'}
              </strong>{' '}
              You finished the "{trialResult.concept}" trial drill. Create a free account to see
              the full explanation, save your progress and get spaced-recall reviews.
            </div>
          )}

          {OAUTH_ENABLED && (
            <>
              <div className="v2-auth-oauth">
                <button
                  type="button"
                  className="v2-oauth-btn"
                  disabled={oauthBusy !== null}
                  onClick={() => handleOAuth('google')}
                >
                  <GoogleGlyph /> {oauthBusy === 'google' ? 'Redirecting…' : 'Continue with Google'}
                </button>
                <button
                  type="button"
                  className="v2-oauth-btn"
                  disabled={oauthBusy !== null}
                  onClick={() => handleOAuth('github')}
                >
                  <GitHubGlyph /> {oauthBusy === 'github' ? 'Redirecting…' : 'Continue with GitHub'}
                </button>
              </div>

              <div className="v2-auth-divider" role="separator">
                <span>or</span>
              </div>
            </>
          )}

          {generalError && (
            <div className="v2-auth-error" role="alert">
              <AlertCircle size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              {generalError}
            </div>
          )}

          <form
            className="v2-auth-form"
            onSubmit={isSignUp ? handleSignUp : handleSignIn}
            noValidate
          >
            <div className="v2-auth-field">
              <label htmlFor={`${formId}-email`}>
                {isSignUp ? 'Email address' : 'Email address or phone number'}
              </label>
              <div className="v2-auth-field-input">
                <span className="v2-auth-field-ico"><Mail size={16} /></span>
                <input
                  id={`${formId}-email`}
                  type={isSignUp ? 'email' : 'text'}
                  autoComplete={isSignUp ? 'email' : 'username'}
                  required
                  placeholder={isSignUp ? 'you@work-or-personal.com' : 'name@company.com or phone'}
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (generalError) setGeneralError(null);
                  }}
                />
              </div>
            </div>

            <div className="v2-auth-field">
              <label htmlFor={`${formId}-password`}>Password</label>
              <div className="v2-auth-field-input">
                <span className="v2-auth-field-ico"><Lock size={16} /></span>
                <input
                  id={`${formId}-password`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required
                  placeholder={isSignUp ? 'At least 8 characters' : 'Enter your password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (generalError) setGeneralError(null);
                  }}
                />
                <button
                  type="button"
                  className="v2-auth-field-trailing"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {isSignUp && password && (
                <>
                  <div className="v2-auth-strength" aria-hidden>
                    {[1, 2, 3, 4].map(step => (
                      <div
                        key={step}
                        className={
                          'v2-auth-strength-bar' +
                          (step <= passwordStrengthScore ? ` active-${passwordStrengthScore}` : '')
                        }
                      />
                    ))}
                  </div>
                  <div className="v2-auth-strength-hint">
                    <span className={hasMinLength ? 'on' : ''}>
                      {hasMinLength ? '✓' : '·'} 8+ chars
                    </span>
                    <span className={hasMixedCase ? 'on' : ''}>
                      {hasMixedCase ? '✓' : '·'} A-z mixed
                    </span>
                    <span className={hasNumberOrSymbol ? 'on' : ''}>
                      {hasNumberOrSymbol ? '✓' : '·'} 123 / !#$
                    </span>
                  </div>
                </>
              )}

              {!isSignUp && (
                <div className="v2-auth-forgot">
                  <a
                    href="#"
                    onClick={e => {
                      e.preventDefault();
                      showToast('Password reset is coming soon — contact support meanwhile.');
                    }}
                  >
                    Forgot password?
                  </a>
                </div>
              )}
            </div>

            {isSignUp && (
              <div className="v2-auth-field">
                <label htmlFor={`${formId}-phone`}>
                  Phone number <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
                </label>
                <div className="v2-auth-field-row">
                  <div className="v2-auth-field-input v2-auth-cc">
                    <span className="v2-auth-field-ico"><ChevronDown size={14} /></span>
                    <select
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      aria-label="Country calling code"
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="v2-auth-field-input" style={{ flex: 1 }}>
                    <span className="v2-auth-field-ico"><Phone size={16} /></span>
                    <input
                      id={`${formId}-phone`}
                      type="tel"
                      autoComplete="tel"
                      placeholder="(555) 000-0000"
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                    />
                  </div>
                </div>
              </div>
            )}

            <V2Button
              type="submit"
              className="v2-auth-submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isSignUp
                  ? 'Creating account…'
                  : 'Signing in…'
                : (
                  <>
                    {isSignUp ? 'Create account' : 'Sign in'} <ArrowRight size={16} />
                  </>
                )}
            </V2Button>
          </form>

          <label className="v2-auth-remember">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={e => setKeepSignedIn(e.target.checked)}
            />
            Keep me signed in
          </label>

          <div className="v2-auth-trust">
            <div className="v2-auth-trust-ico"><ShieldCheck size={16} /></div>
            <div>
              <strong>Secure and private</strong>
              <span>Your data is encrypted and never shared with third parties.</span>
            </div>
          </div>

          {!isSupabase && (
            <div className="v2-auth-demo">
              <button type="button" onClick={fillDemoCredentials}>
                Use demo account (alex.dev@nabbit.io)
              </button>
            </div>
          )}

          <div className="v2-auth-cancel">
            <button type="button" onClick={() => (window.location.href = '/v1/#/')}>
              ← Return to the classic view
            </button>
          </div>
        </section>
      </main>

      <V2Toast message={toast} />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" width="20" height="20">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 2.9-2.3 5.3-4.7 7l7.5 5.8c4.4-4.1 7-10.1 7-17.3z" />
      <path fill="#FBBC05" d="M10.3 28.6c-1-2.9-1-6.1 0-9l-7.8-6.1C-.9 18.9-.9 29.1 2.5 34.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2.1 1.4-4.7 2.3-7.7 2.3-6.4 0-11.8-3.8-13.7-9.4l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function GitHubGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="currentColor">
      <path d="M12 .5C5.6.5.5 5.6.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.6 18.4.5 12 .5z" />
    </svg>
  );
}
