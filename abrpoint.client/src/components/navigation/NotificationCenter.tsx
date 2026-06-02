import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconButton,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Divider,
  Tooltip,
  Avatar,
  Stack,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Badge,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Umbrella as LeaveIcon,
  Block as RefuseIcon,
  AccessTime as AutorisationIcon,
  DoneAll as DoneAllIcon,
  NotificationsNone as NoNotifIcon,
  CheckCircle as ValidIcon,
  Cancel as CancelIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  DeleteOutline as DeleteIcon,
  Refresh as RefreshIcon,
  ChevronRight as ChevronRightIcon,
  Draw as SignIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../helper/AuthProvider';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/fr';
import apiInstance from '../API/apiInstance';

dayjs.extend(relativeTime);
dayjs.locale('fr');

/* ══════════════════════════════════════════════════════ */
/*  Types                                                 */
/* ══════════════════════════════════════════════════════ */
interface ServerNotification {
  id: number;
  title: string;
  body: string;
  category: string | null;
  dataJson: string | null;
  createdAt: string;
  readAt: string | null;
}

interface CategoryMeta {
  icon: React.ReactNode;
  color: string;
  bg: string;
  /** Slug de page interne pour le deep-link au tap. */
  route?: string;
}

const FALLBACK: CategoryMeta = { icon: <NotificationsIcon fontSize="small" />, color: '#64748b', bg: '#f1f5f9' };

// 2026-05-27 — Carto étendue : toutes les catégories émises côté backend
// (cf. UserNotificationService.ExtractCategory + payloads `type` dans
// AutorisersController / DemCongesController / DemandeAbsenceController /
// DemandeAutorisationsController / TeletravailController / VaultController
// / LetterGenerationService / ClaudeRagService) ont maintenant un `route`
// associé. Avant : un clic sur une notif d'heures sup / télétravail / coffre
// / lettre IA / chat IA marquait la notif lue mais ne naviguait nulle part.
const CATEGORIES: Record<string, CategoryMeta> = {
  // Rappels pointage entrée/sortie : pas de page dédiée, dashboard accueille.
  reminder_in:                  { icon: <LoginIcon fontSize="small" />,         color: '#0040a1', bg: '#dae2ff', route: '/dashboard' },
  reminder_out:                 { icon: <LogoutIcon fontSize="small" />,        color: '#b45309', bg: '#fff1c2', route: '/dashboard' },
  // Congés (cycle complet).
  leave_request_created:        { icon: <LeaveIcon fontSize="small" />,         color: '#0056d2', bg: '#d5e3fc', route: '/dashboard/gestion-de-conge' },
  leave_request_accepted:       { icon: <ValidIcon fontSize="small" />,         color: '#005236', bg: '#8df7c2', route: '/dashboard/gestion-de-conge' },
  leave_request_refused:        { icon: <CancelIcon fontSize="small" />,        color: '#ba1a1a', bg: '#ffdad6', route: '/dashboard/gestion-de-conge' },
  // Autorisations de sortie (cycle complet).
  auth_request_created:         { icon: <AutorisationIcon fontSize="small" />,  color: '#0056d2', bg: '#d5e3fc', route: '/dashboard/demande-autorisation' },
  auth_request_accepted:        { icon: <ValidIcon fontSize="small" />,         color: '#005236', bg: '#8df7c2', route: '/dashboard/demande-autorisation' },
  auth_request_refused:         { icon: <RefuseIcon fontSize="small" />,        color: '#ba1a1a', bg: '#ffdad6', route: '/dashboard/demande-autorisation' },
  // Heures supplémentaires : émis par AutorisersController.PostMyAuthorization
  // dès qu'un employé envoie une demande [HEURES SUP]. Le manager doit valider.
  overtime_request_pending:     { icon: <AutorisationIcon fontSize="small" />,  color: '#0056d2', bg: '#d5e3fc', route: '/dashboard/validation-heures-sup' },
  overtime_request_accepted:    { icon: <ValidIcon fontSize="small" />,         color: '#005236', bg: '#8df7c2', route: '/dashboard/demande-heures-sup' },
  overtime_request_refused:     { icon: <RefuseIcon fontSize="small" />,        color: '#ba1a1a', bg: '#ffdad6', route: '/dashboard/demande-heures-sup' },
  // Demandes d'absence (web côté employé) + télétravail.
  absence_request_created:      { icon: <LeaveIcon fontSize="small" />,         color: '#0056d2', bg: '#d5e3fc', route: '/dashboard/demande-absence' },
  absence_request_cancelled:    { icon: <CancelIcon fontSize="small" />,        color: '#64748b', bg: '#f1f5f9', route: '/dashboard/demande-absence' },
  teletravail_request_created:  { icon: <AutorisationIcon fontSize="small" />,  color: '#0056d2', bg: '#d5e3fc', route: '/dashboard/validation-teletravail' },
  teletravail_request_cancelled:{ icon: <CancelIcon fontSize="small" />,        color: '#64748b', bg: '#f1f5f9', route: '/dashboard/demande-teletravail' },
  // Coffre numérique : signature de document publié pour le collaborateur.
  vault_document_uploaded:      { icon: <ValidIcon fontSize="small" />,         color: '#0056d2', bg: '#d5e3fc', route: '/dashboard/coffre-fort' },
  // Workflow de signature électronique. `signature_pending` ouvre DIRECTEMENT la page de
  // signature (deep-link dynamique via dataJson dans handleClick) ; le `route` ci-dessous
  // sert de repli (anciennes notifs sans stepId). Les notifs de fin vont à la boîte de signature.
  signature_pending:            { icon: <SignIcon fontSize="small" />,          color: '#0040a1', bg: '#dae2ff', route: '/dashboard/signature-inbox' },
  signature_completed:          { icon: <ValidIcon fontSize="small" />,         color: '#005236', bg: '#8df7c2', route: '/dashboard/signature-inbox' },
  signature_rejected:           { icon: <CancelIcon fontSize="small" />,        color: '#ba1a1a', bg: '#ffdad6', route: '/dashboard/signature-inbox' },
  // IA : lettres générées (courriers IA) et chat RH — l'utilisateur retombe sur la page outil.
  letter_gen:                   { icon: <ValidIcon fontSize="small" />,         color: '#7c3aed', bg: '#f5f3ff', route: '/dashboard/courriers' },
  chat:                         { icon: <NotificationsIcon fontSize="small" />, color: '#7c3aed', bg: '#f5f3ff', route: '/dashboard/chat-bot' },
  test_push:                    { icon: <NotificationsIcon fontSize="small" />, color: '#64748b', bg: '#f1f5f9' },
};

