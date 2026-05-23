import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import {
  RetentionPolicyApi,
  RetentionPolicy,
  RetentionBoundsSet,
} from './retentionPolicyApi';

interface FieldProps {
  label: string;
  help: string;
  value: number;
  bounds: { min: number; max: number };
  onChange: (v: number) => void;
  disabled?: boolean;
}

function DaysField({ label, help, value, bounds, onChange, disabled }: FieldProps) {
  const invalid = value < bounds.min || value > bounds.max;
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{label}</Typography>
        <Tooltip title={help} arrow>
          <InfoOutlinedIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
        </Tooltip>
      </Stack>
      <TextField
        size="small"
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value || '0', 10))}
        disabled={disabled}
        error={invalid}
        helperText={invalid
          ? `Doit être entre ${bounds.min} et ${bounds.max} jours.`
          : `Plage autorisée : ${bounds.min}–${bounds.max} jours.`}
        InputProps={{
          endAdornment: <InputAdornment position="end">jours</InputAdornment>,
          inputProps: { min: bounds.min, max: bounds.max },
        }}
        sx={{ width: 220 }}
      />
    </Box>
  );
}

export default function RetentionPolicyPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bounds, setBounds] = useState<RetentionBoundsSet | null>(null);
  const [initial, setInitial] = useState<RetentionPolicy | null>(null);
  const [draft, setDraft] = useState<RetentionPolicy | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    RetentionPolicyApi.get()
      .then((res) => {
        if (!alive) return;
        setBounds(res.bounds);
        setInitial(res.policy);
        setDraft(res.policy);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.response?.data?.error || 'Impossible de charger la politique de rétention.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isAdmin]);

  const dirty = useMemo(() => {
    if (!draft || !initial) return false;
    return (
      draft.auditLogDays !== initial.auditLogDays ||
      draft.presenceAnonymizeDays !== initial.presenceAnonymizeDays ||
      draft.presenceDeleteDays !== initial.presenceDeleteDays ||
      draft.refreshTokenDaysAfterExpiry !== initial.refreshTokenDaysAfterExpiry ||
      draft.knownDeviceInactiveDays !== initial.knownDeviceInactiveDays ||
      draft.pushTokenInactiveDays !== initial.pushTokenInactiveDays ||
      draft.ragChatLogDays !== initial.ragChatLogDays
    );
  }, [draft, initial]);

  const consistencyError = useMemo(() => {
    if (!draft) return null;
    if (draft.presenceDeleteDays < draft.presenceAnonymizeDays) {
      return 'La suppression définitive des pointages doit intervenir APRÈS leur anonymisation.';
    }
    return null;
  }, [draft]);

  if (!isAdmin) {
    return <AccessDenied message="Accès réservé aux administrateurs du tenant." />;
  }

  if (loading) {
    return (
      <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!draft || !bounds) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error ?? 'Politique de rétention indisponible.'}</Alert>
      </Box>
    );
  }

  const handleSave = async () => {
    if (consistencyError) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await RetentionPolicyApi.update({
        auditLogDays: draft.auditLogDays,
        presenceAnonymizeDays: draft.presenceAnonymizeDays,
        presenceDeleteDays: draft.presenceDeleteDays,
        refreshTokenDaysAfterExpiry: draft.refreshTokenDaysAfterExpiry,
        knownDeviceInactiveDays: draft.knownDeviceInactiveDays,
        pushTokenInactiveDays: draft.pushTokenInactiveDays,
        ragChatLogDays: draft.ragChatLogDays,
      });
      setInitial(updated);
      setDraft(updated);
      setSuccess('Politique de rétention enregistrée. Les purges quotidiennes appliqueront ces nouvelles durées dès la prochaine exécution.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Échec de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (initial) setDraft(initial);
    setError(null);
    setSuccess(null);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <ShieldIcon color="primary" sx={{ fontSize: 32 }} />
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            Politique de rétention RGPD
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Durées de conservation des données personnelles — clause 13.3 du contrat éditeur.
            Vous êtes le responsable de traitement : ces valeurs engagent votre conformité RGPD.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {consistencyError && <Alert severity="warning" sx={{ mb: 2 }}>{consistencyError}</Alert>}

      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0040a1', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Pointages
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Anonymisation puis suppression définitive des relevés d'heures (table <code>presence</code>).
          Durée légale max en France : 5 ans (Code du travail L3171-3).
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <DaysField
            label="Anonymisation des pointages"
            help="Les notes libres (preobs) sont effacées au-delà de ce seuil. Les heures travaillées agrégées restent en base pour la paie."
            value={draft.presenceAnonymizeDays}
            bounds={bounds.presenceAnonymize}
            onChange={(v) => setDraft({ ...draft, presenceAnonymizeDays: v })}
            disabled={saving}
          />
          <DaysField
            label="Suppression définitive des pointages"
            help="Hard delete : les lignes sont supprimées de la base et ne peuvent plus être restaurées. Recommandé : 1 825 jours (5 ans, limite légale)."
            value={draft.presenceDeleteDays}
            bounds={bounds.presenceDelete}
            onChange={(v) => setDraft({ ...draft, presenceDeleteDays: v })}
            disabled={saving}
          />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0040a1', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Journaux d'audit
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Traçabilité des actions effectuées sur la base (table <code>AuditLog</code>).
        </Typography>
        <DaysField
          label="Conservation des journaux d'audit"
          help="Durée pendant laquelle les entrées d'audit (action, utilisateur, IP) sont conservées avant purge automatique."
          value={draft.auditLogDays}
          bounds={bounds.auditLog}
          onChange={(v) => setDraft({ ...draft, auditLogDays: v })}
          disabled={saving}
        />
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#64748b', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Données techniques
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Données de session et d'usage applicatif — souvent fixées par les bonnes pratiques sécurité plutôt que par un choix métier.
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} flexWrap="wrap" useFlexGap>
          <DaysField
            label="Refresh tokens expirés"
            help="Durée de conservation des tokens d'authentification après leur expiration (pour analyse forensique)."
            value={draft.refreshTokenDaysAfterExpiry}
            bounds={bounds.refreshToken}
            onChange={(v) => setDraft({ ...draft, refreshTokenDaysAfterExpiry: v })}
            disabled={saving}
          />
          <DaysField
            label="Devices connus inactifs"
            help="Devices reconnus pour l'authentification, purgés s'ils n'ont plus été vus depuis ce délai."
            value={draft.knownDeviceInactiveDays}
            bounds={bounds.knownDevice}
            onChange={(v) => setDraft({ ...draft, knownDeviceInactiveDays: v })}
            disabled={saving}
          />
          <DaysField
            label="Push tokens inactifs"
            help="Tokens de notification push désactivés (désinstallation, refus) purgés après inactivité."
            value={draft.pushTokenInactiveDays}
            bounds={bounds.pushToken}
            onChange={(v) => setDraft({ ...draft, pushTokenInactiveDays: v })}
            disabled={saving}
          />
          <DaysField
            label="Historique chats IA"
            help="Conversations avec l'assistant IA (RAG) — peuvent contenir des questions nominatives."
            value={draft.ragChatLogDays}
            bounds={bounds.ragChatLog}
            onChange={(v) => setDraft({ ...draft, ragChatLogDays: v })}
            disabled={saving}
          />
        </Stack>
      </Paper>

      <Divider sx={{ mb: 2 }} />

      <Stack direction="row" spacing={2} alignItems="center">
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={!dirty || !!consistencyError || saving}
        >
          Enregistrer
        </Button>
        <Button
          variant="text"
          startIcon={<RestoreIcon />}
          onClick={handleReset}
          disabled={!dirty || saving}
        >
          Annuler les modifications
        </Button>
        {initial?.updatedAt && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            Dernière mise à jour : {new Date(initial.updatedAt).toLocaleString('fr-FR')}
            {initial.updatedBy ? ` par ${initial.updatedBy}` : ''}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
