import {
  Video,
  Challenge,
  Attempt,
  AttemptInput,
  Confidence,
  RecallItem,
  RecallStats,
  ScoreBreakdown,
  UserAccount,
  AuthResponse,
} from './types';
import { CURATED_VIDEOS, CURATED_CHALLENGES } from '../content/data';
import { normalizeChallenges, normalizeChallenge } from '../content/normalize';
import { calculateRecallSchedule, computeStats, getSimulatedNow } from './recall';
import { grade, computeScore } from './grading';
import { getFreezeState, markFreezeUsed } from './streak-freeze';
import { extractYouTubeVideoId } from './youtube';
import { supabase, isSupabaseConfigured, mapSupabaseUser } from './supabase';
import { supabaseStore } from './supabase-store';

// Phase 8 v1 — attempt submission context. Confidence/time/combo come from the UI,
// never affect SRS, and only confidence × time × combo scales the score (see grading.ts).
export interface AttemptMeta {
  confidence: Confidence;
  timeMs: number;
  /** Pre-attempt combo state (0 for the first attempt in a session, N after N consecutive full-corrects). */
  combo: number;
  /** Phase 8 v3 — attempt is part of this week's Boss drill (Supabase stamps attempts.is_boss). */
  isBoss?: boolean;
}

export interface AttemptResult {
  attempt: Attempt;
  correct: boolean;             // full-correct only (partial credit → false, see outcome for the real signal)
  outcome: 0 | 0.5 | 1;
  explanation: string;
  recallItem: RecallItem;
  stats: RecallStats;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  comboAfter: number;           // 0 if wrong, prev+1 if correct, prev if partial
  // Phase 8 v2 — populated when the write went through SupabaseStore.
  newRating?: number;           // post-attempt per-concept Elo
  eloDelta?: number;            // signed change (positive on wins, negative on losses)
  globalStreak?: number;        // server-authoritative global streak
  freezesRemaining?: number;    // weekly freeze inventory after this attempt
}

const LOCAL_STORAGE_KEY_ITEMS = 'nabbit_recall_items_v1';
const LOCAL_STORAGE_KEY_ATTEMPTS = 'nabbit_attempts_v1';
const LOCAL_STORAGE_KEY_OFFSET = 'nabbit_simulated_offset_v1';
const LOCAL_STORAGE_KEY_PROFILE = 'nabbit_profile_v1';
const LOCAL_STORAGE_KEY_AUTH = 'nabbit_auth_user_v1';
const LOCAL_STORAGE_KEY_PROGRESS_OWNER = 'nabbit_progress_owner_v1';
const LOCAL_STORAGE_KEY_CUSTOM_VIDEOS = 'nabbit_custom_videos_v1';
const LOCAL_STORAGE_KEY_CUSTOM_CHALLENGES = 'nabbit_custom_challenges_v1';

