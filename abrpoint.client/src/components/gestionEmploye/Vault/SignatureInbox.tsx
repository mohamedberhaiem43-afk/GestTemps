import { useEffect, useState, useCallback } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, Select, MenuItem, TextField, CircularProgress, Box, Typography, InputLabel,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { signatureWorkflowApi, SignatureInboxItem, SignatureSourceType } from '../../API/signatureWorkflow';
import { useAuth } from '../../helper/AuthProvider';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';
import useGetEmployee from '../../../hooks/employeHooks/useGetEmployee';
import './Signature.css';

/**
 * Boîte de signature : étapes en attente de l'utilisateur courant (employé OU
 * approbateur dans un circuit). Alimentée par `GET api/Signatures/inbox`. Un clic
 * sur une demande ouvre SignaturePage en mode workflow (requestId + stepId), où
 * l'utilisateur signe (avec OTP optionnel), refuse, ou délègue son étape.
 *
 * Un administrateur dispose en plus du bouton « Nouvelle demande » qui lance un
 * parcours de signature (`POST api/Signatures/start`) : choix du collaborateur,
 * du type de document (modèle lié), et du nombre de niveaux d'approbation.
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
  const { hasPermission } = useAuth();
  // Phase 2 : le lancement n'est plus réservé à l'admin. Tout profil de gestion (admin, RH,
  // manager) ayant le droit « Gestion Employés » peut lancer une signature pour son périmètre ;
  // le backend revérifie le droit ET la portée (sites ∩ service). Le rôle Employé est exclu.
  const canSend = hasPermission('Gestion Employés', 'consult');
  const { showSuccess, showError, element: snackbarElement } = useFeedbackSnackbar();
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

  // ── Dialog « Nouvelle demande de signature » (admin) ────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sourceTypes, setSourceTypes] = useState<SignatureSourceType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [sourceType, setSourceType] = useState('');
  const [empcod, setEmpcod] = useState('');
  const [docName, setDocName] = useState('');
  const [approverLevels, setApproverLevels] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  // Dict empcod→libellé ; le hook le désactive pour un employé simple (sans droit liste).
  const { data: employeOptions = {} } = useGetEmployee();
  const employeEntries = Object.entries(employeOptions as Record<string, string>);

  const openDialog = useCallback(async () => {
    setDialogOpen(true);
    setSourceType(''); setEmpcod(''); setDocName(''); setApproverLevels(1);
    setLoadingTypes(true);
    try {
      const types = await signatureWorkflowApi.sourceTypes();
      setSourceTypes(types);
      if (types.length) setSourceType(types[0].sourceType);
    } catch {
      showError("Impossible de charger les types de document signables.");
    } finally {
      setLoadingTypes(false);
    }
  }, [showError]);

  const handleStart = async () => {
    if (!sourceType || !empcod) {
      showError('Sélectionnez un collaborateur et un type de document.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await signatureWorkflowApi.start({
        sourceType,
        empcod,
        docName: docName.trim() || undefined,
        approverLevels,
      });
      showSuccess(`Demande de signature envoyée : « ${res.docName} ».`);
      setDialogOpen(false);
      load();
    } catch (err) {
      showError(err, "Échec de l'envoi de la demande de signature.");
    } finally {
      setSubmitting(false);
    }
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
      <div className="sig-inbox-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="sig-inbox-title">
            <span className="material-symbols-outlined" style={{ color: '#0040a1' }}>drafts</span>
            Demandes de signature
          </div>
          <div className="sig-inbox-sub">
            Documents en attente de votre signature ou de votre validation.
          </div>
        </div>
        {canSend && (
          <Button
            variant="contained"
            onClick={openDialog}
            startIcon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}
            sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 700, background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)', whiteSpace: 'nowrap' }}
          >
            Nouvelle demande
          </Button>
        )}
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

      {/* Dialog : lancer un nouveau parcours de signature */}
      <Dialog open={dialogOpen} onClose={() => !submitting && setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px' }}>
          Nouvelle demande de signature
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {loadingTypes ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
          ) : (
            <>
              <FormControl fullWidth size="small">
                <InputLabel id="sig-type-label">Type de document</InputLabel>
                <Select
                  labelId="sig-type-label"
                  label="Type de document"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  sx={{ borderRadius: '8px' }}
                >
                  {sourceTypes.length === 0 && <MenuItem value="" disabled>Aucun modèle configuré</MenuItem>}
                  {sourceTypes.map((s) => (
                    <MenuItem key={s.sourceType} value={s.sourceType}>{s.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel id="sig-emp-label">Collaborateur (signataire)</InputLabel>
                <Select
                  labelId="sig-emp-label"
                  label="Collaborateur (signataire)"
                  value={empcod}
                  onChange={(e) => setEmpcod(e.target.value)}
                  sx={{ borderRadius: '8px' }}
                >
                  {employeEntries.length === 0 && <MenuItem value="" disabled>Aucun collaborateur</MenuItem>}
                  {employeEntries.map(([code, lib]) => (
                    <MenuItem key={code} value={code}>{String(lib)}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel id="sig-levels-label">Circuit d'approbation</InputLabel>
                <Select
                  labelId="sig-levels-label"
                  label="Circuit d'approbation"
                  value={approverLevels}
                  onChange={(e) => setApproverLevels(Number(e.target.value))}
                  sx={{ borderRadius: '8px' }}
                >
                  <MenuItem value={0}>Signataire seul</MenuItem>
                  <MenuItem value={1}>+ Manager direct</MenuItem>
                  <MenuItem value={2}>+ Manager direct & N+2</MenuItem>
                </Select>
              </FormControl>

              <Box>
                <TextField
                  fullWidth size="small"
                  label="Nom du document (optionnel)"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Ex: Avenant 2026 — Jean Dupont"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
                <Typography sx={{ fontSize: '11px', color: '#94a3b8', mt: 0.75 }}>
                  Le document est généré depuis le modèle lié au type choisi, pré-rempli avec les données du collaborateur, puis envoyé à la signature.
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting} sx={{ color: '#64748b', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={handleStart}
            variant="contained"
            disabled={submitting || loadingTypes || !sourceType || !empcod}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 700, background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}
          >
            {submitting ? 'Envoi…' : 'Envoyer'}
          </Button>
        </DialogActions>
      </Dialog>

      {snackbarElement}
    </div>
  );
}
