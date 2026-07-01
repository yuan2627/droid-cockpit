import { create } from "zustand";
import type { Page, SettingsTab, DroidSettings, CustomModel, McpConfig } from "../types";
import {
  writeSettings,
  writeCockpitModels,
  type CockpitModelsStore,
} from "../utils/tauri";

export type SettingsSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
export type AppTheme = "light" | "dark" | "system";

interface AppState {
  currentPage: Page;
  settingsTab: SettingsTab;
  setPage: (page: Page) => void;
  setSettingsTab: (tab: SettingsTab) => void;

  // Theme
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;

  settings: DroidSettings;
  setSettings: (settings: DroidSettings) => void;
  updateSettings: (partial: Partial<DroidSettings>) => void;
  settingsDirty: boolean;
  settingsSaveStatus: SettingsSaveStatus;
  settingsSaveError: string;
  lastSettingsSavedAt: number | null;
  saveSettings: (snapshot?: DroidSettings) => Promise<void>;

  mcpConfig: McpConfig;
  setMcpConfig: (config: McpConfig) => void;

  // ====== Three-layer model state (Additive selective write) ======
  // Layer 1: allModels - all models managed by the app (persisted to cockpit-models.json)
  allModels: CustomModel[];
  setAllModels: (models: CustomModel[]) => void;
  addModel: (model: CustomModel) => void;
  removeModel: (modelId: string) => void;
  updateModel: (modelId: string, updates: Partial<CustomModel>) => void;

  // Layer 2: shownModelIds - which models are selected to be written to settings.json
  shownModelIds: string[];
  setShownModelIds: (ids: string[]) => void;
  toggleModelShown: (modelId: string) => void;
  modelSettingsDirty: boolean;
  markModelSettingsPersisted: () => void;

  // Layer 3: settings.customModels - actually written to ~/.factory/settings.json
  // (derived from allModels filtered by shownModelIds, handled in App.tsx persist effect)

  // Sort order
  sortOrder: string[];
  setSortOrder: (ids: string[]) => void;

  // Cockpit store persistence (writes cockpit-models.json)
  cockpitModelsDirty: boolean;
  cockpitModelsSaveError: string;
  persistCockpitModels: () => Promise<void>;

  // UI state
  editingModel: CustomModel | null;
  setEditingModel: (model: CustomModel | null) => void;
  showModelForm: boolean;
  setShowModelForm: (show: boolean) => void;

  // File operations state
  settingsLoaded: boolean;
  setSettingsLoaded: (loaded: boolean) => void;
}