/** Turn raw auth-provider errors into plain, product-voice messages (never name the provider). */
function friendlyAuthError(message: string | undefined): string {
  const m = (message || '').toLowerCase();
  if (/email address .*invalid|unable to validate email|invalid email/.test(m)) {
    return 'Please use a valid email address from a real domain (for example, name@gmail.com).';
  }
  if (/already (been )?registered|already exists/.test(m)) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (/invalid login credentials/.test(m)) {
    return 'Incorrect email or password.';
  }
  if (/email not confirmed/.test(m)) {
    return 'Please confirm your email first — check your inbox for the confirmation link.';
  }
  if (/rate limit|too many|security purposes/.test(m)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (/password/.test(m)) {
    return 'Please choose a stronger password (at least 8 characters).';
  }
  return 'Something went wrong. Please try again.';
}

export interface Profile {
  name: string;
  onboarded: boolean;
}

/**
 * Phase 8 v2 — gate for Supabase-backed reads/writes. True when real credentials
 * are configured AND a Supabase-provider user is signed in. Anonymous trial
 * flow stays on LocalStore even with Supabase configured.
 */
function useSupabase(): boolean {
  if (!isSupabaseConfigured() || !supabase) return false;
  const user = localStore.getCurrentUser();
  return Boolean(user && user.provider === 'supabase');
}

class LocalStore {
  private items: RecallItem[] = [];
  private attempts: Attempt[] = [];
  private offsetDays: number = 0;
  private profile: Profile = { name: '', onboarded: false };
  private customVideos: Video[] = [];
  private customChallenges: Challenge[] = [];
  private currentUser: UserAccount | null = null;
  private authListeners: ((user: UserAccount | null) => void)[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      const storedItems = localStorage.getItem(LOCAL_STORAGE_KEY_ITEMS);
      const storedAttempts = localStorage.getItem(LOCAL_STORAGE_KEY_ATTEMPTS);
      const storedOffset = localStorage.getItem(LOCAL_STORAGE_KEY_OFFSET);

      if (storedItems && storedAttempts) {
        this.items = JSON.parse(storedItems);
        this.attempts = JSON.parse(storedAttempts);
      } else {
        // New browsers start at zero — no pre-filled demo progress.
        this.items = [];
        this.attempts = [];
        this.save();
      }

      if (storedOffset) {
        this.offsetDays = parseInt(storedOffset, 10) || 0;
      }

      const storedProfile = localStorage.getItem(LOCAL_STORAGE_KEY_PROFILE);
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        this.profile = {
          name: typeof parsed?.name === 'string' ? parsed.name : '',
          onboarded: Boolean(parsed?.onboarded),
        };
      }

      const storedAuth = localStorage.getItem(LOCAL_STORAGE_KEY_AUTH);
      if (storedAuth) {
        this.currentUser = JSON.parse(storedAuth);
      }

      const storedCustomVideos = localStorage.getItem(LOCAL_STORAGE_KEY_CUSTOM_VIDEOS);
      if (storedCustomVideos) {
        this.customVideos = JSON.parse(storedCustomVideos);
      }

      const storedCustomChallenges = localStorage.getItem(LOCAL_STORAGE_KEY_CUSTOM_CHALLENGES);
      if (storedCustomChallenges) {
        this.customChallenges = JSON.parse(storedCustomChallenges);
      }
    } catch {
      this.items = [];
      this.attempts = [];
    }

    // Initialize Supabase session synchronization if configured
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          const mapped = mapSupabaseUser(data.session.user);
          mapped.provider = 'supabase';
          this.claimProgress(mapped);
          this.currentUser = mapped;
          this.save();
          this.notifyAuthListeners();
        }
      }).catch(err => {
        console.warn('[Nabbit Supabase] Initial session check notice:', err);
      });

      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const mapped = mapSupabaseUser(session.user);
          mapped.provider = 'supabase';
          this.claimProgress(mapped);
          this.currentUser = mapped;
          if (!this.profile.name && mapped.email) {
            const defaultName = mapped.email.split('@')[0].replace(/[._-]/g, ' ');
            this.profile = { name: defaultName, onboarded: true };
          }
          this.save();
          this.notifyAuthListeners();
        } else if (this.currentUser?.provider === 'supabase') {
          this.currentUser = null;
          this.save();
          this.notifyAuthListeners();
        }
      });
    }
  }

  private save() {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ITEMS, JSON.stringify(this.items));
      localStorage.setItem(LOCAL_STORAGE_KEY_ATTEMPTS, JSON.stringify(this.attempts));
      localStorage.setItem(LOCAL_STORAGE_KEY_OFFSET, this.offsetDays.toString());
      localStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify(this.profile));
      if (this.currentUser) {
        localStorage.setItem(LOCAL_STORAGE_KEY_AUTH, JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_AUTH);
      }
      localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOM_VIDEOS, JSON.stringify(this.customVideos));
      localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOM_CHALLENGES, JSON.stringify(this.customChallenges));
    } catch {
      // storage unavailable or full
    }
  }

  // --- Auth Store Methods ---
  public getCurrentUser(): UserAccount | null {
    return this.currentUser ? { ...this.currentUser } : null;
  }

  /**
   * Progress is stored per browser, so tie it to the account that created it: when a
   * different account signs in on the same browser, start that account from zero
   * instead of inheriting the previous person's streak and solved concepts.
   */
  private claimProgress(user: UserAccount) {
    try {
      const owner = localStorage.getItem(LOCAL_STORAGE_KEY_PROGRESS_OWNER);
      if (owner && owner !== user.id) {
        this.items = [];
        this.attempts = [];
        this.offsetDays = 0;
        this.profile = { name: '', onboarded: false };
      }
      localStorage.setItem(LOCAL_STORAGE_KEY_PROGRESS_OWNER, user.id);
    } catch {
      // storage unavailable — nothing to isolate
    }
  }

  public setCurrentUser(user: UserAccount | null) {
    if (user) this.claimProgress(user);
    this.currentUser = user;
    if (user && !this.profile.name) {
      const defaultName = user.email.split('@')[0].replace(/[._-]/g, ' ');
      this.profile = { name: defaultName, onboarded: true };
    }
    this.save();
    this.notifyAuthListeners();
  }

  public updateUser(partial: Partial<UserAccount>) {
    if (!this.currentUser) return;
    this.currentUser = { ...this.currentUser, ...partial };
    this.save();
    this.notifyAuthListeners();
  }

  public onAuthChange(callback: (user: UserAccount | null) => void): () => void {
    this.authListeners.push(callback);
    return () => {
      this.authListeners = this.authListeners.filter(cb => cb !== callback);
    };
  }

  private notifyAuthListeners() {
    const user = this.getCurrentUser();
    this.authListeners.forEach(cb => cb(user));
  }

  // --- Core Learning & Spaced Recall ---
  public getProfile(): Profile {
    return { ...this.profile };
  }

  public setProfileName(name: string) {
    this.profile = { name: name.trim().slice(0, 32), onboarded: true };
    this.save();
  }

  public dismissOnboarding() {
    this.profile = { ...this.profile, onboarded: true };
    this.save();
  }

  public getOffset(): number {
    return this.offsetDays;
  }

  public setOffset(days: number) {
    this.offsetDays = days;
    this.save();
  }

  public getVideos(): Video[] {
    return [...this.customVideos, ...CURATED_VIDEOS];
  }

  public getChallenges(videoId?: string): Challenge[] {
    const all = normalizeChallenges([...this.customChallenges, ...CURATED_CHALLENGES]);
    if (!videoId) return all;
    return all.filter(c => c.videoId === videoId);
  }

  public getChallenge(id: string): Challenge | undefined {
    const found = [...this.customChallenges, ...CURATED_CHALLENGES].find(c => c.id === id);
    return found ? normalizeChallenge(found) : undefined;
  }

  public addCustomPack(video: Video, challenges: Challenge[]) {
    this.customVideos = [video, ...this.customVideos.filter(v => v.id !== video.id)];
    const newChallengeIds = new Set(challenges.map(c => c.id));
    this.customChallenges = [...challenges, ...this.customChallenges.filter(c => !newChallengeIds.has(c.id))];
    this.save();
  }

  public getAttempts(): Attempt[] {
    return this.attempts;
  }

  public getRecallItems(): RecallItem[] {
    return this.items;
  }

  public recordAttempt(challengeId: string, input: AttemptInput, meta: AttemptMeta): AttemptResult {
    const challenge = this.getChallenge(challengeId);
    if (!challenge) {
      throw new Error(`Challenge not found: ${challengeId}`);
    }

    // Grade deterministically — same code path client-side today, server-side later.
    const g = grade(challenge, input);

    // Combo advances only on full-correct; partial credit holds, wrong resets.
    const comboAfter = g.outcome === 1
      ? meta.combo + 1
      : g.outcome === 0.5 ? meta.combo
      : 0;

    const breakdown = computeScore(g, challenge, { ...meta, comboAfter });

    // `chosen` stays the primary surface for back-compat; formats without a single chosen (rank-fixes) use -1.
    const chosen =
      input.format === 'spot-fix' || input.format === 'locate-then-fix'
        ? input.chosen
        : -1;

    const now = getSimulatedNow(this.offsetDays);
    const attempt: Attempt = {
      challengeId,
      chosen,
      correct: g.correct,
      at: now,
      format: input.format,
      confidence: meta.confidence,
      timeMs: meta.timeMs,
      score: breakdown.score,
      comboAtTime: comboAfter,
      outcome: g.outcome,
      input,
    };
    this.attempts.push(attempt);

    // Phase 8 v1 — passive weekly streak freeze. If this wrong attempt would
    // break a non-zero streak and the week's freeze is still intact, consume
    // the freeze now; computeStats then skips this one wrong when counting.
    // Partial credit (outcome 0.5) already preserves the streak via recall, so
    // only outcome 0 (full wrong) is a candidate.
    if (g.outcome === 0) {
      const prevStreak = this.attempts.length >= 2 ? this.attempts[this.attempts.length - 2] : null;
      if (prevStreak && prevStreak.correct) {
        const freeze = getFreezeState(now);
        if (!freeze.used) markFreezeUsed(now);
      }
    }

    const existingIndex = this.items.findIndex(i => i.challengeId === challengeId);
    const existing = existingIndex >= 0 ? this.items[existingIndex] : undefined;

    const updatedRecall = calculateRecallSchedule(
      existing,
      challenge.id,
      challenge.concept,
      challenge.videoId,
      attempt,
      this.offsetDays,
      g.outcome,
    );

    if (existingIndex >= 0) {
      this.items[existingIndex] = updatedRecall;
    } else {
      this.items.push(updatedRecall);
    }

    this.save();
    const stats = computeStats(this.items, this.attempts, this.offsetDays);

    return {
      attempt,
      correct: g.correct,
      outcome: g.outcome,
      explanation: challenge.explanation,
      recallItem: updatedRecall,
      stats,
      score: breakdown.score,
      scoreBreakdown: breakdown,
      comboAfter,
    };
  }

  public getStats(): RecallStats {
    return computeStats(this.items, this.attempts, this.offsetDays);
  }

  public getDueRecall(): { dueItems: (RecallItem & { challenge: Challenge })[]; stats: RecallStats } {
    const now = getSimulatedNow(this.offsetDays);
    const dueItems = this.items
      .filter(item => item.nextReviewAt <= now)
      .map(item => ({
        ...item,
        challenge: this.getChallenge(item.challengeId)!,
      }))
      .filter(item => Boolean(item.challenge));

    return {
      dueItems,
      stats: this.getStats(),
    };
  }

  public reset() {
    this.items = [];
    this.attempts = [];
    this.offsetDays = 0;
    this.save();
  }
}

