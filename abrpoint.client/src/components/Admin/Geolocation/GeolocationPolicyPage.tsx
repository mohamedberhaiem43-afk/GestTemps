import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import { GeolocationPolicyApi, GeolocationPolicy } from './geolocationPolicyApi';

const DAYS: { code: string; label: string }[] = [
  { code: '1', label: 'L' },
  { code: '2', label: 'M' },
  { code: '3', label: 'M' },
  { code: '4', label: 'J' },
  { code: '5', label: 'V' },
  { code: '6', label: 'S' },
  { code: '7', label: 'D' },
];

export default function GeolocationPolicyPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [initial, setInitial] = useState<GeolocationPolicy | null>(null);
  const [draft, setDraft] = useState<GeolocationPolicy | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    GeolocationPolicyApi.get()
      .then((p) => { if (alive) { setInitial(p); setDraft(p); } })
      .catch((e: any) => {
        if (alive) setError(e?.response?.data?.error || 'Impossible de charger la politique.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isAdmin]);

  const dirty = useMemo(() => {
    if (!draft || !initial) return false;
    return JSON.stringify({ ...draft, updatedAt: '', updatedBy: '' })
      !== JSON.stringify({ ...initial, updatedAt: '', updatedBy: '' });
  }, [draft, initial]);

  if (!isAdmin) return <AccessDenied message="Accès réservé aux administrateurs du tenant." />;
  if (loading) return <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  if (!draft) return <Box sx={{ p: 4 }}><Alert severity="error">{error ?? 'Politique indisponible.'}</Alert></Box>;

  const toggleDay = (code: string) => {
    const current = new Set(draft.allowedDays.split(''));
    if (current.has(code)) current.delete(code); else current.add(code);
    const next = Array.from(current).sort().join('');
    setDraft({ ...draft, allowedDays: next });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null); setSuccess(null);
    if (!draft.allowedDays) {
      setError('Au moins un jour doit être autorisé.');
      setSaving(false);
      return;
    }
    try {
      const updated = await GeolocationPolicyApi.update({
        enabledForClockIn: draft.enabledForClockIn,
        enabledForMissions: draft.enabledForMissions,
        windowStartTime: draft.windowStartTime,
        windowEndTime: draft.windowEndTime,
        allowedDays: draft.allowedDays,
      });
      setInitial(updated);
      setDraft(updated);
      setSuccess('Politique enregistrée. Les pointages suivants appliqueront ces règles.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Échec de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (initial) setDraft(initial);
    setError(null); setSuccess(null);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <LocationOnIcon color="primary" sx={{ fontSize: 32 }} />
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            Géolocalisation — Politique RGPD
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Clause 13.3 points 2 et 4 — vous décidez à quelles finalités la géoloc
            s'applique et dans quelles plages horaires. Hors plage, le pointage
            reste possible mais les coordonnées GPS ne sont pas capturées.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0040a1', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Sous-finalités autorisées
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Activez ou désactivez la collecte GPS pour chaque cas d'usage indépendamment.
        </Typography>
        <Stack spacing={1.5}>
          <FormControlLabel
            control={
              <Switch
                checked={draft.enabledForClockIn}
                onChange={(e) => setDraft({ ...draft, enabledForClockIn: e.target.checked })}
                disabled={saving}
              />
            }
            label={
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Pointage entrée/sortie</Typography>
                <Typography variant="caption" color="text.secondary">
                  Capture la position lors des pointages standards (web + mobile).
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={draft.enabledForMissions}
                onChange={(e) => setDraft({ ...draft, enabledForMissions: e.target.checked })}
                disabled={saving}
              />
            }
            label={
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Missions</Typography>
                <Typography variant="caption" color="text.secondary">
                  Capture la position lors de la saisie/validation de missions terrain.
                </Typography>
              </Box>
            }
          />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0040a1', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Plage horaire & jours autorisés
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Hors de cette fenêtre, le pointage reste accepté mais aucune coordonnée
          GPS n'est ni enregistrée ni journalisée.
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 3 }}>
          <TextField
            label="Début"
            type="time"
            value={draft.windowStartTime}
            onChange={(e) => setDraft({ ...draft, windowStartTime: e.target.value })}
            disabled={saving}
            InputLabelProps={{ shrink: true }}
            inputProps={{ step: 300 }}
            sx={{ width: 160 }}
          />
          <TextField
            label="Fin"
            type="time"
            value={draft.windowEndTime}
            onChange={(e) => setDraft({ ...draft, windowEndTime: e.target.value })}
            disabled={saving}
            InputLabelProps={{ shrink: true }}
            inputProps={{ step: 300 }}
            sx={{ width: 160 }}
          />
        </Stack>
        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Jours autorisés</Typography>
        <ToggleButtonGroup size="small" disabled={saving}>
          {DAYS.map((d) => (
            <ToggleButton
              key={d.code}
              value={d.code}
              selected={draft.allowedDays.includes(d.code)}
              onChange={() => toggleDay(d.code)}
              sx={{ minWidth: 44 }}
            >
              {d.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Une fenêtre traversant minuit (ex. 22:00 → 06:00) est supportée.
        </Typography>
      </Paper>

      <Divider sx={{ mb: 2 }} />

      <Stack direction="row" spacing={2} alignItems="center">
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          Enregistrer
        </Button>
        <Button
          variant="text"
          startIcon={<RestoreIcon />}
          onClick={handleReset}
          disabled={!dirty || saving}
        >
          Annuler
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
