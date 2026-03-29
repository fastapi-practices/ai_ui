# AI Plugin

`ai` 插件为系统提供 AI 能力

## 功能概览

- AI Chat: 基于 `@antdv-next/x` 与 `@antdv-next/x-markdown` 构建对话界面，支持流式对话、Markdown 展示、代码高亮与 Mermaid 图表渲染
- Topic & History: 管理会话话题、聊天历史与消息上下文
- Quick Phrase: 管理快捷短语并在对话时快速复用
- Provider: 管理 AI 供应商配置
- Model: 管理供应商下可用模型
- MCP: 管理可接入的 MCP 服务

## 添加 AI Chat 依赖

这个仓库是 `pnpm workspace` monorepo，并且统一使用 `catalog:` 管理依赖来源。因此新增依赖时，建议按下面两步处理

应用侧通过 `catalog:` 声明依赖，具体版本由根目录 `pnpm-workspace.yaml` 统一维护

### 1. 在根目录维护 catalog 版本

编辑根目录 `pnpm-workspace.yaml`，补充或更新：

```yaml
catalog:
  '@antdv-next/x': ^0.0.1
  '@antdv-next/x-markdown': ^0.0.1
```

如果仓库中已经存在该项，则不需要重复添加

### 2. 在具体应用包中声明依赖

编辑 `apps/web-antdv-next/package.json`：

```json
{
  "dependencies": {
    "@antdv-next/x": "catalog:",
    "@antdv-next/x-markdown": "catalog:"
  }
}
```

这一步表示 `@vben/web-antdv-next` 应用依赖 `@antdv-next/x` 与 `@antdv-next/x-markdown`，具体来源由根目录 `catalog` 统一控制

### 3. 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

如果只是给 `@vben/web-antdv-next` 单独增加该依赖，也可以直接执行：

```bash
pnpm --filter @vben/web-antdv-next add @antdv-next/x@catalog: @antdv-next/x-markdown@catalog:
```

执行后请确认：

- `pnpm-workspace.yaml` 中存在 `@antdv-next/x` 的 catalog 条目
- `pnpm-workspace.yaml` 中存在 `@antdv-next/x-markdown` 的 catalog 条目
- `apps/web-antdv-next/package.json` 中存在对应的 `"catalog:"` 依赖声明
- `pnpm-lock.yaml` 已更新
