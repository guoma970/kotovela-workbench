# Task Log — 2026-03-29

- `b75f584`：`chore: align workbench branding to KOTOVELA`
  - 作用：将项目命名从旧代号收口为 KOTOVELA（package 与 title）
  - 验证：`npm run build`

## 当前工作（未入主分支）

- 路径：`feat/kotovela-demo-v1`
- 目标：完成可演示收口 + GitHub 可发布结构准备
- 本次新增：仓库结构补齐（docs + CI）

## 实例与群映射（Public Demo Sanitized）

- 本节原记录来自 2026-03-29 的本机自动同步，包含私有 app / agent / Feishu chat 运行态标识，不适合进入公开发布。
- 开源候选只保留脱敏后的示例口径：
  - Main：`<MAIN_AGENT_APP>` / `<MAIN_AGENT_ID>` / `<LOCAL_MAIN_WORKSPACE>`
  - Builder：`<BUILDER_AGENT_APP>` / `<BUILDER_AGENT_ID>` / `<LOCAL_BUILDER_WORKSPACE>`
  - Media / Family / Business / Personal：使用同类占位符维护本地私有映射。
- Feishu 群映射请放在私有部署配置中；公开文档统一使用 `<FEISHU_CHAT_ID_KOTOVELA_HUB>`、`<FEISHU_CHAT_ID_LEGACY>` 等占位符，不发布真实 `oc_*` ID。

## 2026-03-29（产品边界补齐：言町驾驶舱 vs 羲果陪伴）
- 已明确：本群与当前仓库研发轨道为独立产品线 **言町驾驶舱**，不再承接/混合 `羲果陪伴` 的研发主线。
- 已按你的要求继续推进言町驾驶舱方向：
  - 实例徽章与弹窗优化（`ObjectBadge`）继续保留为当前主线交付项。
  - 羲果陪伴资料与协作交接口径保持独立，后续不在本次言町驾驶舱研发任务中联动。
