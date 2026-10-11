import type { User, Quest, Observation, Progress } from "./types";
export type LocalQuest = Quest & { dirty?: boolean };
export type LocalUser = User & { dirty?: boolean };
export type AppData = {
  token: string;
  user: LocalUser | null;
  quests: LocalQuest[];
  observations: Observation[];
  onboarded: boolean;
};
export const blank: AppData = {
  token: "",
  user: null,
  quests: [],
  observations: [],
  onboarded: false,
};
// Keep the original storage key so existing journals and sessions survive the rename.
export const storageKey = "grassquest-v1";
export function load(): AppData {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.quests) && Array.isArray(data.observations))
        return { ...blank, ...data };
    }
  } catch {}
  return { ...blank };
}
export function save(data: AppData) {
  localStorage.setItem(storageKey, JSON.stringify(data));
}
export const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
export async function api<T>(
  path: string,
  token = "",
  body?: unknown,
  method?: string,
): Promise<T> {
  const form = body instanceof FormData;
  const url = `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!form && body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? (form ? (body as FormData) : JSON.stringify(body)) : undefined,
    signal: AbortSignal.timeout(75000),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "The connection could not be completed" }));
    const msg = Array.isArray(error.message)
      ? error.message.join(". ")
      : error.message || "Please try again";
    throw new ApiError(msg, response.status);
  }
  return response.json() as Promise<T>;
}
export const progressPayload = (p: Progress) => ({
  status: p.status,
  completedSteps: p.completedSteps,
  bingo: p.bingo,
  screenSeconds: Math.floor(p.screenSeconds),
  elapsedSeconds: Math.floor(p.elapsedSeconds),
});
export async function observationForm(observation: Observation) {
  const form = new FormData();
  form.set("id", observation.id);
  form.set("note", observation.note);
  if (observation.thumbnail) {
    const blob = await fetch(observation.thumbnail).then((r) => r.blob());
    form.set("photo", blob, "observation.jpg");
  }
  return form;
}
export async function compressPhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG or WebP photo");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 5 MB");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not prepare this photo");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.7);
}
