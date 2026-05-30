import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, MenuItem, Table, TableHead, TableRow,
  TableCell, TableBody, Chip, Paper,
} from '@mui/material';
import SavingsIcon from '@mui/icons-material/Savings';
import SendIcon from '@mui/icons-material/Send';
import { useTranslation } from 'react-i18next';
import apiInstance from '../../../API/apiInstance';
import { useAuth } from '../../../helper/AuthProvider';
import { useFeedbackSnackbar } from '../../../helper/FeedbackSnackbar';

interface EligibiliteLine {
  abscod: string;
  abslib?: string | null;
  categorie: string;          // "RTT" | "CP"
  soldeDisponible: number;
  dejaTransfere: number;
  plafondAnnuel?: number | null;
  resteTransferable: number;
}

interface AlimentationLine {
  id: number;
  abscod?: string | null;
  abslib?: string | null;
  nbjours: number;
  annee?: string | null;
  datedemande: string;
  statut: string;             // pending | approved | refused
  motifrefus?: string | null;
}

const statutChip = (s: string) => {
  switch (s) {
    case 'approved': return { color: 'success' as const, key: 'approved' };
    case 'refused': return { color: 'error' as const, key: 'refused' };
    default: return { color: 'warning' as const, key: 'pending' };
  }
};

const AlimenterCetPage: React.FC = () => {
  const { t } = useTranslation();
  const { soccod, uticod } = useAuth();
  const feedback = useFeedbackSnackbar();

  const [eligibilite, setEligibilite] = useState<EligibiliteLine[]>([]);
  const [requests, setRequests] = useState<AlimentationLine[]>([]);
  const [abscod, setAbscod] = useState('');
  const [jours, setJours] = useState('');
  const [loading, setLoading] = useState(false);

  const selected = useMemo(() => eligibilite.find((e) => e.abscod === abscod) || null, [eligibilite, abscod]);

  const loadAll = () => {
    if (!soccod || !uticod) return;
    apiInstance.get(`/Cet/alimentation/eligibilite/${soccod}/${uticod}`)
      .then(({ data }) => setEligibilite(Array.isArray(data) ? data : ((data as any)?.$values ?? [])))
      .catch(() => { /* silencieux */ });
    apiInstance.get(`/Cet/alimentation/mine/${soccod}/${uticod}`)
      .then(({ data }) => setRequests(Array.isArray(data) ? data : ((data as any)?.$values ?? [])))
      .catch(() => { /* silencieux */ });
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soccod, uticod]);

  const submit = async () => {
    const n = Number(jours);
    if (!abscod) { feedback.showError(t('conge.alimenterCet.msg.selectType', { defaultValue: 'Sélectionnez un type de congé.' })); return; }
    if (!n || n <= 0) { feedback.showError(t('conge.alimenterCet.msg.invalidDays', { defaultValue: 'Saisissez un nombre de jours valide.' })); return; }
    if (selected && n > selected.resteTransferable) {
      feedback.showError(t('conge.alimenterCet.msg.overLimit', {
        defaultValue: 'Le nombre de jours dépasse le reste transférable ({{reste}} j).',
        reste: selected.resteTransferable,
      }));
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiInstance.post(`/Cet/alimentation?soccod=${soccod}`, {
        empcod: uticod, abscod, nbjours: n,
      });
      if (data?.applied) {
        feedback.showSuccess(t('conge.alimenterCet.msg.applied', { defaultValue: 'Transfert vers le CET effectué.' }));
      } else {
        feedback.showSuccess(t('conge.alimenterCet.msg.submitted', { defaultValue: 'Demande envoyée pour validation.' }));
      }
      setJours('');
      setAbscod('');
      loadAll();
    } catch (e) {
      feedback.showError(e, t('conge.alimenterCet.msg.error', { defaultValue: "Échec de la demande d'alimentation." }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: '#7c3aed15', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SavingsIcon sx={{ fontSize: 32 }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e' }}>
            {t('conge.alimenterCet.title', { defaultValue: 'Alimenter le CET' })}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#475569' }}>
            {t('conge.alimenterCet.subtitle', { defaultValue: 'Transférez des jours de congé (RTT, CP…) vers votre Compte Épargne Temps.' })}
          </Typography>
        </Box>
      </Box>

      {/* Formulaire de demande */}
      <Box sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mt: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label={t('conge.alimenterCet.type', { defaultValue: 'Type de congé' })}
            value={abscod}
            onChange={(e) => setAbscod(e.target.value)}
            sx={{ minWidth: 260 }}
          >
            {eligibilite.length === 0 && (
              <MenuItem value="" disabled>
                {t('conge.alimenterCet.noType', { defaultValue: 'Aucun type éligible configuré' })}
              </MenuItem>
            )}
            {eligibilite.map((e) => (
              <MenuItem key={e.abscod} value={e.abscod}>
                {e.abslib || e.abscod} — {e.categorie}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            size="small"
            label={t('conge.alimenterCet.days', { defaultValue: 'Jours à transférer' })}
            value={jours}
            onChange={(e) => setJours(e.target.value)}
            inputProps={{ min: 0, step: 0.5 }}
            sx={{ width: 160 }}
          />
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={submit}
            disabled={loading || !abscod}
            sx={{ height: 40, bgcolor: '#7c3aed', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#6d28d9' } }}
          >
            {t('conge.alimenterCet.submit', { defaultValue: 'Demander le transfert' })}
          </Button>
        </Box>

        {selected && (
          <Box sx={{ display: 'flex', gap: 3, mt: 2, flexWrap: 'wrap' }}>
            <Chip size="small" sx={{ bgcolor: '#f1f5f9' }}
              label={t('conge.alimenterCet.available', { defaultValue: 'Disponible : {{n}} j', n: selected.soldeDisponible.toFixed(1) })} />
            <Chip size="small" sx={{ bgcolor: '#f1f5f9' }}
              label={t('conge.alimenterCet.alreadyTransferred', { defaultValue: 'Déjà transféré : {{n}} j', n: selected.dejaTransfere.toFixed(1) })} />
            <Chip size="small" sx={{ bgcolor: '#ede9fe', color: '#6d28d9', fontWeight: 700 }}
              label={t('conge.alimenterCet.remaining', { defaultValue: 'Reste transférable : {{n}} j', n: selected.resteTransferable.toFixed(1) })} />
            {selected.plafondAnnuel != null && selected.plafondAnnuel > 0 && (
              <Chip size="small" sx={{ bgcolor: '#f1f5f9' }}
                label={t('conge.alimenterCet.cap', { defaultValue: 'Plafond/an : {{n}} j', n: selected.plafondAnnuel.toFixed(1) })} />
            )}
          </Box>
        )}
      </Box>

      {/* Historique des demandes */}
      <Box sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mt: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 2, color: '#191c1e' }}>
          {t('conge.alimenterCet.history', { defaultValue: 'Mes demandes' })}
        </Typography>
        {requests.length === 0 ? (
          <Typography sx={{ color: '#64748b', textAlign: 'center', py: 3 }}>
            {t('conge.alimenterCet.empty', { defaultValue: 'Aucune demande pour le moment.' })}
          </Typography>
        ) : (
          <Table size="small" component={Paper} variant="outlined">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t('conge.alimenterCet.col.date', { defaultValue: 'Date' })}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('conge.alimenterCet.col.type', { defaultValue: 'Type' })}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('conge.alimenterCet.col.days', { defaultValue: 'Jours' })}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('conge.alimenterCet.col.status', { defaultValue: 'Statut' })}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((r) => {
                const c = statutChip(r.statut);
                return (
                  <TableRow key={r.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(r.datedemande).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>{r.abslib || r.abscod}</TableCell>
                    <TableCell align="right">{r.nbjours.toFixed(1)} j</TableCell>
                    <TableCell align="right">
                      <Chip size="small" color={c.color}
                        label={t(`conge.alimenterCet.statut.${c.key}`, { defaultValue: c.key })} />
                      {r.statut === 'refused' && r.motifrefus ? (
                        <Typography variant="caption" sx={{ display: 'block', color: '#991b1b' }}>{r.motifrefus}</Typography>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Box>

      {feedback.element}
    </Box>
  );
};

export default AlimenterCetPage;
