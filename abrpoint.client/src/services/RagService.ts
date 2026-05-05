import apiInstance from '../components/API/apiInstance';
import { RagDocument } from '../models/RagDocument';
import {
  RagLetterTemplate,
  RagLetterTemplateUpsert,
  RagLetterGenerateRequest,
} from '../models/RagLetterTemplate';

const API_URL = '/Documents';
const LETTERS_URL = '/LetterTemplates';

export interface RagHealth {
  ok: boolean;
  sidecar: boolean;
  sidecarUrl: string;
  anthropicConfigured: boolean;
  anthropicModel: string;
}

export interface RagChatSource {
  documentId: number;
  documentName?: string | null;
  page?: number | null;
  snippet: string;
  score: number;
}

export interface RagChatAnswer {
  logId: number;
  answer: string;
  sources: RagChatSource[];
  tokensIn?: number | null;
  tokensOut?: number | null;
  latencyMs: number;
}

export interface RagChatLog {
  id: number;
  category: string;
  uticod?: string | null;
  question?: string | null;
  answer?: string | null;
  sources?: RagChatSource[] | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  latencyMs?: number | null;
  createdAt: string;
  feedbackScore?: number | null;
  feedbackComment?: string | null;
}

const RagService = {
  // -- Documents ----------------------------------------------------------
  list: async (): Promise<RagDocument[]> => {
    const res = await apiInstance.get(API_URL);
    return res.data;
  },

  upload: async (file: File, category: string): Promise<RagDocument> => {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    const res = await apiInstance.post(`${API_URL}/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  remove: async (id: number): Promise<void> => {
    await apiInstance.delete(`${API_URL}/${id}`);
  },

  reindex: async (id: number): Promise<void> => {
    await apiInstance.post(`${API_URL}/${id}/reindex`);
  },

  download: async (id: number): Promise<Blob> => {
    const res = await apiInstance.get(`${API_URL}/${id}/download`, {
      responseType: 'blob',
    });
    return res.data;
  },

  // -- Health -------------------------------------------------------------
  health: async (): Promise<RagHealth> => {
    const res = await apiInstance.get('/Rag/health');
    return res.data;
  },

  // -- Chat ---------------------------------------------------------------
  ask: async (question: string, topK = 5): Promise<RagChatAnswer> => {
    const res = await apiInstance.post('/ChatRag/ask', { question, topK });
    return res.data;
  },

  feedback: async (logId: number, score: number, comment?: string): Promise<void> => {
    await apiInstance.post(`/ChatRag/${logId}/feedback`, { score, comment });
  },

  audit: async (skip = 0, take = 50): Promise<{ total: number; items: RagChatLog[] }> => {
    const res = await apiInstance.get('/ChatRag/audit', { params: { skip, take } });
    return res.data;
  },

  // -- Letter templates ---------------------------------------------------
  listTemplates: async (): Promise<RagLetterTemplate[]> => {
    const res = await apiInstance.get(LETTERS_URL);
    return res.data;
  },

  getTemplate: async (id: number): Promise<RagLetterTemplate> => {
    const res = await apiInstance.get(`${LETTERS_URL}/${id}`);
    return res.data;
  },

  createTemplate: async (req: RagLetterTemplateUpsert): Promise<RagLetterTemplate> => {
    const res = await apiInstance.post(LETTERS_URL, req);
    return res.data;
  },

  updateTemplate: async (id: number, req: RagLetterTemplateUpsert): Promise<RagLetterTemplate> => {
    const res = await apiInstance.put(`${LETTERS_URL}/${id}`, req);
    return res.data;
  },

  deleteTemplate: async (id: number): Promise<void> => {
    await apiInstance.delete(`${LETTERS_URL}/${id}`);
  },

  generateLetter: async (
    req: RagLetterGenerateRequest,
  ): Promise<{ blob: Blob; fileName: string }> => {
    const res = await apiInstance.post(`${LETTERS_URL}/generate`, req, {
      responseType: 'blob',
    });
    // Extrait le filename depuis Content-Disposition si fourni.
    const cd = res.headers['content-disposition'] as string | undefined;
    let fileName = req.format === 'pdf' ? 'courrier.pdf' : 'courrier.docx';
    if (cd) {
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
      if (match?.[1]) fileName = decodeURIComponent(match[1]);
    }
    return { blob: res.data, fileName };
  },
};

export default RagService;