const CATEGORY_LABEL: Record<string, string> = {
  reminder_in: 'Rappel entrée',
  reminder_out: 'Rappel sortie',
  leave_request_created: 'À valider',
  leave_request_accepted: 'Congé accepté',
  leave_request_refused: 'Congé refusé',
  auth_request_created: 'À valider',
  auth_request_accepted: 'Autorisation acceptée',
  auth_request_refused: 'Autorisation refusée',
  overtime_request_pending: 'H. supp à valider',
  overtime_request_accepted: 'H. supp validées',
  overtime_request_refused: 'H. supp refusées',
  absence_request_created: 'Absence à valider',
  absence_request_cancelled: 'Absence annulée',
  teletravail_request_created: 'Télétravail à valider',
  teletravail_request_cancelled: 'Télétravail annulé',
  vault_document_uploaded: 'Document à signer',
  signature_pending: 'Document à signer',
  signature_completed: 'Document signé',
  signature_rejected: 'Document rejeté',
  letter_gen: 'Lettre IA',
  chat: 'Assistant RH',
  test_push: 'Test',
};

/**
 * Catégories qui appellent une action explicite (le manager doit valider/refuser).
 * Sert à composer la bannière "Il vous reste X demandes à valider" en tête de popover :
 * la plateforme pousse l'info au lieu de laisser l'utilisateur compter lui-même.
 */
const ACTIONABLE_CATEGORIES: Array<{
  category: string;
  singular: string;
  plural: string;
  route: string;
}> = [
  {
    category: 'leave_request_created',
    singular: 'demande de congé à valider',
    plural: 'demandes de congé à valider',
    route: '/dashboard/gestion-de-conge',
  },
  {
    category: 'auth_request_created',
    singular: 'autorisation de sortie à valider',
    plural: 'autorisations de sortie à valider',
    route: '/dashboard/demande-autorisation',
  },
];

