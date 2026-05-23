import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Paper, Button, TextField,
  CircularProgress, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Stack, Alert, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CancelIcon from '@mui/icons-material/Cancel';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import apiInstance from '../../API/apiInstance';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';

/**
 * Page « Mes demandes d'absence » côté collaborateur.
 *
 * Différences clés avec TeletravailModern :
 *   • Upload d'un justificatif obligatoire dans la pratique (mais facultatif côté
 *     API, le manager peut accepter sans pièce s'il le souhaite).
 *   • Bouton « Scanner avec l'IA » qui appelle /DocumentScan/scan-absence-justification
 *     pour pré-remplir les dates / motif / catégorie depuis le PDF ou photo.
 *   • Soumission en multipart/form-data (FormData) — la création accepte le fichier
 *     dans la même requête, on évite un round-trip upload séparé.
 */
type Status = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

interface AbsenceTypeOption {
  abscod: string;
  abslib: string;
}

interface DemandeAbsenceDto {
  id: number;
  empcod: string | null;
  employeeName: string | null;
  requestedAt: string;
  startDate: string;
  endDate: string;
  daysCount: number | null;
  abscod: string | null;
  absenceLabel: string | null;
  reason: string | null;
  justificationUrl: string | null;
  justificationFilename: string | null;
  justificationMime: string | null;
  justificationSize: number | null;
  status: Status;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
}

