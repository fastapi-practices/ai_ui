type AIChatAttachmentSourceType = 'base64' | 'url';
export type AIChatAttachmentType = 'audio' | 'document' | 'image' | 'video';
export type AIMessageBlockType = 'event' | 'file' | 'reasoning' | 'text';
export type AIMessageType = 'error' | 'normal';
export type AIMessageRoleType = 'assistant' | 'user';

export interface AIChatTextMessageBlock {
  text: string;
  type: 'text';
}

export interface AIChatReasoningMessageBlock {
  text: string;
  type: 'reasoning';
}

export interface AIChatFileMessageBlock {
  file_type?: AIChatAttachmentType | null;
  mime_type?: null | string;
  name?: null | string;
  source_type?: AIChatAttachmentSourceType | null;
  type: 'file';
  url?: null | string;
}

type AIChatEventBlockStatus =
  | 'abort'
  | 'error'
  | 'info'
  | 'running'
  | 'success'
  | 'warning';

export interface AIChatEventMessageBlock {
  data?: unknown;
  event_key: string;
  event_type: string;
  event_types?: string[];
  status?: AIChatEventBlockStatus;
  summary?: string;
  text?: string;
  title: string;
  type: 'event';
}

export type AIChatMessageBlock =
  | AIChatEventMessageBlock
  | AIChatFileMessageBlock
  | AIChatReasoningMessageBlock
  | AIChatTextMessageBlock;

export interface AIChatMessage {
  blocks: AIChatMessageBlock[];
  conversation_id?: null | string;
  created_time: string;
  message_id?: null | number;
  message_index?: number;
  message_type: AIMessageType;
  model_id?: null | string;
  provider_id?: null | number;
  role: AIMessageRoleType;
}

export interface AIChatMessageDetail extends AIChatMessage {
  message_index: number;
}
