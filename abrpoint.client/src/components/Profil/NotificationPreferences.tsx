import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Switch, Stack, Divider, CircularProgress, Button, Alert, Snackbar, Skeleton, TextField,
  ToggleButtonGroup, ToggleButton, Chip,
} from '@mui/material';
import {
  NotificationsActive as NotifIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Bedtime as BedtimeIcon,
  Schedule as ScheduleIcon,
  AutoMode as AutoIcon,
} from '@mui/icons-material';
import apiInstance from '../API/apiInstance';

interface PreferenceItem {
  code: string;
  label: string;
  description: string;
  group: string;
  push: boolean;
  inapp: boolean;
}

const GROUP_LABELS: Record<string, string> = {
  reminders: 'Rappels',
  leaves: 'Congés',
  authorizations: 'Autorisations',
  system: 'Système',
};

/**
 * Carte « Préférences de notification » à intégrer dans la page Profil.
 * Convention serveur : opt-in par défaut. Toute catégorie listée ici peut être
 * activée/désactivée individuellement. La désactivation supprime à la fois le push
 * mobile et l'entrée dans le centre de notifications.
 */
export default function NotificationPreferences() {
  const [items, setItems] = useState<PreferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Snapshot initial pour détecter le dirty state — on garde { code: "push:inapp" } pour comparer.
  const [original, setOriginal] = useState<Record<string, string>>({});

  // Heures silencieuses — 2 modes : manuel ou auto (calé sur le poste de l'employé).
  const defaultQuiet = { enabled: false, mode: 'manual' as 'manual' | 'auto_poste', start: '22:00', end: '07:00' };
  const [quiet, setQuiet] = useState(defaultQuiet);
  const [originalQuiet, setOriginalQuiet] = useState(defaultQuiet);
  const [savingQuiet, setSavingQuiet] = useState(false);
  // Statut "actuellement silencieux" pour le bandeau d'info.
  const [quietStatus, setQuietStatus] = useState<{ silent: boolean; until?: string | null; reason?: string } | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prefRes, qhRes, qsRes] = await Promise.all([
          apiInstance.get('/Notifications/preferences'),
          apiInstance.get('/Notifications/quiet-hours'),
          apiInstance.get('/Notifications/quiet-status'),
        ]);
        if (cancelled) return;
        const list = Array.isArray(prefRes.data) ? (prefRes.data as PreferenceItem[]) : [];
        setItems(list);
        setOriginal(Object.fromEntries(list.map(i => [i.code, `${i.push}:${i.inapp}`])));
        const q = qhRes.data || {};
        const next = {
          enabled: !!q.enabled,
          mode: (q.mode === 'auto_poste' ? 'auto_poste' : 'manual') as 'manual' | 'auto_poste',
          start: q.start || '22:00',
          end: q.end || '07:00',
        };
        setQuiet(next);
        setOriginalQuiet(next);
        setQuietStatus(qsRes.data || null);
      } catch {
        if (!cancelled) setSnack({ open: true, message: 'Impossible de charger les préférences.', severity: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const quietDirty = useMemo(
    () => quiet.enabled !== originalQuiet.enabled
      || quiet.mode !== originalQuiet.mode
      || quiet.start !== originalQuiet.start
      || quiet.end !== originalQuiet.end,
    [quiet, originalQuiet]
  );

  const saveQuiet = async () => {
    setSavingQuiet(true);
    try {
      await apiInstance.put('/Notifications/quiet-hours', {
        Enabled: quiet.enabled,
        Mode: quiet.mode,
        Start: quiet.start,
        End: quiet.end,
      });
      setOriginalQuiet(quiet);
      // Refresh status banner.
      try {
        const { data } = await apiInstance.get('/Notifications/quiet-status');
        setQuietStatus(data || null);
      } catch { /* noop */ }
      setSnack({ open: true, message: 'Heures silencieuses enregistrées.', severity: 'success' });
    } catch {
      setSnack({ open: true, message: 'Erreur lors de l\'enregistrement des heures silencieuses.', severity: 'error' });
    } finally {
      setSavingQuiet(false);
    }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, PreferenceItem[]>();
    for (const it of items) {
      const k = it.group || 'system';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return Array.from(m.entries()).map(([group, items]) => ({ group, items }));
  }, [items]);

  const dirty = useMemo(
    () => items.some(it => original[it.code] !== `${it.push}:${it.inapp}`),
    [items, original]
  );

  const toggle = (code: string, channel: 'push' | 'inapp') => {
    setItems(prev => prev.map(it => it.code === code ? { ...it, [channel]: !it[channel] } : it));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = items.map(it => ({ code: it.code, push: it.push, inapp: it.inapp }));
      await apiInstance.put('/Notifications/preferences', payload);
      setOriginal(Object.fromEntries(items.map(i => [i.code, `${i.push}:${i.inapp}`])));
      setSnack({ open: true, message: 'Préférences enregistrées.', severity: 'success' });
    } catch {
      setSnack({ open: true, message: 'Erreur lors de l\'enregistrement.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setItems(prev => prev.map(it => {
      const [p, i] = (original[it.code] ?? 'true:true').split(':');
      return { ...it, push: p === 'true', inapp: i === 'true' };
    }));
  };

  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 3, boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <NotifIcon sx={{ color: '#0040a1' }} />
          <Typography variant="h6" fontWeight={800} color="#0f172a">
            Préférences de notification
          </Typography>
        </Stack>
        <Stack direction="row" gap={1}>
          {dirty && (
            <Button
              size="small"
              startIcon={<RestoreIcon />}
              onClick={reset}
              disabled={saving}
              sx={{ textTransform: 'none', color: '#64748b' }}
            >
              Annuler
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
            onClick={save}
            disabled={!dirty || saving}
            sx={{ textTransform: 'none', bgcolor: '#0040a1', '&:hover': { bgcolor: '#0056d2' } }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choisissez les types de notifications que vous souhaitez recevoir (push mobile + centre de notifications).
        Désactivé = aucune trace, aucune notification.
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {loading ? (
        <Stack gap={1}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 1.5 }} />
          ))}
        </Stack>
      ) : (
        <Stack gap={3}>
          {/* ── Heures silencieuses ──────────────────────────────────── */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <BedtimeIcon sx={{ color: '#475569', fontSize: 20 }} />
                <Typography variant="overline" fontWeight={800} color="#475569" sx={{ letterSpacing: 1, fontSize: 11 }}>
                  Heures silencieuses
                </Typography>
              </Stack>
              {quietDirty && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={saveQuiet}
                  disabled={savingQuiet}
                  startIcon={savingQuiet ? <CircularProgress size={12} /> : <SaveIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  Enregistrer
                </Button>
              )}
            </Stack>
            <Box
              sx={{
                px: 2, py: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5,
                display: 'flex', flexDirection: 'column', gap: 1.5,
              }}
            >
              {/* Bandeau "actuellement silencieux" */}
              {quietStatus?.silent && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#fef3c7', borderRadius: 1, border: '1px solid #fde68a' }}>
                  <BedtimeIcon sx={{ fontSize: 18, color: '#92400e' }} />
                  <Typography variant="caption" fontWeight={700} color="#92400e">
                    {quietStatus.until
                      ? `Vous êtes silencieux jusqu'à ${quietStatus.until}.`
                      : (quietStatus.reason || 'Vous êtes silencieux.')}
                  </Typography>
                </Box>
              )}

              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={700} color="#0f172a">
                    Activer les heures silencieuses
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pendant ce créneau, les notifications push sont supprimées. L'historique reste visible dans le centre.
                  </Typography>
                </Box>
                <Switch
                  checked={quiet.enabled}
                  onChange={() => setQuiet(q => ({ ...q, enabled: !q.enabled }))}
                  color="primary"
                />
              </Stack>

              {quiet.enabled && (
                <>
                  {/* Sélecteur de mode */}
                  <ToggleButtonGroup
                    value={quiet.mode}
                    exclusive
                    onChange={(_, v) => v && setQuiet(q => ({ ...q, mode: v }))}
                    size="small"
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    <ToggleButton value="manual" sx={{ textTransform: 'none', px: 2 }}>
                      <ScheduleIcon sx={{ fontSize: 16, mr: 0.5 }} />
                      Manuel
                    </ToggleButton>
                    <ToggleButton value="auto_poste" sx={{ textTransform: 'none', px: 2 }}>
                      <AutoIcon sx={{ fontSize: 16, mr: 0.5 }} />
                      Selon mon poste
                    </ToggleButton>
                  </ToggleButtonGroup>

                  {quiet.mode === 'manual' ? (
                    <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
                      <TextField
                        label="Début"
                        type="time"
                        size="small"
                        value={quiet.start}
                        onChange={(e) => setQuiet(q => ({ ...q, start: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 150 }}
                      />
                      <TextField
                        label="Fin"
                        type="time"
                        size="small"
                        value={quiet.end}
                        onChange={(e) => setQuiet(q => ({ ...q, end: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 150 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 200 }}>
                        Vous pouvez traverser minuit (ex: 22:00 → 07:00).
                      </Typography>
                    </Stack>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                      <Chip
                        size="small"
                        icon={<AutoIcon sx={{ fontSize: 14 }} />}
                        label="Calé sur les heures de votre poste"
                        sx={{ bgcolor: '#dae2ff', color: '#0040a1', fontWeight: 700 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Vous serez silencieux en dehors de votre plage de travail (changement automatique chaque jour).
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Box>
          <Divider />
          {grouped.map(({ group, items: gItems }) => (
            <Box key={group}>
              <Typography variant="overline" fontWeight={800} color="#475569" sx={{ letterSpacing: 1, fontSize: 11 }}>
                {GROUP_LABELS[group] || group}
              </Typography>
              <Stack gap={1} sx={{ mt: 1 }}>
                {gItems.map(it => (
                  <Stack
                    key={it.code}
                    direction="row"
                    alignItems="center"
                    sx={{
                      px: 2, py: 1.25,
                      bgcolor: '#f8fafc',
                      borderRadius: 1.5,
                      transition: 'background 0.15s',
                      gap: 2,
                      '&:hover': { bgcolor: '#f1f5f9' },
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={700} color="#0f172a">
                        {it.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {it.description}
                      </Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                      <Stack alignItems="center">
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>Push</Typography>
                        <Switch
                          size="small"
                          checked={it.push}
                          onChange={() => toggle(it.code, 'push')}
                          color="primary"
                        />
                      </Stack>
                      <Stack alignItems="center">
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>Centre</Typography>
                        <Switch
                          size="small"
                          checked={it.inapp}
                          onChange={() => toggle(it.code, 'inapp')}
                          color="primary"
                        />
                      </Stack>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
