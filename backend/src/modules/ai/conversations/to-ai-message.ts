import { AIMessage } from '../models/ai-model.types';
import { MessageEntity } from './entities/message.entity';

export function toAIMessage(message: MessageEntity): AIMessage {
  return {
    role: message.role,
    content: message.content,
    ...(typeof message.metadata.toolName === 'string' ? { name: message.metadata.toolName } : {}),
  };
}