/* ══════════════════════════════════════════════════════ */
/*  Component                                             */
/* ══════════════════════════════════════════════════════ */
export default function NotificationCenter() {
  const { uticod } = useAuth();
  if (!uticod) return null;
  return <NotificationCenterInner />;
}

function NotificationCenterInner() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [notifs, setNotifs] = useState<ServerNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await apiInstance.get('/Notifications/unread-count');
      setUnread(data?.count ?? 0);
    } catch { /* noop */ }
  }, []);

  const loadNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiInstance.get('/Notifications', { params: { take: 50 } });
      setNotifs(Array.isArray(data) ? data : []);
    } catch (e) {
      setNotifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling léger du compteur toutes les 60s — couvre les notifs reçues pendant que l'app reste ouverte
  // sans exiger de refresh page. La popover elle-même charge la liste à l'ouverture.
  useEffect(() => {
    refreshUnread();
    const t = setInterval(refreshUnread, 60_000);
    return () => clearInterval(t);
  }, [refreshUnread]);

  const handleOpen = async (e: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(e.currentTarget);
    await loadNotifs();
  };

  const handleClose = () => setAnchorEl(null);

  const handleClick = async (n: ServerNotification) => {
    // 1. Marquer lu côté serveur (idempotent).
    if (!n.readAt) {
      try {
        await apiInstance.post(`/Notifications/${n.id}/read`);
        setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x));
        setUnread(c => Math.max(0, c - 1));
      } catch { /* noop */ }
    }
    // 2. Deep-link contextuel.
    // Cas signature : on ouvre DIRECTEMENT la page de signature avec requestId + stepId
    // extraits du payload (dataJson) — l'utilisateur signe sans passer par la boîte. Si le
    // payload est incomplet (ancienne notif sans stepId), on retombe sur la boîte de signature.
    if (n.category === 'signature_pending') {
      handleClose();
      try {
        const data = n.dataJson ? JSON.parse(n.dataJson) : {};
        const rid = data.requestId, sid = data.stepId, vid = data.documentVaultId;
        if (rid && sid) {
          const params = new URLSearchParams({ requestId: String(rid), stepId: String(sid) });
          if (vid != null) params.set('id', String(vid));
          navigate(`/dashboard/sign-document?${params.toString()}`);
          return;
        }
      } catch { /* payload illisible → repli sur la boîte de signature */ }
      navigate('/dashboard/signature-inbox');
      return;
    }

    const meta = (n.category && CATEGORIES[n.category]) || null;
    if (meta?.route) {
      handleClose();
      navigate(meta.route);
    }
  };

  const handleDelete = async (e: React.MouseEvent, n: ServerNotification) => {
    e.stopPropagation();
    try {
      await apiInstance.delete(`/Notifications/${n.id}`);
      setNotifs(prev => prev.filter(x => x.id !== n.id));
      if (!n.readAt) setUnread(c => Math.max(0, c - 1));
    } catch {
      setSnackbar({ open: true, message: 'Suppression impossible.', severity: 'error' });
    }
  };

  const markAllRead = async () => {
    try {
      await apiInstance.post('/Notifications/read-all');
      const now = new Date().toISOString();
      setNotifs(prev => prev.map(n => n.readAt ? n : { ...n, readAt: now }));
      setUnread(0);
      setSnackbar({ open: true, message: 'Toutes les notifications sont marquées comme lues.', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Action impossible.', severity: 'error' });
    }
  };

  const open = Boolean(anchorEl);

  const sorted = useMemo(
    () => [...notifs].sort((a, b) => dayjs(b.createdAt).diff(dayjs(a.createdAt))),
    [notifs]
  );

  // Agrège les notifications non-lues par catégorie actionnable. Le but est de
  // formuler la to-do plutôt que la liste brute : "Il vous reste 3 demandes à valider"
  // au lieu de 3 lignes "Vous avez une notification".
  const actionableSummary = useMemo(() => {
    return ACTIONABLE_CATEGORIES
      .map(meta => ({
        ...meta,
        count: notifs.filter(n => n.category === meta.category && !n.readAt).length,
      }))
      .filter(s => s.count > 0);
  }, [notifs]);

  const handleSummaryClick = (route: string) => {
    handleClose();
    navigate(route);
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          onClick={handleOpen}
          sx={{
            color: unread > 0 ? '#0040a1' : '#64748b',
            backgroundColor: unread > 0 ? 'rgba(0, 64, 161, 0.06)' : 'transparent',
            transition: 'all 0.2s',
            '&:hover': { backgroundColor: 'rgba(0, 64, 161, 0.1)' },
          }}
        >
          <Badge
            badgeContent={unread > 99 ? '99+' : unread}
            color="error"
            invisible={unread === 0}
            overlap="circular"
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 380,
            maxHeight: 540,
            mt: 1,
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} color="#0f172a">
              Notifications
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est à jour'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Rafraîchir">
              <IconButton size="small" onClick={loadNotifs} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Tout marquer comme lu">
              <span>
                <IconButton size="small" onClick={markAllRead} disabled={unread === 0}>
                  <DoneAllIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        {/* Bannière "À faire" : pousse les actions en attente plutôt que d'attendre que
            l'utilisateur les déduise de la liste. Cliquable, navigue à l'écran de validation. */}
        {actionableSummary.length > 0 && !loading && (
          <Box sx={{ px: 1.5, py: 1, bgcolor: '#fffbe6', borderBottom: '1px solid #fde68a' }}>
            <Typography variant="caption" sx={{ display: 'block', px: 0.5, mb: 0.5, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Il vous reste à faire
            </Typography>
            <Stack spacing={0.5}>
              {actionableSummary.map(s => {
                const meta = CATEGORIES[s.category] || FALLBACK;
                const label = `${s.count} ${s.count > 1 ? s.plural : s.singular}`;
                return (
                  <Box
                    key={s.category}
                    onClick={() => handleSummaryClick(s.route)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1,
                      py: 0.75,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      bgcolor: '#fff',
                      border: '1px solid #fde68a',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: meta.bg, borderColor: meta.color, transform: 'translateX(2px)' },
                    }}
                  >
                    <Avatar sx={{ width: 28, height: 28, bgcolor: meta.bg, color: meta.color }}>
                      {meta.icon}
                    </Avatar>
                    <Typography variant="body2" fontWeight={700} color="#0f172a" sx={{ flexGrow: 1 }}>
                      {label}
                    </Typography>
                    <ChevronRightIcon sx={{ fontSize: 18, color: meta.color }} />
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        ) : sorted.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1.5 }}>
            <NoNotifIcon sx={{ fontSize: 40, color: '#cbd5e1' }} />
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Aucune notification.
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
            {sorted.map(n => {
              const meta = (n.category && CATEGORIES[n.category]) || FALLBACK;
              const label = (n.category && CATEGORY_LABEL[n.category]) || 'Notification';
              const isUnread = !n.readAt;
              return (
                <React.Fragment key={n.id}>
                  <ListItemButton
                    onClick={() => handleClick(n)}
                    sx={{
                      px: 2,
                      py: 1.5,
                      backgroundColor: isUnread ? 'rgba(0, 64, 161, 0.04)' : 'transparent',
                      '&:hover': { backgroundColor: 'rgba(0, 64, 161, 0.07)' },
                      borderLeft: isUnread ? `3px solid ${meta.color}` : '3px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 44 }}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: meta.bg, color: meta.color }}>
                        {meta.icon}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                          <Typography variant="body2" fontWeight={isUnread ? 800 : 600} color="#0f172a" noWrap sx={{ maxWidth: 220 }}>
                            {n.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {dayjs(n.createdAt).fromNow(true)}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <>
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4, mt: 0.25 }}>
                            {n.body}
                          </Typography>
                          <Stack direction="row" alignItems="center" gap={0.5} mt={0.5}>
                            <Chip
                              size="small"
                              label={label}
                              sx={{
                                height: 18,
                                fontSize: 10,
                                fontWeight: 700,
                                bgcolor: meta.bg,
                                color: meta.color,
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                            <Tooltip title="Supprimer">
                              <IconButton
                                size="small"
                                onClick={(e) => handleDelete(e, n)}
                                sx={{ ml: 'auto', p: 0.25, color: '#cbd5e1', '&:hover': { color: '#ba1a1a' } }}
                              >
                                <DeleteIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </>
                      }
                    />
                  </ListItemButton>
                  <Divider />
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Popover>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
