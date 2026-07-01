import { useState, useEffect } from "react";
import {
  readAgentsMd, writeAgentsMd, getAgentsMtime,
} from "../../utils/tauri";
import {
  BookOpen, Save, Eye, Code, AlertTriangle, RefreshCw, FileText,
} from "lucide-react";

export function PromptsPage() {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loadedMtime, setLoadedMtime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadAgentsMd = async () => {
    setLoading(true);
    try {
      const text = await readAgentsMd();
      const mtime = await getAgentsMtime();
      setContent(text);
      setOriginalContent(text);
      setLoadedMtime(mtime);
      setDirty(false);
    } catch (e) {
      setMsg("加载失败: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgentsMd();
  }, []);

  useEffect(() => {
    setDirty(content !== originalContent);
  }, [content, originalContent]);

  const handleSave = async () => {
    try {
      const currentMtime = await getAgentsMtime();
      if (loadedMtime > 0 && currentMtime > loadedMtime) {
        if (!confirm("⚠️ AGENTS.md 已被外部修改（可能被 Droid 或其他编辑器改动）。是否覆盖外部修改？")) {
          setMsg("已取消保存。建议刷新后查看最新内容。");
          return;
        }
      }
    } catch {
      // mtime check failed, proceed anyway
    }

    setSaving(true);
    try {
      await writeAgentsMd(content);
      setOriginalContent(content);
      const newMtime = await getAgentsMtime();
      setLoadedMtime(newMtime);
      setDirty(false);
      setMsg("✓ 已保存到 ~/.factory/AGENTS.md");
    } catch (e) {
      setMsg("保存失败: " + String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = () => {
    if (dirty && !confirm("当前有未保存的修改，刷新将丢弃。继续？")) return;
    loadAgentsMd();
    setMsg("");
  };

  const msgTone = msg.startsWith("✓")
    ? "alert-cockpit-success"
    : msg.startsWith("⚠")
      ? "alert-cockpit-warning"
      : "alert-cockpit-info";

  return (
    <div className="page-container">
      <div className="page-inner">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-strong">
              <BookOpen size={20} style={{ color: "var(--color-primary)" }} /> AGENTS.md 编辑器
            </h2>
            <p className="text-sm text-muted mt-0.5">
              编辑全局指令文件{" "}
              <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>
                ~/.factory/AGENTS.md
              </code>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className={`btn-cockpit ${showPreview ? "btn-cockpit-outline" : "btn-cockpit-ghost"}`}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? <Code size={14} /> : <Eye size={14} />}
              {showPreview ? "编辑" : "预览"}
            </button>
            <button
              className="btn-cockpit btn-cockpit-ghost"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 刷新
            </button>
            <button
              className="btn-cockpit btn-cockpit-primary"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              保存
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="alert-cockpit alert-cockpit-info mb-4">
          <div>
            <FileText size={16} className="inline mr-1 align-text-bottom" />
            <b>AGENTS.md</b> 是 Factory Droid 的全局指令文件。Droid 启动时会自动读取此文件，
            遵循其中的项目约定、编码规范、验证命令等指令。支持项目级覆盖（在项目根目录创建 AGENTS.md）。
          </div>
        </div>

        {msg && (
          <div className={`alert-cockpit ${msgTone} mb-4`}>
            <span>{msg}</span>
          </div>
        )}

        {/* Dirty indicator */}
        {dirty && (
          <div className="alert-cockpit alert-cockpit-warning mb-3" style={{ padding: "0.5rem 1rem" }}>
            <span className="text-xs flex items-center gap-1">
              <AlertTriangle size={12} /> 有未保存的修改
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="loading-cockpit" />
          </div>
        ) : showPreview ? (
          /* Markdown Preview */
          <div className="cockpit-card p-6">
            <MarkdownPreview content={content} />
          </div>
        ) : (
          /* Editor */
          <div className="cockpit-card overflow-hidden">
            <textarea
              className="w-full h-[60vh] p-4 outline-none resize-none font-mono text-sm"
              style={{
                background: "var(--color-base-300)",
                color: "var(--color-base-content)",
                border: "none",
                borderRadius: "var(--radius-lg)",
              }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"# AGENTS.md\n\n## 项目约定\n- 使用 TypeScript + React\n- 代码风格遵循 ESLint 配置\n\n## 验证命令\n- pnpm lint\n- pnpm test\n\n## 注意事项\n- 提交前必须运行测试\n- 不要修改 src/generated/ 目录"}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>
        )}

        {/* Quick templates */}
        <div className="cockpit-card p-4 mt-6">
          <h3 className="text-sm font-semibold mb-2 text-strong">快速模板</h3>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-cockpit btn-cockpit-outline"
              style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}
              onClick={() => setContent(BASIC_TEMPLATE)}
            >
              基础模板
            </button>
            <button
              className="btn-cockpit btn-cockpit-outline"
              style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}
              onClick={() => setContent(VERIFY_TEMPLATE)}
            >
              验证命令模板
            </button>
            <button
              className="btn-cockpit btn-cockpit-outline"
              style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}
              onClick={() => setContent(STYLE_TEMPLATE)}
            >
              代码风格模板
            </button>
          </div>
        </div>

        <div className="mt-4 text-xs text-faint">
          提示：按 Ctrl+S / Cmd+S 快速保存。项目级 AGENTS.md 可在项目根目录创建，会覆盖全局设置。
        </div>
      </div>
    </div>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  let inCodeBlock = false;
  return (
    <div className="max-w-none text-sm leading-relaxed text-muted">
      {content.split("\n").map((line, index) => {
        if (line.trim().startsWith("```")) {
          inCodeBlock = !inCodeBlock;
          return <div key={index} className="h-2" />;
        }
        if (inCodeBlock) {
          return (
            <code key={index} className="block px-3 py-1 font-mono-sm whitespace-pre-wrap" style={{ background: "var(--color-base-300)" }}>
              {line || " "}
            </code>
          );
        }
        if (line.startsWith("### ")) return <h3 key={index} className="text-lg font-bold mt-3 mb-1 text-strong">{line.slice(4)}</h3>;
        if (line.startsWith("## ")) return <h2 key={index} className="text-xl font-bold mt-4 mb-2 text-strong">{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h1 key={index} className="text-2xl font-bold mt-4 mb-2 text-strong">{line.slice(2)}</h1>;
        if (/^- /.test(line)) return <div key={index} className="ml-5 list-item list-disc">{line.slice(2)}</div>;
        if (/^\d+\. /.test(line)) return <div key={index} className="ml-5 list-item list-decimal">{line.replace(/^\d+\. /, "")}</div>;
        if (!line) return <div key={index} className="h-3" />;
        return <p key={index} className="whitespace-pre-wrap break-words">{line}</p>;
      })}
    </div>
  );
}

const BASIC_TEMPLATE = `# AGENTS.md

## 项目说明
<!-- 描述项目用途和技术栈 -->

## 编码规范
- 使用清晰的变量和函数命名
- 添加必要的注释
- 遵循项目现有的代码风格

## 注意事项
- 提交前运行测试
- 不要修改自动生成的文件
`;

const VERIFY_TEMPLATE = `# AGENTS.md

## 验证命令
在完成代码修改后，必须运行以下命令验证：

\`\`\`
pnpm lint
pnpm test
pnpm build
\`\`\`

## 提交前检查
- [ ] 所有测试通过
- [ ] 代码无 lint 错误
- [ ] 构建成功
- [ ] 无敏感信息泄露
`;

const STYLE_TEMPLATE = `# AGENTS.md

## 代码风格

### TypeScript / JavaScript
- 使用 2 空格缩进
- 优先使用 const，必要时用 let，不用 var
- 使用箭头函数
- 使用解构赋值
- 使用模板字符串

### 命名规范
- 变量/函数：camelCase
- 类/接口/类型：PascalCase
- 常量：UPPER_SNAKE_CASE
- 私有成员：前缀 _

### 文件组织
- 每个文件单一职责
- 导出放在文件末尾
- 相关类型放在一起
`;
