import { Injectable } from '@nestjs/common';
import { AIMessage } from '../models/ai-model.types';

@Injectable()
export class ConversationMemoryService {
  normalizeHistory(history: AIMessage[] | undefined): AIMessage[] {
    if (!history) {
      return [];
    }

    return history
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
        ...(message.name ? { name: message.name.trim() } : {}),
      }))
      .filter((message) => message.content.length > 0);
  }
}
