import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import { ProcessingNoticeApi, ProcessingNotice } from './processingNoticeApi';

export default function ProcessingNoticePage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState<ProcessingNotice | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    ProcessingNoticeApi.getForAdmin()
      .then((notice) => {
        if (!alive) return;
        setInitial(notice);
        setTitle(notice.title);
        setBody(notice.body);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.response?.data?.error || 'Impossible de charger la notice.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isAdmin]);

  const dirty = useMemo(() => {
    if (!initial) return false;
    return title !== initial.title || body !== initial.body;
  }, [title, body, initial]);

  if (!isAdmin) return <AccessDenied message="Accès réservé aux administrateurs du tenant." />;

  if (loading) {
    return <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null); setSuccess(null);
    try {
      const updated = await ProcessingNoticeApi.update({ title: title.trim(), body: body.trim() });
      setInitial(updated);
      setTitle(updated.title);
      setBody(updated.body);
      setSuccess(`Notice enregistrée (version ${updated.version}). Tous les salariés re-verront la bannière lors de leur prochaine connexion.`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Échec de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (initial) { setTitle(initial.title); setBody(initial.body); }
    setError(null); setSuccess(null);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <GavelIcon color="primary" sx={{ fontSize: 32 }} />
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            Notice d'information RGPD
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Article 13 RGPD — obligation d'information. Ce texte est affiché à vos
            salariés sous forme de bannière à leur première connexion et à chaque
            modification de version.
          </Typography>
        </Box>
        {initial && (
          <Chip
            color="primary"
            variant="outlined"
            label={`Version ${initial.version}`}
            size="small"
          />
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Stack spacing={2.5}>
          <TextField
            label="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            inputProps={{ maxLength: 200 }}
            helperText={`${title.length}/200`}
            fullWidth
          />
          <TextField
            label="Corps de la notice"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={saving}
            multiline
            minRows={18}
            inputProps={{ maxLength: 20_000 }}
            helperText={`${body.length}/20 000 — Markdown léger supporté (gras **, listes -, sauts de ligne).`}
            fullWidth
          />
        </Stack>
      </Paper>

      <Alert severity="info" sx={{ mb: 2, fontSize: 13 }}>
        <strong>Quand modifier ?</strong> à chaque changement substantiel des
        finalités, durées de conservation, sous-traitants, ou exercice des droits.
        Toute modification incrémente la version : vos salariés re-acquittent
        automatiquement à leur prochaine connexion (preuve horodatée + IP conservée
        dans la table <code>user_consent</code>).
      </Alert>

      <Divider sx={{ mb: 2 }} />

      <Stack direction="row" spacing={2} alignItems="center">
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={!dirty || saving || !title.trim() || !body.trim()}
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
