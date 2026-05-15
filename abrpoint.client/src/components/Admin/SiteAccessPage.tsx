import * as React from 'react';
import {
  Box, Typography, Paper, Avatar, Chip, Checkbox, Snackbar, Alert,
  TextField, InputAdornment, Skeleton, Button,
} from '@mui/material';
import { Search as SearchIcon, ShieldCheck, Save, RotateCcw } from 'lucide-react';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';
import { ActionButton } from '../helper/animations/ActionButton';

/**
 * *Page d'affectation des droits d'accès par site (table Socuser).
 *
 * Pourquoi : avant, la table Socuser était peuplée à la création d'un user
 * (1 ligne pour le site initial), puis manipulée nulle part dans l'UI.
 * Conséquence : impossible d'élargir l'accès d'un manager à un 2ᵉ site
 * sans passer par SQL. Cette page expose la matrice utilisateur × site
 * pour permettre à l'admin de cocher/décocher en quelques clics.
 *
 * UX :
 *   • Une ligne par utilisateur, une colonne par site enregistré.
 *   • Les administrateurs (Utiadm='1') sont marqués « Tous » — leur ligne
 *     est désactivée, ils ont l'accès global par bypass.
 *   • Le bouton « Enregistrer » envoie un payload `{soccod, uticod, sitcods[]}`
 *     côté serveur qui réconcilie (ajoute / retire ce qui change).
 *   • Un bouton « Annuler » par ligne restaure les checkbox au dernier
 *     état persisté (utile quand on a coché plusieurs sites par erreur).
 */

interface SiteRow { sitcod: string; sitlib: string; }

interface UserAccessRow {
  uticod: string;
  utinom: string | null;
  utiprn: string | null;
  utimail: string | null;
  utirole: string | null;
  isAdmin: boolean;
  sitcods: string[];
}

const fullName = (r: UserAccessRow) => {
  const n = [r.utiprn, r.utinom].filter(Boolean).join(' ').trim();
  return n || r.uticod;
};

