import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserContext } from "../../helper/UserProvider";
import { useAuth } from "../../helper/AuthProvider";
import RolesService from "../../../services/RolesService/RolesService";
import { Role, RolePointdroit, UpdateRolePointdroitRequest } from "../../../models/Role";
import { Save, Fingerprint, CheckCircle, Settings, Visibility } from "@mui/icons-material";

export default function RolePointeuseAccess() {
  const queryClient = useQueryClient();
  const { selectedRole } = useUserContext();
  const { soccod } = useAuth();
  const socCode = soccod || "01";

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: RolesService.getAll,
  });

  const selectedRoleData = roles.find((r: Role) => r.roleId === selectedRole);

  // Fetch pointdroits for selected role
  const { data: pointdroits = [], isLoading: pointdroitsLoading } = useQuery<RolePointdroit[]>({
    queryKey: ['rolePointdroits', selectedRole, socCode],
    queryFn: () => RolesService.getPointdroits(selectedRole!, socCode),
    enabled: !!selectedRole,
  });

  const [editedPointdroits, setEditedPointdroits] = useState<Record<string, { lire: boolean; purger: boolean; config: boolean }>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize edited pointdroits when data changes
  useEffect(() => {
    const edits: Record<string, { lire: boolean; purger: boolean; config: boolean }> = {};
    pointdroits.forEach((pd: RolePointdroit) => {
      edits[pd.poicod] = {
        lire: pd.lire === '1',
        purger: pd.purger === '1',
        config: pd.config === '1',
      };
    });
    setEditedPointdroits(edits);
    setHasChanges(false);
  }, [pointdroits]);

  const handleCheckboxChange = (poicod: string, field: 'lire' | 'purger' | 'config') => {
    setEditedPointdroits(prev => ({
      ...prev,
      [poicod]: {
        ...prev[poicod],
        [field]: !prev[poicod]?.[field],
      }
    }));
    setHasChanges(true);
  };

  const handleToggleAll = (poicod: string) => {
    const current = editedPointdroits[poicod];
    const allChecked = current?.lire && current?.purger && current?.config;
    setEditedPointdroits(prev => ({
      ...prev,
      [poicod]: {
        lire: !allChecked,
        purger: !allChecked,
        config: !allChecked,
      }
    }));
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: (pointdroits: UpdateRolePointdroitRequest[]) =>
      RolesService.updatePointdroits(selectedRole!, pointdroits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolePointdroits', selectedRole, socCode] });
      setHasChanges(false);
    },
  });

  const handleSave = () => {
    if (!selectedRole) return;
    const updates: UpdateRolePointdroitRequest[] = Object.entries(editedPointdroits).map(([poicod, flags]) => ({
      poicod,
      soccod: socCode,
      ...flags,
    }));
    saveMutation.mutate(updates);
  };

  return (
    <div className="aut-matrix-panel">
      <div className="aut-matrix-header">
        <h3 className="aut-matrix-title">
          <Fingerprint sx={{ fontSize: 18, color: '#3b82f6' }} />
          Accès Pointeuses
        </h3>
        {selectedRoleData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className="aut-selected-role-badge"
              style={{ borderLeft: `3px solid ${selectedRoleData.roleColor || '#64748b'}` }}
            >
              {selectedRoleData.roleName}
            </span>
            {hasChanges && (
              <button className="aut-perm-save-btn" onClick={handleSave} disabled={saveMutation.isPending}>
                <Save sx={{ fontSize: 14 }} />
                {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            )}
          </div>
        )}
      </div>

      {selectedRoleData ? (
        <div className="aut-matrix-table-wrap">
          <table className="aut-matrix-table">
            <thead>
              <tr>
                <th>Pointeuse</th>
                <th><Visibility sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} /> Lire</th>
                <th><CheckCircle sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} /> Purger</th>
                <th><Settings sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} /> Configurer</th>
                <th>Tout</th>
              </tr>
            </thead>
            <tbody>
              {pointdroitsLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                    Chargement des pointeuses...
                  </td>
                </tr>
              ) : pointdroits.length > 0 ? (
                pointdroits.map((pd: RolePointdroit) => {
                  const edits = editedPointdroits[pd.poicod];
                  const allChecked = edits?.lire && edits?.purger && edits?.config;
                  return (
                    <tr key={pd.poicod}>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="aut-module-icon aut-module-icon-pointage">
                            <Fingerprint sx={{ fontSize: 14 }} />
                          </span>
                          <span>
                            <span style={{ fontWeight: 500, color: '#334155' }}>{pd.poilib}</span>
                            <span style={{ display: 'block', fontSize: 11, color: '#94a3b8' }}>{pd.poicod}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="aut-checkbox"
                          checked={edits?.lire || false}
                          onChange={() => handleCheckboxChange(pd.poicod, 'lire')}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="aut-checkbox"
                          checked={edits?.purger || false}
                          onChange={() => handleCheckboxChange(pd.poicod, 'purger')}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="aut-checkbox"
                          checked={edits?.config || false}
                          onChange={() => handleCheckboxChange(pd.poicod, 'config')}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="aut-checkbox-all"
                          checked={allChecked || false}
                          onChange={() => handleToggleAll(pd.poicod)}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                    Aucune pointeuse configurée pour cette société
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="aut-matrix-empty">
          <div className="aut-matrix-empty-icon">
            <Fingerprint sx={{ fontSize: 48 }} />
          </div>
          <div className="aut-matrix-empty-text">
            {rolesLoading ? 'Chargement...' : 'Aucun rôle sélectionné'}
          </div>
          <div className="aut-matrix-empty-hint">
            Sélectionnez un rôle dans la liste pour gérer ses accès pointeuses
          </div>
        </div>
      )}
    </div>
  );
}