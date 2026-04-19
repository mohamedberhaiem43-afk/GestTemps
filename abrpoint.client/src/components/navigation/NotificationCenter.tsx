import React, { useState, useEffect, useMemo } from 'react';
import {
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Divider,
  Button,
  useTheme,
  Tooltip,
  Fade,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  ShoppingBag as ExpenseIcon,
  Umbrella as LeaveIcon,
  Circle as DotIcon,
  Block as RefuseIcon,
  AccessTime as AutorisationIcon,
  DoneAll as DoneAllIcon,
  NotificationsNone as NoNotifIcon,
} from '@mui/icons-material';
import { useAuth } from '../helper/AuthProvider';
import useGetDemConges from '../../hooks/congeHooks/useGetDemConges';
import useGetNotesDeFrais from '../../hooks/useGetNotesDeFrais';
import useGetAllNotesDeFrais from '../../hooks/expenseHooks/useGetAllNotesDeFrais';
import useGetDemandeAutorisations from '../../hooks/demandeAutorisationHooks/useGetDemandeAutorisations';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/fr';

dayjs.extend(relativeTime);
dayjs.locale('fr');

/* ══════════════════════════════════════════════════════ */
/*  Types & Interfaces                                    */
/* ══════════════════════════════════════════════════════ */
type NotifType = 'leave' | 'leave_rejected' | 'expense' | 'expense_rejected' | 'autorisation' | 'autorisation_rejected';

interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  subtitle: string;
  date: string;
  isRead: boolean;
  status: string;
}

/* ══════════════════════════════════════════════════════ */
/*  Helpers                                              */
/* ══════════════════════════════════════════════════════ */
const normalizeStatus = (s?: string) => (s ?? '').trim().toLowerCase();

const getCongeStatus = (c: any): 'Accepté' | 'Refusé' | 'En attente' => {
  const n = normalizeStatus(c.etat);
  if (n.includes('refus') || c.conrefus === '1') return 'Refusé';
  if (n.includes('accept') || n.includes('approuv') || n.includes('accord')) return 'Accepté';
  return 'En attente';
};

const getExpenseStatus = (e: any): 'Validé' | 'Rejected' | 'En attente' => {
  const n = normalizeStatus(e.etat);
  if (n.includes('valid') || n.includes('reimburs') || n.includes('approved')) return 'Validé';
  if (n.includes('reject') || n.includes('refus')) return 'Rejected';
  return 'En attente';
};

const getAutorisationStatus = (d: any): 'Approuvé' | 'Refusé' | 'En attente' => {
  const n = normalizeStatus(d.statut);
  if (n.includes('approuv') || n.includes('accept')) return 'Approuvé';
  if (n.includes('refus')) return 'Refusé';
  return 'En attente';
};

