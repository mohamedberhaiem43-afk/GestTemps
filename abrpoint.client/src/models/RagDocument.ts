export type RagDocumentStatus = 'pending' | 'indexed' | 'failed';
export type RagDocumentCategory = 'convention' | 'reglement' | 'accord' | 'autre';

export interface RagDocument {
  id: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  category: RagDocumentCategory;
  uploadedBy?: string | null;
  uploadedAt: string;
  status: RagDocumentStatus;
  chunksCount?: number | null;
  errorMessage?: string | null;
}
