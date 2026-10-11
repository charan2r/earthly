"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  Leaf,
  Compass,
  BookOpen,
  Settings,
  MapPin,
  Clock3,
  Sun,
  Sparkles,
  Footprints,
  Wind,
  Check,
  CheckCheck,
  Camera,
  Volume2,
  Smartphone,
  Trees,
  X,
  WifiOff,
  Download,
  CircleHelp,
  Heart,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  Grid2X2,
  Loader2,
} from "lucide-react";
import type {
  Quest,
  QuestConfig,
  Place,
  Progress,
  Observation,
  User,
} from "../lib/types";
import {
  api,
  blank,
  load,
  save,
  progressPayload,
  observationForm,
  compressPhoto,
  type AppData,
  type LocalQuest,
} from "../lib/api";
import Landscape from "./landscape";

type Screen =
  | "home"
  | "configure"
  | "preview"
  | "field"
  | "observe"
  | "bingo"
  | "recap"
  | "journal"
  | "settings"
  | "explore";
type Health = { status: string; database: string; ai: boolean; voice: boolean; discovery: boolean };
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const defaults: QuestConfig = {
  minutes: 30,
  mood: "peaceful",
  location: "My neighborhood",
  mobility: "standard",
  company: "solo",
};
const fmt = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const minutes = (seconds: number) => Math.round(seconds / 60);
const pendingInsight = {
  label: "A moment saved for later",
  insight:
    "Your observation is saved on this device. When you reconnect, Earthly will ask Gemma for a little more context.",
  curiosity: "What caught your eye?",
  confidence: "low" as const,
};

