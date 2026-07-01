import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { buildModelChoiceGroups, type ModelChoice, type ModelChoiceGroup } from "../../config/modelCatalog";
import { useAppStore } from "../../stores/appStore";

const MANUAL_VALUE = "__manual_model__";

export interface GroupedModelSelectProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  includeHidden?: boolean;
  includeFactoryOfficial?: boolean;
  includeByokPresets?: boolean;
  includeFavorites?: boolean;
  allowManual?: boolean;
  specialOptions?: ModelChoice[];
  specialLabel?: string;
}

export function GroupedModelSelect({
  value,
  onChange,
  placeholder = "继承默认 / 产品默认",
  className = "input-cockpit",
  style,
  includeHidden = true,
  includeFactoryOfficial = true,
  includeByokPresets = true,
  includeFavorites = true,
  allowManual = true,
  specialOptions = [],
  specialLabel = "特殊选项",
}: GroupedModelSelectProps) {
  const { settings, allModels, shownModelIds } = useAppStore();
  const [manualMode, setManualMode] = useState(false);

  const groups = useMemo<ModelChoiceGroup[]>(() => {
    const baseGroups = buildModelChoiceGroups({
      value,
      settings,
      allModels,
      shownModelIds,
      includeHidden,
      includeFactoryOfficial,
      includeByokPresets,
      includeFavorites,
    });
    const filteredSpecials = specialOptions.filter((choice) => choice.value);
    return filteredSpecials.length > 0
      ? [{ id: "special", label: specialLabel, choices: filteredSpecials }, ...baseGroups]
      : baseGroups;
  }, [
    allModels,
    includeByokPresets,
    includeFactoryOfficial,
    includeFavorites,
    includeHidden,
    settings,
    shownModelIds,
    specialLabel,
    specialOptions,
    value,
  ]);

  const flatChoices = groups.flatMap((group) => group.choices);
  const knownValue = value && flatChoices.some((choice) => choice.value === value);
  const selectValue = manualMode ? MANUAL_VALUE : value && knownValue ? value : "";

  return (
    <div className="model-select-stack" style={style}>
      <select
        className={className}
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === MANUAL_VALUE) {
            setManualMode(true);
            return;
          }
          setManualMode(false);
          onChange(next || undefined);
        }}
      >
        <option value="">{placeholder}</option>
        {groups.map((group) => (
          <optgroup key={group.id} label={group.label}>
            {group.choices.map((choice) => (
              <option key={`${group.id}:${choice.value}`} value={choice.value} disabled={choice.disabled}>
                {choice.label}{choice.detail ? ` — ${choice.detail}` : ""}
              </option>
            ))}
          </optgroup>
        ))}
        {allowManual && <option value={MANUAL_VALUE}>手动输入模型 ID...</option>}
      </select>
      {manualMode && (
        <input
          className={className}
          value={value || ""}
          onChange={(event) => onChange(event.target.value || undefined)}
          placeholder="输入任意 Droid/官方模型 ID"
        />
      )}
    </div>
  );
}
