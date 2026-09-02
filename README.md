# AI Plugin

`ai` 插件提供企业工作台所需的基础 AI 对话能力

- AI Chat：支持流式文本对话、Markdown、代码块和附件
- Topic & History：管理会话话题、聊天历史与消息上下文
- Quick Phrase：管理快捷短语并在对话时快速复用
- Provider：管理 AI 供应商配置
- Model：管理供应商下可用模型与默认模型

本插件只覆盖基础对话与对应后台管理

如需 MCP、空间、知识、客户端等完整 Buddy 能力，请前往插件市场安装 AI Buddy：https://docs.fba.wu-clan.cc/fastapi_best_architecture_docs/marketplace.html

## 对话请求流程

```text
用户输入消息
  -> 选择供应商和模型
  -> 发送基础文本或附件消息
  -> 通过 AG-UI 接收流式文本
  -> 合并并持久化会话消息
```

插件只保留基础对话所需的请求字段：`provider_id`、`model_id`、会话标识和消息内容
