export type AiSuggestionCategory = 'SALES' | 'SUPPORT' | 'OPERATIONS' | 'FINANCE' | 'GENERAL';

export interface AiSuggestionEntity {
  id: string;
  organizationId: string;
  category: AiSuggestionCategory;
  title: string;
  description: string;
  createdAt: Date;
  dismissedAt: Date | null;
}
