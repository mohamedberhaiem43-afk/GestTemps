import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Chip, Snackbar, Alert, CircularProgress, Tooltip, InputAdornment
} from '@mui/material';
import {
  Plus, Edit3, Trash2, Search, Briefcase, MapPin, Calendar, User as UserIcon, FileText
} from 'lucide-react';
import dayjs from 'dayjs';
import { useAuth } from '../../helper/AuthProvider';
import { useQuery } from 'react-query';
import EmployeService from '../../../services/EmployeService/EmployeService';
import {
  useMissionsBySoc,
  useMissionsByEmp,
  useFormationMissionNatures,
  useCreateMission,
  useUpdateMission,
  useDeleteMission,
} from '../../../hooks/missionHooks/useMissions';
import { Mission, MissionUpsertRequest } from '../../../models/Mission';

const STATES = ['Pending', 'Approved', 'InProgress', 'Completed', 'Cancelled'];
const STATE_COLORS: Record<string, string> = {
  Pending: '#f59e0b',
  Approved: '#3b82f6',
  InProgress: '#8b5cf6',
  Completed: '#16a34a',
  Cancelled: '#ef4444',
};

const emptyForm = (soccod: string, defaultEmpcod = ''): MissionUpsertRequest => ({
  soccod,
  empcod: defaultEmpcod,
  misobj: '',
  misdest: '',
  misdatedeb: dayjs().format('YYYY-MM-DD'),
  misdatefin: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  misnote: '',
  misetat: 'Pending',
  misbudget: undefined,
  abscod: '',
});