export default function Earthly() {
  const [data, setData] = useState<AppData>(blank),
    [hydrated, setHydrated] = useState(false),
    [screen, setScreen] = useState<Screen>("home");
  const [selected, setSelected] = useState(""),
    [config, setConfig] = useState<QuestConfig>(defaults),
    [name, setName] = useState("Explorer");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [online, setOnline] = useState(true),
    [health, setHealth] = useState<Health | null>(null);
  const [places, setPlaces] = useState<Place[]>([]),
    [discovered, setDiscovered] = useState(false),
    [note, setNote] = useState(""),
    [photo, setPhoto] = useState(""),
    [consent, setConsent] = useState(false),
    [lastObservation, setLastObservation] = useState<Observation | null>(null);
  const [resting, setResting] = useState(false),
    [install, setInstall] = useState<InstallEvent | null>(null),
    [syncing, setSyncing] = useState(false);
  const latest = useRef(data),
    sessionRequest = useRef<Promise<{ token: string; user: User }> | null>(null),
    syncLock = useRef(false),
    audioRef = useRef<HTMLAudioElement | null>(null),
    audioUrl = useRef("");
  latest.current = data;
  const quest = data.quests.find((q) => q.id === selected);
  const active = data.quests.find((q) => q.progress.status === "active");
  const completed = data.quests.filter(
    (q) => q.progress.status === "completed",
  );
  const pending =
    data.quests.filter((q) => q.dirty).length +
    data.observations.filter((o) => o.pending).length +
    (data.user?.dirty ? 1 : 0);
  const go = (next: Screen) => {
    audioRef.current?.pause();
    setResting(false);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const open = (q: Quest) => {
    setSelected(q.id);
    go(
      q.progress.status === "completed"
        ? "recap"
        : q.progress.status === "active"
          ? "field"
          : "preview",
    );
  };
  const updateQuest = (id: string, update: (q: LocalQuest) => LocalQuest) =>
    setData((d) => ({
      ...d,
      quests: d.quests.map((q) => (q.id === id ? update(q) : q)),
    }));
  const perform = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Please try again");
    } finally {
      setBusy(false);
    }
  };
  const startSetup = () => {
    if (active) {
      open(active);
      return;
    }
    go("configure");
  };

  useEffect(() => {
    const stored = load();
    setData(stored);
    if (stored.user) setName(stored.user.name);
    setHydrated(true);
    setOnline(navigator.onLine);
    api<Health>("/health")
      .then(setHealth)
      .catch(() => {});
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", prompt);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", prompt);
      audioRef.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    };
  }, []);
  useEffect(() => {
    if (hydrated) {
      try {
        save(data);
      } catch {
        setNotice(
          "Device storage is full. Export your journal and remove old data in settings. Keep this tab open until progress syncs.",
        );
      }
    }
  }, [data, hydrated]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 9000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setInterval(
      () =>
        setData((current) => {
          if (!current.quests.some((q) => q.progress.status === "active"))
            return current;
          return {
            ...current,
            quests: current.quests.map((q) => {
              if (q.progress.status !== "active") return q;
              const elapsed = Math.min(
                86400,
                Math.max(
                  q.progress.elapsedSeconds,
                  Math.floor(
                    (Date.now() - Date.parse(q.progress.startedAt!)) / 1000,
                  ),
                ),
              );
              return {
                ...q,
                dirty: true,
                progress: {
                  ...q.progress,
                  elapsedSeconds: elapsed,
                  screenSeconds: Math.min(
                    elapsed,
                    q.progress.screenSeconds +
                      (document.visibilityState === "visible" ? 1 : 0),
                  ),
                },
              };
            }),
          };
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [hydrated]);

  const sync = useCallback(async () => {
    if (syncLock.current || !navigator.onLine || !latest.current.token) return;
    const snapshot = latest.current;
    if (
      !snapshot.quests.some((q) => q.dirty) &&
      !snapshot.observations.some((o) => o.pending) &&
      !snapshot.user?.dirty
    )
      return;
    syncLock.current = true;
    setSyncing(true);
    try {
      if (snapshot.user?.dirty) {
        const user = await api<User>(
          "/users/me",
          snapshot.token,
          {
            name: snapshot.user.name,
            voice: snapshot.user.voice,
            reducedMotion: snapshot.user.reducedMotion,
          },
          "PATCH",
        );
        setData((d) =>
          d.user &&
          d.user.name === snapshot.user?.name &&
          d.user.voice === snapshot.user.voice &&
          d.user.reducedMotion === snapshot.user.reducedMotion
            ? { ...d, user }
            : d,
        );
      }
      for (const q of snapshot.quests.filter((q) => q.dirty)) {
        const p = await api<Progress>(
          `/quests/${q.id}/progress`,
          snapshot.token,
          progressPayload(q.progress),
          "PATCH",
        );
        setData((d) => ({
          ...d,
          quests: d.quests.map((current) =>
            current.id === q.id
              ? JSON.stringify(progressPayload(current.progress)) ===
                JSON.stringify(progressPayload(q.progress))
                ? { ...current, dirty: false, progress: p }
                : {
                    ...current,
                    progress: { ...current.progress, revision: p.revision },
                  }
              : current,
          ),
        }));
      }
      for (const o of snapshot.observations.filter((o) => o.pending)) {
        const saved = await api<Observation>(
          `/quests/${o.questId}/observations`,
          snapshot.token,
          await observationForm(o),
        );
        setData((d) => ({
          ...d,
          observations: d.observations.map((current) =>
            current.id === o.id
              ? { ...saved, thumbnail: current.thumbnail, pending: false }
              : current,
          ),
        }));
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Sync paused: ${error.message}`
          : "Your progress is still saved on this device.",
      );
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
  }, []);
  useEffect(() => {
    if (!hydrated || !online) return;
    void sync();
    const timer = setInterval(() => void sync(), 15000);
    return () => clearInterval(timer);
  }, [hydrated, online, sync]);

  async function ensureSession() {
    if (latest.current.token) return latest.current.token;
    if (!sessionRequest.current) {
      sessionRequest.current = api<{ token: string; user: User }>(
        "/users/session",
        "",
        { name: "Explorer" },
      );
    }
    try {
      const session = await sessionRequest.current;
      latest.current = { ...latest.current, ...session, onboarded: true };
      setData((d) => ({ ...d, ...session, onboarded: true }));
      return session.token;
    } finally {
      sessionRequest.current = null;
    }
  }
  async function generate() {
    await perform(async () => {
      if (!config.location.trim())
        throw new Error("Enter an area or a familiar public place");
      const token = await ensureSession();
      const q = await api<Quest>("/quests", token, config);
      setData((d) => ({ ...d, quests: [q, ...d.quests] }));
      setSelected(q.id);
      go("preview");
    });
  }
  async function discover() {
    setDiscovered(false);
    await perform(async () => {
      const token = await ensureSession();
      const result = await api<Place[]>("/places/discover", token, {
        location: config.location,
      });
      setPlaces(result);
      setDiscovered(true);
    });
  }
  async function startQuest() {
    if (!quest) return;
    await perform(async () => {
      const p = await api<Progress>(
        `/quests/${quest.id}/progress`,
        data.token,
        progressPayload({ ...quest.progress, status: "active" }),
        "PATCH",
      );
      updateQuest(quest.id, (q) => ({ ...q, progress: p }));
      go("field");
    });
  }
  function finishStep() {
    if (!quest) return;
    const index = quest.progress.completedSteps.length;
    const steps = [...quest.progress.completedSteps, index];
    const finished = steps.length === quest.steps.length;
    updateQuest(quest.id, (q) => ({
      ...q,
      dirty: true,
      progress: {
        ...q.progress,
        completedSteps: steps,
        status: finished ? "completed" : "active",
        finishedAt: finished ? new Date().toISOString() : undefined,
      },
    }));
    if (finished) go("recap");
  }
  async function voice() {
    if (!quest) return;
    await perform(async () => {
      const r = await fetch(`/api/v1/quests/${quest.id}/voice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({ step: quest.progress.completedSteps.length }),
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message);
      }
      audioRef.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = URL.createObjectURL(await r.blob());
      audioRef.current = new Audio(audioUrl.current);
      await audioRef.current.play();
    });
  }
  async function observe() {
    if (!quest) return;
    await perform(async () => {
      if (!note.trim() && !photo)
        throw new Error("Add a photo or a short note");
      if (photo && !consent)
        throw new Error("Confirm photo sharing before saving");
      const o: Observation = {
        id: crypto.randomUUID(),
        questId: quest.id,
        note,
        thumbnail: photo || undefined,
        insight: pendingInsight,
        source: "gemma",
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setData((d) => ({ ...d, observations: [o, ...d.observations] }));
      let result = o;
      if (navigator.onLine) {
        try {
          const saved = await api<Observation>(
            `/quests/${quest.id}/observations`,
            data.token,
            await observationForm(o),
          );
          result = { ...saved, thumbnail: o.thumbnail, pending: false };
          setData((d) => ({
            ...d,
            observations: d.observations.map((item) =>
              item.id === o.id ? result : item,
            ),
          }));
        } catch (error) {
          setNotice(
            `Saved on device. ${error instanceof Error ? error.message : "Will retry when connected."}`,
          );
        }
      }
      setLastObservation(result);
      setNote("");
      setPhoto("");
      setConsent(false);
    });
  }
  const reduce = data.user?.reducedMotion;
  const nav = [
    { screen: "home" as const, label: "Home", icon: Leaf },
    { screen: "explore" as const, label: "Explore", icon: Compass },
    { screen: "journal" as const, label: "My journal", icon: BookOpen },
    { screen: "settings" as const, label: "Settings", icon: Settings },
  ];
  const mode =
    !health
      ? "Checking connection"
      : health.ai
        ? "Powered by Gemma AI"
        : "Connected · Add GEMMA_API_KEY for AI quests";
  const outside = completed.reduce(
    (sum, q) =>
      sum + Math.max(0, q.progress.elapsedSeconds - q.progress.screenSeconds),
    0,
  );

  return (
    <div className={`app ${reduce ? "reduce-motion" : ""}`}>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => go("home")}
          aria-label="Earthly home"
        >
          <span className="brand-icon">
            <Leaf size={23} />
          </span>
          Earthly<span className="brand-dot">.</span>
        </button>
        <div className="sidebar-caption">A little more out there.</div>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.screen}
              onClick={() => go(item.screen)}
              className={`nav-item ${screen === item.screen ? "selected" : ""}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {screen === item.screen && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="small-leaf">
            <Trees size={28} />
          </div>
          <strong>
            The best part is
            <br />
            off the screen.
          </strong>
          <p>We’ll help you get there.</p>
          <button onClick={startSetup}>
            Find my next adventure <ArrowRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className={`status-dot ${online ? "" : "offline"}`} />
          {online ? mode : "Offline · progress saved"}
          <span className="version">v1.0</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => go("home")}>
            <Leaf size={22} />
            Earthly.
          </button>
          <div className="breadcrumb">
            <span>Your daily dose of outside</span>
            <span className="separator">/</span>
            <strong>
              {screen === "home"
                ? "Welcome back"
                : screen === "field"
                  ? "Out in the world"
                  : screen === "configure"
                    ? "Make it yours"
                    : screen === "journal"
                      ? "My journal"
                      : screen === "settings"
                        ? "Settings"
                        : "A little adventure"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="connection">
              <span className={`status-dot ${online ? "" : "offline"}`} />
              {online ? "Ready to roam" : "Offline"}
            </span>
            <button
              className="avatar"
              aria-label="Open settings"
              onClick={() => go("settings")}
            >
              {(data.user?.name || "Explorer").slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        {!online && (
          <div className="offline-banner">
            <WifiOff size={16} />
            Your saved quest works offline. New adventures and AI need a
            connection.
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <CircleHelp size={19} />
            <span>{notice}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              <X size={17} />
            </button>
          </div>
        )}
        <main className={screen === "field" ? "main field-main" : "main"}>
          {screen === "home" && (
            <>
              <div className="page-intro">
                <div>
                  <div className="eyebrow">
                    <Sun size={16} /> A SMALL ADVENTURE IS WAITING
                  </div>
                  <h1>
                    Less screen.
                    <br className="mobile-break" /> <em>More green.</em>
                  </h1>
                  <p>
                    You don’t need a big plan. Just a little curiosity and a way
                    outside.
                  </p>
                </div>
                <span className="intro-doodle">
                  <Wind size={44} />
                </span>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="light-chip">
                    <Sparkles size={14} /> Made for your kind of day
                  </span>
                  <h2>
                    Your next adventure
                    <br />
                    is closer than you think.
                  </h2>
                  <p>
                    A small, personal quest that turns an ordinary walk into
                    something worth remembering.
                  </p>
                  <button className="button cream" onClick={startSetup}>
                    {active ? "Continue my quest" : "Let’s get outside"}
                    <ArrowRight size={18} />
                  </button>
                  <span className="hero-foot">
                    <Clock3 size={14} /> No login needed. Explore at your pace.
                  </span>
                </div>
                <div className="hero-art">
                  <Landscape />
                  <div className="art-label">
                    <MapPin size={14} /> A little wonder, somewhere nearby
                  </div>
                </div>
              </section>
              {active && (
                <button className="resume-card" onClick={() => open(active)}>
                  <div className="resume-icon">
                    <Footprints />
                  </div>
                  <div>
                    <strong>Your adventure is still out there</strong>
                    <span>
                      {active.title} · {active.progress.completedSteps.length}{" "}
                      of {active.steps.length} moments completed
                    </span>
                  </div>
                  <ArrowRight />
                </button>
              )}
              <div className="section-heading">
                <div>
                  <h2>What kind of outside are you feeling?</h2>
                  <p>No wrong answers. Start where you are.</p>
                </div>
                <span className="tiny-label">A LITTLE INSPIRATION</span>
              </div>
              <div className="adventure-grid">
                {[
                  {
                    mood: "peaceful",
                    title: "A moment of calm",
                    text: "Slow steps. Deep breaths. Room to just be.",
                    icon: Wind,
                    variant: "water",
                    duration: 20,
                  },
                  {
                    mood: "curious",
                    title: "Follow your curiosity",
                    text: "Look a little closer at the world around you.",
                    icon: Sparkles,
                    variant: "forest",
                    duration: 30,
                  },
                  {
                    mood: "energized",
                    title: "Find your fresh air",
                    text: "Stretch your legs. Give your mind some space.",
                    icon: Sun,
                    variant: "meadow",
                    duration: 45,
                  },
                ].map((item) => (
                  <button
                    className="adventure-card"
                    key={item.mood}
                    onClick={() => {
                      setConfig((c) => ({
                        ...c,
                        mood: item.mood as QuestConfig["mood"],
                        minutes: item.duration,
                      }));
                      startSetup();
                    }}
                  >
                    <div className="card-art">
                      <Landscape
                        variant={item.variant as "forest" | "water" | "meadow"}
                      />
                      <span className="duration">
                        <Clock3 size={12} />
                        {item.duration} min
                      </span>
                    </div>
                    <div className="card-copy">
                      <div className="card-title">
                        <h3>{item.title}</h3>
                        <ArrowUpRight size={19} />
                      </div>
                      <p>{item.text}</p>
                      <span className="card-category">
                        <item.icon size={13} />
                        {item.mood === "peaceful"
                          ? "SLOW & MINDFUL"
                          : item.mood === "curious"
                            ? "NOTICE & DISCOVER"
                            : "MOVE & RECHARGE"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <section className="impact-strip">
                <div className="impact-copy">
                  <div className="round-icon">
                    <Leaf size={22} />
                  </div>
                  <div>
                    <h3>Little adventures. A little more alive.</h3>
                    <p>
                      {completed.length
                        ? "Your small moments outside are adding up."
                        : "Your first chapter starts with a step outside."}
                    </p>
                  </div>
                </div>
                <div className="impact-stat">
                  <strong>
                    {minutes(outside)}
                    <small> min</small>
                  </strong>
                  <span>estimated away from screen</span>
                </div>
                <div className="impact-stat">
                  <strong>{completed.length}</strong>
                  <span>adventures completed</span>
                </div>
              </section>
              <div className="footer-note">
                <Leaf size={13} />
                <span>Open-weight AI. Real-world wonder.</span>
                <span className="footer-right">
                  Less scrolling, more strolling.
                </span>
              </div>
            </>
          )}

          {screen === "configure" && (
            <div className="narrow">
              <button className="back" onClick={() => go("home")}>
                <ArrowLeft size={16} />
                Back home
              </button>
              <div className="eyebrow">MAKE A LITTLE ROOM FOR OUTSIDE</div>
              <h1>
                Your time. <em>Your trail.</em>
              </h1>
              <p className="lead">
                A few small choices. No login needed. We’ll take it from here.
              </p>
              <form
                className="config-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void generate();
                }}
              >
                <fieldset>
                  <legend>How much time do you have?</legend>
                  <div className="choice-row">
                    {[15, 30, 45, 60].map((n) => (
                      <button
                        type="button"
                        key={n}
                        className={`choice ${config.minutes === n ? "chosen" : ""}`}
                        onClick={() => setConfig((c) => ({ ...c, minutes: n }))}
                      >
                        <Clock3 size={17} />
                        {n}
                        <small>minutes</small>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>What do you need today?</legend>
                  <div className="choice-row">
                    {[
                      {
                        value: "peaceful",
                        label: "A little peace",
                        icon: Wind,
                      },
                      {
                        value: "curious",
                        label: "Something new",
                        icon: Sparkles,
                      },
                      { value: "energized", label: "Fresh energy", icon: Sun },
                    ].map((m) => (
                      <button
                        type="button"
                        className={`choice mood-choice ${config.mood === m.value ? "chosen" : ""}`}
                        key={m.value}
                        onClick={() =>
                          setConfig((c) => ({
                            ...c,
                            mood: m.value as QuestConfig["mood"],
                          }))
                        }
                      >
                        <m.icon size={21} />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label className="field-label" htmlFor="location">
                    Where will you explore?
                  </label>
                  <div className="input-icon">
                    <MapPin size={18} />
                    <input
                      id="location"
                      value={config.location}
                      maxLength={120}
                      minLength={2}
                      required
                      onChange={(e) => {
                        setConfig((c) => ({
                          ...c,
                          location: e.target.value,
                          place: undefined,
                        }));
                        setPlaces([]);
                        setDiscovered(false);
                      }}
                      placeholder="Your city, area, or a familiar public park"
                    />
                  </div>
                  <button
                    type="button"
                    className="text-button discovery"
                    disabled={busy || !online}
                    onClick={() => void discover()}
                  >
                    <Compass size={15} />
                    Find public places nearby
                    <ArrowUpRight size={14} />
                  </button>
                  {places.length > 0 && (
                    <div className="places-list">
                      {places.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          className={`place-item ${config.place?.id === p.id ? "chosen" : ""}`}
                          onClick={() => setConfig((c) => ({ ...c, place: p }))}
                        >
                          <MapPin size={17} />
                          <span>
                            <strong>{p.name}</strong>
                            <small>{p.address}</small>
                          </span>
                          {config.place?.id === p.id && <Check size={17} />}
                        </button>
                      ))}
                    </div>
                  )}
                  {discovered && !places.length && (
                    <p className="micro">
                      No places found. You can still use a familiar public green
                      space.
                    </p>
                  )}
                </div>
                <div className="form-two">
                  <div>
                    <label className="field-label" htmlFor="mobility">
                      Your pace & access
                    </label>
                    <select
                      id="mobility"
                      value={config.mobility}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          mobility: e.target.value as QuestConfig["mobility"],
                        }))
                      }
                    >
                      <option value="standard">An easy walk</option>
                      <option value="step-free">
                        Prefer level, step-free paths
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="company">
                      Who's coming?
                    </label>
                    <select
                      id="company"
                      value={config.company}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          company: e.target.value as QuestConfig["company"],
                        }))
                      }
                    >
                      <option value="solo">Just me</option>
                      <option value="together">With someone</option>
                    </select>
                  </div>
                </div>
                <div className="gentle-note">
                  <Leaf size={19} />
                  <p>
                    Free, gentle adventures on familiar public paths. Check
                    local access, daylight and weather before heading out.
                  </p>
                </div>
                <button
                  className="button primary wide"
                  disabled={busy || !online}
                >
                  {busy ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      Finding your little adventure…
                    </>
                  ) : (
                    <>
                      Make my quest
                      <Sparkles size={18} />
                    </>
                  )}
                </button>
                <p className="micro">
                  {health?.ai
                    ? "Gemma makes the plan. You make the memories."
                    : "Add GEMMA_API_KEY to your backend .env to enable AI-generated quests."}
                </p>
              </form>
            </div>
          )}

          {screen === "preview" && quest && (
            <div className="narrow">
              <button className="back" onClick={() => go("configure")}>
                <ArrowLeft size={16} />
                Adjust my adventure
              </button>
              <div className="quest-cover">
                <Landscape />
                <span className="cover-chip">
                  <Sparkles size={14} />
                  Created with Gemma
                </span>
              </div>
              <div className="eyebrow">YOUR LITTLE ADVENTURE</div>
              <h1>{quest.title}</h1>
              <p className="lead">{quest.description}</p>
              <div className="quest-meta">
                <span>
                  <Clock3 size={16} />
                  {quest.config.minutes} minutes
                </span>
                <span>
                  <Footprints size={16} />
                  {quest.config.mobility === "step-free"
                    ? "Level paths preferred"
                    : "An easy pace"}
                </span>
                <span>
                  <MapPin size={16} />
                  {quest.config.place?.name || quest.config.location}
                </span>
              </div>
              <div className="timeline">
                {quest.steps.map((s, i) => (
                  <div key={i} className="timeline-step">
                    <span className="step-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>{s.instruction}</p>
                    </div>
                    <span className="step-minutes">{s.minutes} min</span>
                  </div>
                ))}
              </div>
              <div className="safety-panel">
                <ShieldCheck size={22} />
                <div>
                  <h3>A little care goes a long way</h3>
                  {quest.safety.map((s) => (
                    <p key={s}>{s}</p>
                  ))}
                  <p>
                    Place discovery does not verify route conditions or
                    step-free access.
                  </p>
                </div>
              </div>
              <button
                className="button primary wide"
                onClick={() => void startQuest()}
                disabled={busy || !online}
              >
                {busy ? (
                  <Loader2 className="spin" size={18} />
                ) : (
                  <>
                    I’m ready. Let’s go
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              <p className="micro">
                Start while connected. Your quest and progress stay available
                when you lose signal.
              </p>
            </div>
          )}

          {screen === "field" &&
            quest &&
            (() => {
              const step = quest.steps[quest.progress.completedSteps.length];
              if (!step) return null;
              return (
                <div className="field-container">
                  <div className="field-top">
                    <button className="back" onClick={() => go("home")}>
                      <ArrowLeft size={16} />
                      My quest
                    </button>
                    <span className="field-live">
                      <span className="status-dot" />
                      OUT IN THE WORLD
                    </span>
                    <span className="field-clock">
                      <Clock3 size={15} />
                      {fmt(quest.progress.elapsedSeconds)}
                    </span>
                  </div>
                  <div
                    className="progress-dashes"
                    aria-label={`${quest.progress.completedSteps.length} of ${quest.steps.length} completed`}
                  >
                    {quest.steps.map((_, i) => (
                      <span
                        key={i}
                        className={
                          i < quest.progress.completedSteps.length
                            ? "done"
                            : i === quest.progress.completedSteps.length
                              ? "current"
                              : ""
                        }
                      />
                    ))}
                  </div>
                  <div className="field-step">
                    <span className="eyebrow">
                      MOMENT {quest.progress.completedSteps.length + 1} OF{" "}
                      {quest.steps.length} · ABOUT {step.minutes} MINUTES
                    </span>
                    <div className="field-emblem">
                      <Leaf size={39} />
                    </div>
                    <h1>{step.title}</h1>
                    <p>{step.instruction}</p>
                    <div className="phone-away">
                      <Smartphone size={17} />
                      {step.phoneAway
                        ? "Now let your phone rest. This moment is yours."
                        : "One quick note or photo, if it catches your eye."}
                    </div>
                    <button className="button primary" onClick={finishStep}>
                      {quest.progress.completedSteps.length ===
                      quest.steps.length - 1
                        ? "Finish my adventure"
                        : "I’m ready for the next moment"}
                      <Check size={18} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setResting(true)}
                    >
                      <Smartphone size={15} />
                      Put my phone away
                    </button>
                  </div>
                  <div className="field-tools">
                    <button
                      onClick={() => {
                        setLastObservation(null);
                        go("observe");
                      }}
                    >
                      <Camera size={21} />
                      Notice something
                    </button>
                    <button onClick={() => go("bingo")}>
                      <Grid2X2 size={21} />
                      Nature bingo
                    </button>
                    {data.user?.voice && (
                      <button
                        disabled={busy || !online}
                        onClick={() => void voice()}
                      >
                        <Volume2 size={21} />
                        {busy ? "Loading voice…" : "Listen to this step"}
                      </button>
                    )}
                  </div>
                  <p className="micro">
                    Stay aware of your surroundings. You can always turn back.
                  </p>
                </div>
              );
            })()}

          {screen === "observe" && quest && (
            <div className="narrow">
              <button
                className="back"
                onClick={() =>
                  go(quest.progress.status === "completed" ? "recap" : "field")
                }
              >
                <ArrowLeft size={16} />
                Back to my quest
              </button>
              {lastObservation ? (
                <>
                  <div className="eyebrow">YOUR TINY WONDER</div>
                  <h1>{lastObservation.insight.label}</h1>
                  {lastObservation.thumbnail && (
                    <img
                      className="observation-image"
                      src={lastObservation.thumbnail}
                      alt="Your nature observation"
                    />
                  )}
                  <div className="insight-panel">
                    <span className="source-tag">
                      {lastObservation.pending
                        ? "SAVED ON DEVICE"
                        : "GEMMA · TENTATIVE OBSERVATION"}
                    </span>
                    <p>{lastObservation.insight.insight}</p>
                    <div className="curiosity">
                      <Sparkles size={20} />
                      {lastObservation.insight.curiosity}
                    </div>
                  </div>
                  <p className="micro">
                    A nature prompt, not a reliable species identification.
                    Leave it as you found it.
                  </p>
                  <button
                    className="button primary wide"
                    onClick={() =>
                      go(
                        quest.progress.status === "completed"
                          ? "recap"
                          : "field",
                      )
                    }
                  >
                    Back to the world
                    <ArrowRight size={18} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setLastObservation(null)}
                  >
                    Notice something else
                  </button>
                </>
              ) : (
                <>
                  <div className="eyebrow">STOP. LOOK. A LITTLE CLOSER.</div>
                  <h1>
                    What caught <em>your eye?</em>
                  </h1>
                  <p className="lead">
                    A leaf, a shadow, a tiny unexpected thing. Keep a moment of
                    it.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void observe();
                    }}
                  >
                    <label className="photo-drop">
                      {photo ? (
                        <img src={photo} alt="Photo ready to share" />
                      ) : (
                        <>
                          <Camera size={34} />
                          <strong>Capture a little wonder</strong>
                          <span>
                            Take a photo or choose one · JPEG, PNG, WebP · max 5
                            MB
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        aria-label="Choose observation photo"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            void perform(async () => {
                              setPhoto(await compressPhoto(file));
                              setConsent(false);
                            });
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {photo && (
                      <>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            setPhoto("");
                            setConsent(false);
                          }}
                        >
                          <X size={14} />
                          Remove photo
                        </button>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                          />
                          I agree to send this resized photo to hosted Gemma
                          when connected. A copy stays on this device.
                        </label>
                      </>
                    )}
                    <label className="field-label" htmlFor="note">
                      A small note {photo ? "(optional)" : ""}
                    </label>
                    <textarea
                      id="note"
                      maxLength={600}
                      rows={4}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What did you notice? Colors, shapes, sounds…"
                    />
                    <button
                      className="button primary wide"
                      disabled={
                        busy ||
                        (!note.trim() && !photo) ||
                        !!(photo && !consent)
                      }
                    >
                      {busy ? (
                        <>
                          <Loader2 className="spin" size={18} />
                          Saving your moment…
                        </>
                      ) : (
                        <>
                          {online
                            ? "Save & explore with Gemma"
                            : "Save for when I reconnect"}
                          <Sparkles size={18} />
                        </>
                      )}
                    </button>
                    <p className="micro">
                      Gemma may be uncertain. Observe from a distance and leave nature untouched.
                    </p>
                  </form>
                </>
              )}
            </div>
          )}

          {screen === "bingo" && quest && (
            <div className="narrow bingo-page">
              <button
                className="back"
                onClick={() =>
                  go(quest.progress.status === "completed" ? "recap" : "field")
                }
              >
                <ArrowLeft size={16} />
                Back to my quest
              </button>
              <div className="eyebrow">NINE LITTLE REASONS TO LOOK UP</div>
              <h1>
                Nature <em>bingo.</em>
              </h1>
              <p className="lead">
                No collecting. No rushing. Just tap the little things you
                notice.
              </p>
              <div className="bingo-grid">
                {quest.bingo.map((item, i) => (
                  <button
                    key={item}
                    disabled={quest.progress.status === "completed"}
                    className={quest.progress.bingo.includes(i) ? "found" : ""}
                    aria-pressed={quest.progress.bingo.includes(i)}
                    onClick={() =>
                      updateQuest(quest.id, (q) => ({
                        ...q,
                        dirty: true,
                        progress: {
                          ...q.progress,
                          bingo: q.progress.bingo.includes(i)
                            ? q.progress.bingo
                            : [...q.progress.bingo, i],
                        },
                      }))
                    }
                  >
                    {quest.progress.bingo.includes(i) ? (
                      <Check size={24} />
                    ) : (
                      <Leaf size={23} />
                    )}
                    <span>{item}</span>
                  </button>
                ))}
              </div>
              <div className="bingo-score">
                <strong>
                  {quest.progress.bingo.length}
                  <span> / 9</span>
                </strong>
                <p>little wonders noticed</p>
                {[
                  [0, 1, 2],
                  [3, 4, 5],
                  [6, 7, 8],
                  [0, 3, 6],
                  [1, 4, 7],
                  [2, 5, 8],
                  [0, 4, 8],
                  [2, 4, 6],
                ].some((row) =>
                  row.every((i) => quest.progress.bingo.includes(i)),
                ) && (
                  <span className="bingo-win">
                    <Sparkles size={16} />A little bingo magic!
                  </span>
                )}
              </div>
              <p className="micro">
                Once noticed, a moment stays marked. There’s no need to find
                them all.
              </p>
            </div>
          )}

          {screen === "recap" && quest && (
            <div className="narrow recap">
              <div className="recap-emblem">
                <CheckCheck size={40} />
              </div>
              <div className="eyebrow">YOU MADE ROOM FOR THE WORLD</div>
              <h1>
                A little greener.
                <br />
                <em>A little lighter.</em>
              </h1>
              <p className="lead">
                {quest.title}. A small adventure, all yours.
              </p>
              <section className="time-recap">
                <div className="outside-time">
                  <Trees size={26} />
                  <strong>
                    {fmt(
                      Math.max(
                        0,
                        quest.progress.elapsedSeconds -
                          quest.progress.screenSeconds,
                      ),
                    )}
                  </strong>
                  <span>estimated away from screen</span>
                </div>
                <div className="screen-time">
                  <Smartphone size={20} />
                  <strong>{fmt(quest.progress.screenSeconds)}</strong>
                  <span>time with this app visible</span>
                </div>
                <div className="time-bar">
                  <span
                    style={{
                      width: `${quest.progress.elapsedSeconds ? (100 * (quest.progress.elapsedSeconds - quest.progress.screenSeconds)) / quest.progress.elapsedSeconds : 0}%`,
                    }}
                  />
                </div>
                <p>
                  Based on quest duration and app visibility. Away from screen
                  is an estimate, not verified outdoor activity.
                </p>
              </section>
              <div className="recap-stats">
                <div>
                  <strong>{quest.progress.completedSteps.length}</strong>
                  <span>moments completed</span>
                </div>
                <div>
                  <strong>{quest.progress.bingo.length}</strong>
                  <span>bingo discoveries</span>
                </div>
                <div>
                  <strong>
                    {
                      data.observations.filter((o) => o.questId === quest.id)
                        .length
                    }
                  </strong>
                  <span>wonders saved</span>
                </div>
              </div>
              <div className="recap-notes">
                {data.observations
                  .filter((o) => o.questId === quest.id)
                  .map((o) => (
                    <div key={o.id} className="journal-observation">
                      {o.thumbnail ? (
                        <img src={o.thumbnail} alt="Saved nature observation" />
                      ) : (
                        <span className="note-icon">
                          <Leaf />
                        </span>
                      )}
                      <div>
                        <h3>{o.insight.label}</h3>
                        <p>{o.note || o.insight.insight}</p>
                      </div>
                    </div>
                  ))}
              </div>
              <button
                className="button primary wide"
                onClick={() => go("journal")}
              >
                Keep this in my journal
                <BookOpen size={18} />
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setSelected("");
                  go("home");
                }}
              >
                Back home
                <ArrowRight size={16} />
              </button>
              <p className="micro">
                {quest.dirty
                  ? "Saved on device · sync pending"
                  : "Saved to your adventure journal"}
              </p>
            </div>
          )}

          {screen === "journal" && (
            <>
              <div className="page-intro">
                <div className="eyebrow">
                  <BookOpen size={16} /> YOUR LITTLE COLLECTION OF OUTSIDE
                </div>
                <h1>
                  Small moments.
                  <br />
                  <em>Good memories.</em>
                </h1>
                <p>Every little adventure leaves you with something.</p>
              </div>
              <div className="journal-summary">
                <div>
                  <Trees size={25} />
                  <strong>{minutes(outside)} min</strong>
                  <span>estimated away from screen</span>
                </div>
                <div>
                  <Compass size={25} />
                  <strong>{completed.length}</strong>
                  <span>adventures completed</span>
                </div>
                <div>
                  <Camera size={25} />
                  <strong>{data.observations.length}</strong>
                  <span>moments saved</span>
                </div>
              </div>
              {data.quests.length === 0 ? (
                <div className="empty-state">
                  <BookOpen size={44} />
                  <h2>Your first page is waiting.</h2>
                  <p>
                    Head outside. Notice something. Bring back a little story.
                  </p>
                  <button className="button primary" onClick={startSetup}>
                    Make my first quest
                    <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <div className="journal-list">
                  {data.quests.map((q) => (
                    <button
                      className="journal-card"
                      key={q.id}
                      onClick={() => open(q)}
                    >
                      <div className="journal-art">
                        <Landscape
                          variant={
                            q.config.mood === "peaceful"
                              ? "water"
                              : q.config.mood === "energized"
                                ? "meadow"
                                : "forest"
                          }
                        />
                      </div>
                      <div>
                        <span className="source-tag">
                          {q.progress.status === "completed"
                            ? "A LITTLE ADVENTURE, COMPLETED"
                            : q.progress.status === "active"
                              ? "STILL EXPLORING"
                              : "READY WHEN YOU ARE"}
                          {q.dirty ? " · SYNC PENDING" : ""}
                        </span>
                        <h2>{q.title}</h2>
                        <p>
                          {new Date(q.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          · {q.config.minutes} min · {q.config.location}
                        </p>
                      </div>
                      <ChevronRight size={21} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {screen === "explore" && (
            <>
              <div className="page-intro">
                <div className="eyebrow">
                  <Compass size={16} /> A DIFFERENT WAY TO WANDER
                </div>
                <h1>
                  Find your <em>kind of outside.</em>
                </h1>
                <p>
                  Start with a feeling. Let your curiosity take it from there.
                </p>
              </div>
              <div className="explore-feature">
                <Landscape variant="meadow" />
                <div>
                  <span className="light-chip">
                    <Heart size={14} /> Close to home counts
                  </span>
                  <h2>
                    Wonder doesn’t need
                    <br />a faraway destination.
                  </h2>
                  <button className="button cream" onClick={startSetup}>
                    Make a nearby adventure
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
              <div className="explore-tips">
                {[
                  {
                    icon: Leaf,
                    title: "The noticing walk",
                    text: "Find three textures, two colors and one sound you usually miss.",
                    mood: "curious",
                  },
                  {
                    icon: Wind,
                    title: "The quiet reset",
                    text: "A gentle route, a safe place to pause, and a few slow breaths.",
                    mood: "peaceful",
                  },
                  {
                    icon: Sun,
                    title: "The fresh-air break",
                    text: "Make a little room between your to-do list and your next step.",
                    mood: "energized",
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    onClick={() => {
                      setConfig((c) => ({
                        ...c,
                        mood: item.mood as QuestConfig["mood"],
                      }));
                      startSetup();
                    }}
                  >
                    <item.icon size={28} />
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <span>
                      Make it mine
                      <ArrowRight size={16} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="gentle-note">
                <ShieldCheck size={22} />
                <p>
                  Places are starting points, not verified hiking routes. Stay
                  on familiar public paths and check access before you go.
                </p>
              </div>
            </>
          )}

          {screen === "settings" && (
            <div className="narrow">
              <div className="eyebrow">KEEP IT SIMPLE. MAKE IT YOURS.</div>
              <h1>
                Your <em>little preferences.</em>
              </h1>
              <section className="settings-section">
                <h2>About you</h2>
                <label className="field-label" htmlFor="settings-name">
                  Explorer name
                </label>
                <input
                  id="settings-name"
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  className="button secondary"
                  disabled={busy || !data.user}
                  onClick={() => {
                    setData((d) => ({
                      ...d,
                      user: d.user
                        ? {
                            ...d.user,
                            name: name.trim() || "Explorer",
                            dirty: true,
                          }
                        : null,
                    }));
                    setNotice("Preferences saved on this device.");
                  }}
                >
                  Save name
                  <Check size={16} />
                </button>
                <p className="micro">
                  {data.user
                    ? "This browser holds your device session."
                    : "Start your first adventure to create a device session."}
                </p>
              </section>
              <section className="settings-section">
                <h2>Out in the world</h2>
                <label className="switch-row">
                  <span>
                    <strong>Optional voice instructions</strong>
                    <small>
                      Hear the next step with ElevenLabs. Requires a connection.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    disabled={!data.user}
                    checked={!!data.user?.voice}
                    onChange={(e) =>
                      setData((d) => ({
                        ...d,
                        user: d.user
                          ? { ...d.user, voice: e.target.checked, dirty: true }
                          : null,
                      }))
                    }
                  />
                </label>
                <label className="switch-row">
                  <span>
                    <strong>Less motion</strong>
                    <small>A calmer experience with fewer animations.</small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    disabled={!data.user}
                    checked={!!data.user?.reducedMotion}
                    onChange={(e) =>
                      setData((d) => ({
                        ...d,
                        user: d.user
                          ? {
                              ...d.user,
                              reducedMotion: e.target.checked,
                              dirty: true,
                            }
                          : null,
                      }))
                    }
                  />
                </label>
                <p className="micro">
                  {health?.voice
                    ? "Voice provider is configured."
                    : "Voice not configured. Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to backend .env."}
                </p>
              </section>
              <section className="settings-section">
                <h2>Backend status</h2>
                <div className="status-grid">
                  <div className="status-row">
                    <span>Database</span>
                    <span className={`status-badge ${health?.database === 'connected' ? 'ok' : 'warn'}`}>
                      {health?.database === 'connected' ? 'Connected' : 'Checking…'}
                    </span>
                  </div>
                  <div className="status-row">
                    <span>AI (Gemma)</span>
                    <span className={`status-badge ${health?.ai ? 'ok' : 'warn'}`}>
                      {health?.ai ? 'Configured' : 'Add GEMMA_API_KEY'}
                    </span>
                  </div>
                  <div className="status-row">
                    <span>Voice (ElevenLabs)</span>
                    <span className={`status-badge ${health?.voice ? 'ok' : 'warn'}`}>
                      {health?.voice ? 'Configured' : 'Not set up'}
                    </span>
                  </div>
                  <div className="status-row">
                    <span>Place discovery (SerpAPI)</span>
                    <span className={`status-badge ${health?.discovery ? 'ok' : 'warn'}`}>
                      {health?.discovery ? 'Configured' : 'Not set up'}
                    </span>
                  </div>
                </div>
                <p className="micro">
                  Configure services in <code>backend/.env</code>. Restart the API after changing keys.
                </p>
              </section>
              <section className="settings-section">
                <h2>Data &amp; session</h2>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    if (confirm('This will clear your local session and all quest data stored on this device. Your data is already saved in MongoDB if you were online. Continue?')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                >
                  <RotateCcw size={16} />
                  Reset device session
                </button>
                <p className="micro">
                  Clears the browser cache and local session. Your progress synced to the server is safe.
                </p>
              </section>
            </div>
          )}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map((item) => (
          <button
            key={item.screen}
            className={screen === item.screen ? "selected" : ""}
            onClick={() => go(item.screen)}
          >
            <item.icon size={20} />
            <span>{item.label === "My journal" ? "Journal" : item.label}</span>
          </button>
        ))}
      </nav>
      {resting && (
        <div
          className="rest-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Put your phone away"
        >
          <Leaf size={48} />
          <h2>The world has your attention.</h2>
          <p>
            Lock your phone and tuck it away.
            <br />
            Your next moment will be here when you return.
          </p>
          <span>
            Visible screen time continues until you lock or leave this app.
          </span>
          <button className="button cream" onClick={() => setResting(false)}>
            I’m back
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
