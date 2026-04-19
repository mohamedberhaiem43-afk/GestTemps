import { Role, UpdatePermissionRequest, UpdateRolePointdroitRequest, RolePointdroit } from "../../models/Role";
import ApiClient from "../apiClient";

const rolesApi = new ApiClient<Role>("Roles");
const pointdroitApi = new ApiClient<RolePointdroit>("Roles");

export const RolesService = {
  getAll: () => rolesApi.getAllWithoutParams(),

  getById: (id: number) => rolesApi.getWithParams(String(id)),

  create: (data: Partial<Role>) => rolesApi.post(data as Role),

  update: (id: number, data: Partial<Role>) =>
    rolesApi.putObject(String(id), data as Role),

  updatePermissions: (id: number, permissions: UpdatePermissionRequest[]) =>
    rolesApi.putObject(`${id}/permissions`, permissions as any),

  getPointdroits: (id: number, soccod: string) =>
    pointdroitApi.getWithParams(`${id}/pointdroit/${soccod}`) as unknown as Promise<RolePointdroit[]>,

  updatePointdroits: (id: number, pointdroits: UpdateRolePointdroitRequest[]) =>
    rolesApi.putObject(`${id}/pointdroit`, pointdroits as any),

  syncPermissions: (id: number) =>
    rolesApi.postWithoutParams(`${id}/sync-permissions`),

  delete: (id: number) => rolesApi.delete(null, id),
};

export default RolesService;