/* ══════════════════════════════════════════════════════ */
/*  NotificationCenter Component                          */
/* ══════════════════════════════════════════════════════ */
export default function NotificationCenter() {
  const { utiadm, isEmp } = useAuth();
  if (!utiadm && !isEmp) return null;
  return <NotificationCenterInner />;
}
function NotificationCenterInner() {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const { isEmp, utiadm } = useAuth();
  const isAdmin = utiadm === '1';
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  if (!utiadm && !isEmp) return null;  // ← ajoute cette ligne

  /* ── Data hooks ── */
  const { data: leaveRequests } = useGetDemConges();
  const { data: myExpenses } = useGetNotesDeFrais();
  const { data: allExpenses } = useGetAllNotesDeFrais();
  const { data: demandeAutorisations } = useGetDemandeAutorisations();

  /* ── Load read status ── */
  useEffect(() => {
    const saved = localStorage.getItem('seen_notifications');
    if (saved) {
      try { setReadIds(new Set(JSON.parse(saved))); } catch { /* ignore */ }
    }
  }, []);

  /* ── Mark all as read ── */
  const markAllAsRead = () => {
    const newReadIds = new Set(readIds);
    notifications.forEach(n => newReadIds.add(n.id));
    setReadIds(newReadIds);
    localStorage.setItem('seen_notifications', JSON.stringify(Array.from(newReadIds)));
  };

  /* ── Build notification list ── */
  const notifications = useMemo(() => {
    const list: AppNotification[] = [];

    /* ───── CONGÉS ───── */
    if (leaveRequests) {
      leaveRequests.forEach((req: any) => {
        const status = getCongeStatus(req);
        const dateRange = `du ${dayjs(req.condep).format('DD/MM')} au ${dayjs(req.conret).format('DD/MM')}`;
        const empName = req.emplib || req.empcod;
        const date = req.createdAt || req.condat || dayjs().format();

        if (status === 'Accepté') {
          list.push({
            id: `leave-accepted-${req.concod}`,
            type: 'leave',
            title: isEmp ? 'Congé Approuvé' : `Congé Approuvé — ${empName}`,
            subtitle: isEmp ? `Votre demande ${dateRange} a été validée.` : `La demande ${dateRange} a été approuvée.`,
            date,
            isRead: readIds.has(`leave-accepted-${req.concod}`),
            status: 'Accepté'
          });
        } else if (status === 'Refusé') {
          list.push({
            id: `leave-rejected-${req.concod}`,
            type: 'leave_rejected',
            title: isEmp ? 'Congé Refusé' : `Congé Refusé — ${empName}`,
            subtitle: isEmp ? `Votre demande ${dateRange} a été refusée.` : `La demande de ${empName} ${dateRange} a été refusée.`,
            date,
            isRead: readIds.has(`leave-rejected-${req.concod}`),
            status: 'Refusé'
          });
        } else if (isAdmin && status === 'En attente') {
          list.push({
            id: `leave-pending-${req.concod}`,
            type: 'leave',
            title: `Nouvelle Demande de Congé`,
            subtitle: `${empName} a déposé une demande ${dateRange}.`,
            date,
            isRead: readIds.has(`leave-pending-${req.concod}`),
            status: 'En attente'
          });
        }
      });
    }

    /* ───── NOTES DE FRAIS ───── */
    const expenses = isAdmin ? (allExpenses ?? []) : (myExpenses ?? []);
    expenses.forEach((req: any) => {
      const status = getExpenseStatus(req);
      const date = req.createdAt || dayjs().format();
      const empName = req.emplib || req.empcod;

      if (status === 'Validé') {
        list.push({
          id: `expense-validated-${req.id}`,
          type: 'expense',
          title: isEmp ? 'Note de Frais Validée' : `Note de Frais Validée — ${empName}`,
          subtitle: isEmp ? `Votre note "${req.titre}" (${req.montant} DT) est approuvée.` : `La note "${req.titre}" de ${empName} a été validée.`,
          date,
          isRead: readIds.has(`expense-validated-${req.id}`),
          status: 'Validé'
        });
      } else if (status === 'Rejected') {
        list.push({
          id: `expense-rejected-${req.id}`,
          type: 'expense_rejected',
          title: isEmp ? 'Note de Frais Refusée' : `Note de Frais Refusée — ${empName}`,
          subtitle: isEmp ? `Votre note "${req.titre}" a été refusée.` : `La note "${req.titre}" de ${empName} a été refusée.`,
          date,
          isRead: readIds.has(`expense-rejected-${req.id}`),
          status: 'Rejected'
        });
      } else if (isAdmin && status === 'En attente') {
        list.push({
          id: `expense-pending-${req.id}`,
          type: 'expense',
          title: `Nouvelle Note de Frais`,
          subtitle: `${empName} a soumis "${req.titre}" (${req.montant} DT).`,
          date,
          isRead: readIds.has(`expense-pending-${req.id}`),
          status: 'En attente'
        });
      }
    });

    /* ───── AUTORISATIONS ───── */
    if (demandeAutorisations) {
      demandeAutorisations.forEach((req: any) => {
        const status = getAutorisationStatus(req);
        const empName = req.emplib || req.empcod;
        const date = req.dateDemande || req.condat || dayjs().format();
        const timeRange = req.condep && req.conret
          ? `${dayjs(req.condep).format('DD/MM HH:mm')} → ${dayjs(req.conret).format('HH:mm')}`
          : '';

        if (status === 'Approuvé') {
          list.push({
            id: `aut-approved-${req.id}`,
            type: 'autorisation',
            title: isEmp ? 'Autorisation Approuvée' : `Autorisation Approuvée — ${empName}`,
            subtitle: isEmp ? `Votre demande ${timeRange} a été approuvée.` : `La demande de ${empName} ${timeRange} a été approuvée.`,
            date,
            isRead: readIds.has(`aut-approved-${req.id}`),
            status: 'Approuvé'
          });
        } else if (status === 'Refusé') {
          list.push({
            id: `aut-rejected-${req.id}`,
            type: 'autorisation_rejected',
            title: isEmp ? 'Autorisation Refusée' : `Autorisation Refusée — ${empName}`,
            subtitle: isEmp ? `Votre demande ${timeRange} a été refusée.` : `La demande de ${empName} ${timeRange} a été refusée.`,
            date,
            isRead: readIds.has(`aut-rejected-${req.id}`),
            status: 'Refusé'
          });
        } else if (isAdmin && status === 'En attente') {
          list.push({
            id: `aut-pending-${req.id}`,
            type: 'autorisation',
            title: `Nouvelle Autorisation`,
            subtitle: `${empName} demande une sortie ${timeRange}.`,
            date,
            isRead: readIds.has(`aut-pending-${req.id}`),
            status: 'En attente'
          });
        }
      });
    }

    return list.sort((a, b) => dayjs(b.date).diff(dayjs(a.date)));
  }, [leaveRequests, myExpenses, allExpenses, demandeAutorisations, readIds, isEmp, isAdmin]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const getTypeConfig = (type: NotifType) => {
    switch (type) {
      case 'leave': return { icon: <LeaveIcon sx={{ fontSize: 18 }} />, bg: '#eff6ff', color: '#0040a1' };
      case 'leave_rejected': return { icon: <RefuseIcon sx={{ fontSize: 18 }} />, bg: '#fef2f2', color: '#dc2626' };
      case 'expense': return { icon: <ExpenseIcon sx={{ fontSize: 18 }} />, bg: '#f0fdf4', color: '#16a34a' };
      case 'expense_rejected': return { icon: <RefuseIcon sx={{ fontSize: 18 }} />, bg: '#fef2f2', color: '#dc2626' };
      case 'autorisation': return { icon: <AutorisationIcon sx={{ fontSize: 18 }} />, bg: '#fff7ed', color: '#ea580c' };
      case 'autorisation_rejected': return { icon: <RefuseIcon sx={{ fontSize: 18 }} />, bg: '#fef2f2', color: '#dc2626' };
      default: return { icon: <NotificationsIcon sx={{ fontSize: 18 }} />, bg: '#f1f5f9', color: '#64748b' };
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        onClick={handleClick}
        sx={{
          color: isDark ? '#94a3b8' : '#64748b',
          '&:hover': { color: '#0040a1', bgcolor: 'rgba(0, 64, 161, 0.05)' },
          borderRadius: '12px',
          p: 1.2,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          sx={{
            '& .MuiBadge-badge': {
              fontSize: 10,
              height: 18,
              minWidth: 18,
              fontWeight: 800,
              border: `2px solid ${isDark ? '#1e293b' : '#fff'}`,
              animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.4)' },
                '70%': { transform: 'scale(1.1)', boxShadow: '0 0 0 10px rgba(239, 68, 68, 0)' },
                '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
              }
            }
          }}
        >
          <NotificationsIcon sx={{ fontSize: 24 }} />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionComponent={Fade}
        PaperProps={{
          sx: {
            width: 380,
            maxHeight: 520,
            borderRadius: '20px',
            mt: 2,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}`,
            overflow: 'hidden',
          }
        }}
      >
        {/* Header */}
        <Box sx={{ p: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: isDark ? '#1e293b' : '#ffffff' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.1rem', color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'Manrope' }}>
              Notifications
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
              Vous avez {unreadCount} message{unreadCount > 1 ? 's' : ''} non lu{unreadCount > 1 ? 's' : ''}
            </Typography>
          </Box>
          {unreadCount > 0 && (
            <Tooltip title="Tout marquer comme lu">
              <IconButton onClick={markAllAsRead} size="small" sx={{ color: '#0040a1', bgcolor: 'rgba(0, 64, 161, 0.05)', '&:hover': { bgcolor: 'rgba(0, 64, 161, 0.1)' } }}>
                <DoneAllIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Divider sx={{ opacity: 0.6 }} />

        {/* List */}
        <List sx={{ p: 0, maxHeight: 380, overflowY: 'auto' }}>
          {notifications.length > 0 ? (
            notifications.map((n) => {
              const cfg = getTypeConfig(n.type);
              return (
                <React.Fragment key={n.id}>
                  <ListItem
                    sx={{
                      py: 2,
                      px: 3,
                      bgcolor: n.isRead ? 'transparent' : isDark ? 'rgba(0, 64, 161, 0.08)' : 'rgba(0, 64, 161, 0.03)',
                      transition: 'background-color 0.2s',
                      '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8f9fa' },
                      borderLeft: n.isRead ? '4px solid transparent' : '4px solid #0040a1',
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 48 }}>
                      <Box sx={{
                        width: 40, height: 40, borderRadius: '12px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', bgcolor: cfg.bg, color: cfg.color,
                        boxShadow: `0 4px 6px -1px ${cfg.bg}80`
                      }}>
                        {cfg.icon}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: isDark ? '#f1f5f9' : '#1e293b', fontSize: '13px' }}>
                            {n.title}
                          </Typography>
                          {!n.isRead && <DotIcon sx={{ fontSize: 10, color: '#0040a1' }} />}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" sx={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#475569', mb: 1, lineHeight: 1.5 }}>
                            {n.subtitle}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, fontSize: '10px' }}>
                              {dayjs(n.date).fromNow()}
                            </Typography>
                            <Box sx={{
                              px: 1, py: 0.2, borderRadius: '6px',
                              bgcolor: n.status === 'En attente' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: n.status === 'En attente' ? '#ca8a04' : '#059669',
                              fontSize: '10px', fontWeight: 800, textTransform: 'uppercase'
                            }}>
                              {n.status}
                            </Box>
                          </Box>
                        </>
                      }
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              );
            })
          ) : (
            <Box sx={{ p: 8, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: '50%', bgcolor: '#f1f5f9' }}>
                <NoNotifIcon sx={{ fontSize: 48, color: '#cbd5e1' }} />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b' }}>
                  Tout est à jour !
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  Vous n'avez aucune nouvelle notification.
                </Typography>
              </Box>
            </Box>
          )}
        </List>

        <Box sx={{ p: 2, bgcolor: isDark ? '#1e293b' : '#f8fafc', textAlign: 'center' }}>
          <Button fullWidth size="small" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', py: 1, color: '#0040a1', '&:hover': { bgcolor: 'rgba(0, 64, 161, 0.05)' } }}>
            Voir tout l'historique
          </Button>
        </Box>
      </Popover>
    </>
  );
}