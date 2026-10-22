import React, { useState, useId } from 'react';
import { Mail, Lock, Phone, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Sparkles, Target, ChevronDown } from 'lucide-react';
import { UserAccount } from '../lib/types';
import { Button } from '../components/Button';
import { api } from '../lib/api';

export interface AuthScreenProps {
  initialMode?: 'signin' | 'signup';
  onSuccess: (user: UserAccount, notice?: string) => void;
  onCancel?: () => void;
  /** Set when a visitor just finished a trial challenge and was sent here to sign up. */
  trialResult?: { correct: boolean; concept: string } | null;
  signUpFn: (email: string, password: string, phone: string, countryCode: string) => Promise<{ user: UserAccount; backgroundNotice: string }>;
  signInFn: (identifier: string, password: string) => Promise<{ user: UserAccount; backgroundNotice: string }>;
}

const COMMON_COUNTRY_CODES = [
  { code: '+1', country: 'US / CA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+33', country: 'FR', flag: '🇫🇷' },
  { code: '+81', country: 'JP', flag: '🇯🇵' },
  { code: '+65', country: 'SG', flag: '🇸🇬' },
  { code: '+41', country: 'CH', flag: '🇨🇭' },
  { code: '+31', country: 'NL', flag: '🇳🇱' },
];

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialMode = 'signup',
  onSuccess,
  onCancel,
  trialResult,
  signUpFn,
  signInFn,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

  // Form Fields - Strictly Email, Password, and Phone Number
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [showPassword, setShowPassword] = useState(false);

  // Sign In single identifier (email or phone)
  const [signinIdentifier, setSigninIdentifier] = useState('');

  // UI & Validation States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; phone?: boolean; signinId?: boolean }>({});

  const formId = useId();
  const isSupabase = api.isSupabaseConfigured();

  // --- Browser Verifications ---

  // 1. Email Verification
  const emailTrimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const isEmailValid = emailRegex.test(emailTrimmed);

  // Check common typos
  let emailTypoWarning: string | null = null;
  if (emailTrimmed.includes('@')) {
    const [, domain] = emailTrimmed.split('@');
    if (domain === 'gmail.con') emailTypoWarning = 'Did you mean @gmail.com?';
    else if (domain === 'gmai.com') emailTypoWarning = 'Did you mean @gmail.com?';
    else if (domain === 'yaho.com') emailTypoWarning = 'Did you mean @yahoo.com?';
    else if (domain === 'outlok.com') emailTypoWarning = 'Did you mean @outlook.com?';
  }

  // 2. Password Verification
  const hasMinLength = password.length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumberOrSymbol = /\d/.test(password) || /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  let passwordStrengthScore = 0;
  if (hasMinLength) passwordStrengthScore++;
  if (hasMixedCase) passwordStrengthScore++;
  if (hasNumberOrSymbol) passwordStrengthScore++;
  if (password.length >= 12) passwordStrengthScore++;

  const isPasswordValid = hasMinLength;

  // 3. Phone Number Verification & Formatting
  const rawPhoneDigits = phoneNumber.replace(/\D/g, '');
  const isPhoneValid = rawPhoneDigits.length >= 10 && rawPhoneDigits.length <= 15;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '');

    // Auto-format for 10-digit style: (XXX) XXX-XXXX
    if (countryCode === '+1' && digits.length <= 10) {
      if (digits.length === 0) setPhoneNumber('');
      else if (digits.length <= 3) setPhoneNumber(`(${digits}`);
      else if (digits.length <= 6) setPhoneNumber(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
      else setPhoneNumber(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`);
    } else {
      setPhoneNumber(raw);
    }
  };

  // Sign Up Submission
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true, phone: true });
    setGeneralError(null);

    // Browser-level verification check
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
      const fullPhone = `${countryCode} ${phoneNumber.trim()}`;
      const result = await signUpFn(emailTrimmed, password, fullPhone, countryCode);
      onSuccess(result.user, result.backgroundNotice);
    } catch (err: any) {
      setGeneralError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sign In Submission
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ signinId: true, password: true });
    setGeneralError(null);

    if (!signinIdentifier.trim()) {
      setGeneralError('Please enter your email address or phone number.');
      return;
    }
    if (!password) {
      setGeneralError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signInFn(signinIdentifier.trim(), password);
      onSuccess(result.user, result.backgroundNotice);
    } catch (err: any) {
      setGeneralError(err.message || 'Invalid credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Demo 1-click quick credentials
  const fillDemoCredentials = () => {
    setMode('signin');
    setSigninIdentifier('alex.dev@nabbit.io');
    setPassword('Password123!');
    setGeneralError(null);
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4 sm:px-6 space-y-4">
      {trialResult && (
        <div className="rounded-[var(--radius)] border border-[var(--color-accent-border)] bg-[var(--color-accent-weak)] px-4 py-3 text-xs text-[var(--color-text)] leading-relaxed">
          <strong className="font-semibold">
            {trialResult.correct ? 'Nice catch! ✅' : 'Not quite — close one. 🔍'}
          </strong>{' '}
          You finished the “{trialResult.concept}” trial drill. Create a free account to see the full
          explanation, save your progress and get spaced-recall reviews.
        </div>
      )}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-[var(--shadow-md)] space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white flex items-center justify-center mx-auto shadow-[var(--shadow-sm)]">
            <Target className="w-5 h-5 stroke-[2.5]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text)]">
            {mode === 'signup' ? 'Create Your Account' : 'Welcome Back'}
          </h1>
          <p className="text-xs text-[var(--color-muted)]">
            {mode === 'signup'
              ? 'Instant access to bug hunt drills. Verifications deliver in the background.'
              : 'Sign in to sync your spaced-recall progress across devices.'}
          </p>

          {/* Supabase Connection Status Pill */}
          {isSupabase ? (
            <div className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-mono mx-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Supabase Auth Connected</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px] font-mono mx-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Local Auth Mode · Add Supabase keys to .env</span>
            </div>
          )}
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-[var(--radius)] bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-xs font-semibold select-none">
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setGeneralError(null);
            }}
            className={`py-2 rounded-[var(--radius-sm)] transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setGeneralError(null);
            }}
            className={`py-2 rounded-[var(--radius-sm)] transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Sign In
          </button>
        </div>

        {/* General Error Banner */}
        {generalError && (
          <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--color-danger-border)] bg-[var(--color-danger-weak)] text-xs text-[var(--color-danger-ink)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-danger)]" />
            <span>{generalError}</span>
          </div>
        )}

        {/* --- SIGN UP FORM --- */}
        {mode === 'signup' ? (
          <form onSubmit={handleSignUpSubmit} className="space-y-4" noValidate>
            {/* Field 1: Email Address */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor={`${formId}-email`} className="font-semibold text-[var(--color-text)]">
                  Email Address
                </label>
                {touched.email && emailTrimmed && (
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    {isEmailValid ? (
                      <span className="text-[var(--color-good)] flex items-center gap-0.5 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Valid format
                      </span>
                    ) : (
                      <span className="text-[var(--color-danger)] font-medium">
                        Invalid email
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-muted)]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id={`${formId}-email`}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@work-or-personal.com"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (generalError) setGeneralError(null);
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-[var(--radius-sm)] border bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] transition-colors focus:outline-none ${
                    touched.email && !isEmailValid && emailTrimmed
                      ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]'
                      : 'border-[var(--color-border)] focus:border-[var(--color-accent)]'
                  }`}
                />
              </div>

              {emailTypoWarning && (
                <p className="text-[11px] text-amber-500 font-mono">
                  💡 {emailTypoWarning}
                </p>
              )}
            </div>

            {/* Field 2: Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor={`${formId}-password`} className="font-semibold text-[var(--color-text)]">
                  Password
                </label>
                {password && (
                  <span className="text-[10px] font-mono text-[var(--color-muted)]">
                    {passwordStrengthScore <= 1 && <span className="text-red-500 font-semibold">Weak</span>}
                    {passwordStrengthScore === 2 && <span className="text-amber-500 font-semibold">Fair</span>}
                    {passwordStrengthScore === 3 && <span className="text-emerald-500 font-semibold">Strong</span>}
                    {passwordStrengthScore >= 4 && <span className="text-[var(--color-accent)] font-bold">Excellent</span>}
                  </span>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-muted)]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id={`${formId}-password`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (generalError) setGeneralError(null);
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                  className="w-full pl-9 pr-10 py-2 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Password strength indicators */}
              {password && (
                <div className="space-y-1 pt-1">
                  <div className="grid grid-cols-4 gap-1 h-1">
                    {[1, 2, 3, 4].map(step => (
                      <div
                        key={step}
                        className={`h-full rounded-full transition-all ${
                          step <= passwordStrengthScore
                            ? step === 1
                              ? 'bg-red-500'
                              : step === 2
                              ? 'bg-amber-500'
                              : step === 3
                              ? 'bg-emerald-500'
                              : 'bg-[var(--color-accent)]'
                            : 'bg-[var(--color-border)]'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted)] font-mono">
                    <span className={hasMinLength ? 'text-[var(--color-good)] font-medium' : ''}>
                      {hasMinLength ? '✓' : '·'} 8+ chars
                    </span>
                    <span className={hasMixedCase ? 'text-[var(--color-good)] font-medium' : ''}>
                      {hasMixedCase ? '✓' : '·'} A-z mixed
                    </span>
                    <span className={hasNumberOrSymbol ? 'text-[var(--color-good)] font-medium' : ''}>
                      {hasNumberOrSymbol ? '✓' : '·'} 123 / !#$
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Field 3: Phone Number */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor={`${formId}-phone`} className="font-semibold text-[var(--color-text)]">
                  Phone Number
                </label>
                {touched.phone && phoneNumber && (
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    {isPhoneValid ? (
                      <span className="text-[var(--color-good)] flex items-center gap-0.5 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Valid format
                      </span>
                    ) : (
                      <span className="text-[var(--color-danger)] font-medium">
                        Need 10-15 digits
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <div className="relative shrink-0">
                  <select
                    value={countryCode}
                    onChange={e => setCountryCode(e.target.value)}
                    aria-label="Country calling code"
                    className="h-full pl-2.5 pr-7 py-2 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] font-mono appearance-none focus:outline-none focus:border-[var(--color-accent)] cursor-pointer"
                  >
                    {COMMON_COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-[var(--color-muted)] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-muted)]">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id={`${formId}-phone`}
                    type="tel"
                    autoComplete="tel"
                    required
                    placeholder="(555) 000-0000"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[var(--color-muted)]">
                Stored securely in user profile for verification and recovery.
              </p>
            </div>

            {/* Reassurance Notice */}
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--color-accent-weak)] border border-[var(--color-accent-border)] text-xs text-[var(--color-text)] flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-[var(--color-text-subtle)]">
                <strong className="text-[var(--color-text)]">Smooth instant access:</strong> You enter directly into drills. {isSupabase ? 'Authenticated securely via Supabase Auth.' : 'Verification codes dispatch asynchronously in the background.'}
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              variant="primary"
              className="w-full justify-center"
              isLoading={isSubmitting}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Create Account (Instant Access)
            </Button>
          </form>
        ) : (
          /* --- SIGN IN FORM --- */
          <form onSubmit={handleSignInSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor={`${formId}-signin-id`} className="text-xs font-semibold text-[var(--color-text)]">
                Email Address or Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-muted)]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id={`${formId}-signin-id`}
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="name@company.com or phone"
                  value={signinIdentifier}
                  onChange={e => {
                    setSigninIdentifier(e.target.value);
                    if (generalError) setGeneralError(null);
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, signinId: true }))}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor={`${formId}-signin-password`} className="font-semibold text-[var(--color-text)]">
                  Password
                </label>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-muted)]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id={`${formId}-signin-password`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (generalError) setGeneralError(null);
                  }}
                  className="w-full pl-9 pr-10 py-2 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              variant="primary"
              className="w-full justify-center"
              isLoading={isSubmitting}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>

            {/* Quick Demo Credentials only if Supabase is not active */}
            {!isSupabase && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={fillDemoCredentials}
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] font-mono transition-colors cursor-pointer"
                >
                  Use demo account (alex.dev@nabbit.io)
                </button>
              </div>
            )}
          </form>
        )}

        {/* Supabase Setup Card if keys are not yet in .env */}
        {!isSupabase && (
          <div className="p-3.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-xs text-[var(--color-muted)] space-y-2">
            <div className="flex items-center gap-1.5 text-[var(--color-text)] font-semibold text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>Connect Your Supabase Account</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--color-text-subtle)]">
              To activate real Supabase authentication, add your project credentials to your <code className="text-[var(--color-accent)] font-mono">.env</code> file:
            </p>
            <div className="bg-[var(--code-bg)] text-[var(--code-text)] p-2.5 rounded font-mono text-[10.5px] space-y-1 select-all overflow-x-auto">
              <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
              <div>VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...</div>
            </div>
            <p className="text-[10.5px] text-[var(--color-muted)]">
              Get these from: Supabase Dashboard → Settings → API
            </p>
          </div>
        )}

        {/* Supabase Active Security Badge */}
        {isSupabase && (
          <div className="p-3.5 rounded-[var(--radius-sm)] border border-emerald-500/20 bg-emerald-500/5 text-xs text-[var(--color-muted)] space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold font-mono text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Protected by Supabase Auth</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--color-text-subtle)]">
              Your credentials are securely hashed and stored in your Supabase project. Authentication tokens auto-refresh across sessions.
            </p>
          </div>
        )}

        {/* Cancel / Back Button */}
        {onCancel && (
          <div className="pt-2 text-center border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
            >
              ← Return to Nabbit drills
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
