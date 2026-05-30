export interface RolePermission {
  rpId?: number;
  rpRoleId?: number;
  rpModule: string;
  rpConsult: string;
  rpAdd: string;
  rpModify: string;
  rpDelete: string;
}

export interface RolePointdroit {
  poicod: string;
  poilib: string;
  soccod: string;
  roleId: number;
  lire: string;
  purger: string;
  config: string;
}

export interface UpdateRolePointdroitRequest {
  poicod: string;
  soccod: string;
  lire: boolean;
  purger: boolean;
  config: boolean;
}

export interface Role {
  roleId?: number;
  roleName: string;
  roleDescription?: string;
  roleColor?: string;
  roleIsSystem?: boolean;
  roleCreatedAt?: string;
  permissions?: RolePermission[];
  pointdroits?: RolePointdroit[];
}

export interface CreateRoleRequest {
  roleName: string;
  roleDescription?: string;
  roleColor?: string;
}

export interface UpdatePermissionRequest {
  module: string;
  consult: boolean;
  add: boolean;
  modify: boolean;
  delete: boolean;
}

// Module definitions with icons
export const PERMISSION_MODULES = [
  { key: 'Absences et Sanctions', icon: '📋', label: 'Absences et Sanctions' },
  { key: 'Pointage et Temps', icon: '⏱️', label: 'Pointage et Temps' },
  { key: 'Gestion Employés', icon: '👥', label: 'Gestion Employés' },
  { key: 'Contrats et Avenants', icon: '📄', label: 'Contrats et Avenants' },
  { key: 'Paie et Rémunération', icon: '💰', label: 'Paie et Rémunération' },
  { key: 'Note de Frais', icon: '🧾', label: 'Note de Frais' },
  { key: 'Demande de Congé', icon: '📝', label: 'Demande de Congé' },
  { key: 'Gestion des Congés', icon: '🏖️', label: 'Gestion des Congés' },
  { key: 'Données de Base', icon: '🗄️', label: 'Données de Base' },
  { key: 'Paramètres de Temps', icon: '⚙️', label: 'Paramètres de Temps' },
  { key: 'Rapports et Statistiques', icon: '📊', label: 'Rapports et Statistiques' },
  { key: 'Administration', icon: '🛡️', label: 'Administration' },
] as const;

export const ROLE_COLORS = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#64748b', // slate
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
] as const;