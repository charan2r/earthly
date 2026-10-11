import { z } from 'zod';

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

export const questStepSchema = z.object({
  title: z.string().min(1),
  instruction: z.string().min(1),
  minutes: z.number().int().positive(),
  phoneAway: z.boolean().optional(),
});

export const questPlanSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  steps: z.array(questStepSchema).min(3).max(8),
  bingo: z
    .array(z.string().min(1))
    .length(9)
    .refine((items) => new Set(items).size === 9, {
      message: 'Bingo items must be 9 unique items',
    }),
});

export const observationInsightSchema = z.object({
  label: z.string().min(1),
  insight: z.string().min(1),
  curiosity: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
});

export function emptyProgress(): Progress {
  return {
    status: 'ready',
    completedSteps: [],
    bingo: [],
    screenSeconds: 0,
    elapsedSeconds: 0,
    revision: 0,
  };
}

export const safetyNotes: string[] = [
  'Stay on public, marked paths at all times.',
  'Check weather, daylight, and surroundings before starting.',
  'Observe nature from a safe distance without disturbing plants or wildlife.',
  'Never consume wild plants, berries, or fungi.',
  'Keep your device charged and remain aware of your surroundings.',
];
