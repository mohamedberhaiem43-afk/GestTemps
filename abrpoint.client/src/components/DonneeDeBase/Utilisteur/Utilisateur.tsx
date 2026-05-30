import { useState, useMemo, useRef } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from "@mui/material";
import { useFeedbackSnackbar } from "../../helper/FeedbackSnackbar";
import { useTranslation, Trans } from "react-i18next";
import SaisieUtilisateur, { SaisieUtilisateurHandle } from "./SaisieUtilisateur";
import { useQuery } from '@tanstack/react-query';
import UserProvider, { useUserContext } from "../../helper/UserProvider";
import UtilisateurService from "../../../services/UtilisateurService/UtilisateurService";
import RolesService from "../../../services/RolesService/RolesService";
import { resolveAssetUrl } from "../../../helpers/assetUrl";
import { Role } from "../../../models/Role";
import { ROLE_LABELS } from "../../../models/Utilisateur";
import {
  Shield,
  Group,
  Bolt,
  Mail,
  Security,
  Search,
  ExpandMore,
  FileUpload,
  Edit,
  LockReset,
  Delete,
  Add,
  Close,
} from "@mui/icons-material";
import "./Utilisateur.css";
import useDeleteUser from "../../../hooks/userHooks/useDeleteUser";
import useResetPassword from "../../../hooks/userHooks/useResetPassword";
import useToggleUserStatus from "../../../hooks/userHooks/useToggleUserStatus";
// ── Inner component ──────────────────────────────────────────────
function UtilisateurContent() {
  const { t } = useTranslation();
  const { selectedUser, setSelectedUser } = useUserContext();
  const saisieRef = useRef<SaisieUtilisateurHandle>(null);

  const feedback = useFeedbackSnackbar();

  // Filters
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [userToProcess, setUserToProcess] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");

  // Hooks
  const { mutate: deleteUser } = useDeleteUser();
  const { mutate: resetPassword } = useResetPassword();
  const { mutate: toggleStatus } = useToggleUserStatus();

  // Fetch all users
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: () => UtilisateurService.getAllWithoutParams(),
  });

  // Rôles créés (page « Droit d'accès ») — alimentent la liste roulante de filtre,
  // au lieu d'une liste figée qui ne correspondait pas aux rôles réels (utirole).
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: RolesService.getAll,
  });

  // Computed stats
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u: any) => u.utiactif === 'Oui' || u.utiactif === '1').length;
    const admins = users.filter((u: any) => u.utiadm === '1' || u.utiadm === 'Oui').length;
    const with2FA = users.filter((u: any) => u.uti2fa_enabled === '1').length;
    return { total, active, admins, with2FA, inactive: total - active };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u: any) => {
      if (roleFilter !== 'all') {
        const role = u.utirole || (u.utiadm === '1' || u.utiadm === 'Oui' ? 'Administrator' : 'Employee');
        if (role !== roleFilter) return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && u.utiactif !== 'Oui' && u.utiactif !== '1') return false;
        if (statusFilter === 'inactive' && (u.utiactif === 'Oui' || u.utiactif === '1')) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = `${u.utiprn || ''} ${u.utinom || ''}`.toLowerCase();
        const email = (u.utimail || '').toLowerCase();
        const code = (u.uticod || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !code.includes(q)) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  const getRoleBadge = (user: any) => {
    const role = user.utirole || (user.utiadm === '1' || user.utiadm === 'Oui' ? 'admin' : 'standard');
    const label = ROLE_LABELS[role] || role;
    const colors: Record<string, string> = {
      // Noms RBAC modernes
      Administrator: 'um-role-admin',
      Manager: 'um-role-manager',
      Employee: 'um-role-standard',
      // Alias legacy
      admin: 'um-role-admin',
      rh: 'um-role-rh',
      superviseur: 'um-role-superviseur',
      manager: 'um-role-manager',
      standard: 'um-role-standard',
    };
    return { label, className: colors[role] || 'um-role-standard' };
  };

  const getStatusDisplay = (user: any) => {
    const isActive = user.utiactif === 'Oui' || user.utiactif === '1';
    if (isActive) return { label: t('utilisateur.status.active'), className: 'um-status-active' };
    return { label: t('utilisateur.status.inactive'), className: 'um-status-inactive' };
  };

  const getInitials = (user: any) => {
    const n = user.utinom?.trim() || '';
    const p = user.utiprn?.trim() || '';
    if (n && p) return (p[0] + n[0]).toUpperCase();
    if (n) return n.substring(0, 2).toUpperCase();
    return '??';
  };

  const handleDeleteClick = (user: any) => {
    setUserToProcess(user);
    setDeleteDialogOpen(true);
  };

  const handleResetClick = (user: any) => {
    setUserToProcess(user);
    setNewPassword("");
    setResetDialogOpen(true);
  };

  const handleToggleStatus = (user: any) => {
    toggleStatus(user.uticod, {
      onSuccess: () => {
        feedback.showSuccess(t('utilisateur.msg.statusUpdated'));
        refetch();
      },
      onError: (err: any) => feedback.showError(err, t('utilisateur.msg.statusUpdateError'))
    });
  };

  const confirmDelete = () => {
    if (!userToProcess) return;
    deleteUser(userToProcess.uticod, {
      onSuccess: () => {
        feedback.showSuccess(t('utilisateur.msg.userDeleted'));
        setDeleteDialogOpen(false);
        refetch();
      },
      onError: (err: any) => feedback.showError(err, t('utilisateur.msg.deleteError'))
    });
  };

  const confirmReset = () => {
    if (!userToProcess || !newPassword) return;
    resetPassword({ uticod: userToProcess.uticod, newPassword }, {
      onSuccess: () => {
        feedback.showSuccess(t('utilisateur.msg.passwordReset'));
        setResetDialogOpen(false);
      },
      onError: (err: any) => feedback.showError(err, t('utilisateur.msg.resetError'))
    });
  };

  return (
    <div className="um-page">
      {/* Page Header */}
      <div className="um-page-header">
        <div className="um-header-left">
          <h1 className="um-page-title">{t('utilisateur.page.title')}</h1>
          <div className="um-header-search">
            <Search sx={{ fontSize: 18 }} />
            <input
              type="text"
              placeholder={t('utilisateur.page.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="um-header-right">
          <a href="/dashboard/droit-accees" className="um-btn-permissions" style={{ textDecoration: 'none' }}>
            <Shield sx={{ fontSize: 16 }} />
            {t('utilisateur.page.permissions')}
          </a>
          <button className="um-btn-add" onClick={() => setShowAddModal(true)}>
            <Add sx={{ fontSize: 18 }} />
            {t('utilisateur.page.newUser')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="um-kpi-row">
        <div className="um-kpi-card">
          <div className="um-kpi-header">
            <div className="um-kpi-icon um-kpi-icon-blue">
              <Group sx={{ fontSize: 22 }} />
            </div>
            <span className="um-kpi-badge um-kpi-badge-green">+{Math.max(1, Math.round(stats.total * 0.04))}%</span>
          </div>
          <p className="um-kpi-label">{t('utilisateur.kpi.totalUsers')}</p>
          <p className="um-kpi-value">{stats.total}</p>
        </div>
        <div className="um-kpi-card">
          <div className="um-kpi-header">
            <div className="um-kpi-icon um-kpi-icon-green">
              <Bolt sx={{ fontSize: 22 }} />
            </div>
            <span className="um-kpi-live">{t('utilisateur.kpi.activeBadge')}</span>
          </div>
          <p className="um-kpi-label">{t('utilisateur.kpi.active')}</p>
          <p className="um-kpi-value">{stats.active}</p>
        </div>
        <div className="um-kpi-card">
          <div className="um-kpi-header">
            <div className="um-kpi-icon um-kpi-icon-purple">
              <Mail sx={{ fontSize: 22 }} />
            </div>
            <span className="um-kpi-badge um-kpi-badge-gray">{stats.admins}</span>
          </div>
          <p className="um-kpi-label">{t('utilisateur.kpi.administrators')}</p>
          <p className="um-kpi-value">{stats.admins}</p>
        </div>
        <div className="um-kpi-card">
          <div className="um-kpi-header">
            <div className="um-kpi-icon um-kpi-icon-red">
              <Security sx={{ fontSize: 22 }} />
            </div>
            <span className="um-kpi-badge um-kpi-badge-red">{stats.total - stats.with2FA}</span>
          </div>
          <p className="um-kpi-label">{t('utilisateur.kpi.without2fa')}</p>
          <p className="um-kpi-value">{stats.total - stats.with2FA}</p>
        </div>
      </div>

      {/* Table Section */}
      <div className="um-table-section">
        {/* Filters */}
        <div className="um-table-controls">
          <div className="um-filters">
            <div className="um-filter-select-wrap">
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">{t('utilisateur.filters.allRoles')}</option>
                {roles.map((r) => (
                  <option key={r.roleId ?? r.roleName} value={r.roleName}>
                    {ROLE_LABELS[r.roleName] ?? r.roleName}
                  </option>
                ))}
              </select>
              <ExpandMore sx={{ fontSize: 18 }} />
            </div>
            <div className="um-filter-select-wrap">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">{t('utilisateur.filters.allStatuses')}</option>
                <option value="active">{t('utilisateur.filters.active')}</option>
                <option value="inactive">{t('utilisateur.filters.inactive')}</option>
              </select>
              <ExpandMore sx={{ fontSize: 18 }} />
            </div>
          </div>
          <button className="um-btn-export">
            <FileUpload sx={{ fontSize: 18 }} />
            {t('utilisateur.page.exportCsv')}
          </button>
        </div>

        {/* Table */}
        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th>{t('utilisateur.table.user')}</th>
                <th>{t('utilisateur.table.role')}</th>
                <th>{t('utilisateur.table.status')}</th>
                <th>{t('utilisateur.table.email')}</th>
                <th style={{ textAlign: 'right' }}>{t('utilisateur.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5}>
                    <div className="um-loading">
                      <div className="um-spinner" />
                      {t('utilisateur.page.loading')}
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="um-empty">
                      <Group sx={{ fontSize: 48, opacity: 0.3 }} />
                      <p>{t('utilisateur.page.noUsers')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user: any) => {
                  const role = getRoleBadge(user);
                  const status = getStatusDisplay(user);
                  const initials = getInitials(user);
                  const fullName = `${user.utiprn || ''} ${user.utinom || ''}`.trim() || user.uticod;
                  const isActive = user.utiactif === 'Oui' || user.utiactif === '1';
                  const avatarUrl = user.utiimg ? resolveAssetUrl(user.utiimg) : '';

                  return (
                    <tr key={user.uticod} className="um-row" onClick={() => setSelectedUser(user.uticod)}>
                      <td>
                        <div className="um-user-cell">
                          <div className={`um-avatar ${isActive ? 'um-avatar-active' : 'um-avatar-inactive'}`}>
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={fullName}
                                className="um-avatar-img"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              initials
                            )}
                          </div>
                          <div>
                            <p className="um-user-name">{fullName}</p>
                            <p className="um-user-code">{user.uticod}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`um-role-badge ${role.className}`}>
                          {role.label}
                        </span>
                      </td>
                      <td>
                        <div className={`um-status ${status.className}`}>
                          <span className="um-status-dot" />
                          {status.label}
                        </div>
                      </td>
                      <td className="um-email-cell">{user.utimail || '—'}</td>
                      <td>
                        <div className="um-actions">
                          <button className="um-action-btn" title={t('utilisateur.actions.edit')} onClick={(e) => { e.stopPropagation(); setSelectedUser(user.uticod); setShowAddModal(true); }}>
                            <Edit sx={{ fontSize: 18 }} />
                          </button>
                          <button className="um-action-btn" title={t('utilisateur.actions.resetPassword')} onClick={(e) => { e.stopPropagation(); handleResetClick(user); }}>
                            <LockReset sx={{ fontSize: 18 }} />
                          </button>
                          <button className="um-action-btn" title={isActive ? t('utilisateur.actions.deactivate') : t('utilisateur.actions.activate')} onClick={(e) => { e.stopPropagation(); handleToggleStatus(user); }}>
                            <Bolt sx={{ fontSize: 18, color: isActive ? '#16a34a' : '#94a3b8' }} />
                          </button>
                          <button className="um-action-btn um-action-btn-danger" title={t('utilisateur.actions.delete')} onClick={(e) => { e.stopPropagation(); handleDeleteClick(user); }}>
                            <Delete sx={{ fontSize: 18 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="um-pagination">
          <p className="um-pagination-info">
            {t('utilisateur.page.paginationInfo', { filtered: filteredUsers.length, total: users.length })}
          </p>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showAddModal && (
        <div className="um-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="um-modal" onClick={(e) => e.stopPropagation()}>
            <div className="um-modal-header">
              <h3>
                {selectedUser ? (
                  <><Edit sx={{ fontSize: 20, verticalAlign: 'middle', mr: 1 }} /> {t('utilisateur.modal.editTitle')}</>
                ) : (
                  <><Add sx={{ fontSize: 20, verticalAlign: 'middle', mr: 1 }} /> {t('utilisateur.modal.newTitle')}</>
                )}
              </h3>
              <button className="um-modal-close" onClick={() => { setShowAddModal(false); setSelectedUser(null); }}>
                <Close sx={{ fontSize: 20 }} />
              </button>
            </div>
            <div className="um-modal-body">
              <SaisieUtilisateur
                ref={saisieRef}
                onDataChange={() => {}}
                profil={false}
              />
            </div>
            <div className="um-modal-footer">
              <button className="um-btn-cancel" onClick={() => { setShowAddModal(false); setSelectedUser(null); }}>
                {t('utilisateur.modal.cancel')}
              </button>
              <button
                className="um-btn-save"
                onClick={async () => {
                  const success = await saisieRef.current?.handleSave();
                  if (success) {
                    feedback.showSuccess(selectedUser ? t('utilisateur.msg.userUpdated') : t('utilisateur.msg.userCreated'));
                    refetch();
                    setShowAddModal(false);
                    setSelectedUser(null);
                  }
                }}
              >
                {t('utilisateur.modal.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback.element}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: '12px' } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#dc2626' }}>{t('utilisateur.delete.title')}</DialogTitle>
        <DialogContent>
          <p>
            <Trans
              i18nKey="utilisateur.delete.message"
              values={{ name: `${userToProcess?.utiprn ?? ''} ${userToProcess?.utinom ?? ''}`.trim() }}
              components={{ 0: <strong /> }}
            />
          </p>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>{t('utilisateur.delete.warning')}</p>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">{t('utilisateur.delete.cancel')}</Button>
          <Button onClick={confirmDelete} variant="contained" color="error">{t('utilisateur.delete.confirm')}</Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} PaperProps={{ sx: { borderRadius: '12px', width: '350px' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{t('utilisateur.reset.title')}</DialogTitle>
        <DialogContent>
          <p style={{ fontSize: '14px', marginBottom: '16px' }}>
            <Trans
              i18nKey="utilisateur.reset.prompt"
              values={{ name: userToProcess?.utiprn ?? '' }}
              components={{ 0: <strong /> }}
            />
          </p>
          <TextField
            fullWidth
            type="password"
            size="small"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('utilisateur.reset.placeholder')}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setResetDialogOpen(false)} color="inherit">{t('utilisateur.reset.cancel')}</Button>
          <Button onClick={confirmReset} variant="contained" disabled={!newPassword}>{t('utilisateur.reset.confirm')}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

// ── Outer component ──────────────────────────────────────────────
export default function Utilisateur() {
  return (
    <UserProvider>
        <UtilisateurContent />
      </UserProvider>
  );
}