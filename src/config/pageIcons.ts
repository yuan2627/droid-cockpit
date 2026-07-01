import type { Page } from "../types";
import dashboardIcon from "../assets/generated/section-icons/dashboard.png";
import usageIcon from "../assets/generated/section-icons/usage.png";
import sessionsIcon from "../assets/generated/section-icons/sessions.png";
import modelsIcon from "../assets/generated/section-icons/models.png";
import mcpIcon from "../assets/generated/section-icons/mcp.png";
import droidsIcon from "../assets/generated/section-icons/droids.png";
import skillsIcon from "../assets/generated/section-icons/skills.png";
import promptsIcon from "../assets/generated/section-icons/prompts.png";
import settingsIcon from "../assets/generated/section-icons/settings.png";

export const PAGE_ICON_SRC: Record<Page, string> = {
  dashboard: dashboardIcon,
  usage: usageIcon,
  sessions: sessionsIcon,
  models: modelsIcon,
  mcp: mcpIcon,
  droids: droidsIcon,
  skills: skillsIcon,
  prompts: promptsIcon,
  settings: settingsIcon,
};

export const PAGE_ICON_LABEL: Record<Page, string> = {
  dashboard: "仪表盘",
  usage: "用量统计",
  sessions: "会话管理",
  models: "模型管理",
  mcp: "MCP 服务器",
  droids: "Droid 管理",
  skills: "技能管理",
  prompts: "提示词",
  settings: "设置",
};
