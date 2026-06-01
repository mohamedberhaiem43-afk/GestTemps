import { useEffect, useState, useCallback } from 'react';
import { CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { signatureWorkflowApi, SignatureInboxItem } from '../../API/signatureWorkflow';
import './Signature.css';

/**
 * Boîte de signature : étapes en attente de l'utilisateur courant (employé OU
 * approbateur dans un circuit). Alimentée par `GET api/Signatures/inbox`. Un clic
 * sur une demande ouvre SignaturePage en mode workflow (requestId + stepId), où
 * l'utilisateur signe (avec OTP optionnel), refuse, ou délègue son étape.
 */
const FR_SOURCE_LABELS: Record<string, string> = {
  contrat: 'Contrat',
  contract: 'Contrat',
  avenant: 'Avenant',
  letter: 'Courrier',
  courrier: 'Courrier',
  attestation: 'Attestation',
};

export default function SignatureInbox() {
  const navigate = useNavigate();
  const [items, setItems] = useState<SignatureInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await signatureWorkflowApi.inbox();
      setItems(data);
    } catch {
      setError('Impossible de charger vos demandes de signature.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openStep = (it: SignatureInboxItem) => {
    const params = new URLSearchParams({
      requestId: String(it.requestId),
      stepId: String(it.stepId),
    });
    if (it.documentVaultId != null) params.set('id', String(it.documentVaultId));
    // docName / sourceType : fallback d'affichage si l'aperçu Vault est inaccessible
    // au signataire (ex. approbateur hors service du document « Pending Signature »).
    if (it.docName) params.set('docName', it.docName);
    if (it.sourceType) params.set('sourceType', it.sourceType);
    navigate(`/dashboard/sign-document?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="sig-inbox-shell" style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="sig-inbox-shell">
      <div className="sig-inbox-head">
        <div className="sig-inbox-title">
          <span className="material-symbols-outlined" style={{ color: '#0040a1' }}>drafts</span>
          Demandes de signature
        </div>
        <div className="sig-inbox-sub">
          Documents en attente de votre signature ou de votre validation.
        </div>
      </div>

      {error && (
        <div className="sig-inbox-empty">
          <span className="material-symbols-outlined" style={{ color: '#fca5a5' }}>error_outline</span>
          <p style={{ fontWeight: 700, color: '#334155' }}>{error}</p>
          <button className="sig-btn-secondary" onClick={load}>Réessayer</button>
        </div>
      )}

      {!error && items.length === 0 && (
        <div className="sig-inbox-empty">
          <span className="material-symbols-outlined">inbox</span>
          <p style={{ fontWeight: 700, color: '#334155', margin: '0.75rem 0 0.25rem' }}>Aucune demande en attente</p>
          <p style={{ fontSize: '0.85rem' }}>Les documents qui requièrent votre signature apparaîtront ici.</p>
        </div>
      )}

      {!error && items.length > 0 && (
        <div className="sig-inbox-list">
          {items.map((it) => {
            const srcLabel = FR_SOURCE_LABELS[it.sourceType?.toLowerCase()] ?? it.sourceType;
            const created = new Date(it.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <div key={`${it.requestId}-${it.stepId}`} className="sig-inbox-card">
                <div className="sig-inbox-icon">
                  <span className="material-symbols-outlined" style={{ color: '#0040a1' }}>draw</span>
                </div>
                <div className="sig-inbox-info">
                  <div className="sig-inbox-docname">{it.docName}</div>
                  <div className="sig-inbox-metaline">
                    {srcLabel}{it.sourceId ? ` · réf. ${it.sourceId}` : ''} · demandé le {created}
                    {it.stepOrder > 1 && <> · étape {it.stepOrder} (approbation)</>}
                  </div>
                </div>
                <button className="sig-btn-primary" onClick={() => openStep(it)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>draw</span>
                  {it.stepOrder > 1 ? 'Examiner' : 'Signer'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