export default function SiteAccessPage() {
  const { soccod } = useAuth();
  const [sites, setSites] = React.useState<SiteRow[]>([]);
  const [users, setUsers] = React.useState<UserAccessRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  // État local des cases cochées : map uticod → Set(sitcod). On le diffère
  // du `users` initial pour gérer le « dirty state » par ligne.
  const [draft, setDraft] = React.useState<Record<string, Set<string>>>({});
  const [search, setSearch] = React.useState('');
  const [snack, setSnack] = React.useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' });

  // Chargement initial : sites de la société + matrice user × sites.
  React.useEffect(() => {
    if (!soccod) return;
    setLoading(true);
    Promise.all([
      apiInstance.get(`/Sites/get-sitlibs/${soccod}`).then(r => {
        const obj = r.data ?? {};
        return Object.entries(obj as Record<string, string>)
          .map(([sitcod, sitlib]) => ({ sitcod, sitlib }))
          .sort((a, b) => a.sitcod.localeCompare(b.sitcod));
      }).catch(() => [] as SiteRow[]),
      apiInstance.get(`/Socuser/by-soc/${soccod}`).then(r => (r.data ?? []) as UserAccessRow[]).catch(() => [] as UserAccessRow[]),
    ]).then(([sitesData, usersData]) => {
      setSites(sitesData);
      setUsers(usersData);
      // Snapshot initial pour le draft.
      const initial: Record<string, Set<string>> = {};
      usersData.forEach(u => { initial[u.uticod] = new Set(u.sitcods); });
      setDraft(initial);
    }).finally(() => setLoading(false));
  }, [soccod]);

  // Une ligne est « dirty » si son draft ne correspond plus aux sitcods initiaux.
  const isDirty = React.useCallback((u: UserAccessRow): boolean => {
    const a = u.sitcods;
    const b = Array.from(draft[u.uticod] ?? []);
    if (a.length !== b.length) return true;
    const sa = new Set(a);
    return b.some(c => !sa.has(c));
  }, [draft]);

  const filteredUsers = React.useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter(u =>
      (u.utinom || '').toLowerCase().includes(q) ||
      (u.utiprn || '').toLowerCase().includes(q) ||
      (u.utimail || '').toLowerCase().includes(q) ||
      u.uticod.toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggleCheck = (uticod: string, sitcod: string) => {
    setDraft(prev => {
      const cur = new Set(prev[uticod] ?? []);
      if (cur.has(sitcod)) cur.delete(sitcod); else cur.add(sitcod);
      return { ...prev, [uticod]: cur };
    });
  };

  const resetRow = (u: UserAccessRow) => {
    setDraft(prev => ({ ...prev, [u.uticod]: new Set(u.sitcods) }));
  };

  const saveRow = async (u: UserAccessRow): Promise<void> => {
    if (!soccod) throw new Error('soccod manquant');
    const sitcods = Array.from(draft[u.uticod] ?? []);
    await apiInstance.post('/Socuser/assign', {
      soccod, uticod: u.uticod, sitcods,
    });
    // Mise à jour optimiste de la source de vérité côté front pour clore
    // le « dirty state » après confirmation serveur.
    setUsers(prev => prev.map(x => x.uticod === u.uticod ? { ...x, sitcods } : x));
    setSnack({ open: true, msg: `Droits mis à jour pour ${fullName(u)}`, sev: 'success' });
  };

  const totalAssignments = users.reduce((acc, u) => acc + u.sitcods.length, 0);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '12px',
          background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldCheck size={22} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Droits d'accès par site
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.5 }}>
            Définit, pour chaque utilisateur, les sites dont il peut consulter les données (employés, KPIs, demandes…).
            Les administrateurs ont accès à tous les sites par défaut.
          </Typography>
        </Box>
        <Chip
          label={`${users.length} utilisateurs · ${sites.length} sites · ${totalAssignments} affectations`}
          size="small"
          sx={{ fontSize: 12, fontWeight: 700, bgcolor: '#e0e7ff', color: '#0040a1', border: '1px solid #c7d2fe' }}
        />
      </Box>

      {/* Search */}
      <Paper sx={{ p: 1.5, mb: 2, borderRadius: '12px' }}>
        <TextField
          size="small" fullWidth
          placeholder="Rechercher par nom, prénom, email ou code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon size={16} color="#94a3b8" /></InputAdornment>,
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#f8fafc' } }}
        />
      </Paper>

      {/* Matrix */}
      <Paper sx={{ borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ p: 2 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.2, borderBottom: '1px solid #f1f5f9' }}>
                <Skeleton variant="circular" width={36} height={36} animation="wave" />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="35%" height={16} animation="wave" />
                  <Skeleton variant="text" width="20%" height={12} animation="wave" />
                </Box>
                {[0, 1, 2, 3].map(j => <Skeleton key={j} variant="rounded" width={80} height={28} animation="wave" />)}
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: 720 }}>
              {/* Header matrix */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: `minmax(260px, 2fr) repeat(${Math.max(1, sites.length)}, 90px) 220px`,
                alignItems: 'center', gap: 1,
                px: 2, py: 1.5,
                borderBottom: '2px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                position: 'sticky', top: 0, zIndex: 1,
              }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Utilisateur
                </Typography>
                {sites.map(s => (
                  <Box key={s.sitcod} sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#0040a1' }}>{s.sitcod}</Typography>
                    <Typography sx={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sitlib}</Typography>
                  </Box>
                ))}
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>
                  Action
                </Typography>
              </Box>

              {filteredUsers.length === 0 ? (
                <Box sx={{ p: 6, textAlign: 'center', color: '#94a3b8' }}>
                  <Typography>Aucun utilisateur trouvé.</Typography>
                </Box>
              ) : filteredUsers.map(u => {
                const dirty = isDirty(u);
                return (
                  <Box key={u.uticod} sx={{
                    display: 'grid',
                    gridTemplateColumns: `minmax(260px, 2fr) repeat(${Math.max(1, sites.length)}, 90px) 220px`,
                    alignItems: 'center', gap: 1,
                    px: 2, py: 1.2,
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: dirty ? '#fffbeb' : 'transparent',
                    transition: 'background-color 200ms ease',
                  }}>
                    {/* User cell */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: '#e0e7ff', color: '#0040a1', fontSize: 13, fontWeight: 800 }}>
                        {(u.utinom || u.uticod).charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fullName(u)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                          <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>{u.uticod}</Typography>
                          {u.utirole && <Chip label={u.utirole} size="small" sx={{ height: 16, fontSize: 9, fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }} />}
                          {u.isAdmin && <Chip label="Admin" size="small" sx={{ height: 16, fontSize: 9, fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e' }} />}
                        </Box>
                      </Box>
                    </Box>

                    {/* Site cells */}
                    {sites.map(s => {
                      const checked = u.isAdmin || (draft[u.uticod]?.has(s.sitcod) ?? false);
                      return (
                        <Box key={s.sitcod} sx={{ textAlign: 'center' }}>
                          <Checkbox
                            size="small"
                            checked={checked}
                            disabled={u.isAdmin}
                            onChange={() => !u.isAdmin && toggleCheck(u.uticod, s.sitcod)}
                            sx={{
                              p: 0.5,
                              color: u.isAdmin ? '#fbbf24' : '#cbd5e1',
                              '&.Mui-checked': { color: u.isAdmin ? '#f59e0b' : '#0040a1' },
                            }}
                          />
                        </Box>
                      );
                    })}

                    {/* Actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.7 }}>
                      {u.isAdmin ? (
                        <Chip label="Accès global" size="small" sx={{ fontSize: 11, fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e' }} />
                      ) : (
                        <>
                          <Button
                            size="small"
                            variant="text"
                            disabled={!dirty}
                            startIcon={<RotateCcw size={14} />}
                            onClick={() => resetRow(u)}
                            sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12, color: '#64748b' }}
                          >
                            Annuler
                          </Button>
                          <ActionButton
                            size="small"
                            variant="contained"
                            disabled={!dirty}
                            startIcon={<Save size={14} />}
                            onAction={() => saveRow(u)}
                            successLabel="Enregistré"
                            sx={{
                              textTransform: 'none', fontWeight: 700, fontSize: 12,
                              borderRadius: '8px', minWidth: 96,
                              background: dirty ? 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)' : undefined,
                            }}
                          >
                            Enregistrer
                          </ActionButton>
                        </>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Paper>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
