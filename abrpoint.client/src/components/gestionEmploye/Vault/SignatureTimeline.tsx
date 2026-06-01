import { useMemo } from 'react';
import {
  SignatureRequestView,
  SignatureActionView,
  signerRoleLabel,
  WORKFLOW_STATUS_LABELS,
} from '../../API/signatureWorkflow';

/**
 * Timeline de statut d'un parcours de signature : enchaînement ordonné des
 * étapes (employé → approbateurs) avec, pour chaque étape, son état courant et
 * l'action journalisée correspondante (signataire réel, méthode d'auth, date,
 * motif de rejet). Réutilisée dans SignaturePage (mode workflow) et dans la vue
 * détail de l'inbox. Lecture seule.
 */
interface Props {
  request: SignatureRequestView;
  /** empcod de l'utilisateur courant — surligne « Vous ». */
  currentEmpcod?: string | null;
}

function actionForStep(actions: SignatureActionView[], stepId: number): SignatureActionView | undefined {
  // Registre append-only : on prend la dernière action de l'étape (la plus récente).
  return [...actions].reverse().find(a => a.stepId === stepId);
}

const STEP_TONE: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  signed: { color: '#005136', bg: '#e6f4ee', icon: 'check_circle', label: 'Signé' },
  rejected: { color: '#ba1a1a', bg: '#fdeaea', icon: 'cancel', label: 'Rejeté' },
  skipped: { color: '#94a3b8', bg: '#f1f5f9', icon: 'remove_circle', label: 'Ignoré' },
  pending: { color: '#b45309', bg: '#fef3c7', icon: 'pending', label: 'En attente' },
};

const AUTH_METHOD_LABELS: Record<string, string> = {
  handwritten: 'Signature manuscrite',
  password_otp_email: 'OTP par e-mail',
  totp: 'Authentificateur (TOTP)',
};

export default function SignatureTimeline({ request, currentEmpcod }: Props) {
  const statusMeta = WORKFLOW_STATUS_LABELS[request.workflowStatus] ?? { label: request.workflowStatus, tone: 'pending' as const };
  const steps = useMemo(() => [...request.steps].sort((a, b) => a.stepOrder - b.stepOrder), [request.steps]);

  return (
    <div className="sig-timeline">
      <div className="sig-timeline-header">
        <div className="sig-panel-section-label" style={{ margin: 0 }}>Parcours de signature</div>
        <span className={`sig-badge sig-badge--${statusMeta.tone === 'sealed' ? 'signed' : statusMeta.tone}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            {statusMeta.tone === 'rejected' ? 'cancel' : statusMeta.tone === 'pending' ? 'pending' : 'verified'}
          </span>
          {statusMeta.label}
        </span>
      </div>

      <ol className="sig-timeline-list">
        {steps.map((step) => {
          const isCurrent = step.stepOrder === request.currentStep
            && request.workflowStatus !== 'rejected'
            && request.workflowStatus !== 'all_signed'
            && request.workflowStatus !== 'archived';
          const tone = STEP_TONE[step.status] ?? STEP_TONE.pending;
          const action = actionForStep(request.actions, step.id);
          const isMe = !!currentEmpcod && (
            step.signerEmpcod?.toLowerCase() === currentEmpcod.toLowerCase()
            || step.delegatedTo?.toLowerCase() === currentEmpcod.toLowerCase()
          );
          const signedBy = action?.signerEmpcod || step.delegatedTo || step.signerEmpcod;
          return (
            <li key={step.id} className={`sig-timeline-item ${isCurrent ? 'is-current' : ''}`}>
              <div className="sig-timeline-dot" style={{ background: tone.bg, color: tone.color }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{tone.icon}</span>
              </div>
              <div className="sig-timeline-content">
                <div className="sig-timeline-row">
                  <span className="sig-timeline-role">
                    {signerRoleLabel(step.signerRole)}
                    {isMe && <span className="sig-timeline-you"> (Vous)</span>}
                  </span>
                  <span className="sig-timeline-status" style={{ color: tone.color }}>{tone.label}</span>
                </div>
                <div className="sig-timeline-meta">
                  <span>{signedBy}</span>
                  {step.delegatedTo && step.delegatedTo.toLowerCase() !== step.signerEmpcod.toLowerCase() && (
                    <span className="sig-timeline-deleg"> · délégué depuis {step.signerEmpcod}</span>
                  )}
                </div>
                {action && step.status === 'signed' && (
                  <div className="sig-timeline-detail">
                    {AUTH_METHOD_LABELS[action.authMethod ?? ''] ?? action.authMethod ?? 'Signé'}
                    {' · '}
                    {new Date(action.signedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {action.certificateId && <> · <code className="sig-timeline-cert">{action.certificateId}</code></>}
                  </div>
                )}
                {action && step.status === 'rejected' && action.motif && (
                  <div className="sig-timeline-detail sig-timeline-detail--reject">Motif : {action.motif}</div>
                )}
                {isCurrent && step.status === 'pending' && (
                  <div className="sig-timeline-detail sig-timeline-detail--current">Étape en cours</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {request.sealHash && (
        <div className="sig-timeline-seal">
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#005136' }}>shield_lock</span>
          <div>
            <div className="sig-timeline-seal-label">Sceau d'intégrité SHA-256{request.sealValid === false ? ' — INVALIDE' : ''}</div>
            <code className="sig-timeline-seal-hash">{request.sealHash}</code>
          </div>
        </div>
      )}
    </div>
  );
}
