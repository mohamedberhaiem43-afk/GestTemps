import {
  Box, Typography, Button, TextField, FormControlLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider, Switch,
  Autocomplete, CircularProgress, Alert,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import TuneIcon from '@mui/icons-material/Tune';
import SaveIcon from '@mui/icons-material/Save';
import { useAuth } from '../../helper/AuthProvider';
import useGetEmployeesLibs from '../../../hooks/employeHooks/useGetEmployeesLibs';
import apiInstance from '../../API/apiInstance';

// Permet aux utilisateurs disposant du droit `Pointage et Temps:modify` de corriger
// manuellement les heures d'entrée/sortie d'un salarié pour une journée donnée.
// On modifie uniquement les champs `_up` côté backend : ils surchargent les pointages
// bruts capturés par la pointeuse, sans détruire l'historique.
export default function PointageAdjustDialog({
  open,
  onClose,
  canModify,
  showSnack,
  onSaved,
  initialEmpcod,
  initialDate,
}: {
  open: boolean;
  onClose: () => void;
  canModify: boolean;
  showSnack: (msg: string, sev: 'success' | 'error' | 'warning') => void;
  onSaved?: (ctx: { empcod: string; date: string }) => void | Promise<void>;
  // Pré-remplissage optionnel : si fournis, le dialog s'ouvre déjà ciblé sur le bon
  // (employé, jour) — utilisé depuis l'état périodique où l'utilisateur a déjà
  // cliqué sur une journée précise.
  initialEmpcod?: string;
  initialDate?: string;
}) {
  const { soccod } = useAuth();
  const { data: employeesLibsRaw } = useGetEmployeesLibs();

  const employeesOptions = useMemo(() => {
    const raw = employeesLibsRaw as any;
    if (!raw) return [] as { code: string; label: string }[];
    if (Array.isArray(raw)) {
      return raw.map((e: any) => ({
        code: e.empcod || e.code || '',
        label: e.emplib || e.lib || e.label || e.empcod || '',
      })).filter(e => e.code);
    }
    return Object.entries(raw as Record<string, string>).map(([code, lib]) => ({ code, label: String(lib) }));
  }, [employeesLibsRaw]);

  const [empcod, setEmpcod] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Pointages bruts (lecture seule) capturés par la pointeuse.
  const [raw, setRaw] = useState<{ entMat: string; sortMat: string; entAm: string; sortAm: string }>({
    entMat: '', sortMat: '', entAm: '', sortAm: '',
  });
  // Corrections (champs `_up`) — éditables.
  const [corr, setCorr] = useState<{ entMat: string; sortMat: string; entAm: string; sortAm: string; repos: boolean; repas: number }>({
    entMat: '', sortMat: '', entAm: '', sortAm: '', repos: false, repas: 0,
  });
  const [hasRecord, setHasRecord] = useState(false);

  // Reset à l'ouverture, sinon les données précédentes restent affichées.
  useEffect(() => {
    if (!open) return;
    setEmpcod(initialEmpcod || '');
    setDate(initialDate || new Date().toISOString().split('T')[0]);
    setRaw({ entMat: '', sortMat: '', entAm: '', sortAm: '' });
    setCorr({ entMat: '', sortMat: '', entAm: '', sortAm: '', repos: false, repas: 0 });
    setHasRecord(false);
  }, [open, initialEmpcod, initialDate]);

  // Charge le pointage du jour quand empcod + date sont fournis.
  useEffect(() => {
    if (!open || !empcod || !date || !soccod) return;
    let cancelled = false;
    setLoading(true);
    apiInstance
      .get(`/Presences/emp-point-filtrer/${soccod}/${empcod}/${date}/${date}`)
      .then(res => {
        if (cancelled) return;
        const row: any = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;
        if (row) {
          setHasRecord(true);
          setRaw({
            entMat: row.preentmat || '',
            sortMat: row.presortmat || '',
            entAm: row.preentamidi || '',
            sortAm: row.presortamidi || '',
          });
          setCorr({
            // Si une correction existe déjà, on la pré-charge ; sinon on part du brut pour faciliter l'édition.
            entMat: row.preentmatup || row.preentmat || '',
            sortMat: row.presortmatup || row.presortmat || '',
            entAm: row.preentamidiup || row.preentamidi || '',
            sortAm: row.presortamidiup || row.presortamidi || '',
            repos: row.prerepos === '1',
            repas: typeof row.prerepas === 'number' ? row.prerepas : 0,
          });
        } else {
          // Aucun pointage existant — l'API en créera un au PUT (cf. Put dans PresencesController).
          setHasRecord(false);
          setRaw({ entMat: '', sortMat: '', entAm: '', sortAm: '' });
          setCorr({ entMat: '', sortMat: '', entAm: '', sortAm: '', repos: false, repas: 0 });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasRecord(false);
          setRaw({ entMat: '', sortMat: '', entAm: '', sortAm: '' });
          setCorr({ entMat: '', sortMat: '', entAm: '', sortAm: '', repos: false, repas: 0 });
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, empcod, date, soccod]);

  const handleSave = async () => {
    if (!canModify) return;
    if (!empcod || !date || !soccod) {
      showSnack('Veuillez sélectionner un collaborateur et une date', 'warning');
      return;
    }
    setSaving(true);
    try {
      // Le backend (PresencesController.Put) attend un `EmpEtatPeriodique` :
      // il met à jour les colonnes `_up` (corrections) sans toucher aux pointages bruts.
      await apiInstance.put(`/Presences/${soccod}/${empcod}/${date}`, {
        predat: date,
        preentmatup: corr.entMat || '',
        presortmatup: corr.sortMat || '',
        preentamidiup: corr.entAm || '',
        presortamidiup: corr.sortAm || '',
        preentsupup: '',
        presortsupup: '',
        prerepos: corr.repos ? '1' : '0',
        prerepas: corr.repas || 0,
        tothnuit: '',
        tothre: '',
      });
      await onSaved?.({ empcod, date });
      showSnack('Pointage corrigé avec succès', 'success');
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data || 'Erreur lors de la correction';
      showSnack(typeof msg === 'string' ? msg : 'Erreur lors de la correction', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px', backgroundColor: '#f8fafc',
      '& fieldset': { borderColor: '#e2e8f0' },
    },
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: '16px' } }}
    >
      <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '17px', pb: 1, display: 'flex', alignItems: 'center', gap: 1.2 }}>
        <TuneIcon sx={{ color: '#0040a1' }} />
        Ajuster un pointage
      </DialogTitle>
      <Typography sx={{ px: 3, pb: 1.5, color: '#64748b', fontSize: '12px' }}>
        Corrigez les heures d'entrée/sortie d'un salarié pour une journée. Les valeurs brutes
        de la pointeuse ne sont pas modifiées — seules les valeurs corrigées (utilisées pour le
        calcul de paie) sont enregistrées.
      </Typography>
      <Divider />
      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Sélection collaborateur + date */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
              Collaborateur
            </Typography>
            <Autocomplete
              size="small"
              options={employeesOptions}
              value={employeesOptions.find(o => o.code === empcod) || null}
              onChange={(_, v) => setEmpcod(v?.code || '')}
              getOptionLabel={o => `${o.label} (${o.code})`}
              isOptionEqualToValue={(o, v) => o.code === v.code}
              renderInput={(params) => <TextField {...params} placeholder="Rechercher un salarié..." sx={fieldSx} />}
              disabled={!canModify}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
              Date
            </Typography>
            <TextField
              size="small" fullWidth type="date" value={date}
              onChange={e => setDate(e.target.value)} sx={fieldSx}
              InputLabelProps={{ shrink: true }}
              disabled={!canModify}
            />
          </Box>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={22} />
          </Box>
        )}

        {!loading && empcod && (
          <>
            {!hasRecord && (
              <Alert severity="info" sx={{ borderRadius: '10px' }}>
                Aucun pointage trouvé pour ce jour — la sauvegarde créera la ligne avec vos valeurs.
              </Alert>
            )}

            {/* Comparaison : brut (lecture seule) vs corrigé (éditable) */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                  Pointage brut (pointeuse)
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {[
                    { lbl: 'Entrée matin', val: raw.entMat },
                    { lbl: 'Sortie matin', val: raw.sortMat },
                    { lbl: 'Entrée après-midi', val: raw.entAm },
                    { lbl: 'Sortie après-midi', val: raw.sortAm },
                  ].map(r => (
                    <Box key={r.lbl} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: '8px', px: 1.5, py: 1 }}>
                      <Typography sx={{ fontSize: '12px', color: '#475569' }}>{r.lbl}</Typography>
                      <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                        {r.val || '—'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box>
                <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#0040a1', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                  Valeurs corrigées (utilisées pour la paie)
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <TextField size="small" type="time" label="Entrée matin" value={corr.entMat}
                    onChange={e => setCorr(c => ({ ...c, entMat: e.target.value }))}
                    InputLabelProps={{ shrink: true }} sx={fieldSx} disabled={!canModify} />
                  <TextField size="small" type="time" label="Sortie matin" value={corr.sortMat}
                    onChange={e => setCorr(c => ({ ...c, sortMat: e.target.value }))}
                    InputLabelProps={{ shrink: true }} sx={fieldSx} disabled={!canModify} />
                  <TextField size="small" type="time" label="Entrée après-midi" value={corr.entAm}
                    onChange={e => setCorr(c => ({ ...c, entAm: e.target.value }))}
                    InputLabelProps={{ shrink: true }} sx={fieldSx} disabled={!canModify} />
                  <TextField size="small" type="time" label="Sortie après-midi" value={corr.sortAm}
                    onChange={e => setCorr(c => ({ ...c, sortAm: e.target.value }))}
                    InputLabelProps={{ shrink: true }} sx={fieldSx} disabled={!canModify} />
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={<Switch checked={corr.repos} onChange={e => setCorr(c => ({ ...c, repos: e.target.checked }))} size="small" disabled={!canModify} />}
                label={<Typography sx={{ fontSize: '13px' }}>Jour de repos</Typography>}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '12px', color: '#64748b' }}>Pause repas (h) :</Typography>
                <TextField
                  size="small" type="number" inputProps={{ step: 0.25, min: 0 }}
                  value={corr.repas}
                  onChange={e => setCorr(c => ({ ...c, repas: Number(e.target.value) || 0 }))}
                  sx={{ ...fieldSx, width: 100 }} disabled={!canModify}
                />
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>
          Fermer
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={!canModify || saving || !empcod}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer la correction'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

