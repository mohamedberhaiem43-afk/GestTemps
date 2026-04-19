import { useState, useMemo, useRef } from "react";
import { Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from "@mui/material";
import SaisieUtilisateur, { SaisieUtilisateurHandle } from "./SaisieUtilisateur";
import { QueryClientProvider, QueryClient, useQuery } from "react-query";
import UserProvider, { useUserContext } from "../../helper/UserProvider";
import UtilisateurService from "../../../services/UtilisateurService/UtilisateurService";
import { ROLE_LABELS } from "../../../models/Utilisateur";
import {
  Shield,
  Group,
  Bolt,
  Mail,
  Security,
  Search,
  ExpandMore,
  FileDownload,
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

const queryClient = new QueryClient();

// ── Inner component ──────────────────────────────────────────────
function UtilisateurContent() {
  const { selectedUser, setSelectedUser } = useUserContext();
  const saisieRef = useRef<SaisieUtilisateurHandle>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({ open: false, message: "", severity: "success" });

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
        const role = u.utirole || (u.utiadm === '1' || u.utiadm === 'Oui' ? 'admin' : 'standard');
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
    if (isActive) return { label: 'Actif', className: 'um-status-active' };
    return { label: 'Inactif', className: 'um-status-inactive' };
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
        setSnackbar({ open: true, message: "Statut mis à jour", severity: "success" });
        refetch();
      },
      onError: () => setSnackbar({ open: true, message: "Erreur lors de la mise à jour", severity: "error" })
    });
  };

  const confirmDelete = () => {
    if (!userToProcess) return;
    deleteUser(userToProcess.uticod, {
      onSuccess: () => {
        setSnackbar({ open: true, message: "Utilisateur supprimé", severity: "success" });
        setDeleteDialogOpen(false);
        refetch();
      },
      onError: () => setSnackbar({ open: true, message: "Erreur lors de la suppression", severity: "error" })
    });
  };

  const confirmReset = () => {
    if (!userToProcess || !newPassword) return;
    resetPassword({ uticod: userToProcess.uticod, newPassword }, {
      onSuccess: () => {
        setSnackbar({ open: true, message: "Mot de passe réinitialisé", severity: "success" });
        setResetDialogOpen(false);
      },
      onError: () => setSnackbar({ open: true, message: "Erreur lors de la réinitialisation", severity: "error" })
    });
  };

  return (
    <div className="um-page">
      {/* Page Header */}
      <div className="um-page-header">
        <div className="um-header-left">
          <h1 className="um-page-title">Gestion des Utilisateurs</h1>
          <div className="um-header-search">
            <Search sx={{ fontSize: 18 }} />
            <input
              type="text"
              placeholder="Rechercher dans le répertoire..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="um-header-right">
          <a href="/dashboard/droit-accees" className="um-btn-permissions" style={{ textDecoration: 'none' }}>
            <Shield sx={{ fontSize: 16 }} />
            Autorisations
          </a>
          <button className="um-btn-add" onClick={() => setShowAddModal(true)}>
            <Add sx={{ fontSize: 18 }} />
            Nouvel Utilisateur
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
          <p className="um-kpi-label">Total Utilisateurs</p>
          <p className="um-kpi-value">{stats.total}</p>
        </div>
        <div className="um-kpi-card">
          <div className="um-kpi-header">
            <div className="um-kpi-icon um-kpi-icon-green">
              <Bolt sx={{ fontSize: 22 }} />
            </div>
            <span className="um-kpi-live">Actif</span>
          </div>
          <p className="um-kpi-label">Actifs</p>
          <p className="um-kpi-value">{stats.active}</p>
        </div>
        <div className="um-kpi-card">
          <div className="um-kpi-header">
            <div className="um-kpi-icon um-kpi-icon-purple">
              <Mail sx={{ fontSize: 22 }} />
            </div>
            <span className="um-kpi-badge um-kpi-badge-gray">{stats.admins}</span>
          </div>
          <p className="um-kpi-label">Administrateurs</p>
          <p className="um-kpi-value">{stats.admins}</p>
        </div>
        <div className="um-kpi-card">
          <div className="um-kpi-header">
            <div className="um-kpi-icon um-kpi-icon-red">
              <Security sx={{ fontSize: 22 }} />
            </div>
            <span className="um-kpi-badge um-kpi-badge-red">{stats.total - stats.with2FA}</span>
          </div>
          <p className="um-kpi-label">Sans 2FA</p>
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
                <option value="all">Tous les Rôles</option>
                <option value="admin">Administrateur</option>
                <option value="rh">Responsable RH</option>
                <option value="superviseur">Superviseur</option>
                <option value="manager">Manager</option>
                <option value="standard">Standard</option>
              </select>
              <ExpandMore sx={{ fontSize: 18 }} />
            </div>
            <div className="um-filter-select-wrap">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Tous les Statuts</option>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
              <ExpandMore sx={{ fontSize: 18 }} />
            </div>
          </div>
          <button className="um-btn-export">
            <FileDownload sx={{ fontSize: 18 }} />
            Exporter CSV
          </button>
        </div>

        {/* Table */}
        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Email</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5}>
                    <div className="um-loading">
                      <div className="um-spinner" />
                      Chargement...
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="um-empty">
                      <Group sx={{ fontSize: 48, opacity: 0.3 }} />
                      <p>Aucun utilisateur trouvé</p>
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

                  return (
                    <tr key={user.uticod} className="um-row" onClick={() => setSelectedUser(user.uticod)}>
                      <td>
                        <div className="um-user-cell">
                          <div className={`um-avatar ${isActive ? 'um-avatar-active' : 'um-avatar-inactive'}`}>
                            {initials}
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
                          <button className="um-action-btn" title="Modifier" onClick={(e) => { e.stopPropagation(); setSelectedUser(user.uticod); setShowAddModal(true); }}>
                            <Edit sx={{ fontSize: 18 }} />
                          </button>
                          <button className="um-action-btn" title="Réinitialiser mot de passe" onClick={(e) => { e.stopPropagation(); handleResetClick(user); }}>
                            <LockReset sx={{ fontSize: 18 }} />
                          </button>
                          <button className="um-action-btn" title={isActive ? "Désactiver" : "Activer"} onClick={(e) => { e.stopPropagation(); handleToggleStatus(user); }}>
                            <Bolt sx={{ fontSize: 18, color: isActive ? '#16a34a' : '#94a3b8' }} />
                          </button>
                          <button className="um-action-btn um-action-btn-danger" title="Supprimer" onClick={(e) => { e.stopPropagation(); handleDeleteClick(user); }}>
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
            Affichage de {filteredUsers.length} sur {users.length} utilisateurs
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
                  <><Edit sx={{ fontSize: 20, verticalAlign: 'middle', mr: 1 }} /> Modifier l'Utilisateur</>
                ) : (
                  <><Add sx={{ fontSize: 20, verticalAlign: 'middle', mr: 1 }} /> Nouvel Utilisateur</>
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
                Annuler
              </button>
              <button
                className="um-btn-save"
                onClick={async () => {
                  await saisieRef.current?.handleSave();
                  refetch();
                  setShowAddModal(false);
                  setSelectedUser(null);
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: '12px' } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#dc2626' }}>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <p>Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>{userToProcess?.utiprn} {userToProcess?.utinom}</strong> ?</p>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>Cette action supprimera également tous ses droits et accès.</p>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">Annuler</Button>
          <Button onClick={confirmDelete} variant="contained" color="error">Supprimer définitivement</Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} PaperProps={{ sx: { borderRadius: '12px', width: '350px' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Réinitialiser le mot de passe</DialogTitle>
        <DialogContent>
          <p style={{ fontSize: '14px', marginBottom: '16px' }}>Nouveau mot de passe pour <strong>{userToProcess?.utiprn}</strong> :</p>
          <TextField
            fullWidth
            type="password"
            size="small"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Entrez le nouveau mot de passe"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setResetDialogOpen(false)} color="inherit">Annuler</Button>
          <Button onClick={confirmReset} variant="contained" disabled={!newPassword}>Réinitialiser</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

// ── Outer component ──────────────────────────────────────────────
export default function Utilisateur() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <UtilisateurContent />
      </UserProvider>
    </QueryClientProvider>
  );
}