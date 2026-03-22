# AI Plugin

`ai` 插件为系统提供 AI 能力

## 功能概览

- AI Chat: 发起流式对话，支持 Markdown 内容渲染
- Provider: 管理 AI 供应商配置
- Model: 管理供应商下可用模型
- MCP: 管理可接入的 MCP 服务

## 添加 markstream-vue 依赖

这个仓库是 `pnpm workspace` monorepo，并且统一使用 `catalog:` 管理第三方版本。因此新增依赖时，建议按下面两步处理

### 1. 在根目录维护 catalog 版本

编辑根目录 `pnpm-workspace.yaml`，补充或更新：

```yaml
catalog:
  markstream-vue: 0.0.10-beta.1
```

如果仓库中已经存在该项，则不需要重复添加，只需按需升级版本

### 2. 在具体应用包中声明依赖

编辑 `apps/web-antdv-next/package.json`：

```json
{
  "dependencies": {
    "markstream-vue": "catalog:"
  }
}
```

这一步表示 `@vben/web-antdv-next` 应用依赖 `markstream-vue`，具体版本由根目录 `catalog` 统一控制

### 3. 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

如果只是给 `@vben/web-antdv-next` 单独增加该依赖，也可以直接执行：

```bash
pnpm --filter @vben/web-antdv-next add markstream-vue@catalog:
```

执行后请确认：

- `pnpm-workspace.yaml` 中存在 `markstream-vue` 版本
- `apps/web-antdv-next/package.json` 中存在 `"markstream-vue": "catalog:"`
- `pnpm-lock.yaml` 已更新
