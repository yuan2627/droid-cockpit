import type { CustomModel, DroidSettings } from "../types";
import { providerPresets } from "./presets";

export interface ModelChoice {
  value: string;
  label: string;
  detail?: string;
  disabled?: boolean;
}

export interface ModelChoiceGroup {
  id: string;
  label: string;
  choices: ModelChoice[];
}

export const FACTORY_OFFICIAL_MODELS: ModelChoice[] = [
  { value: "claude-opus-4-8", label: "Claude Opus 4.8", detail: "Factory 官方 / Anthropic" },
  { value: "claude-opus-4-7", label: "Claude Opus 4.7", detail: "Factory 官方 / Anthropic" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", detail: "Factory 官方 / Anthropic" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", detail: "Factory 官方 / Anthropic" },
  { value: "gpt-5.5", label: "GPT-5.5", detail: "Factory 官方 / OpenAI" },
  { value: "gpt-5.5-pro", label: "GPT-5.5 Pro", detail: "Factory 官方 / OpenAI" },
  { value: "gpt-5.4", label: "GPT-5.4", detail: "Factory 官方 / OpenAI" },
  { value: "gpt-5.4-pro", label: "GPT-5.4 Pro", detail: "Factory 官方 / OpenAI" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini", detail: "Factory 官方 / OpenAI" },
  { value: "gpt-5.4-nano", label: "GPT-5.4 Nano", detail: "Factory 官方 / OpenAI" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash", detail: "Factory 官方 / Google" },
];

function providerLabel(provider: string): string {
  switch (provider) {
    case "anthropic":
      return "Anthropic";
    case "openai":
      return "OpenAI";
    case "generic-chat-completion-api":
      return "Chat Completions";
    default:
      return provider;
  }
}

function modelKey(model: CustomModel): string {
  return model.id || model.model;
}

export function getEffectiveSettingsModel(settings: DroidSettings): string | undefined {
  return settings.model || settings.sessionDefaultSettings?.model;
}

export function getModelDisplayLabel(value: string, groups: ModelChoiceGroup[]): string {
  for (const group of groups) {
    const found = group.choices.find((choice) => choice.value === value);
    if (found) return found.label;
  }
  return value;
}

export function buildModelChoiceGroups(options: {
  value?: string;
  settings: DroidSettings;
  allModels: CustomModel[];
  shownModelIds: string[];
  includeHidden?: boolean;
  includeFactoryOfficial?: boolean;
  includeByokPresets?: boolean;
  includeFavorites?: boolean;
}): ModelChoiceGroup[] {
  const {
    value,
    settings,
    allModels,
    shownModelIds,
    includeHidden = true,
    includeFactoryOfficial = true,
    includeByokPresets = true,
    includeFavorites = true,
  } = options;

  const groups: ModelChoiceGroup[] = [];
  const seen = new Set<string>();

  const addGroup = (id: string, label: string, choices: ModelChoice[]) => {
    const filtered: ModelChoice[] = [];
    for (const choice of choices) {
      if (!choice.value || seen.has(choice.value)) continue;
      seen.add(choice.value);
      filtered.push(choice);
    }
    if (filtered.length > 0) groups.push({ id, label, choices: filtered });
  };

  const defaultModel = getEffectiveSettingsModel(settings);
  addGroup(
    "default",
    "当前默认",
    defaultModel
      ? [{ value: defaultModel, label: defaultModel, detail: "当前 settings 默认模型" }]
      : [],
  );

  if (includeFactoryOfficial) {
    addGroup("factory", "Factory 官方模型", FACTORY_OFFICIAL_MODELS);
  }

  if (includeByokPresets) {
    addGroup(
      "byok",
      "官方 BYOK / 网关预设模型",
      providerPresets.flatMap((preset) => {
        const presetModels = preset.models && preset.models.length > 0
          ? preset.models
          : preset.model
            ? [{ model: preset.model, displayName: preset.model, stability: undefined }]
            : [];
        return presetModels.map((model) => ({
          value: model.model,
          label: model.displayName,
          detail: `${preset.name} · ${providerLabel(preset.provider)}${model.stability ? ` · ${model.stability}` : ""}`,
        }));
      }),
    );
  }

  const shownSet = new Set(shownModelIds);
  const shownModels = allModels.filter((model) => shownSet.has(modelKey(model)));
  addGroup(
    "custom-shown",
    "自定义模型（已展示到 Droid）",
    shownModels.map((model) => ({
      value: modelKey(model),
      label: model.displayName || model.model,
      detail: `${model.model} · ${providerLabel(model.provider)}`,
    })),
  );

  if (includeHidden) {
    const hiddenModels = allModels.filter((model) => !shownSet.has(modelKey(model)));
    addGroup(
      "custom-hidden",
      "仅 Cockpit 管理（需先展示）",
      hiddenModels.map((model) => ({
        value: modelKey(model),
        label: model.displayName || model.model,
        detail: `${model.model} · 当前未写入 settings.customModels`,
        disabled: value !== modelKey(model),
      })),
    );
  }

  if (includeFavorites) {
    addGroup(
      "favorites",
      "收藏 / 其他",
      (settings.modelFavorites || []).map((favorite) => ({
        value: favorite,
        label: favorite,
        detail: "settings.modelFavorites",
      })),
    );
  }

  if (value && !seen.has(value)) {
    addGroup("current", "当前配置 / 手动模型", [
      { value, label: value, detail: "当前已配置值，不在内置列表中" },
    ]);
  }

  return groups;
}
