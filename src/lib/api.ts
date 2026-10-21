import { Video, Challenge, Attempt, RecallItem, RecallStats } from './types';
import { CURATED_VIDEOS, CURATED_CHALLENGES } from '../content/data';
import { calculateRecallSchedule, computeStats, getInitialSeedRecall, getSimulatedNow } from './recall';

const LOCAL_STORAGE_KEY_ITEMS = 'nabbit_recall_items_v1';
const LOCAL_STORAGE_KEY_ATTEMPTS = 'nabbit_attempts_v1';
const LOCAL_STORAGE_KEY_OFFSET = 'nabbit_simulated_offset_v1';
const LOCAL_STORAGE_KEY_PROFILE = 'nabbit_profile_v1';

export interface Profile {
  name: string;
  onboarded: boolean;
}

class LocalStore {
  private items: RecallItem[] = [];
  private attempts: Attempt[] = [];
  private offsetDays: number = 0;
  private profile: Profile = { name: '', onboarded: false };

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
        const seed = getInitialSeedRecall();
        this.items = seed.items;
        this.attempts = seed.attempts;
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
    } catch {
      const seed = getInitialSeedRecall();
      this.items = seed.items;
      this.attempts = seed.attempts;
    }
  }

  private save() {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ITEMS, JSON.stringify(this.items));
      localStorage.setItem(LOCAL_STORAGE_KEY_ATTEMPTS, JSON.stringify(this.attempts));
      localStorage.setItem(LOCAL_STORAGE_KEY_OFFSET, this.offsetDays.toString());
      localStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify(this.profile));
    } catch {
      // storage unavailable or full
    }
  }

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
    return CURATED_VIDEOS;
  }

  public getChallenges(videoId?: string): Challenge[] {
    if (!videoId) return CURATED_CHALLENGES;
    return CURATED_CHALLENGES.filter(c => c.videoId === videoId);
  }

  public getChallenge(id: string): Challenge | undefined {
    return CURATED_CHALLENGES.find(c => c.id === id);
  }

  public getAttempts(): Attempt[] {
    return this.attempts;
  }

  public getRecallItems(): RecallItem[] {
    return this.items;
  }

  public recordAttempt(challengeId: string, chosen: number): {
    attempt: Attempt;
    correct: boolean;
    explanation: string;
    recallItem: RecallItem;
    stats: RecallStats;
  } {
    const challenge = this.getChallenge(challengeId);
    if (!challenge) {
      throw new Error(`Challenge not found: ${challengeId}`);
    }

    const correct = chosen === challenge.correctOption;
    const attempt: Attempt = {
      challengeId,
      chosen,
      correct,
      at: getSimulatedNow(this.offsetDays),
    };

    this.attempts.push(attempt);

    const existingIndex = this.items.findIndex(i => i.challengeId === challengeId);
    const existing = existingIndex >= 0 ? this.items[existingIndex] : undefined;

    const updatedRecall = calculateRecallSchedule(
      existing,
      challenge.id,
      challenge.concept,
      challenge.videoId,
      attempt,
      this.offsetDays
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
      correct,
      explanation: challenge.explanation,
      recallItem: updatedRecall,
      stats,
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
    const seed = getInitialSeedRecall();
    this.items = seed.items;
    this.attempts = seed.attempts;
    this.offsetDays = 0;
    this.save();
  }
}

export const localStore = new LocalStore();

/**
 * API client (B0): localStore is the single source of truth. The Express
 * server is optional and only serves the built SPA — no request-time backend
 * state, so there's nothing to diverge from or reset. Methods stay async so
 * callers don't change if a real backend is added behind this interface later.
 */
export const api = {
  async getVideos(): Promise<Video[]> {
    return localStore.getVideos();
  },

  async getVideoChallenges(videoId: string): Promise<Challenge[]> {
    return localStore.getChallenges(videoId);
  },

  async getChallenge(challengeId: string): Promise<Challenge | null> {
    return localStore.getChallenge(challengeId) || null;
  },

  async submitAttempt(challengeId: string, chosen: number) {
    return localStore.recordAttempt(challengeId, chosen);
  },

  async getRecallDashboard() {
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
};
