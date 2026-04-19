import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useUserContext } from '../../helper/UserProvider';
import RolesService from '../../../services/RolesService/RolesService';
import { Role, ROLE_COLORS } from '../../../models/Role';
import { Search, People, Add, Delete, Check } from '@mui/icons-material';

export default function ListeUtilisateur() {
  const queryClient = useQueryClient();
  const { selectedRole, setSelectedRole } = useUserContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRole, setEditingRole] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#64748b');

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: RolesService.getAll,
  });

  const createMutation = useMutation(
    (data: Partial<Role>) => RolesService.create(data),
    { onSuccess: () => { queryClient.invalidateQueries('roles'); setShowAddForm(false); setNewRoleName(''); setNewRoleDesc(''); } }
  );

  const deleteMutation = useMutation(
    (id: number) => RolesService.delete(id),
    { onSuccess: () => { queryClient.invalidateQueries('roles'); if (selectedRole) setSelectedRole(null as any); } }
  );

  const filteredRoles = roles.filter((role: Role) => {
    if (!searchTerm) return true;
    return role.roleName?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    createMutation.mutate({
      roleName: newRoleName.trim(),
      roleDescription: newRoleDesc.trim() || undefined,
      roleColor: newRoleColor,
    });
  };

  const handleDeleteRole = (e: React.MouseEvent, roleId: number, isSystem: boolean) => {
    e.stopPropagation();
    if (isSystem) return;
    if (confirm('Supprimer ce rôle ?')) deleteMutation.mutate(roleId);
  };

  return (
    <div className="aut-user-panel">
      <div className="aut-user-panel-header">
        <h3 className="aut-user-panel-title">
          <People sx={{ fontSize: 18, mr: 0.5 }} />
          Rôles
        </h3>
        <button className="aut-role-add-btn" onClick={() => setShowAddForm(!showAddForm)} title="Ajouter un rôle">
          <Add sx={{ fontSize: 18 }} />
        </button>
      </div>

      {/* Add Role Form */}
      {showAddForm && (
        <div className="aut-role-form">
          <input
            className="aut-role-form-input"
            type="text"
            placeholder="Nom du rôle"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />
          <input
            className="aut-role-form-input"
            type="text"
            placeholder="Description (optionnel)"
            value={newRoleDesc}
            onChange={(e) => setNewRoleDesc(e.target.value)}
          />
          <div className="aut-role-color-picker">
            {ROLE_COLORS.map((color) => (
              <button
                key={color}
                className={`aut-role-color-dot ${newRoleColor === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setNewRoleColor(color)}
              />
            ))}
          </div>
          <div className="aut-role-form-actions">
            <button className="aut-role-form-cancel" onClick={() => setShowAddForm(false)}>Annuler</button>
            <button className="aut-role-form-save" onClick={handleAddRole} disabled={!newRoleName.trim()}>
              <Check sx={{ fontSize: 14 }} /> Créer
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <div className="aut-filter-search">
          <span className="aut-filter-search-icon">
            <Search sx={{ fontSize: 16 }} />
          </span>
          <input
            className="aut-filter-input"
            type="text"
            placeholder="Rechercher un rôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Roles List */}
      <div className="aut-user-list">
        {isLoading ? (
          <div className="aut-loading"><div className="aut-spinner" /> Chargement...</div>
        ) : (
          filteredRoles.map((role: Role) => (
            <div
              key={role.roleId}
              className={`aut-user-item ${selectedRole === role.roleId ? 'active' : ''}`}
              onClick={() => setSelectedRole(role.roleId as any)}
            >
              <div
                className="aut-role-color-indicator"
                style={{ backgroundColor: role.roleColor || '#64748b' }}
              />
              <div className="aut-user-info">
                <div className="aut-user-name">
                  {editingRole === role.roleId ? (
                    <input
                      className="aut-role-edit-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editName.trim()) {
                          RolesService.update(role.roleId!, { roleName: editName.trim() }).then(() => {
                            queryClient.invalidateQueries('roles');
                            setEditingRole(null);
                          });
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    role.roleName
                  )}
                </div>
                <div className="aut-user-email" style={{ fontSize: '11px' }}>
                  {role.roleDescription || (role.roleIsSystem ? 'Rôle système' : 'Rôle personnalisé')}
                </div>
              </div>
              {!role.roleIsSystem && (
                <button
                  className="aut-role-delete-btn"
                  onClick={(e) => handleDeleteRole(e, role.roleId!, false)}
                  title="Supprimer"
                >
                  <Delete sx={{ fontSize: 14 }} />
                </button>
              )}
            </div>
          ))
        )}
        {filteredRoles.length === 0 && !isLoading && (
          <div className="aut-loading" style={{ padding: '24px' }}>
            Aucun rôle trouvé
          </div>
        )}
      </div>
    </div>
  );
}