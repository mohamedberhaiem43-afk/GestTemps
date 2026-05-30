import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableRow, TableCell, TableBody, Chip, FormControlLabel, Switch } from '@mui/material';
import { useFeedbackSnackbar } from '../../../helper/FeedbackSnackbar';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useTranslation, Trans } from 'react-i18next';
import apiInstance from '../../../API/apiInstance';
import { useAuth } from '../../../helper/AuthProvider';
import AccessDenied from '../../../helper/AccessDenied';

interface TransferLine {
  empcod: string;
  soldeAvant: number;
  transferes: number;
  cetApres: number;
}
interface TransferResult {
  soccod: string;
  annee: string;
  dateLimite: string;
  maxJours: number;
  employesTraites: number;
  totalJoursTransferes: number;
  details: TransferLine[];
}
interface SoldeLine {
  empcod: string;
  emplib?: string | null;
  annee?: string | null;
  cetjours: number;
}
interface AlimentationLine {
  id: number;
  empcod?: string | null;
  emplib?: string | null;
  abscod?: string | null;
  abslib?: string | null;
  nbjours: number;
  annee?: string | null;
  datedemande: string;
  statut: string;
}

const CetPage: React.FC = () => {
  const { t } = useTranslation();
  const { soccod, hasPermission } = useAuth();
  const [datelim, setDatelim] = useState('31-05');
  const [maxJours, setMaxJours] = useState<number>(10);
  const [requireValidation, setRequireValidation] = useState<boolean>(true);
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [preview, setPreview] = useState<TransferResult | null>(null);
  const [soldes, setSoldes] = useState<SoldeLine[]>([]);
  const [pendingAlims, setPendingAlims] = useState<AlimentationLine[]>([]);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const feedback = useFeedbackSnackbar();

  const canModify = hasPermission('Données de Base', 'modify');

  // Charge l'état réel des soldes CET cumulés par salarié (vue de consultation permanente,
  // indépendante de l'aperçu/transfert). La réponse .NET peut être enveloppée ($values).
  const loadSoldes = () => {
    if (!soccod) return;
    apiInstance.get(`/Cet/soldes/${soccod}`)
      .then(({ data }) => {
        const list: SoldeLine[] = Array.isArray(data) ? data : ((data as any)?.$values ?? []);
        setSoldes(list);
      })
      .catch(() => { /* silencieux : la consultation reste vide en cas d'erreur */ });
  };

  // Demandes d'alimentation du CET en attente de validation (workflow salarié → admin).
  const loadPendingAlims = () => {
    if (!soccod) return;
    apiInstance.get(`/Cet/alimentation/pending/${soccod}`)
      .then(({ data }) => {
        const list: AlimentationLine[] = Array.isArray(data) ? data : ((data as any)?.$values ?? []);
        setPendingAlims(list);
      })
      .catch(() => { /* silencieux */ });
  };

  useEffect(() => {
    if (!soccod) return;
    apiInstance.get(`/Cet/parametres/${soccod}`)
      .then(({ data }) => {
        setDatelim(data?.datelim ?? '31-05');
        setMaxJours(typeof data?.maxjours === 'number' ? data.maxjours : 10);
        setRequireValidation(data?.requireValidation !== false);
      })
      .catch(() => { /* defaults already set */ });
    loadSoldes();
    loadPendingAlims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soccod]);

  const approveAlim = async (id: number) => {
    setLoading(true);
    try {
      await apiInstance.post(`/Cet/alimentation/${soccod}/${id}/approve`);
      feedback.showSuccess(t('conge.cet.alim.approveSuccess', { defaultValue: 'Demande approuvée et transfert appliqué.' }));
      loadPendingAlims();
      loadSoldes();
    } catch (e) {
      feedback.showError(e, t('conge.cet.alim.approveError', { defaultValue: "Échec de l'approbation." }));
    } finally {
      setLoading(false);
    }
  };

  const refuseAlim = async (id: number) => {
    setLoading(true);
    try {
      await apiInstance.post(`/Cet/alimentation/${soccod}/${id}/refuse`, { motif: '' });
      feedback.showInfo(t('conge.cet.alim.refuseSuccess', { defaultValue: 'Demande refusée.' }));
      loadPendingAlims();
    } catch (e) {
      feedback.showError(e, t('conge.cet.alim.refuseError', { defaultValue: 'Échec du refus.' }));
    } finally {
      setLoading(false);
    }
  };

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message={t('conge.cet.noConsult')} />;
  }

  const saveParams = async () => {
    if (!/^\d{2}-\d{2}$/.test(datelim)) {
      feedback.showError(t('conge.cet.msg.invalidDate'));
      return;
    }
    if (maxJours < 0) {
      feedback.showError(t('conge.cet.msg.invalidCeiling'));
      return;
    }
    setLoading(true);
    try {
      await apiInstance.put('/Cet/parametres', { soccod, datelim, maxjours: maxJours, requireValidation });
      feedback.showSuccess(t('conge.cet.msg.saveSuccess'));
    } catch (e) {
      feedback.showError(e, t('conge.cet.msg.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const runPreview = async () => {
    setLoading(true);
    try {
      const { data } = await apiInstance.get<TransferResult>(`/Cet/preview/${soccod}/${annee}`);
      setPreview(data);
      feedback.showInfo(t('conge.cet.msg.previewMsg', { employees: data.employesTraites, days: data.totalJoursTransferes }));
    } catch (e) {
      feedback.showError(e, t('conge.cet.msg.previewError'));
    } finally {
      setLoading(false);
    }
  };

  const applyTransfer = async () => {
    setOpenConfirm(false);
    setLoading(true);
    try {
      const { data } = await apiInstance.post<TransferResult>(`/Cet/apply/${soccod}/${annee}`);
      setPreview(data);
      loadSoldes(); // rafraîchit la consultation des soldes CET après le transfert
      feedback.showSuccess(t('conge.cet.msg.applySuccess', { employees: data.employesTraites, days: data.totalJoursTransferes }));
    } catch (e) {
      feedback.showError(e, t('conge.cet.msg.applyError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1280, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: '#0040a115', color: '#0040a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 32 }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e' }}>{t('conge.cet.title')}</Typography>
          <Typography sx={{ fontSize: 13, color: '#475569' }}>
            {t('conge.cet.subtitle')}
          </Typography>
        </Box>
      </Box>

      {/* Paramètres */}
      <Box sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mt: 4 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 3, color: '#191c1e' }}>{t('conge.cet.params.title')}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, alignItems: 'flex-end' }}>
          <TextField
            label={t('conge.cet.params.dateLimit')}
            size="small"
            value={datelim}
            onChange={(e) => setDatelim(e.target.value)}
            placeholder="31-05"
            helperText={t('conge.cet.params.dateLimitHelp')}
          />
          <TextField
            label={t('conge.cet.params.ceiling')}
            size="small"
            type="number"
            value={maxJours}
            onChange={(e) => setMaxJours(Number(e.target.value) || 0)}
            inputProps={{ min: 0, step: 0.5 }}
            helperText={t('conge.cet.params.ceilingHelp')}
          />
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveParams}
            disabled={!canModify || loading}
            sx={{ height: 40, bgcolor: '#0040a1', textTransform: 'none', fontWeight: 700 }}
          >
            {t('conge.cet.params.save')}
          </Button>
        </Box>
        <FormControlLabel
          sx={{ mt: 2 }}
          control={
            <Switch
              checked={requireValidation}
              onChange={(e) => setRequireValidation(e.target.checked)}
              disabled={!canModify}
            />
          }
          label={
            <Typography sx={{ fontSize: 13 }}>
              {t('conge.cet.params.requireValidation', { defaultValue: "Les demandes d'alimentation du CET par les salariés doivent être validées (RH/admin/manager)" })}
            </Typography>
          }
        />
      </Box>

      {/* Demandes d'alimentation du CET en attente de validation (workflow salarié) */}
      {pendingAlims.length > 0 && (
        <Box sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mt: 3 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 2, color: '#191c1e' }}>
            {t('conge.cet.alim.pendingTitle', { defaultValue: "Demandes d'alimentation en attente" })}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t('conge.cet.alim.employee', { defaultValue: 'Salarié' })}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('conge.cet.alim.type', { defaultValue: 'Type' })}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('conge.cet.alim.days', { defaultValue: 'Jours' })}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('conge.cet.alim.actions', { defaultValue: 'Actions' })}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingAlims.map((a) => (
                <TableRow key={a.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{a.emplib || a.empcod}</TableCell>
                  <TableCell>{a.abslib || a.abscod}</TableCell>
                  <TableCell align="right">{a.nbjours.toFixed(1)} j</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="contained" onClick={() => approveAlim(a.id)} disabled={!canModify || loading}
                      sx={{ mr: 1, bgcolor: '#16a34a', textTransform: 'none', '&:hover': { bgcolor: '#15803d' } }}>
                      {t('conge.cet.alim.approve', { defaultValue: 'Approuver' })}
                    </Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => refuseAlim(a.id)} disabled={!canModify || loading}
                      sx={{ textTransform: 'none' }}>
                      {t('conge.cet.alim.refuse', { defaultValue: 'Refuser' })}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* Application du transfert */}
      <Box sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mt: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1, color: '#191c1e' }}>{t('conge.cet.apply.title')}</Typography>
        <Typography sx={{ fontSize: 13, color: '#475569', mb: 2 }}>
          {t('conge.cet.apply.description')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', p: 1.5, mb: 3, borderRadius: 2, bgcolor: '#fff7ed', border: '1px solid #fed7aa' }}>
          <Typography sx={{ fontSize: 13, color: '#9a3412' }}>
            {t('conge.cet.apply.manualNote', {
              defaultValue: 'Le transfert est une action manuelle : il ne se déclenche pas automatiquement à la date limite (celle-ci est seulement indicative). Lancez d’abord un Aperçu, puis cliquez sur Appliquer pour épargner les congés non pris vers le CET.',
            })}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label={t('conge.cet.apply.year')}
            size="small"
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
            sx={{ width: 120 }}
          />
          <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={runPreview} disabled={loading} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {t('conge.cet.apply.preview')}
          </Button>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={() => setOpenConfirm(true)}
            disabled={!canModify || loading}
            sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#15803d' } }}
          >
            {t('conge.cet.apply.applyButton')}
          </Button>
        </Box>
      </Box>

      {/* Résultat */}
      {preview && (
        <Box sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#191c1e' }}>
              {t('conge.cet.result.title', { year: preview.annee })}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip label={t('conge.cet.result.dateLimit', { date: preview.dateLimite })} size="small" sx={{ bgcolor: '#f1f5f9' }} />
              <Chip label={t('conge.cet.result.ceiling', { count: preview.maxJours })} size="small" sx={{ bgcolor: '#f1f5f9' }} />
              <Chip label={t('conge.cet.result.employees', { count: preview.employesTraites })} size="small" color="primary" />
              <Chip label={t('conge.cet.result.totalDays', { count: preview.totalJoursTransferes })} size="small" sx={{ bgcolor: '#16a34a', color: '#fff', fontWeight: 700 }} />
            </Box>
          </Box>
          {preview.details.length === 0 ? (
            <Typography sx={{ color: '#64748b', textAlign: 'center', py: 3 }}>
              {t('conge.cet.result.noTransfer')}
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>{t('conge.cet.result.headers.empcod')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">{t('conge.cet.result.headers.before')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">{t('conge.cet.result.headers.transferred')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">{t('conge.cet.result.headers.after')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.details.map((d) => (
                  <TableRow key={d.empcod}>
                    <TableCell sx={{ fontWeight: 600 }}>{d.empcod}</TableCell>
                    <TableCell align="right">{d.soldeAvant.toFixed(1)} j</TableCell>
                    <TableCell align="right" sx={{ color: '#16a34a', fontWeight: 700 }}>+{d.transferes.toFixed(1)} j</TableCell>
                    <TableCell align="right">{d.cetApres.toFixed(1)} j</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      )}

      {/* Consultation permanente : solde CET cumulé par salarié */}
      <Box sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#191c1e' }}>
            {t('conge.cet.balances.title', { defaultValue: 'Soldes CET cumulés' })}
          </Typography>
          <Button variant="outlined" size="small" onClick={loadSoldes} disabled={loading} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {t('conge.cet.balances.refresh', { defaultValue: 'Actualiser' })}
          </Button>
        </Box>
        {soldes.length === 0 ? (
          <Typography sx={{ color: '#64748b', textAlign: 'center', py: 3 }}>
            {t('conge.cet.balances.empty', { defaultValue: 'Aucun solde CET enregistré pour le moment.' })}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t('conge.cet.balances.empcod', { defaultValue: 'Matricule' })}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('conge.cet.balances.name', { defaultValue: 'Salarié' })}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('conge.cet.balances.cet', { defaultValue: 'CET cumulé' })}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {soldes.map((s) => (
                <TableRow key={s.empcod}>
                  <TableCell sx={{ fontWeight: 600 }}>{s.empcod}</TableCell>
                  <TableCell>{s.emplib || '—'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: s.cetjours > 0 ? '#7c3aed' : '#94a3b8' }}>
                    {(s.cetjours ?? 0).toFixed(1)} j
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)}>
        <DialogTitle>{t('conge.cet.confirm.title')}</DialogTitle>
        <DialogContent>
          <Typography>
            <Trans
              i18nKey="conge.cet.confirm.message"
              values={{ year: annee }}
              components={{ 0: <strong /> }}
            />
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirm(false)} sx={{ textTransform: 'none' }}>{t('conge.cet.confirm.cancel')}</Button>
          <Button onClick={applyTransfer} variant="contained" sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 700 }}>
            {t('conge.cet.confirm.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {feedback.element}
    </Box>
  );
};

export default CetPage;