function modelFingerprint(model: CustomModel): string {
  const input = `${model.provider}\u0000${model.baseUrl}\u0000${model.model}\u0000${model.displayName || ""}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function generateModelId(model: CustomModel): string {
  const name = model.displayName || model.model;
  const safe = name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "model";
  return `custom:${safe}-${modelFingerprint(model)}`;
}

export function ensureModelIds(models: CustomModel[]): CustomModel[] {
  const used = new Set<string>();
  return models.map((model, index) => {
    const base = model.id || generateModelId(model);
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return { ...model, id, index };
  });
}

export function getEffectiveModel(settings: DroidSettings): string | undefined {
  return settings.model || settings.sessionDefaultSettings?.model;
}

export function getEffectiveReasoningEffort(settings: DroidSettings): string | undefined {
  return settings.reasoningEffort || settings.sessionDefaultSettings?.reasoningEffort;
}

export function toDroidCustomModel(model: CustomModel): CustomModel {
  const {
    id: _id,
    index: _index,
    tags: _tags,
    notes: _notes,
    maxContextLimit: _maxContextLimit,
    ...droidFields
  } = model;
  const serialized: CustomModel = {
    ...droidFields,
    model: model.model.trim(),
    baseUrl: model.baseUrl.trim().replace(/\/+$/, ""),
    apiKey: model.apiKey.trim(),
    provider: model.provider,
  };
  if (model.displayName?.trim()) serialized.displayName = model.displayName.trim();
  if (model.maxOutputTokens && model.maxOutputTokens > 0) {
    serialized.maxOutputTokens = model.maxOutputTokens;
  }
  if (model.noImageSupport === true) {
    serialized.noImageSupport = true;
  } else {
    delete serialized.noImageSupport;
  }
  if (model.extraArgs && Object.keys(model.extraArgs).length > 0) {
    serialized.extraArgs = model.extraArgs;
  }
  if (model.extraHeaders && Object.keys(model.extraHeaders).length > 0) {
    serialized.extraHeaders = model.extraHeaders;
  }
  return serialized;
}

export function normalizeSettingsForWrite(settings: DroidSettings): DroidSettings {
  const normalized: DroidSettings = { ...settings };
  normalized.customModels = (settings.customModels || []).map(toDroidCustomModel);
  return normalized;
}

let settingsWriteChain: Promise<void> = Promise.resolve();
let settingsWriteGeneration = 0;

const APP_PAGES: Page[] = [
  "dashboard",
  "models",
  "skills",
  "droids",
  "prompts",
  "sessions",
  "mcp",
  "usage",
  "settings",
];

const SETTINGS_TABS: SettingsTab[] = [
  "general",
  "droid-config",
  "mission",
  "usage",
  "data",
  "slash-commands",
  "about",
];

function getInitialPage(): Page {
  if (typeof window === "undefined") return "dashboard";
  const page = new URLSearchParams(window.location.search).get("page");
  return APP_PAGES.includes(page as Page) ? page as Page : "dashboard";
}

function getInitialSettingsTab(): SettingsTab {
  if (typeof window === "undefined") return "general";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return SETTINGS_TABS.includes(tab as SettingsTab) ? tab as SettingsTab : "general";
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: getInitialPage(),
  settingsTab: getInitialSettingsTab(),
  setPage: (page) => set({ currentPage: page }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),

  // Theme preference is UI-only and persisted to localStorage.
  theme: (() => {
    if (typeof localStorage === "undefined") return "light";
    const stored = localStorage.getItem("droid-cockpit-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
  })(),
  setTheme: (theme) => {
    if (typeof document !== "undefined") {
      const resolved = theme === "system" && typeof window !== "undefined"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : theme;
      document.documentElement.setAttribute("data-theme", resolved);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("droid-cockpit-theme", theme);
    }
    set({ theme });
  },
  toggleTheme: () => {
    const current = get().theme;
    const next: AppTheme = current === "light" ? "dark" : current === "dark" ? "system" : "light";
    get().setTheme(next);
  },

  settings: {},
  setSettings: (settings) => set({
    settings,
    settingsDirty: false,
    settingsSaveStatus: "idle",
    settingsSaveError: "",
  }),
  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
      settingsDirty: true,
      settingsSaveStatus: "dirty",
      settingsSaveError: "",
    })),
  settingsDirty: false,
  settingsSaveStatus: "idle",
  settingsSaveError: "",
  lastSettingsSavedAt: null,
  saveSettings: async (snapshot) => {
    const normalized = normalizeSettingsForWrite(snapshot || get().settings);
    const generation = ++settingsWriteGeneration;
    set({
      settings: normalized,
      settingsSaveStatus: "saving",
      settingsSaveError: "",
    });
    const pending = settingsWriteChain
      .catch(() => undefined)
      .then(() => writeSettings(normalized));
    settingsWriteChain = pending;
    try {
      await pending;
      if (generation === settingsWriteGeneration) {
        set({
          settingsDirty: false,
          settingsSaveStatus: "saved",
          settingsSaveError: "",
          lastSettingsSavedAt: Date.now(),
        });
      }
    } catch (error) {
      if (generation === settingsWriteGeneration) {
        set({
          settingsDirty: true,
          settingsSaveStatus: "error",
          settingsSaveError: String(error),
        });
      }
      throw error;
    }
  },

  mcpConfig: { mcpServers: {} },
  setMcpConfig: (config) => set({ mcpConfig: config }),

  // ====== allModels ======
  allModels: [],
  setAllModels: (models) => set({ allModels: ensureModelIds(models) }),
  addModel: (model) =>
    set((state) => {
      const index = state.allModels.length;
      const baseId = model.id || generateModelId(model);
      let id = baseId;
      let suffix = 2;
      const used = new Set(state.allModels.map((item) => item.id || item.model));
      while (used.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      const newModel = { ...model, id, index };
      const newAll = [...state.allModels, newModel];
      // Auto-show new models by default
      const newShown = [...state.shownModelIds, id];
      return {
        allModels: newAll,
        shownModelIds: newShown,
        sortOrder: [...state.sortOrder, id],
        modelSettingsDirty: true,
        cockpitModelsDirty: true,
      };
    }),
  removeModel: (modelId) =>
    set((state) => {
      const isDefault = getEffectiveModel(state.settings) === modelId;
      const legacySession = { ...(state.settings.sessionDefaultSettings || {}) };
      if (isDefault) delete legacySession.model;
      const nextSettings = isDefault
        ? { ...state.settings, model: undefined, sessionDefaultSettings: legacySession }
        : state.settings;
      return {
        allModels: state.allModels.filter((m) => (m.id || m.model) !== modelId),
        shownModelIds: state.shownModelIds.filter((id) => id !== modelId),
        sortOrder: state.sortOrder.filter((id) => id !== modelId),
        settings: nextSettings,
        settingsDirty: state.settingsDirty || isDefault,
        settingsSaveStatus: isDefault ? "dirty" : state.settingsSaveStatus,
        modelSettingsDirty: true,
        cockpitModelsDirty: true,
      };
    }),
  updateModel: (modelId, updates) =>
    set((state) => ({
      allModels: state.allModels.map((m) =>
        (m.id || m.model) === modelId ? { ...m, ...updates } : m
      ),
      modelSettingsDirty: true,
      cockpitModelsDirty: true,
    })),

  // ====== shownModelIds ======
  shownModelIds: [],
  setShownModelIds: (ids) => set({ shownModelIds: ids }),
  modelSettingsDirty: false,
  markModelSettingsPersisted: () => set({ modelSettingsDirty: false }),
  toggleModelShown: (modelId) =>
    set((state) => ({
      shownModelIds: state.shownModelIds.includes(modelId)
        ? state.shownModelIds.filter((id) => id !== modelId)
        : [...state.shownModelIds, modelId],
      modelSettingsDirty: true,
      cockpitModelsDirty: true,
    })),

  // ====== sortOrder ======
  sortOrder: [],
  setSortOrder: (ids) => set({ sortOrder: ids }),

  // ====== persist cockpit-models.json ======
  cockpitModelsDirty: false,
  cockpitModelsSaveError: "",
  persistCockpitModels: async () => {
    const state = get();
    const store: CockpitModelsStore = {
      allModels: state.allModels,
      shownModelIds: state.shownModelIds,
      sortOrder: state.sortOrder,
      version: 1,
    };
    try {
      await writeCockpitModels(store);
      set({ cockpitModelsDirty: false, cockpitModelsSaveError: "" });
    } catch (error) {
      set({ cockpitModelsDirty: true, cockpitModelsSaveError: String(error) });
      throw error;
    }
  },

  editingModel: null,
  setEditingModel: (model) => set({ editingModel: model }),
  showModelForm: false,
  setShowModelForm: (show) => set({ showModelForm: show }),

  settingsLoaded: false,
  setSettingsLoaded: (loaded) => set({ settingsLoaded: loaded }),
}));

// Helper to get models that should be written to settings.json
export function getShownModels(
  allModels: CustomModel[],
  shownModelIds: string[],
  sortOrder: string[],
): CustomModel[] {
  let ordered: CustomModel[] = [];

  if (sortOrder.length > 0) {
    // Use sortOrder to determine order
    for (const id of sortOrder) {
      const m = allModels.find((m) => (m.id || m.model) === id);
      if (m && shownModelIds.includes(id)) {
        ordered.push(m);
      }
    }
    // Add any shown models not in sortOrder (shouldn't happen, but safety)
    for (const m of allModels) {
      const id = m.id || m.model;
      if (shownModelIds.includes(id) && !ordered.find((om) => (om.id || om.model) === id)) {
        ordered.push(m);
      }
    }
  } else {
    ordered = allModels.filter((m) => shownModelIds.includes(m.id || m.model));
  }

  // Reindex for settings.json
  return ordered.map(toDroidCustomModel);
}
