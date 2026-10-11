import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  emptyProgress,
  safetyNotes,
  type User,
  type Quest,
  type Progress,
  type QuestConfig,
  type Observation,
} from "./shared";
import { STORE, type Store, type StoredUser } from "./store";
import { AI, VOICE, type NatureAI, type VoiceInstructions } from "./providers";
import { ConfigService } from "@nestjs/config";
import { ProgressDto, ObservationDto } from "./dto";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function publicUser(user: StoredUser): User {
  return {
    id: user.id,
    name: user.name,
    voice: user.voice,
    reducedMotion: user.reducedMotion,
    createdAt: user.createdAt,
  };
}
export function mergeProgress(
  current: Progress,
  patch: ProgressDto,
  steps: number,
  now = new Date(),
): Progress {
  if (patch.completedSteps.some((i) => i >= steps))
    throw new BadRequestException("Unknown quest step");
  if (patch.screenSeconds > patch.elapsedSeconds)
    throw new BadRequestException("Screen time cannot exceed elapsed time");
  if (current.status === "completed") return current;
  if (current.status === "ready" && patch.status === "completed")
    throw new BadRequestException("Start your quest before completing it");
  if (
    current.status === "ready" &&
    patch.status === "ready" &&
    (patch.completedSteps.length || patch.elapsedSeconds)
  )
    throw new BadRequestException("Start your quest before recording progress");
  const completedSteps = [
    ...new Set([...current.completedSteps, ...patch.completedSteps]),
  ].sort((a, b) => a - b);
  if (completedSteps.some((value, index) => value !== index))
    throw new BadRequestException("Complete steps in order");
  if (patch.status === "completed" && completedSteps.length !== steps)
    throw new BadRequestException("Complete every step before finishing");
  const status =
    current.status === "active" && patch.status === "ready"
      ? "active"
      : patch.status;
  const startedAt =
    current.startedAt || (status === "active" ? now.toISOString() : undefined);
  const elapsedSeconds = Math.max(current.elapsedSeconds, patch.elapsedSeconds);
  // Client timers are estimates; bound claims by the server's recorded start.
  const maximum = startedAt
    ? Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000) + 5
    : 0;
  if (elapsedSeconds > maximum)
    throw new BadRequestException("Elapsed time exceeds the quest session");
  return {
    status,
    completedSteps,
    bingo: [...new Set([...current.bingo, ...patch.bingo])].sort(
      (a, b) => a - b,
    ),
    startedAt,
    finishedAt: status === "completed" ? now.toISOString() : undefined,
    screenSeconds: Math.max(current.screenSeconds, patch.screenSeconds),
    elapsedSeconds,
    revision: current.revision + 1,
  };
}
export function validateImage(file?: Express.Multer.File) {
  if (!file) return undefined;
  const b = file.buffer;
  const jpeg = b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png =
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    b.length >= 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP";
  const mimeType = jpeg
    ? "image/jpeg"
    : png
      ? "image/png"
      : webp
        ? "image/webp"
        : null;
  if (!mimeType || mimeType !== file.mimetype)
    throw new BadRequestException("Use a valid JPEG, PNG or WebP image");
  return { mimeType, base64: b.toString("base64") };
}
@Injectable()
export class GrassQuestService {
  constructor(
    @Inject(STORE) private store: Store,
    @Inject(AI) private ai: NatureAI,
    @Inject(VOICE) private voice: VoiceInstructions,
    @Inject(ConfigService) private config: ConfigService,
  ) {}
  async session(name: string) {
    const token = randomBytes(32).toString("base64url");
    const user: StoredUser = {
      id: randomUUID(),
      name: name.trim() || "Explorer",
      voice: false,
      reducedMotion: false,
      createdAt: new Date().toISOString(),
      tokenHash: hashToken(token),
    };
    await this.store.createUser(user);
    return { user: publicUser(user), token };
  }
  async create(userId: string, config: QuestConfig) {
    const plan = await this.ai.generate(config);
    const quest: Quest = {
      ...plan,
      id: randomUUID(),
      userId,
      config,
      safety: safetyNotes,
      source: "gemma",
      createdAt: new Date().toISOString(),
      progress: emptyProgress(),
    };
    await this.store.saveQuest(quest);
    return quest;
  }
  async progress(userId: string, id: string, patch: ProgressDto) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const quest = await this.store.quest(id, userId),
        value = mergeProgress(quest.progress, patch, quest.steps.length);
      if (quest.progress.status === "completed") return quest.progress;
      try {
        return await this.store.progress(
          id,
          userId,
          value,
          quest.progress.revision,
        );
      } catch (error) {
        if (!(error instanceof ConflictException) || attempt === 2) throw error;
      }
    }
    throw new ConflictException("Progress changed; please retry");
  }
  async observe(
    userId: string,
    questId: string,
    dto: ObservationDto,
    file?: Express.Multer.File,
  ) {
    await this.store.quest(questId, userId);
    const existing = (await this.store.observations(questId, userId)).find(
      (o) => o.id === dto.id,
    );
    if (existing) return existing;
    if (!dto.note.trim() && !file)
      throw new BadRequestException("Add a photo or a short observation");
    const insight = await this.ai.observe(dto.note, validateImage(file));
    const observation: Observation = {
      id: dto.id,
      questId,
      note: dto.note,
      insight,
      createdAt: new Date().toISOString(),
      source: "gemma",
    };
    return this.store.addObservation(userId, observation);
  }
  async speak(userId: string, id: string, step: number) {
    const q = await this.store.quest(id, userId);
    if (!q.steps[step]) throw new BadRequestException("Unknown step");
    return this.voice.speak(
      `${q.steps[step].title}. ${q.steps[step].instruction}`,
    );
  }
}
