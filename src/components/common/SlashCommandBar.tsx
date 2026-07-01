import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, X, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../stores/appStore";
import { StatsCommand } from "./StatsCommand";
import {
  SLASH_COMMANDS,
  SLASH_CATEGORY_META,
  type SlashCommandCategory,
} from "../../config/slashCommands";

interface CommandEntry {
  id: string;
  name: string;
  description: string;
  category: SlashCommandCategory;
  action: "navigate" | "stats" | "reference";
  page?: string;
}

interface SlashCommandBarProps {
  open: boolean;
  onClose: () => void;
}

// Map slash commands to Cockpit navigation pages
const COMMAND_TO_PAGE: Record<string, string> = {
  "goto-dashboard": "dashboard",
  "goto-models": "models",
  "goto-sessions": "sessions",
  "goto-usage": "usage",
  "goto-settings": "settings",
  "goto-skills": "skills",
  "goto-droids": "droids",
  "goto-mcp": "mcp",
  "goto-prompts": "prompts",
};

export function SlashCommandBar({ open, onClose }: SlashCommandBarProps) {
  const { t } = useTranslation();
  const setPage = useAppStore((s) => s.setPage);
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build command list: official slash commands + Cockpit navigation shortcuts
  const commands: CommandEntry[] = useMemo(() => {
    const officialCommands: CommandEntry[] = SLASH_COMMANDS.map((cmd) => {
      // Map official commands to Cockpit pages where possible
      const pageMap: Record<string, { page: string; tab?: string }> = {
        "settings": { page: "settings" },
        "themes": { page: "settings", tab: "general" },
        "language": { page: "settings", tab: "general" },
        "model": { page: "settings", tab: "droid-config" },
        "fast": { page: "settings", tab: "droid-config" },
        "statusline": { page: "settings", tab: "droid-config" },
        "limits": { page: "settings", tab: "droid-config" },
        "hooks": { page: "settings", tab: "general" },
        "ide": { page: "settings", tab: "general" },
        "droids": { page: "droids" },
        "mcp": { page: "mcp" },
        "skills": { page: "skills" },
        "sessions": { page: "sessions" },
        "commands": { page: "settings", tab: "slash-commands" },
        "plugins": { page: "settings", tab: "slash-commands" },
        "diagnostics": { page: "settings", tab: "slash-commands" },
        "status": { page: "dashboard" },
        "context": { page: "usage" },
        "cost": { page: "usage" },
        "missions": { page: "settings", tab: "mission" },
        "stats": { page: "stats" }, // Special: shows stats view
      };

      const mapping = pageMap[cmd.command];
      if (cmd.command === "stats") {
        return {
          id: `official:${cmd.command}`,
          name: cmd.command,
          description: cmd.description,
          category: cmd.category,
          action: "stats" as const,
        };
      }
      if (mapping) {
        return {
          id: `official:${cmd.command}`,
          name: cmd.command,
          description: cmd.description,
          category: cmd.category,
          action: "navigate" as const,
          page: mapping.page,
        };
      }
      return {
        id: `official:${cmd.command}`,
        name: cmd.command,
        description: cmd.description,
        category: cmd.category,
        action: "reference" as const,
      };
    });

    // Add Cockpit navigation shortcuts
    const navShortcuts: CommandEntry[] = Object.entries(COMMAND_TO_PAGE).map(([id, page]) => ({
      id,
      name: `goto-${page}`,
      description: `跳转到 ${page}`,
      category: "settings" as SlashCommandCategory,
      action: "navigate" as const,
      page,
    }));

    return [...officialCommands, ...navShortcuts];
  }, []);

  const filteredCommands = useMemo(() => {
    const q = query.toLowerCase().replace(/^\//, "");
    if (!q) return commands;
    return commands.filter((cmd) =>
      cmd.name.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q)
    );
  }, [query, commands]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setActiveCommand(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const executeCommand = useCallback((cmd: CommandEntry) => {
    if (cmd.action === "stats") {
      setActiveCommand("stats");
      return;
    }
    if (cmd.action === "navigate" && cmd.page) {
      if (cmd.page === "settings") {
        // Also set the settings tab if specified
        const officialCmd = SLASH_COMMANDS.find((c) => c.command === cmd.name);
        if (officialCmd) {
          const pageMap: Record<string, string> = {
            "themes": "general",
            "language": "general",
            "model": "droid-config",
            "fast": "droid-config",
            "statusline": "droid-config",
            "limits": "droid-config",
            "hooks": "general",
            "ide": "general",
            "commands": "slash-commands",
            "plugins": "slash-commands",
            "diagnostics": "slash-commands",
            "missions": "mission",
          };
          const tab = pageMap[officialCmd.command];
          if (tab) setSettingsTab(tab as never);
        }
      }
      setPage(cmd.page as never);
      onClose();
    }
  }, [setPage, setSettingsTab, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filteredCommands[activeIndex];
      if (cmd) executeCommand(cmd);
    } else if (e.key === "Escape") {
      if (activeCommand) {
        setActiveCommand(null);
      } else {
        onClose();
      }
    }
  };

  if (!open) return null;

  // Stats command view
  if (activeCommand === "stats") {
    return (
      <div className="slash-command-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="slash-command-modal slash-command-modal-wide" onClick={(e) => e.stopPropagation()}>
          <div className="slash-command-modal-header">
            <span className="slash-command-modal-title">/stats</span>
            <button className="btn-icon" onClick={() => { setActiveCommand(null); onClose(); }}>
              <X size={16} />
            </button>
          </div>
          <div className="slash-command-modal-body">
            <StatsCommand />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="slash-command-overlay" onClick={onClose}>
      <div className="slash-command-modal" onClick={(e) => e.stopPropagation()}>
        <div className="slash-command-input-row">
          <Search size={16} className="text-faint" />
          <input
            ref={inputRef}
            type="text"
            className="slash-command-input"
            placeholder={t("slash.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="slash-command-kbd">ESC</kbd>
        </div>
        {filteredCommands.length > 0 ? (
          <div className="slash-command-list">
            {filteredCommands.slice(0, 30).map((cmd, i) => {
              const meta = SLASH_CATEGORY_META[cmd.category];
              const isOfficial = cmd.id.startsWith("official:");
              return (
                <button
                  key={cmd.id}
                  className={`slash-command-item ${i === activeIndex ? "active" : ""}`}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span
                    className="slash-command-item-icon"
                    style={{ color: meta.color }}
                  >
                    {isOfficial ? (
                      <span className="font-mono-sm text-[11px] font-bold">/</span>
                    ) : (
                      <ExternalLink size={14} />
                    )}
                  </span>
                  <div className="slash-command-item-content">
                    <div className="slash-command-item-name">
                      {isOfficial ? `/${cmd.name}` : cmd.name}
                      {cmd.action === "reference" && (
                        <span className="slash-command-ref-badge">TUI</span>
                      )}
                    </div>
                    <div className="slash-command-item-desc">{cmd.description}</div>
                  </div>
                  <span
                    className="slash-command-cat-badge"
                    style={{ color: meta.color, borderColor: meta.color }}
                  >
                    {meta.label}
                  </span>
                </button>
              );
            })}
            {filteredCommands.length > 30 && (
              <div className="slash-command-more">
                还有 {filteredCommands.length - 30} 个命令，请缩小搜索范围…
              </div>
            )}
          </div>
        ) : (
          <div className="slash-command-empty">{t("slash.noResults")}</div>
        )}
      </div>
    </div>
  );
}
