import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, TextField, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableRow, TableCell, TableBody, Chip } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
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

const CetPage: React.FC = () => {
  const { soccod, hasPermission } = useAuth();
  const [datelim, setDatelim] = useState('31-05');
  const [maxJours, setMaxJours] = useState<number>(10);
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [preview, setPreview] = useState<TransferResult | null>(null);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as 'success' | 'error' | 'info' });

  const canModify = hasPermission('Données de Base', 'modify');

  useEffect(() => {
    if (!soccod) return;
    apiInstance.get(`/Cet/parametres/${soccod}`)
      .then(({ data }) => {
        setDatelim(data?.datelim ?? '31-05');
        setMaxJours(typeof data?.maxjours === 'number' ? data.maxjours : 10);
      })
      .catch(() => { /* defaults already set */ });
  }, [soccod]);

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter le CET." />;
  }

  const saveParams = async () => {
    if (!/^\d{2}-\d{2}$/.test(datelim)) {
      setSnack({ open: true, msg: 'Date limite invalide (format DD-MM, ex: 31-05).', sev: 'error' });
      return;
    }
    if (maxJours < 0) {
      setSnack({ open: true, msg: 'Le plafond doit être positif.', sev: 'error' });
      return;
    }
    setLoading(true);
    try {
      await apiInstance.put('/Cet/parametres', { soccod, datelim, maxjours: maxJours });
      setSnack({ open: true, msg: 'Paramètres CET enregistrés.', sev: 'success' });
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.error || 'Erreur lors de la sauvegarde.', sev: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const runPreview = async () => {
    setLoading(true);
    try {
      const { data } = await apiInstance.get<TransferResult>(`/Cet/preview/${soccod}/${annee}`);
      setPreview(data);
      setSnack({ open: true, msg: `Aperçu : ${data.employesTraites} employé(s), ${data.totalJoursTransferes} jour(s) à transférer.`, sev: 'info' });
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.error || 'Erreur lors du calcul.', sev: 'error' });
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
      setSnack({ open: true, msg: `Transfert appliqué : ${data.employesTraites} employé(s), ${data.totalJoursTransferes} jour(s) ajoutés au CET.`, sev: 'success' });
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.error || 'Erreur lors du transfert.', sev: 'error' });
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
          <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e' }}>Compte Épargne Temps</Typography>
          <Typography sx={{ fontSize: 13, color: '#475569' }}>
            Les congés payés non pris à la date limite sont automatiquement transférés vers le CET, dans la limite du plafond paramétré.
          </Typography>
        </Box>
      </Box>

      {/* Paramètres */}
      <Box sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mt: 4 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 3, color: '#191c1e' }}>Paramètres de la règle</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, alignItems: 'flex-end' }}>
          <TextField
            label="Date limite (JJ-MM)"
            size="small"
            value={datelim}
            onChange={(e) => setDatelim(e.target.value)}
            placeholder="31-05"
            helperText="Date après laquelle le transfert s'applique"
          />
          <TextField
            label="Plafond CET (jours)"
            size="small"
            type="number"
            value={maxJours}
            onChange={(e) => setMaxJours(Number(e.target.value) || 0)}
            inputProps={{ min: 0, step: 0.5 }}
            helperText="Nombre maximum de jours transférés par an"
          />
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveParams}
            disabled={!canModify || loading}
            sx={{ height: 40, bgcolor: '#0040a1', textTransform: 'none', fontWeight: 700 }}
          >
            Enregistrer
          </Button>
        </Box>
      </Box>

      {/* Application du transfert */}
      <Box sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mt: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1, color: '#191c1e' }}>Appliquer le transfert annuel</Typography>
        <Typography sx={{ fontSize: 13, color: '#475569', mb: 3 }}>
          Sélectionnez l'année. L'aperçu calcule sans modifier — le transfert effectif met à jour la table solde.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Année"
            size="small"
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
            sx={{ width: 120 }}
          />
          <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={runPreview} disabled={loading} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Aperçu
          </Button>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={() => setOpenConfirm(true)}
            disabled={!canModify || loading}
            sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#15803d' } }}
          >
            Appliquer le transfert
          </Button>
        </Box>
      </Box>

      {/* Résultat */}
      {preview && (
        <Box sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#191c1e' }}>
              Résultat — Année {preview.annee}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip label={`Date limite : ${preview.dateLimite}`} size="small" sx={{ bgcolor: '#f1f5f9' }} />
              <Chip label={`Plafond : ${preview.maxJours} j`} size="small" sx={{ bgcolor: '#f1f5f9' }} />
              <Chip label={`${preview.employesTraites} employé(s)`} size="small" color="primary" />
              <Chip label={`Total : ${preview.totalJoursTransferes} j`} size="small" sx={{ bgcolor: '#16a34a', color: '#fff', fontWeight: 700 }} />
            </Box>
          </Box>
          {preview.details.length === 0 ? (
            <Typography sx={{ color: '#64748b', textAlign: 'center', py: 3 }}>
              Aucun jour à transférer.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Code employé</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Solde restant avant</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Jours transférés</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">CET après</TableCell>
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

      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)}>
        <DialogTitle>Confirmer le transfert CET</DialogTitle>
        <DialogContent>
          <Typography>
            Cette action met à jour les soldes de tous les employés pour l'année <strong>{annee}</strong>.
            Les jours non pris (au-delà du plafond) seront perdus. Cette opération est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirm(false)} sx={{ textTransform: 'none' }}>Annuler</Button>
          <Button onClick={applyTransfer} variant="contained" sx={{ bgcolor: '#16a34a', textTransform: 'none', fontWeight: 700 }}>
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={5000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.sev} onClose={() => setSnack({ ...snack, open: false })} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default CetPage;
