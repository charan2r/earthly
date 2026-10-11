import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import {
  UserSchema,
  QuestSchema,
  ProgressSchema,
  ObservationSchema,
} from "./schemas";
import type { User, Quest, Progress, Observation } from "./shared";
export type StoredUser = User & { tokenHash: string };
type UserRecord = Omit<StoredUser, "id"> & { _id: string };
type QuestRecord = Omit<Quest, "id" | "progress"> & { _id: string };
type ProgressRecord = Progress & { _id: string; userId: string };
type ObservationRecord = Omit<Observation, "id"> & {
  _id: string;
  userId: string;
};
export const STORE = Symbol("STORE");
export interface Store {
  createUser(user: StoredUser): Promise<void>;
  byToken(hash: string): Promise<StoredUser | null>;
  user(id: string): Promise<StoredUser>;
  updateUser(id: string, patch: Partial<User>): Promise<StoredUser>;
  saveQuest(quest: Quest): Promise<void>;
  quests(userId: string): Promise<Quest[]>;
  quest(id: string, userId: string): Promise<Quest>;
  progress(
    id: string,
    userId: string,
    value: Progress,
    revision: number,
  ): Promise<Progress>;
  addObservation(
    userId: string,
    observation: Observation,
  ): Promise<Observation>;
  observations(questId: string, userId: string): Promise<Observation[]>;
}
@Injectable()
export class MemoryStore implements Store {
  private users = new Map<string, StoredUser>();
  private plans = new Map<string, Quest>();
  private notes = new Map<string, Observation & { userId: string }>();
  async createUser(user: StoredUser) {
    this.users.set(user.id, structuredClone(user));
  }
  async byToken(hash: string) {
    return structuredClone(
      [...this.users.values()].find((u) => u.tokenHash === hash) || null,
    );
  }
  async user(id: string) {
    const user = this.users.get(id);
    if (!user) throw new NotFoundException("User not found");
    return structuredClone(user);
  }
  async updateUser(id: string, patch: Partial<User>) {
    const user = { ...(await this.user(id)), ...patch };
    this.users.set(id, user);
    return structuredClone(user);
  }
  async saveQuest(quest: Quest) {
    this.plans.set(quest.id, structuredClone(quest));
  }
  async quests(userId: string) {
    return structuredClone(
      [...this.plans.values()]
        .filter((q) => q.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }
  async quest(id: string, userId: string) {
    const q = this.plans.get(id);
    if (!q || q.userId !== userId)
      throw new NotFoundException("Quest not found");
    return structuredClone(q);
  }
  async progress(
    id: string,
    userId: string,
    value: Progress,
    revision: number,
  ) {
    const q = await this.quest(id, userId);
    if (q.progress.revision !== revision)
      throw new ConflictException("Progress changed; retry");
    q.progress = value;
    this.plans.set(id, q);
    return structuredClone(value);
  }
  async addObservation(userId: string, o: Observation) {
    const existing = this.notes.get(o.id);
    if (existing) {
      if (existing.userId !== userId || existing.questId !== o.questId)
        throw new ConflictException("Observation ID already used");
      return structuredClone(existing);
    }
    this.notes.set(o.id, { ...o, userId });
    return structuredClone(o);
  }
  async observations(questId: string, userId: string) {
    return structuredClone(
      [...this.notes.values()].filter(
        (o) => o.questId === questId && o.userId === userId,
      ),
    );
  }
}
@Injectable()
export class MongoStore implements Store {
  private u: Model<UserRecord>;
  private q: Model<QuestRecord>;
  private p: Model<ProgressRecord>;
  private o: Model<ObservationRecord>;
  constructor(@InjectConnection() connection: Connection) {
    this.u =
      (connection.models.User as Model<UserRecord>) ||
      connection.model<UserRecord>("User", UserSchema);
    this.q =
      (connection.models.Quest as Model<QuestRecord>) ||
      connection.model<QuestRecord>("Quest", QuestSchema);
    this.p =
      (connection.models.Progress as Model<ProgressRecord>) ||
      connection.model<ProgressRecord>("Progress", ProgressSchema);
    this.o =
      (connection.models.Observation as Model<ObservationRecord>) ||
      connection.model<ObservationRecord>("Observation", ObservationSchema);
  }
  private clean<T>(doc: any): T {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id } as T;
  }
  async createUser(user: StoredUser) {
    const { id, ...fields } = user;
    await this.u.create({ _id: id, ...fields });
  }
  async byToken(hash: string) {
    const u = await this.u.findOne({ tokenHash: hash }).lean();
    return u ? this.clean<StoredUser>(u) : null;
  }
  async user(id: string) {
    const u = await this.u.findById(id).lean();
    if (!u) throw new NotFoundException("User not found");
    return this.clean<StoredUser>(u);
  }
  async updateUser(id: string, patch: Partial<User>) {
    const u = await this.u
      .findByIdAndUpdate(
        id,
        { $set: patch },
        { new: true, runValidators: true },
      )
      .lean();
    if (!u) throw new NotFoundException("User not found");
    return this.clean<StoredUser>(u);
  }
  async saveQuest(quest: Quest) {
    const { id, progress, ...fields } = quest;
    await this.p.create({ _id: id, userId: quest.userId, ...progress });
    try {
      await this.q.create({ _id: id, ...fields });
    } catch (error) {
      await this.p.deleteOne({ _id: id });
      throw error;
    }
  }
  async quests(userId: string) {
    const docs = await this.q
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return Promise.all(docs.map((q) => this.quest(q._id, userId)));
  }
  async quest(id: string, userId: string) {
    const [q, p] = await Promise.all([
      this.q.findOne({ _id: id, userId }).lean(),
      this.p.findOne({ _id: id, userId }).lean(),
    ]);
    if (!q || !p) throw new NotFoundException("Quest not found");
    const { _id: ignored, userId: owner, ...progress } = p;
    return { ...this.clean<Quest>(q), progress: progress as Progress };
  }
  async progress(
    id: string,
    userId: string,
    value: Progress,
    revision: number,
  ) {
    const p = await this.p
      .findOneAndUpdate(
        { _id: id, userId, revision },
        { $set: value },
        { new: true, runValidators: true },
      )
      .lean();
    if (!p) throw new ConflictException("Progress changed; retry");
    const { _id: ignored, userId: owner, ...result } = p;
    return result as Progress;
  }
  async addObservation(userId: string, o: Observation) {
    const { id, ...fields } = o;
    try {
      await this.o.updateOne(
        { _id: id, userId, questId: o.questId },
        { $setOnInsert: { ...fields, userId } },
        { upsert: true, runValidators: true },
      );
    } catch (error: any) {
      if (error.code === 11000)
        throw new ConflictException("Observation ID already used");
      throw error;
    }
    return this.clean<Observation>(await this.o.findById(id).lean());
  }
  async observations(questId: string, userId: string) {
    return (
      await this.o.find({ questId, userId }).sort({ createdAt: 1 }).lean()
    ).map((o) => this.clean<Observation>(o));
  }
}
