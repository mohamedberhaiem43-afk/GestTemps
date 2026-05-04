import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { useTranslation } from "react-i18next";
import { useUserContext } from "../../helper/UserProvider";
import RolesService from "../../../services/RolesService/RolesService";
import ModuserService from "../../../services/ModuserService/ModuserService";
import ModuleService from "../../../services/ModuleService/ModuleService";
import UtilisateurService from "../../../services/UtilisateurService/UtilisateurService";
import { Moduser } from "../../../models/moduser";
import { Module } from "../../../models/Module";
import { Role, RolePermission, PERMISSION_MODULES, UpdatePermissionRequest } from "../../../models/Role";
import {
  EventBusy,
  Schedule,
  People,
  Description,
  Payments,
  Shield,
  Save,
  HolidayVillage,
  Storage,
  Settings,
  Assessment,
  AdminPanelSettings,
} from "@mui/icons-material";

interface DroitAcceesProps {
  onPermissionsChange?: (permissions: Moduser[]) => void;
  isAdmin?: boolean;
}

function getModuleIcon(modlib: string) {
  const lower = modlib.toLowerCase();
  if (lower.includes('absence') || lower.includes('sanction')) return <EventBusy sx={{ fontSize: 14 }} />;
  if (lower.includes('pointage') || lower.includes('temps') && !lower.includes('paramètre')) return <Schedule sx={{ fontSize: 14 }} />;
  if (lower.includes('employé') || lower.includes('employe') || lower.includes('gestion')) return <People sx={{ fontSize: 14 }} />;
  if (lower.includes('contrat') || lower.includes('avenant')) return <Description sx={{ fontSize: 14 }} />;
  if (lower.includes('paie') || lower.includes('rémunération') || lower.includes('remuneration')) return <Payments sx={{ fontSize: 14 }} />;
  if (lower.includes('congé') || lower.includes('conge')) return <HolidayVillage sx={{ fontSize: 14 }} />;
  if (lower.includes('base')) return <Storage sx={{ fontSize: 14 }} />;
  if (lower.includes('paramètre') || lower.includes('parametre')) return <Settings sx={{ fontSize: 14 }} />;
  if (lower.includes('rapport') || lower.includes('statistique')) return <Assessment sx={{ fontSize: 14 }} />;
  if (lower.includes('administration')) return <AdminPanelSettings sx={{ fontSize: 14 }} />;
  return <Shield sx={{ fontSize: 14 }} />;
}

function getModuleIconClass(modlib: string): string {
  const lower = modlib.toLowerCase();
  if (lower.includes('absence') || lower.includes('sanction')) return 'aut-module-icon-abs';
  if (lower.includes('pointage') || lower.includes('temps') && !lower.includes('paramètre')) return 'aut-module-icon-pointage';
  if (lower.includes('employé') || lower.includes('employe') || lower.includes('gestion')) return 'aut-module-icon-employe';
  if (lower.includes('contrat') || lower.includes('avenant')) return 'aut-module-icon-contrat';
  if (lower.includes('paie') || lower.includes('rémunération') || lower.includes('remuneration')) return 'aut-module-icon-paie';
  if (lower.includes('congé') || lower.includes('conge')) return 'aut-module-icon-conge';
  if (lower.includes('base')) return 'aut-module-icon-base';
  if (lower.includes('paramètre') || lower.includes('parametre')) return 'aut-module-icon-params';
  if (lower.includes('rapport') || lower.includes('statistique')) return 'aut-module-icon-reports';
  if (lower.includes('administration')) return 'aut-module-icon-admin';
  return '';
}

