export interface RagLetterTemplate {
  id: number;
  name: string;
  description?: string | null;
  bodyHtml: string;
  placeholders: string[];
  category?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface RagLetterTemplateUpsert {
  name: string;
  description?: string;
  bodyHtml: string;
  category?: string;
}

export interface RagLetterGenerateRequest {
  templateId: number;
  empcod: string;
  polishWithAi?: boolean;
  format?: 'docx' | 'pdf';
  extraVars?: Record<string, string>;
}
