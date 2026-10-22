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
}

export interface Attempt {
  challengeId: string;
  chosen: number;
  correct: boolean;
  at: number; // timestamp ms
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
