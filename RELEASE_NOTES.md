# Droid Cockpit v1.0.0

这是 Droid Cockpit 的第一个公开 Windows 版本。

## 下载

请在 GitHub Releases 中下载 Windows 安装器：

- `Droid Cockpit_1.0.0_x64-setup.exe`

当前版本只发布 Windows x64 NSIS 安装器，不发布 macOS、Linux、Android 或 iOS 包。

## 适用范围

Droid Cockpit 是 Factory Droid CLI 的第三方桌面管理面板。它不会随安装器分发 Droid CLI，也不会替代 Droid；用户需要先自行安装并登录 Droid CLI。

应用主要管理本机：

- `%USERPROFILE%\.factory\settings.json`
- `%USERPROFILE%\.factory\mcp.json`
- `%USERPROFILE%\.factory\cockpit-models.json`
- `%USERPROFILE%\.factory\skills\`
- `%USERPROFILE%\.agents\skills\`
- `%USERPROFILE%\.factory\droids\`
- `%USERPROFILE%\.factory\sessions\`
- `%USERPROFILE%\.factory\AGENTS.md`

## 首版功能

- 中文优先的 Windows 桌面界面。
- Droid settings、BYOK 模型、MCP、技能、自定义 Droid、提示词、会话和用量统计管理。
- 官方斜杠命令说明与 Cockpit 设置项映射。
- 配置脱敏导出、完整导出、备份、恢复和导入。
- 启动时只读配置，只有用户明确保存、导入、恢复或删除时才写入文件。
- Windows 子进程以无控制台窗口方式启动，减少黑色命令行窗口闪现。
- 单实例运行，避免多个窗口同时写同一份配置。

## 安全说明

- 导入和恢复配置前会自动备份当前 `settings.json`、`mcp.json` 和 `cockpit-models.json`。
- 脱敏导出会隐藏 API Key、Token、Authorization、密码、私钥、环境变量和请求头。
- 模型连接测试不会读取 `${ENV_VAR}` 环境变量引用，避免把本机环境变量发送到远程 Endpoint。
- 模型连接测试只允许公开 HTTPS Endpoint 或本机回环地址，禁止私网、链路本地、元数据地址和自动重定向。
- 本仓库不包含 Droid 可执行文件、从 Droid 提取的资源、个人配置、会话正文、API Key 或签名证书。

## 已验证

本版本发布前已通过：

- `cargo fmt --check`
- `cargo check --locked`
- `cargo test --locked`
- `node scripts/check-versions.mjs`
- `pnpm audit --audit-level moderate`
- `pnpm build`
- `pnpm tauri build`

## 已知限制

- 安装器暂未代码签名，Windows SmartScreen 可能提示未知发布者。
- RustSec `cargo audit` 需要额外安装 `cargo-audit`，本次未在本机执行。
- 当前只支持 Windows 发布；其他平台不在本版本范围内。
