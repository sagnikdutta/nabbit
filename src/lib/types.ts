export interface Video {
  id: string;
  title: string;
  channel: string;
  stack: 'react' | 'javascript' | 'backend' | 'typescript' | 'fullstack' | string;
  youtubeId: string;
  duration: string;
  conceptCount: number;
  description: string;
  thumbnailUrl: string;
  isUserCustom?: boolean;
}

// Phase 8 v1 — formats a drill can be played in. Additive: a drill is playable
// in format X only when its required field(s) are present on the Challenge.
export type ChallengeFormat =
  | 'spot-fix'          // current single-verb MCQ
  | 'locate-then-fix'   // v1: click the buggy line, then pick a fix
  | 'rank-fixes'        // v1 (deferred): rank the fixes worst → best
  | 'blind-fix'         // v2
  | 'diff-review'       // v3
  | 'impostor'          // v3 (Pro)
  | 'red-herring';      // v3 (Pro)

export interface Hunk {
  file: string;
  startLine: number;
  oldLines: string[];
  newLines: string[];
}

export interface Challenge {
  id: string;
  videoId: string;
  concept: string;
  chapter: string;
  timestampSeconds: number;
  timestampFormatted: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  buggyCode: string;
  buggyLines: number[]; // 1-indexed
  fixOptions: string[];
  correctOption: number; // 0-indexed
  explanation: string;
  correctCode: string;
  takeaway: string;
  filename?: string;
  fileType?: 'json' | 'terraform' | 'dockerfile' | 'typescript' | 'javascript' | 'python' | 'yaml';
  hints?: {
    conceptNudge: string;
    videoTimestampSeconds?: number;
    inspectionClue: string;
  };

  // Phase 8 v1 additions (optional — drill is only playable in a format when
  // the format's required field is present; purely-additive to keep every
  // existing drill working unchanged).
  buggyLineAnswer?: number;                  // locate-then-fix: canonical bug line (1-indexed; usually buggyLines[0])
  rankedFixes?: number[];                    // rank-fixes: indices of fixOptions, worst → best
  availableFormats?: ChallengeFormat[];      // author override; otherwise derived from field presence
  seedDistribution?: number[];               // Autopsy: pre-v2 placeholder; length === fixOptions.length

  // Reserved for v2/v3 (unused in v1a):
  canonicalPatch?: { oldLines: number[]; newText: string };
  diffHunks?: Hunk[];
  reviewVerdict?: 'approve' | 'request-changes' | 'comment';
  impostorOption?: string;
  secondFlaw?: { line: number; label: string };
}

// Phase 8 v1 — confidence multiplier picked at submit time.
// Affects SCORE ONLY — never Elo, never SRS (deliberate: keeps the learning signal honest).
export type Confidence = 'guess' | 'sure' | 'certain';

// Phase 8 v1 — one input per supported format. ChallengeScreen builds it from local state.
export type AttemptInput =
  | { format: 'spot-fix'; chosen: number }
  | { format: 'locate-then-fix'; line: number; chosen: number }
  | { format: 'rank-fixes'; order: number[] };

export interface ScoreBreakdown {
  basePoints: number;          // 100 full / 50 partial / -40 wrong
  confidenceMultiplier: number; // 1 / 1.5 / 2
  speedFactor: number;         // clamp(1 + (median - time) / median, 0.5, 2)
  comboMultiplier: number;     // min(1 + 0.1 * comboAfter, 2); 1 when wrong
  score: number;               // product, rounded
}

export interface Attempt {
  challengeId: string;
  chosen: number;              // for spot-fix / locate-then-fix: the chosen fix index; -1 for formats where it doesn't apply
  correct: boolean;            // full-correct only (partial counts as !correct for back-compat consumers)
  at: number;                  // timestamp ms
  // Phase 8 v1 additions — all optional for back-compat with pre-v1 persisted attempts.
  format?: ChallengeFormat;
  confidence?: Confidence;
  timeMs?: number;
  score?: number;
  comboAtTime?: number;        // post-attempt combo (what the reveal chip showed)
  outcome?: 0 | 0.5 | 1;       // SRS/Elo signal: 1 full, 0.5 partial, 0 wrong
  input?: AttemptInput;        // full input (e.g. line for locate-then-fix, order for rank-fixes)
}

export interface RecallItem {
  challengeId: string;
  concept: string;
  videoId: string;
  interval: 1 | 3 | 7 | 14 | 30; // days
  nextReviewAt: number; // timestamp ms
  lastReviewedAt: number; // timestamp ms
  streak: number;
  history: Attempt[];
}

export interface RecallStats {
  revisitRate: number; // 0 to 100
  currentStreak: number;
  totalSolved: number;
  dueCount: number;
  atRiskCount: number;
  masteredCount: number; // intervals >= 14
  simulatedOffsetDays: number;
}

export interface UserAccount {
  id: string;
  email: string;
  phoneNumber: string;
  phoneCountryCode: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: number;
  emailVerificationSentAt?: number;
  phoneVerificationSentAt?: number;
  provider?: 'supabase' | 'local' | 'demo';
  demoVerificationCodes?: {
    emailCode: string;
    phoneCode: string;
  };
}

export interface AuthResponse {
  user: UserAccount;
  token?: string;
  backgroundNotice: string;
}