export default function DroitAccees(_props: DroitAcceesProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { selectedRole } = useUserContext();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: RolesService.getAll,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-for-sync'],
    queryFn: () => UtilisateurService.getAllWithoutParams(),
  });

  const { data: allModules = [] } = useQuery<Module[]>({
    queryKey: ['all-modules'],
    queryFn: () => ModuleService.getAllWithoutParams(),
  });

  const selectedRoleData = roles.find((r: Role) => r.roleId === selectedRole);
  const permissions = selectedRoleData?.permissions || [];

  const [editedPermissions, setEditedPermissions] = useState<Record<string, { consult: boolean; add: boolean; modify: boolean; delete: boolean }>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize edited permissions when role changes
  useEffect(() => {
    const perms: Record<string, { consult: boolean; add: boolean; modify: boolean; delete: boolean }> = {};
    PERMISSION_MODULES.forEach((mod) => {
      const existing = permissions?.find((p: RolePermission) => p.rpModule === mod.key);
      perms[mod.key] = {
        consult: existing?.rpConsult === '1',
        add: existing?.rpAdd === '1',
        modify: existing?.rpModify === '1',
        delete: existing?.rpDelete === '1',
      };
    });
    setEditedPermissions(perms);
    setHasChanges(false);
  }, [selectedRole, permissions]);

  const handleCheckboxChange = (moduleKey: string, field: 'consult' | 'add' | 'modify' | 'delete') => {
    setEditedPermissions(prev => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [field]: !prev[moduleKey]?.[field],
      }
    }));
    setHasChanges(true);
  };

  const handleToggleAll = (moduleKey: string) => {
    const current = editedPermissions[moduleKey];
    const allChecked = current?.consult && current?.add && current?.modify && current?.delete;
    setEditedPermissions(prev => ({
      ...prev,
      [moduleKey]: {
        consult: !allChecked,
        add: !allChecked,
        modify: !allChecked,
        delete: !allChecked,
      }
    }));
    setHasChanges(true);
  };

  const saveMutation = useMutation(
    ({ roleId, perms }: { roleId: number; perms: UpdatePermissionRequest[] }) =>
      RolesService.updatePermissions(roleId, perms),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('roles');
        setHasChanges(false);
      }
    }
  );

  const handleSave = async () => {
    if (!selectedRole || !selectedRoleData) return;
    const permsList: UpdatePermissionRequest[] = Object.entries(editedPermissions).map(([module, flags]) => ({
      module,
      ...flags,
    }));
    
    try {
      setIsSyncing(true);
      // 1. Sauvegarder les permissions du rôle
      await saveMutation.mutateAsync({ roleId: selectedRole, perms: permsList });
      
      // 2. Identifier les utilisateurs de ce rôle
      // Match strict sur roleName ; en compat on accepte aussi l'ancien alias "admin"
      // pour le rôle système actuel "Administrator", quand utiadm=1 sans utirole défini.
      const isAdminRole = ['admin', 'Administrator'].includes(selectedRoleData.roleName);
      const usersToUpdate = allUsers.filter((u: any) =>
        u.utirole === selectedRoleData.roleName ||
        (isAdminRole && (u.utiadm === '1' || u.utiadm === 'Oui'))
      );

      if (usersToUpdate.length > 0) {
        // 3. Pour chaque utilisateur, mettre à jour la table moduser
        for (const user of usersToUpdate) {
          const moduserList: Moduser[] = permsList.map(p => {
            const moduleInfo = allModules.find(m => m.modlib === p.module);
            return {
              uticod: user.uticod,
              modcod: moduleInfo?.modcod || p.module,
              modlib: p.module,
              modconsult: p.consult ? '1' : '0',
              modsais: p.add ? '1' : '0',
              modupd: p.modify ? '1' : '0',
              modsupp: p.delete ? '1' : '0',
              appcod: 'GestTemps'
            };
          });

          await ModuserService.bulkUpdate(user.uticod || '', moduserList);
        }
      }
      
      // Propagation de secours via l'endpoint de rôle si dispo
      try {
        await RolesService.syncPermissions(selectedRole);
      } catch (e) {
        console.warn("Sync backend facultatif échoué.", e);
      }

      setHasChanges(false);
    } catch (err) {
      console.error("Erreur lors de la sauvegarde ou synchronisation des droits:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="aut-matrix-panel">
      <div className="aut-matrix-header">
        <h3 className="aut-matrix-title">
          <Shield sx={{ fontSize: 18, color: '#3b82f6' }} />
          {t('donneeDeBase.utilisateur.permissionsMatrix')}
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
              <button className="aut-perm-save-btn" onClick={handleSave} disabled={saveMutation.isLoading || isSyncing}>
                <Save sx={{ fontSize: 14 }} />
                {saveMutation.isLoading || isSyncing ? t('donneeDeBase.utilisateur.syncing') : t('donneeDeBase.utilisateur.save')}
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
                <th>{t('donneeDeBase.utilisateur.module')}</th>
                <th>{t('donneeDeBase.utilisateur.consult')}</th>
                <th>{t('donneeDeBase.utilisateur.add')}</th>
                <th>{t('donneeDeBase.utilisateur.modify')}</th>
                <th>{t('donneeDeBase.utilisateur.deletePerm')}</th>
                <th>{t('donneeDeBase.utilisateur.all')}</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MODULES.map((mod) => {
                const perms = editedPermissions[mod.key];
                const allChecked = perms?.consult && perms?.add && perms?.modify && perms?.delete;
                return (
                  <tr key={mod.key}>
                    <td>
                      <span className={`aut-module-icon ${getModuleIconClass(mod.key)}`}>
                        {getModuleIcon(mod.key)}
                      </span>
                      {mod.label}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        className="aut-checkbox"
                        checked={perms?.consult || false}
                        onChange={() => handleCheckboxChange(mod.key, 'consult')}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        className="aut-checkbox"
                        checked={perms?.add || false}
                        onChange={() => handleCheckboxChange(mod.key, 'add')}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        className="aut-checkbox"
                        checked={perms?.modify || false}
                        onChange={() => handleCheckboxChange(mod.key, 'modify')}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        className="aut-checkbox"
                        checked={perms?.delete || false}
                        onChange={() => handleCheckboxChange(mod.key, 'delete')}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        className="aut-checkbox-all"
                        checked={allChecked || false}
                        onChange={() => handleToggleAll(mod.key)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="aut-matrix-empty">
          <div className="aut-matrix-empty-icon">
            <Shield sx={{ fontSize: 48 }} />
          </div>
          <div className="aut-matrix-empty-text">
            {rolesLoading ? t('donneeDeBase.utilisateur.permissionsLoading') : t('donneeDeBase.utilisateur.noRoleSelected')}
          </div>
          <div className="aut-matrix-empty-hint">
            {rolesLoading ? t('donneeDeBase.utilisateur.pleaseWait') : t('donneeDeBase.utilisateur.selectRoleHint')}
          </div>
        </div>
      )}
    </div>
  );
}