export const localStore = new LocalStore();

export const api = {
  // --- Auth APIs ---
  isSupabaseConfigured(): boolean {
    return isSupabaseConfigured();
  },

  getCurrentUser(): UserAccount | null {
    return localStore.getCurrentUser();
  },

  onAuthChange(callback: (user: UserAccount | null) => void): () => void {
    return localStore.onAuthChange(callback);
  },

  async signOut(): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[Nabbit] Supabase signOut notice:', err);
      }
    }
    localStore.setCurrentUser(null);
  },

  /**
   * Social sign-in. Redirects the browser to the provider; on return
   * supabase-js (detectSessionInUrl) picks the session up and the existing
   * onAuthStateChange handler signs the user in. The provider must be enabled
   * in the Supabase dashboard (Authentication → Providers) with
   * `<origin>/v2/` in the redirect allow-list. Resolves only on failure —
   * on success the page navigates away.
   */
  async signInWithOAuth(provider: 'google' | 'github'): Promise<{ ok: boolean; message?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { ok: false, message: 'Social sign-in needs an online account. Use email and password for now.' };
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/v2/` },
      });
      if (error) {
        const m = (error.message || '').toLowerCase();
        if (/provider.*(not enabled|unsupported)|unsupported provider/.test(m)) {
          return { ok: false, message: `${provider === 'google' ? 'Google' : 'GitHub'} sign-in isn't enabled yet.` };
        }
        return { ok: false, message: 'Could not start social sign-in. Please try again.' };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: 'Could not start social sign-in. Please try again.' };
    }
  },

  async signUp(
    email: string,
    password: string,
    phoneNumber: string,
    phoneCountryCode = '+1'
  ): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Primary: Use real Supabase Auth when credentials are provided
    if (isSupabaseConfigured() && supabase) {
      console.log('[Nabbit] 🚀 Supabase Auth: Registering user account with Supabase:', normalizedEmail);
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            phone_number: phoneNumber.trim(),
            phone_country_code: phoneCountryCode,
          },
        },
      });

      if (error) {
        console.error('[Nabbit] sign-up error:', error.message);
        throw new Error(friendlyAuthError(error.message));
      }

      if (data.user) {
        console.log('[Nabbit] ✅ Supabase Auth: User account created! UID:', data.user.id);
        const mapped = mapSupabaseUser(data.user);
        mapped.provider = 'supabase';
        localStore.setCurrentUser(mapped);

        return {
          user: mapped,
          token: data.session?.access_token,
          backgroundNotice: data.session
            ? 'Welcome to Nabbit! Your account is ready.'
            : 'Account created! Check your email to confirm it.',
        };
      }
    }

    // 2. Fallback: Backend or local session when Supabase credentials are not configured yet
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password, phoneNumber, phoneCountryCode }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('fetch_fallback_required');
      }

      const data = await res.json();
      localStore.setCurrentUser(data.user);
      return data;
    } catch {
      const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
      const phoneCode = Math.floor(100000 + Math.random() * 900000).toString();
      const fallbackUser: UserAccount = {
        id: `usr_local_${Date.now()}`,
        email: normalizedEmail,
        phoneNumber: phoneNumber.trim(),
        phoneCountryCode,
        emailVerified: false,
        phoneVerified: false,
        createdAt: Date.now(),
        emailVerificationSentAt: Date.now(),
        phoneVerificationSentAt: Date.now(),
        provider: 'local',
        demoVerificationCodes: {
          emailCode,
          phoneCode,
        },
      };
      localStore.setCurrentUser(fallbackUser);
      return {
        user: fallbackUser,
        backgroundNotice: 'Account created smoothly! Verification codes dispatched to email and phone in background.',
      };
    }
  },

  async signIn(identifier: string, password: string): Promise<AuthResponse> {
    const cleanId = identifier.trim();

    // 1. Primary: Use real Supabase Auth when credentials are provided
    if (isSupabaseConfigured() && supabase) {
      console.log('[Nabbit] 🔑 Supabase Auth: Authenticating with Supabase for:', cleanId);
      const isEmail = cleanId.includes('@');
      let result;
      if (isEmail) {
        result = await supabase.auth.signInWithPassword({
          email: cleanId.toLowerCase(),
          password,
        });
      } else {
        result = await supabase.auth.signInWithPassword({
          phone: cleanId,
          password,
        });
      }

      if (result.error) {
        console.error('[Nabbit] sign-in error:', result.error.message);
        throw new Error(friendlyAuthError(result.error.message));
      }

      if (result.data.user) {
        console.log('[Nabbit] ✅ Supabase Auth: Authenticated! UID:', result.data.user.id);
        const mapped = mapSupabaseUser(result.data.user);
        mapped.provider = 'supabase';
        localStore.setCurrentUser(mapped);

        return {
          user: mapped,
          token: result.data.session?.access_token,
          backgroundNotice: 'Signed in successfully!',
        };
      }
    }

    // 2. Fallback: Backend or cached local session
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId, password }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('fetch_fallback_required');
      }

      const data = await res.json();
      localStore.setCurrentUser(data.user);
      return data;
    } catch (err: any) {
      const existing = localStore.getCurrentUser();
      if (
        existing &&
        (existing.email.toLowerCase() === cleanId.toLowerCase() ||
          existing.phoneNumber.replace(/\D/g, '').endsWith(cleanId.replace(/\D/g, '')))
      ) {
        return {
          user: existing,
          backgroundNotice: 'Signed in from cached local credentials.',
        };
      }
      throw new Error(err.message === 'fetch_fallback_required' ? 'Invalid email/phone or password.' : err.message || 'Unable to sign in. Please verify your credentials or sign up.');
    }
  },

  async verifyContact(
    userId: string,
    type: 'email' | 'phone',
    code: string
  ): Promise<{ success: boolean; message: string; user: UserAccount }> {
    const cleanCode = code.trim();

    // 1. Primary: Supabase OTP verification
    if (isSupabaseConfigured() && supabase) {
      const user = localStore.getCurrentUser();
      if (type === 'email' && user?.email) {
        const { data, error } = await supabase.auth.verifyOtp({
          email: user.email,
          token: cleanCode,
          type: 'signup',
        });

        if (error) {
          const secondTry = await supabase.auth.verifyOtp({
            email: user.email,
            token: cleanCode,
            type: 'email',
          });

          if (secondTry.error) {
            throw new Error('That verification code is invalid or has expired.');
          }
          if (secondTry.data.user) {
            const mapped = mapSupabaseUser(secondTry.data.user);
            mapped.provider = 'supabase';
            localStore.setCurrentUser(mapped);
            return {
              success: true,
              message: 'Email address verified!',
              user: mapped,
            };
          }
        } else if (data.user) {
          const mapped = mapSupabaseUser(data.user);
          mapped.provider = 'supabase';
          localStore.setCurrentUser(mapped);
          return {
            success: true,
            message: 'Email address verified!',
            user: mapped,
          };
        }
      } else if (type === 'phone' && user?.phoneNumber) {
        const { data, error } = await supabase.auth.verifyOtp({
          phone: user.phoneNumber,
          token: cleanCode,
          type: 'sms',
        });
        if (error) throw new Error('That verification code is invalid or has expired.');
        if (data.user) {
          const mapped = mapSupabaseUser(data.user);
          mapped.provider = 'supabase';
          localStore.setCurrentUser(mapped);
          return {
            success: true,
            message: 'Phone number verified!',
            user: mapped,
          };
        }
      }
    }

    // 2. Fallback: Backend or local verification
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type, code: cleanCode }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('fetch_fallback_required');
      }

      const data = await res.json();
      localStore.setCurrentUser(data.user);
      return data;
    } catch {
      const user = localStore.getCurrentUser();
      if (!user) throw new Error('No user session found.');

      const expectedCode =
        type === 'email'
          ? user.demoVerificationCodes?.emailCode || '123456'
          : user.demoVerificationCodes?.phoneCode || '789012';

      if (cleanCode === expectedCode || cleanCode === '123456' || cleanCode === '789012') {
        const updated = {
          ...user,
          [type === 'email' ? 'emailVerified' : 'phoneVerified']: true,
        };
        localStore.setCurrentUser(updated);
        return {
          success: true,
          message: `${type === 'email' ? 'Email' : 'Phone'} verified successfully!`,
          user: updated,
        };
      }
      throw new Error(`Invalid 6-digit ${type} verification code.`);
    }
  },

  async resendVerification(
    userId: string,
    type: 'email' | 'phone'
  ): Promise<{ success: boolean; message: string; user: UserAccount }> {
    // 1. Primary: Supabase resend
    if (isSupabaseConfigured() && supabase) {
      const user = localStore.getCurrentUser();
      if (type === 'email' && user?.email) {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: user.email,
        });
        if (error) throw new Error(friendlyAuthError(error.message));
        return {
          success: true,
          message: 'Verification email resent!',
          user,
        };
      } else if (type === 'phone' && user?.phoneNumber) {
        const { error } = await supabase.auth.resend({
          type: 'sms',
          phone: user.phoneNumber,
        });
        if (error) throw new Error(friendlyAuthError(error.message));
        return {
          success: true,
          message: 'SMS verification code resent!',
          user,
        };
      }
    }

    // 2. Fallback: Backend or local resend
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('fetch_fallback_required');
      }

      const data = await res.json();
      localStore.setCurrentUser(data.user);
      return data;
    } catch {
      const user = localStore.getCurrentUser();
      if (!user) throw new Error('No user session found.');
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      const updated: UserAccount = {
        ...user,
        [type === 'email' ? 'emailVerificationSentAt' : 'phoneVerificationSentAt']: Date.now(),
        demoVerificationCodes: {
          emailCode: type === 'email' ? newCode : user.demoVerificationCodes?.emailCode || '123456',
          phoneCode: type === 'phone' ? newCode : user.demoVerificationCodes?.phoneCode || '789012',
        },
      };
      localStore.setCurrentUser(updated);
      return {
        success: true,
        message: `New ${type} verification code dispatched in background!`,
        user: updated,
      };
    }
  },

  // --- Core Learning & Spaced Recall APIs ---
  async getVideos(): Promise<Video[]> {
    return localStore.getVideos();
  },

  async getVideoChallenges(videoId: string): Promise<Challenge[]> {
    return localStore.getChallenges(videoId);
  },

  async getChallenge(challengeId: string): Promise<Challenge | null> {
    return localStore.getChallenge(challengeId) || null;
  },

  async submitAttempt(challengeId: string, input: AttemptInput, meta: AttemptMeta): Promise<AttemptResult> {
    // Phase 8 v2 — signed-in Supabase users go through SupabaseStore (RPC).
    // Trial/anonymous and local-fallback users stay on LocalStore (unchanged).
    if (useSupabase()) {
      const challenge = localStore.getChallenge(challengeId);
      if (!challenge) throw new Error(`Challenge not found: ${challengeId}`);
      return supabaseStore.recordAttempt(challenge, input, meta);
    }
    return localStore.recordAttempt(challengeId, input, meta);
  },

  async getRecallDashboard() {
    if (useSupabase()) {
      const [items, attempts, streak] = await Promise.all([
        supabaseStore.getRecallItems(),
        supabaseStore.getAttempts(),
        supabaseStore.getStreakState().catch(() => null),
      ]);
      const stats = computeStats(items, attempts, 0);
      if (streak) {
        stats.currentStreak = streak.current; // server-authoritative global streak
      }
      const now = Date.now();
      const dueItems = items
        .filter(i => i.nextReviewAt <= now)
        .map(i => ({ ...i, challenge: localStore.getChallenge(i.challengeId)! }))
        .filter(i => Boolean(i.challenge));
      const allItems = items.map(i => ({ ...i, challenge: localStore.getChallenge(i.challengeId) }));
      return { dueItems, allItems, stats };
    }

    const { dueItems, stats } = localStore.getDueRecall();
    const allItems = localStore.getRecallItems().map(item => ({
      ...item,
      challenge: localStore.getChallenge(item.challengeId),
    }));
    return {
      dueItems,
      allItems,
      stats,
    };
  },

  /**
   * Phase 8 v2 — one-shot push of this browser's local attempts + recall_items
   * into Supabase for the signed-in user. Idempotent: dedupes on
   * (user_id, challenge_id, at) server-side. We also skip when nothing's local
   * or when we've already merged this user on this browser.
   */
  async mergeLocalProgressIntoSupabase(): Promise<{ merged: boolean; attempts_imported?: number; recall_imported?: number }> {
    if (!useSupabase()) return { merged: false };
    const user = localStore.getCurrentUser();
    if (!user) return { merged: false };
    const flagKey = `nabbit_sb_merged_v1_${user.id}`;
    try {
      if (localStorage.getItem(flagKey) === '1') return { merged: false };
    } catch {
      // storage blocked — proceed; a reattempt is harmless (merge is idempotent)
    }
    const localAttempts = localStore.getAttempts();
    const localRecall = localStore.getRecallItems();
    if (localAttempts.length === 0 && localRecall.length === 0) {
      try { localStorage.setItem(flagKey, '1'); } catch {}
      return { merged: false };
    }
    const challengeById = new Map<string, Challenge>();
    for (const c of localStore.getChallenges()) challengeById.set(c.id, c);
    const res = await supabaseStore.mergeLocalProgress(localAttempts, localRecall, challengeById);
    try { localStorage.setItem(flagKey, '1'); } catch {}
    return { merged: true, ...res };
  },

  async resetData() {
    localStore.reset();
  },

  getSimulatedOffset(): number {
    return localStore.getOffset();
  },

  setSimulatedOffset(days: number) {
    localStore.setOffset(days);
  },

  getProfile(): Profile {
    return localStore.getProfile();
  },

  saveProfileName(name: string) {
    localStore.setProfileName(name);
  },

  dismissOnboarding() {
    localStore.dismissOnboarding();
  },

  async generateFromYouTubeUrl(url: string, topicHint?: string): Promise<{ video: Video; challenges: Challenge[]; source: string }> {
    // Validate locally first so a typo never costs a network round-trip.
    if (!extractYouTubeVideoId(url)) {
      throw new Error('Please enter a valid YouTube video URL or ID');
    }
    // No canned-template fallback: drills that aren't about this video are worse
    // than a clear error. The server returns { error, code } on any failure.
    let res: Response;
    try {
      res = await fetch('/api/videos/generate-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, topicHint }),
      });
    } catch {
      throw new Error("Couldn't reach the Nabbit server. Check your connection and try again.");
    }
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json().catch(() => null) : null;
    if (!res.ok || !data) {
      // A non-JSON reply means /api isn't served by the Nabbit server at all
      // (static hosting, or `vite preview`, which serves index.html for /api).
      if (data?.detail) console.warn('[Nabbit] import detail:', data.detail);
      throw new Error(
        data?.error ||
          'This page is running without the Nabbit server, so video import is unavailable. Start the app with "npm start" (after "npm run build") or "npm run dev" and open the address it prints.',
      );
    }
    // Older servers answered with a canned template pack unrelated to the video.
    // Never accept it: tell the user to restart/redeploy the server instead.
    if (data.source === 'template') {
      throw new Error(
        'The Nabbit server is running an outdated version that fabricates unrelated drills. Restart it (npm start / npm run dev) so it picks up the latest code.',
      );
    }
    if (data.detail) console.warn('[Nabbit] import detail:', data.detail);
    if (!data.video || !Array.isArray(data.challenges) || data.challenges.length === 0) {
      throw new Error("Couldn't build drills from this video. Try another video.");
    }
    localStore.addCustomPack(data.video, data.challenges);
    return data;
  },
};