const STATUS_STYLE: Record<Status, { bg: string; color: string; label: string }> = {
  Pending:   { bg: '#fef9c3', color: '#854d0e', label: 'En attente' },
  Approved:  { bg: '#dcfce7', color: '#166534', label: 'Acceptée' },
  Rejected:  { bg: '#fee2e2', color: '#991b1b', label: 'Refusée' },
  Cancelled: { bg: '#e2e8f0', color: '#475569', label: 'Annulée' },
};

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const formatBytes = (b?: number | null) => {
  if (!b) return '';
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} ko`;
  return `${(b / 1024 / 1024).toFixed(1)} Mo`;
};

export default function DemandeAbsenceModern() {
  const [items, setItems] = useState<DemandeAbsenceDto[]>([]);
  const [absenceTypes, setAbsenceTypes] = useState<AbsenceTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const feedback = useFeedbackSnackbar();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiInstance.get<DemandeAbsenceDto[]>('/DemandeAbsence/me');
      setItems(data ?? []);
    } catch (err) {
      feedback.showError(err, 'Impossible de charger vos demandes.');
    } finally {
      setLoading(false);
    }
    // ⚠️ `feedback` est volontairement omis des deps : useFeedbackSnackbar()
    // retourne un nouvel objet à chaque render (l'élément Snackbar JSX dépend
    // du state interne). L'inclure ici recrée `reload` à chaque render →
    // useEffect ci-dessous re-fire → boucle infinie de GET /DemandeAbsence/me
    // qui finit par 503er le backend (cf. incident 2026-05-23). Les méthodes
    // appelées (`showError`) sont elles-mêmes stables (useCallback côté hook),
    // donc capturer une "vieille" référence ne change rien à leur comportement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chargement des types d'absence (réutilise l'endpoint existant — pas besoin
  // de dupliquer la liste côté nouveau modèle).
  const loadAbsenceTypes = useCallback(async () => {
    try {
      const { data } = await apiInstance.get<any>('/Absences');
      // L'endpoint peut renvoyer un Array ou un dict {abscod: abslib}. On
      // normalise — mais on REJETTE explicitement les chaînes : quand le
      // backend renvoie une page d'erreur HTML (proxy Vite en 503, IIS
      // service unavailable…), `data` arrive comme string "<!doctype html>…".
      // Sans ce garde, Object.entries(string) produit [["0","<"],["1","!"]…]
      // et l'UI affiche un MenuItem par caractère (cf. incident 2026-05-24).
      let arr: AbsenceTypeOption[] = [];
      if (Array.isArray(data)) {
        arr = data
          .map((a: any) => ({ abscod: a.abscod ?? a.Abscod ?? '', abslib: a.abslib ?? a.Abslib ?? '' }))
          .filter(a => a.abscod);
      } else if (data && typeof data === 'object') {
        arr = Object.entries<string>(data).map(([abscod, abslib]) => ({ abscod, abslib }));
      }
      setAbsenceTypes(arr);
    } catch { /* silent — l'utilisateur peut quand même saisir sans type */ }
  }, []);

  useEffect(() => { reload(); loadAbsenceTypes(); }, [reload, loadAbsenceTypes]);

  const handleCancel = async (id: number) => {
    if (!window.confirm('Annuler cette demande d\'absence ?')) return;
    try {
      await apiInstance.post(`/DemandeAbsence/${id}/cancel`);
      feedback.showSuccess('Demande annulée.');
      await reload();
    } catch (err) {
      feedback.showError(err, "Impossible d'annuler la demande.");
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <LocalHospitalIcon sx={{ color: '#0040a1', fontSize: 32 }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Mes demandes d'absence
            </Typography>
          </Stack>
          <Typography sx={{ color: '#64748b', mt: 0.5 }}>
            Soumettez une demande avec justificatif (certificat médical, convocation…).
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreate(true)}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, py: 1.2, background: 'linear-gradient(135deg, #0040a1, #0056d2)' }}
        >
          Nouvelle demande
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: '16px', border: '1px dashed #cbd5e1', background: '#f8fafc' }}>
          <LocalHospitalIcon sx={{ fontSize: 56, color: '#94a3b8', mb: 1 }} />
          <Typography sx={{ color: '#475569', fontWeight: 600 }}>Aucune demande d'absence.</Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: 14, mt: 0.5 }}>Cliquez sur « Nouvelle demande » pour en créer une.</Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {items.map((it) => {
            const style = STATUS_STYLE[it.status];
            return (
              <Paper key={it.id} elevation={0} sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
                      <Chip label={style.label} size="small" sx={{ bgcolor: style.bg, color: style.color, fontWeight: 700 }} />
                      {it.absenceLabel && (
                        <Chip label={it.absenceLabel} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                      )}
                      {it.daysCount != null && (
                        <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                          {it.daysCount} jour{it.daysCount > 1 ? 's' : ''} ouvré{it.daysCount > 1 ? 's' : ''}
                        </Typography>
                      )}
                    </Stack>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                      Du {fmtDate(it.startDate)} au {fmtDate(it.endDate)}
                    </Typography>
                    {it.reason && (
                      <Typography sx={{ fontSize: 13, color: '#475569', mt: 0.5, fontStyle: 'italic' }}>« {it.reason} »</Typography>
                    )}
                    {it.justificationUrl && (
                      <Button
                        href={it.justificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<AttachFileIcon />}
                        size="small"
                        sx={{ mt: 1, textTransform: 'none', fontWeight: 600 }}
                      >
                        {it.justificationFilename ?? 'Justificatif'}
                        {it.justificationSize ? ` · ${formatBytes(it.justificationSize)}` : ''}
                      </Button>
                    )}
                    {it.status === 'Rejected' && it.decisionComment && (
                      <Alert severity="error" sx={{ mt: 1, py: 0.5, borderRadius: '8px' }}>
                        Motif du refus : {it.decisionComment}
                      </Alert>
                    )}
                    {it.status === 'Approved' && it.decisionComment && (
                      <Alert severity="success" sx={{ mt: 1, py: 0.5, borderRadius: '8px' }}>{it.decisionComment}</Alert>
                    )}
                    <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 1 }}>
                      Soumise le {fmtDate(it.requestedAt)}
                      {it.decidedAt && it.decidedByName && ` · décidée le ${fmtDate(it.decidedAt)} par ${it.decidedByName}`}
                    </Typography>
                  </Box>
                  {it.status === 'Pending' && (
                    <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => handleCancel(it.id)} sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 600 }}>
                      Annuler
                    </Button>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <CreateDialog open={openCreate} onClose={() => setOpenCreate(false)} onCreated={() => { setOpenCreate(false); reload(); }} absenceTypes={absenceTypes} />
      {feedback.element}
    </Box>
  );
}

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  absenceTypes: AbsenceTypeOption[];
}

function CreateDialog({ open, onClose, onCreated, absenceTypes }: CreateDialogProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [abscod, setAbscod] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedback = useFeedbackSnackbar();

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
      setAbscod('');
      setReason('');
      setFile(null);
      setScanInfo(null);
      setError(null);
    }
  }, [open]);

  /**
   * Sélection du fichier ET lancement automatique du scan IA pour pré-remplir.
   * Si le scan échoue (clé API absente, document illisible…), on garde quand
   * même le fichier sélectionné — l'utilisateur peut compléter manuellement.
   */
  const handleFilePick = async (selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    setScanInfo(null);
    setError(null);
    setScanLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', selected);
      const { data } = await apiInstance.post('/DocumentScan/scan-absence-justification', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data?.success && data.extractedData) {
        const ext = data.extractedData;
        if (ext.startDate) setStartDate(ext.startDate);
        if (ext.endDate) setEndDate(ext.endDate);
        if (ext.reason) setReason(ext.reason);
        // Mapping catégorie IA → abscod si on retrouve un type d'absence
        // correspondant dans la table de référence (matching insensible à la casse).
        if (ext.absenceCategory && absenceTypes.length > 0) {
          const cat = String(ext.absenceCategory).toLowerCase();
          const map: Record<string, string[]> = {
            maladie: ['malad', 'arret', 'arrêt'],
            evenement_familial: ['famil', 'mariage', 'deces', 'décès', 'naiss'],
            rdv_medical: ['rdv', 'consult', 'medic', 'médic'],
            convocation_officielle: ['convoc', 'tribunal', 'admin'],
            formation: ['formation', 'cours', 'stage'],
          };
          const aliases = map[cat] ?? [cat];
          const found = absenceTypes.find(a =>
            aliases.some(al => a.abslib?.toLowerCase().includes(al))
          );
          if (found) setAbscod(found.abscod);
        }
        setScanInfo(data.message ?? 'Justificatif analysé et formulaire pré-rempli.');
      } else if (data?.message) {
        setScanInfo(data.message);
      }
    } catch (err: any) {
      // Pas un blocker — l'utilisateur peut quand même soumettre manuellement.
      const status = err?.response?.status;
      if (status === 402) {
        setScanInfo("Scan IA non disponible sur votre pack (DocumentScanOcr requis). Vous pouvez quand même soumettre la demande manuellement.");
      } else {
        setScanInfo("Le scan automatique n'a pas pu analyser ce document. Complétez le formulaire manuellement.");
      }
    } finally {
      setScanLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!startDate || !endDate) { setError('Sélectionnez les dates de début et fin.'); return; }
    if (endDate < startDate) { setError('La date de fin doit être ≥ à la date de début.'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('StartDate', startDate);
      fd.append('EndDate', endDate);
      if (abscod) fd.append('Abscod', abscod);
      if (reason.trim()) fd.append('Reason', reason.trim());
      if (file) fd.append('file', file);
      await apiInstance.post('/DemandeAbsence', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      feedback.showSuccess('Demande envoyée — votre manager sera notifié.');
      onCreated();
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error;
      setError(apiMsg ?? "Impossible d'envoyer la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Nouvelle demande d'absence
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {/* Bouton scan IA — placé en HAUT du formulaire pour matérialiser le
              workflow recommandé : « scannez d'abord, le formulaire se remplit
              tout seul ». L'utilisateur peut quand même saisir manuellement
              s'il préfère. */}
          <Paper variant="outlined" sx={{ p: 2, borderStyle: 'dashed', borderColor: '#bfdbfe', background: '#eff6ff', borderRadius: '12px' }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#0040a1' }} />
              <Typography sx={{ fontWeight: 700, color: '#0040a1' }}>Scanner avec l'IA (recommandé)</Typography>
            </Stack>
            <Typography sx={{ fontSize: 12, color: '#1e40af', mb: 1.5 }}>
              Téléchargez votre justificatif (certificat médical, convocation…). Notre IA extrait automatiquement les dates et le motif.
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="contained"
              startIcon={scanLoading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={scanLoading}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}
            >
              {scanLoading ? 'Analyse…' : file ? 'Changer le justificatif' : 'Choisir le justificatif'}
            </Button>
            {file && (
              <Typography sx={{ fontSize: 12, color: '#0f172a', mt: 1 }}>
                📎 {file.name} <span style={{ color: '#64748b' }}>({formatBytes(file.size)})</span>
              </Typography>
            )}
            {scanInfo && (
              <Alert severity="info" sx={{ mt: 1.5, py: 0.5, borderRadius: '8px', fontSize: 12 }}>
                {scanInfo}
              </Alert>
            )}
          </Paper>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Date de début" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="Date de fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
          </Stack>

          <TextField
            select
            label="Type d'absence (facultatif)"
            value={abscod}
            onChange={(e) => setAbscod(e.target.value)}
            fullWidth
            helperText={absenceTypes.length === 0 ? 'Aucun type configuré — saisie libre via le motif.' : undefined}
          >
            <MenuItem value=""><em>— Non spécifié —</em></MenuItem>
            {absenceTypes.map((a) => (
              <MenuItem key={a.abscod} value={a.abscod}>{a.abslib || a.abscod}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Motif"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 1000))}
            fullWidth
            multiline
            rows={3}
            placeholder="Ex : arrêt maladie suite à consultation du Dr. X, durée 3 jours."
            helperText={`${reason.length}/1000`}
          />

          {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Annuler</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', background: 'linear-gradient(135deg, #0040a1, #0056d2)' }}
        >
          {submitting ? 'Envoi…' : 'Soumettre'}
        </Button>
        {feedback.element}
      </DialogActions>
    </Dialog>
  );
}
