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

const CATEGORIES: Record<string, CategoryMeta> = {
  reminder_in:           { icon: <LoginIcon fontSize="small" />,         color: '#0040a1', bg: '#dae2ff', route: '/dashboard' },
  reminder_out:          { icon: <LogoutIcon fontSize="small" />,        color: '#b45309', bg: '#fff1c2', route: '/dashboard' },
  leave_request_created: { icon: <LeaveIcon fontSize="small" />,         color: '#0056d2', bg: '#d5e3fc', route: '/dashboard/gestion-de-conge' },
  leave_request_accepted:{ icon: <ValidIcon fontSize="small" />,         color: '#005236', bg: '#8df7c2', route: '/dashboard/gestion-de-conge' },
  leave_request_refused: { icon: <CancelIcon fontSize="small" />,        color: '#ba1a1a', bg: '#ffdad6', route: '/dashboard/gestion-de-conge' },
  auth_request_created:  { icon: <AutorisationIcon fontSize="small" />,  color: '#0056d2', bg: '#d5e3fc', route: '/dashboard/demande-autorisation' },
  auth_request_accepted: { icon: <ValidIcon fontSize="small" />,         color: '#005236', bg: '#8df7c2', route: '/dashboard/demande-autorisation' },
  auth_request_refused:  { icon: <RefuseIcon fontSize="small" />,        color: '#ba1a1a', bg: '#ffdad6', route: '/dashboard/demande-autorisation' },
  test_push:             { icon: <NotificationsIcon fontSize="small" />, color: '#64748b', bg: '#f1f5f9' },
};

const CATEGORY_LABEL: Record<string, string> = {
  reminder_in: 'Rappel entrée',
  reminder_out: 'Rappel sortie',
  leave_request_created: 'Demande de congé',
  leave_request_accepted: 'Congé accepté',
  leave_request_refused: 'Congé refusé',
  auth_request_created: 'Autorisation',
  auth_request_accepted: 'Autorisation acceptée',
  auth_request_refused: 'Autorisation refusée',
  test_push: 'Test',
};

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
