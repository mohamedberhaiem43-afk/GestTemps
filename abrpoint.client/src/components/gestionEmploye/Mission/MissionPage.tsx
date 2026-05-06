import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Chip, Snackbar, Alert, CircularProgress, Tooltip, InputAdornment, Skeleton
} from '@mui/material';
import { staggerSx } from '../../helper/animations/Stagger';
import {
  Plus, Edit3, Trash2, Search, Briefcase, MapPin, Calendar, User as UserIcon, FileText
} from 'lucide-react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
      if (statusFilter !== 'all' && m.misetat !== statusFilter) return false;
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
      showSnack(t('mission.msg.requiredFields'), 'error');
      return;
    }
    if (dayjs(form.misdatefin).isBefore(form.misdatedeb)) {
      showSnack(t('mission.msg.invalidDateRange'), 'error');
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
        showSnack(t('mission.msg.created'), 'success');
      } else {
        await updateMut.mutateAsync({ id: editingId, req: payload });
        showSnack(t('mission.msg.updated'), 'success');
      }
      setDialogOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('mission.msg.saveError');
      showSnack(msg, 'error');
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      showSnack(t('mission.msg.deleted'), 'success');
    } catch {
      showSnack(t('mission.msg.deleteError'), 'error');
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
            {t('mission.header.title')}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
            {t('mission.header.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={openCreate}
          sx={{ bgcolor: '#0040a1', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#003080' } }}
        >
          {t('mission.header.newMission')}
        </Button>
      </Box>

      {noNatures && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('mission.alerts.noNatures')}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder={t('mission.filters.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
          sx={{ minWidth: 320, flex: 1 }}
        />
        <TextField
          size="small"
          select
          label={t('mission.filters.state')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">{t('mission.filters.all')}</MenuItem>
          {STATES.map(s => <MenuItem key={s} value={s}>{t(`mission.states.${s}`)}</MenuItem>)}
        </TextField>
      </Box>

      {/* overflow-x scroll au lieu de overflow:hidden — sur mobile (<700px) la grille
          7 colonnes débordait silencieusement. Le wrapper scrollable préserve la
          lisibilité en gardant la min-width de la grille. */}
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '2.5fr 1.8fr 1.4fr 1.4fr 1fr 1fr 90px', gap: 0, bgcolor: 'background.paper', minWidth: { xs: 700, md: 'auto' } }}>
          {[
            t('mission.table.object'),
            t('mission.table.collaborator'),
            t('mission.table.destination'),
            t('mission.table.period'),
            t('mission.table.budget'),
            t('mission.table.state'),
            ''
          ].map((h, i) => (
            <Typography key={i} sx={{ p: 1.5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>
              {h}
            </Typography>
          ))}
          {missionsQ.isLoading && (
            // Skeleton rows : reproduit la silhouette de 4 lignes pour que l'œil ne
            // perçoive pas un flash entre l'écran vide et la table peuplée.
            [0, 1, 2, 3].map(rowIdx => (
              <React.Fragment key={`sk-${rowIdx}`}>
                {[0, 1, 2, 3, 4, 5, 6].map(colIdx => (
                  <Box
                    key={`sk-${rowIdx}-${colIdx}`}
                    sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Skeleton variant="text" sx={{ fontSize: 13, width: colIdx === 0 ? '80%' : colIdx === 6 ? 60 : '60%' }} />
                  </Box>
                ))}
              </React.Fragment>
            ))
          )}
          {!missionsQ.isLoading && filtered.length === 0 && (
            <Typography sx={{ gridColumn: '1 / -1', p: 4, textAlign: 'center', color: 'text.secondary' }}>
              {t('mission.table.empty')}
            </Typography>
          )}
          {filtered.map((m, idx) => {
            // staggerSx ajoute un fade+translateY de 320 ms décalé de 40 ms par
            // ligne (plafonné à 12 lignes). Appliqué à chaque cellule pour rester
            // cohérent avec la grille CSS (pas de wrapper supplémentaire).
            const cellStagger = staggerSx(idx);
            return (
              <React.Fragment key={m.id}>
                <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, ...cellStagger }}>
                  <FileText size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{m.misobj}</Typography>
                    {m.misnote && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{m.misnote}</Typography>}
                  </Box>
                </Box>
                <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, ...cellStagger }}>
                  <UserIcon size={14} style={{ opacity: 0.6 }} />
                  <Typography sx={{ fontSize: 13 }}>{employeLabel(m.empcod)}</Typography>
                </Box>
                <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, ...cellStagger }}>
                  {m.misdest && <MapPin size={14} style={{ opacity: 0.6 }} />}
                  <Typography sx={{ fontSize: 13 }}>{m.misdest || '—'}</Typography>
                </Box>
                <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, ...cellStagger }}>
                  <Calendar size={14} style={{ opacity: 0.6 }} />
                  <Typography sx={{ fontSize: 12 }}>
                    {dayjs(m.misdatedeb).format('DD/MM/YY')} → {dayjs(m.misdatefin).format('DD/MM/YY')}
                  </Typography>
                </Box>
                <Typography sx={{ p: 1.5, fontSize: 13, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', ...cellStagger }}>
                  {m.misbudget != null ? `${m.misbudget.toFixed(2)} €` : '—'}
                </Typography>
                <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', ...cellStagger }}>
                  <Chip
                    label={t(`mission.states.${m.misetat}`, m.misetat)}
                    size="small"
                    sx={{ bgcolor: `${STATE_COLORS[m.misetat] || '#94a3b8'}20`, color: STATE_COLORS[m.misetat] || '#94a3b8', fontWeight: 700, fontSize: 11 }}
                  />
                </Box>
                <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 0.5, ...cellStagger }}>
                  <Tooltip title={t('mission.actions.edit')}><IconButton size="small" onClick={() => openEdit(m)}><Edit3 size={14} /></IconButton></Tooltip>
                  <Tooltip title={t('mission.actions.delete')}><IconButton size="small" onClick={() => setConfirmDelete(m)} sx={{ color: '#ef4444' }}><Trash2 size={14} /></IconButton></Tooltip>
                </Box>
              </React.Fragment>
            );
          })}
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editingId == null ? t('mission.dialog.newTitle') : t('mission.dialog.editTitle')}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, pt: 1 }}>
            {selfOnly ? (
              // Employé : auto-affecté à lui-même, champ en lecture seule pour clarifier l'intention.
              <TextField
                label={t('mission.dialog.collaborator')}
                size="small"
                value={uticod ?? ''}
                InputProps={{ readOnly: true }}
                helperText={t('mission.dialog.selfHint')}
              />
            ) : (
              <TextField
                label={t('mission.dialog.collaborator')}
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
              label={t('mission.dialog.absenceNature')}
              size="small"
              select
              required
              value={form.abscod}
              onChange={e => setForm({ ...form, abscod: e.target.value })}
              helperText={noNatures ? t('mission.dialog.absenceHintNone') : t('mission.dialog.absenceHintAvailable')}
              disabled={noNatures}
            >
              {(naturesQ.data ?? []).map(n => (
                <MenuItem key={n.abscod} value={n.abscod}>{n.abscod} — {n.abslib}</MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('mission.dialog.object')}
              size="small"
              required
              value={form.misobj}
              onChange={e => setForm({ ...form, misobj: e.target.value })}
              sx={{ gridColumn: { md: 'span 2' } }}
            />
            <TextField
              label={t('mission.dialog.destination')}
              size="small"
              value={form.misdest ?? ''}
              onChange={e => setForm({ ...form, misdest: e.target.value })}
            />
            <TextField
              label={t('mission.dialog.state')}
              size="small"
              select
              value={form.misetat}
              onChange={e => setForm({ ...form, misetat: e.target.value })}
            >
              {STATES.map(s => <MenuItem key={s} value={s}>{t(`mission.states.${s}`)}</MenuItem>)}
            </TextField>
            <TextField
              label={t('mission.dialog.dateStart')}
              size="small"
              type="date"
              required
              InputLabelProps={{ shrink: true }}
              value={form.misdatedeb?.slice(0, 10) ?? ''}
              onChange={e => setForm({ ...form, misdatedeb: e.target.value })}
            />
            <TextField
              label={t('mission.dialog.dateEnd')}
              size="small"
              type="date"
              required
              InputLabelProps={{ shrink: true }}
              value={form.misdatefin?.slice(0, 10) ?? ''}
              onChange={e => setForm({ ...form, misdatefin: e.target.value })}
            />
            <TextField
              label={t('mission.dialog.budget')}
              size="small"
              type="number"
              inputProps={{ step: '0.001', min: 0 }}
              value={form.misbudget ?? ''}
              onChange={e => setForm({ ...form, misbudget: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
            <TextField
              label={t('mission.dialog.note')}
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
          <Button onClick={() => setDialogOpen(false)}>{t('mission.dialog.cancel')}</Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={createMut.isLoading || updateMut.isLoading}
            sx={{ bgcolor: '#0040a1', '&:hover': { bgcolor: '#003080' } }}
          >
            {(createMut.isLoading || updateMut.isLoading) ? <CircularProgress size={16} sx={{ color: 'white' }} /> : t('mission.dialog.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>{t('mission.delete.title')}</DialogTitle>
        <DialogContent>
          <Typography>{t('mission.delete.message', { object: confirmDelete?.misobj ?? '' })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>{t('mission.delete.cancel')}</Button>
          <Button color="error" variant="contained" onClick={doDelete} disabled={deleteMut.isLoading}>
            {deleteMut.isLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : t('mission.delete.confirm')}
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
