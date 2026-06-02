import apiInstance from './apiInstance';

/**
 * Client typé du workflow de signature électronique (Phase 4 UI).
 * Mappe l'API serveur `api/Signatures/*` (cf. SignaturesController) :
 *   start | inbox | {id} | {id}/steps/{stepId}/sign|otp|reject|delegate | verify-seal/{docId}
 *
 * Le backend est gated [RequirePlanFeature(ElectronicSignature)] : un 402 est
 * intercepté globalement par apiInstance (redirection /upgrade), donc les
 * composants n'ont pas à gérer ce cas.
 */

export type SignatureWorkflowStatus =
  | 'awaiting_signatures'
  | 'in_validation'
  | 'rejected'
  | 'all_signed'
  | 'archived';

export type SignatureStepStatus = 'pending' | 'signed' | 'rejected' | 'skipped';

export interface SignatureInboxItem {
  requestId: number;
  stepId: number;
  stepOrder: number;
  sourceType: string;
  sourceId: string | null;
  documentVaultId: number | null;
  docName: string;
  createdAt: string;
}

export interface SignatureStepView {
  id: number;
  stepOrder: number;
  signerEmpcod: string;
  signerRole: string;
  status: SignatureStepStatus | string;
  placeholderKey: string | null;
  delegatedTo: string | null;
}

export interface SignatureActionView {
  stepId: number;
  signerEmpcod: string;
  action: string;
  certificateId: string | null;
  authMethod: string | null;
  signedAt: string;
  motif: string | null;
}

export interface SignatureRequestView {
  id: number;
  sourceType: string;
  sourceId: string | null;
  documentVaultId: number | null;
  workflowStatus: SignatureWorkflowStatus | string;
  currentStep: number;
  createdAt: string;
  completedAt: string | null;
  sealValid: boolean | null;
  sealHash: string | null;
  steps: SignatureStepView[];
  actions: SignatureActionView[];
}

export interface SignStepBody {
  signatureData: string;
  signerName?: string;
  mention?: string;
  location?: string;
  /** Code OTP optionnel (renforce le niveau de garantie). */
  otpCode?: string;
  /** 'email' (défaut) | 'totp'. Ignoré si otpCode absent. */
  otpMethod?: 'email' | 'totp';
}

export interface SignStepResult {
  completed: boolean;
  certificateId: string | null;
  workflowStatus: SignatureWorkflowStatus | string;
  sealHash: string | null;
}

export interface StartBody {
  sourceType: string;
  sourceId?: string | null;
  empcod: string;
  docName?: string;
  extraVars?: Record<string, string>;
  /** Niveaux d'approbation après l'employé (0 = employé seul ; 1 = + manager direct). */
  approverLevels?: number;
}

export interface StartResult {
  requestId: number;
  documentVaultId: number;
  docName: string;
}

export interface SignatureSourceType {
  sourceType: string;
  label: string;
}

const base = '/Signatures';

export const signatureWorkflowApi = {
  async start(body: StartBody): Promise<StartResult> {
    const res = await apiInstance.post(`${base}/start`, body);
    return res.data;
  },

  async inbox(): Promise<SignatureInboxItem[]> {
    const res = await apiInstance.get(`${base}/inbox`);
    return res.data ?? [];
  },

  /** Types de documents signables configurés pour le tenant (alimente le sélecteur d'envoi). */
  async sourceTypes(): Promise<SignatureSourceType[]> {
    const res = await apiInstance.get(`${base}/source-types`);
    return res.data ?? [];
  },

  async get(requestId: number): Promise<SignatureRequestView> {
    const res = await apiInstance.get(`${base}/${requestId}`);
    return res.data;
  },

  /** Envoie un OTP email au signataire de l'étape courante. Renvoie l'email masqué. */
  async sendOtp(requestId: number, stepId: number): Promise<{ sent: boolean; email: string }> {
    const res = await apiInstance.post(`${base}/${requestId}/steps/${stepId}/otp`, {});
    return res.data;
  },

  async sign(requestId: number, stepId: number, body: SignStepBody): Promise<SignStepResult> {
    const res = await apiInstance.post(`${base}/${requestId}/steps/${stepId}/sign`, body);
    return res.data;
  },

  async reject(requestId: number, stepId: number, motif: string): Promise<void> {
    await apiInstance.post(`${base}/${requestId}/steps/${stepId}/reject`, { motif });
  },

  async delegate(requestId: number, stepId: number, toEmpcod: string): Promise<void> {
    await apiInstance.post(`${base}/${requestId}/steps/${stepId}/delegate`, { toEmpcod });
  },

  async verifySeal(documentVaultId: number): Promise<{ sealed_: boolean; valid: boolean; storedHash: string | null; computedHash: string | null }> {
    const res = await apiInstance.post(`${base}/verify-seal/${documentVaultId}`, {});
    return res.data;
  },
};

/** Libellés FR des statuts de workflow (badges / timeline). */
export const WORKFLOW_STATUS_LABELS: Record<string, { label: string; tone: 'pending' | 'signed' | 'rejected' | 'sealed' }> = {
  awaiting_signatures: { label: 'En attente de signature', tone: 'pending' },
  in_validation: { label: 'En cours de validation', tone: 'pending' },
  rejected: { label: 'Rejeté', tone: 'rejected' },
  all_signed: { label: 'Signé', tone: 'signed' },
  archived: { label: 'Scellé & archivé', tone: 'sealed' },
};

/** Libellés FR du rôle de signataire dérivés du placeholder / signerRole. */
export function signerRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Signataire';
  const r = role.toLowerCase();
  if (r.includes('collaborateur') || r === 'employe' || r === 'employee') return 'Collaborateur';
  if (r.includes('approbateur') || r.includes('manager')) return 'Approbateur';
  if (r.includes('societe') || r.includes('rh')) return 'Représentant';
  return role;
}