const MissionPage: React.FC = () => {
  const { soccod, uticod, isEmp, isAdmin, isManager } = useAuth();
  const sc = soccod || '';
  // Un collaborateur (sans rôle manager/admin) ne peut créer une mission que pour lui-même.
  // Le selector "Collaborateur" est masqué et empcod est pré-affecté à son propre uticod.
  const selfOnly = isEmp && !isAdmin && !isManager;
  const defaultEmpcod = selfOnly ? (uticod ?? '') : '';

  // Admin/Manager voient toutes les missions de la société ; un employé ne voit que les siennes.
  const missionsBySocQ = useMissionsBySoc(selfOnly ? null : sc);
  const missionsByEmpQ = useMissionsByEmp(selfOnly ? sc : null, selfOnly ? (uticod ?? null) : null);
  const missionsQ = selfOnly ? missionsByEmpQ : missionsBySocQ;
  const naturesQ = useFormationMissionNatures(sc);
  const employesQ = useQuery({
    queryKey: ['employees', sc, uticod],
    queryFn: () => EmployeService.getAllWithParams(`${sc}/${uticod}`),
    enabled: !!sc && !!uticod && !selfOnly,
  });

  const createMut = useCreateMission();
  const updateMut = useUpdateMission();
  const deleteMut = useDeleteMission();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Tous');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MissionUpsertRequest>(emptyForm(sc, defaultEmpcod));
  const [confirmDelete, setConfirmDelete] = useState<Mission | null>(null);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as 'success' | 'error' });
  const showSnack = (msg: string, sev: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, sev });

  const employesList = useMemo(() => {
    const data = (employesQ.data as any) ?? [];
    return Array.isArray(data) ? data : [];
  }, [employesQ.data]);

  const employeLabel = (empcod: string) => {
    const e = employesList.find((x: any) => x.empcod === empcod);
    return e ? `${e.empcod} — ${e.emplib ?? ''}`.trim() : empcod;
  };

  const filtered = useMemo(() => {
    const list = (missionsQ.data ?? []) as Mission[];
    return list.filter(m => {
      if (statusFilter !== 'Tous' && m.misetat !== statusFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        m.misobj?.toLowerCase().includes(s) ||
        m.misdest?.toLowerCase().includes(s) ||
        m.empcod?.toLowerCase().includes(s)
      );
    });
  }, [missionsQ.data, search, statusFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(sc, defaultEmpcod));
    setDialogOpen(true);
  };

  const openEdit = (m: Mission) => {
    setEditingId(m.id);
    setForm({
      soccod: m.soccod,
      empcod: m.empcod,
      misobj: m.misobj,
      misdest: m.misdest ?? '',
      misdatedeb: dayjs(m.misdatedeb).format('YYYY-MM-DD'),
      misdatefin: dayjs(m.misdatefin).format('YYYY-MM-DD'),
      misnote: m.misnote ?? '',
      misetat: m.misetat,
      misbudget: m.misbudget ?? undefined,
      abscod: m.abscod,
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.empcod || !form.misobj || !form.abscod || !form.misdatedeb || !form.misdatefin) {
      showSnack('Champs requis manquants : collaborateur, objet, nature et dates.', 'error');
      return;
    }
    if (dayjs(form.misdatefin).isBefore(form.misdatedeb)) {
      showSnack('La date de fin doit être postérieure à la date de début.', 'error');
      return;
    }
    try {
      const payload: MissionUpsertRequest = {
        ...form,
        soccod: sc,
        misdatedeb: dayjs(form.misdatedeb).toISOString(),
        misdatefin: dayjs(form.misdatefin).toISOString(),
        misbudget: form.misbudget != null && form.misbudget !== ('' as any) ? Number(form.misbudget) : undefined,
      };
      if (editingId == null) {
        await createMut.mutateAsync(payload);
        showSnack('Mission créée.', 'success');
      } else {
        await updateMut.mutateAsync({ id: editingId, req: payload });
        showSnack('Mission mise à jour.', 'success');
      }
      setDialogOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Échec de l'enregistrement.";
      showSnack(msg, 'error');
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      showSnack('Mission supprimée.', 'success');
    } catch {
      showSnack('Erreur lors de la suppression.', 'error');
    } finally {
      setConfirmDelete(null);
    }
  };

  const noNatures = !naturesQ.isLoading && (naturesQ.data ?? []).length === 0;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 26, fontWeight: 800, color: 'text.primary' }}>
            <Briefcase size={22} style={{ verticalAlign: -3, marginRight: 8 }} />
            Gestion des missions
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
            Toute note de frais doit être rattachée à une mission de catégorie « Formation et mission » (abscng = 6).
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={openCreate}
          sx={{ bgcolor: '#0040a1', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#003080' } }}
        >
          Nouvelle mission
        </Button>
      </Box>

      {noNatures && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Aucune nature d'absence avec abscng = 6 n'est définie. Créez-en une dans
          « Données de base &gt; Natures d'absences » avant de saisir des missions.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Rechercher (objet, destination, employé)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
          sx={{ minWidth: 320, flex: 1 }}
        />
        <TextField
          size="small"
          select
          label="État"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="Tous">Tous</MenuItem>
          {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
      </Box>

      {/* overflow-x scroll au lieu de overflow:hidden — sur mobile (<700px) la grille
          7 colonnes débordait silencieusement. Le wrapper scrollable préserve la
          lisibilité en gardant la min-width de la grille. */}
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '2.5fr 1.8fr 1.4fr 1.4fr 1fr 1fr 90px', gap: 0, bgcolor: 'background.paper', minWidth: { xs: 700, md: 'auto' } }}>
          {['Objet', 'Collaborateur', 'Destination', 'Période', 'Budget', 'État', ''].map((h, i) => (
            <Typography key={i} sx={{ p: 1.5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>
              {h}
            </Typography>
          ))}
          {missionsQ.isLoading && (
            <Box sx={{ gridColumn: '1 / -1', p: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>
          )}
          {!missionsQ.isLoading && filtered.length === 0 && (
            <Typography sx={{ gridColumn: '1 / -1', p: 4, textAlign: 'center', color: 'text.secondary' }}>
              Aucune mission.
            </Typography>
          )}
          {filtered.map(m => (
            <React.Fragment key={m.id}>
              <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                <FileText size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{m.misobj}</Typography>
                  {m.misnote && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{m.misnote}</Typography>}
                </Box>
              </Box>
              <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                <UserIcon size={14} style={{ opacity: 0.6 }} />
                <Typography sx={{ fontSize: 13 }}>{employeLabel(m.empcod)}</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                {m.misdest && <MapPin size={14} style={{ opacity: 0.6 }} />}
                <Typography sx={{ fontSize: 13 }}>{m.misdest || '—'}</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Calendar size={14} style={{ opacity: 0.6 }} />
                <Typography sx={{ fontSize: 12 }}>
                  {dayjs(m.misdatedeb).format('DD/MM/YY')} → {dayjs(m.misdatefin).format('DD/MM/YY')}
                </Typography>
              </Box>
              <Typography sx={{ p: 1.5, fontSize: 13, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                {m.misbudget != null ? `${m.misbudget.toFixed(2)} DT` : '—'}
              </Typography>
              <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                <Chip
                  label={m.misetat}
                  size="small"
                  sx={{ bgcolor: `${STATE_COLORS[m.misetat] || '#94a3b8'}20`, color: STATE_COLORS[m.misetat] || '#94a3b8', fontWeight: 700, fontSize: 11 }}
                />
              </Box>
              <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title="Modifier"><IconButton size="small" onClick={() => openEdit(m)}><Edit3 size={14} /></IconButton></Tooltip>
                <Tooltip title="Supprimer"><IconButton size="small" onClick={() => setConfirmDelete(m)} sx={{ color: '#ef4444' }}><Trash2 size={14} /></IconButton></Tooltip>
              </Box>
            </React.Fragment>
          ))}
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editingId == null ? 'Nouvelle mission' : 'Modifier la mission'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, pt: 1 }}>
            {selfOnly ? (
              // Employé : auto-affecté à lui-même, champ en lecture seule pour clarifier l'intention.
              <TextField
                label="Collaborateur"
                size="small"
                value={uticod ?? ''}
                InputProps={{ readOnly: true }}
                helperText="Mission créée pour vous-même."
              />
            ) : (
              <TextField
                label="Collaborateur"
                size="small"
                select
                required
                value={form.empcod}
                onChange={e => setForm({ ...form, empcod: e.target.value })}
              >
                {employesList.map((e: any) => (
                  <MenuItem key={e.empcod} value={e.empcod}>{e.empcod} — {e.emplib}</MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              label="Nature d'absence (Formation et mission)"
              size="small"
              select
              required
              value={form.abscod}
              onChange={e => setForm({ ...form, abscod: e.target.value })}
              helperText={noNatures ? 'Aucune nature avec abscng = 6 disponible.' : 'Seules les natures abscng=6 sont listées.'}
              disabled={noNatures}
            >
              {(naturesQ.data ?? []).map(n => (
                <MenuItem key={n.abscod} value={n.abscod}>{n.abscod} — {n.abslib}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Objet de la mission"
              size="small"
              required
              value={form.misobj}
              onChange={e => setForm({ ...form, misobj: e.target.value })}
              sx={{ gridColumn: { md: 'span 2' } }}
            />
            <TextField
              label="Destination"
              size="small"
              value={form.misdest ?? ''}
              onChange={e => setForm({ ...form, misdest: e.target.value })}
            />
            <TextField
              label="État"
              size="small"
              select
              value={form.misetat}
              onChange={e => setForm({ ...form, misetat: e.target.value })}
            >
              {STATES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <TextField
              label="Date de début"
              size="small"
              type="date"
              required
              InputLabelProps={{ shrink: true }}
              value={form.misdatedeb?.slice(0, 10) ?? ''}
              onChange={e => setForm({ ...form, misdatedeb: e.target.value })}
            />
            <TextField
              label="Date de fin"
              size="small"
              type="date"
              required
              InputLabelProps={{ shrink: true }}
              value={form.misdatefin?.slice(0, 10) ?? ''}
              onChange={e => setForm({ ...form, misdatefin: e.target.value })}
            />
            <TextField
              label="Budget alloué (DT)"
              size="small"
              type="number"
              inputProps={{ step: '0.001', min: 0 }}
              value={form.misbudget ?? ''}
              onChange={e => setForm({ ...form, misbudget: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
            <TextField
              label="Note"
              size="small"
              multiline
              minRows={3}
              value={form.misnote ?? ''}
              onChange={e => setForm({ ...form, misnote: e.target.value })}
              sx={{ gridColumn: { md: 'span 2' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={createMut.isLoading || updateMut.isLoading}
            sx={{ bgcolor: '#0040a1', '&:hover': { bgcolor: '#003080' } }}
          >
            {(createMut.isLoading || updateMut.isLoading) ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Supprimer la mission ?</DialogTitle>
        <DialogContent>
          <Typography>« {confirmDelete?.misobj} » sera supprimée. Les notes de frais déjà rattachées la conserveront en référence historique.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Annuler</Button>
          <Button color="error" variant="contained" onClick={doDelete} disabled={deleteMut.isLoading}>
            {deleteMut.isLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.sev} onClose={() => setSnack({ ...snack, open: false })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default MissionPage;
