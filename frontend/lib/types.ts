export interface Place {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  source: 'serpapi' | 'manual';
}

export interface QuestConfig {
  minutes: number;
  mood: 'peaceful' | 'curious' | 'energized';
  location: string;
  mobility: 'standard' | 'step-free';
  company: 'solo' | 'together';
  place?: Place;
}

export interface QuestStep {
  title: string;
  instruction: string;
  minutes: number;
  phoneAway?: boolean;
}

export interface QuestPlan {
  title: string;
  description: string;
  steps: QuestStep[];
  bingo: string[];
}

export interface Progress {
  status: 'ready' | 'active' | 'completed';
  completedSteps: number[];
  bingo: number[];
  startedAt?: string;
  finishedAt?: string;
  screenSeconds: number;
  elapsedSeconds: number;
  revision: number;
}

export interface Quest extends QuestPlan {
  id: string;
  userId: string;
  config: QuestConfig;
  safety: string[];
  source: 'gemma' | 'custom';
  createdAt: string;
  progress: Progress;
}

export interface Insight {
  label: string;
  insight: string;
  curiosity: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface Observation {
  id: string;
  questId: string;
  note: string;
  insight: Insight;
  createdAt: string;
  source: 'gemma';
  thumbnail?: string;
  pending?: boolean;
}

export interface User {
  id: string;
  name: string;
  voice: boolean;
  reducedMotion: boolean;
  createdAt: string;
}
