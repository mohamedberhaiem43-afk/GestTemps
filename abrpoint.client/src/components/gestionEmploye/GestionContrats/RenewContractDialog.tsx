import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, MenuItem, Select, FormControl, InputLabel, CircularProgress, Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import dayjs from 'dayjs';
import useRenouvellementContrat from '../../../hooks/contratHooks/useRenouvellementContrat';
import apiInstance from '../../API/apiInstance';
import { useAuth } from '../../helper/AuthProvider';
import { Contrat } from '../../../models/Contrat';

/**
 * Boîte de dialogue de renouvellement de contrat.
 *
 * Usage : appelée depuis la liste des contrats (bouton "Renouveler" par ligne) et depuis
 * le dashboard (KPI "Échéance contrat" → liste cliquable). Pré-remplit la durée à 12 mois,
 * la date de début à J+1 de la fin du contrat source, et propose de re-générer le numéro
 * de contrat via l'endpoint backend GetNextConcod.
 */
export interface RenewContractDialogProps {
  open: boolean;
  onClose: () => void;
  source: Contrat | null;
  onSuccess?: () => void;
}

const TYPE_OPTIONS = [
  { code: '0', label: 'CDD' },
  { code: '1', label: 'CDI' },
  { code: '2', label: 'Ouvrier' },
  { code: '3', label: 'CIVP' },
  { code: '4', label: 'Alternance' },
];

const toIso = (v: any) => (v ? dayjs(v).format('YYYY-MM-DD') : '');
const monthsBetween = (start: string, end: string) => {
  if (!start || !end) return 0;
  const s = dayjs(start), e = dayjs(end);
  return Math.max(0, e.diff(s, 'month') + 1);
};

const RenewContractDialog: React.FC<RenewContractDialogProps> = ({ open, onClose, source, onSuccess }) => {
  const { soccod } = useAuth();
  const renew = useRenouvellementContrat();

  const initialStart = useMemo(() => {
    if (!source?.empsort) return dayjs().format('YYYY-MM-DD');
    return dayjs(source.empsort).add(1, 'day').format('YYYY-MM-DD');
  }, [source]);

  const [newConcod, setNewConcod] = useState('');
  const [condat, setCondat] = useState(dayjs().format('YYYY-MM-DD'));
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(dayjs(initialStart).add(12, 'month').subtract(1, 'day').format('YYYY-MM-DD'));
  const [contype, setContype] = useState<string>(source?.contype || '0');
  const [empmotif, setEmpmotif] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Reset / pré-remplissage à chaque ouverture pour repartir d'un état propre.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setStartDate(initialStart);
    setEndDate(dayjs(initialStart).add(12, 'month').subtract(1, 'day').format('YYYY-MM-DD'));
    setCondat(dayjs().format('YYYY-MM-DD'));
    setContype(source?.contype || '0');
    setEmpmotif('');

    // Demander un nouveau numéro de contrat au backend.
    if (soccod) {
      apiInstance.get(`/Contrats/get-next-concod/${soccod}`)
        .then((r) => setNewConcod(r.data?.concod || ''))
        .catch(() => setNewConcod(''));
    }
  }, [open, soccod, initialStart, source]);

  const months = monthsBetween(startDate, endDate);
  const empcontrat = useMemo(() => TYPE_OPTIONS.find(o => o.code === contype)?.label || '', [contype]);

  const handleConfirm = async () => {
    setError(null);
    if (!source?.concod || !soccod) { setError('Contrat source invalide.'); return; }
    if (!newConcod) { setError('Numéro de nouveau contrat manquant.'); return; }
    if (!startDate || !endDate) { setError('Dates de début et fin obligatoires.'); return; }
    if (dayjs(endDate).isBefore(startDate)) { setError('La date de fin doit être postérieure à la date de début.'); return; }

    try {
      await renew.mutateAsync({
        soccod,
        sourceConcod: source.concod,
        newConcod,
        condat: toIso(condat),
        startDate: toIso(startDate),
        endDate: toIso(endDate),
        monthNumber: months,
        contype,
        empcontrat,
        empmotif: empmotif || undefined,
      });
      onSuccess?.();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erreur lors du renouvellement.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <RefreshIcon /> Renouveler le contrat
        {source?.concod && (
          <Typography component="span" sx={{ ml: 1, fontFamily: 'monospace', color: '#0040a1', fontSize: 14 }}>
            {source.concod}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {source && (
          <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, background: '#f8faff', border: '1px solid #e0e7ff' }}>
            <Typography sx={{ fontSize: 13 }}>
              <strong>{source.emplib || source.empcod}</strong>
              {source.empsort && (
                <> · échéance actuelle : <strong>{dayjs(source.empsort).format('DD/MM/YYYY')}</strong></>
              )}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <TextField label="N° nouveau contrat" size="small" value={newConcod} onChange={(e) => setNewConcod(e.target.value)} />
          <TextField label="Date contrat" type="date" size="small" InputLabelProps={{ shrink: true }} value={condat} onChange={(e) => setCondat(e.target.value)} />
          <TextField label="Date début" type="date" size="small" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <TextField label="Date fin" type="date" size="small" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <FormControl size="small">
            <InputLabel>Type de contrat</InputLabel>
            <Select label="Type de contrat" value={contype} onChange={(e) => setContype(String(e.target.value))}>
              {TYPE_OPTIONS.map((o) => <MenuItem key={o.code} value={o.code}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Durée (mois)" size="small" value={months} InputProps={{ readOnly: true }} />
          <TextField label="Motif (optionnel)" size="small" value={empmotif} onChange={(e) => setEmpmotif(e.target.value)} sx={{ gridColumn: '1 / -1' }} />
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={renew.isPending}>Annuler</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={renew.isPending} startIcon={renew.isPending ? <CircularProgress size={16} /> : <RefreshIcon />}>
          Renouveler
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RenewContractDialog;
