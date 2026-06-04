import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/env';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TENANT_SLUG_KEY = 'tenant_slug';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor : auth token + multi-tenant slug.
    // Sans le header X-Tenant-Slug, le backend SaaS retombe sur la base legacy
    // et l'app mobile montre les données du mauvais tenant.
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        const slug = await SecureStore.getItemAsync(TENANT_SLUG_KEY);
        if (slug && config.headers) {
          config.headers['X-Tenant-Slug'] = slug;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
            if (refreshToken) {
              const response = await this.client.post('/MobileAuth/refresh', {
                refreshToken,
              });
              const { token, refreshToken: newRefreshToken } = response.data;
              await SecureStore.setItemAsync(TOKEN_KEY, token);
              await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefreshToken);
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            await this.clearTokens();
            throw refreshError;
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async clearTokens() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(TENANT_SLUG_KEY);
  }

  async saveTokens(token: string, refreshToken: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }

  async saveTenantSlug(slug: string) {
    await SecureStore.setItemAsync(TENANT_SLUG_KEY, slug.trim().toLowerCase());
  }

  async getStoredTenantSlug(): Promise<string | null> {
    return SecureStore.getItemAsync(TENANT_SLUG_KEY);
  }

  async getStoredToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  }

  // Auth endpoints
  async login(email: string, password: string, tenantSlug?: string) {
    try {
      const normalizedEmail = email?.trim();
      if (!normalizedEmail) {
        throw new Error('Email requis');
      }

      // Stocke le slug AVANT le login pour qu'il soit injecté dans le header de la requête
      // (sinon le backend ne sait pas dans quelle DB chercher l'utilisateur).
      if (tenantSlug && tenantSlug.trim()) {
        await this.saveTenantSlug(tenantSlug);
      } else {
        // Supprime un slug potentiellement obsolète avant le lookup / login.
        await SecureStore.deleteItemAsync(TENANT_SLUG_KEY);
        try {
          const lookup = await this.client.post('/auth/lookup-tenant', { email: normalizedEmail });
          const slug: string | undefined = lookup.data?.slug;
          if (slug) await this.saveTenantSlug(slug);
        } catch {
          // En cas d'échec, on laisse passer — le login renverra une erreur explicite.
        }
      }
      const response = await this.client.post('/MobileAuth/login', {
        email: normalizedEmail,
        password,
      });
      if (response.data.token) {
        await this.saveTokens(response.data.token, response.data.refreshToken);
      }
      return response.data;
    } catch (error: any) {
      console.log('ApiService Login Error:', error.message);
      if (error.response) {
        console.log('ApiService Error Response:', error.response.status, error.response.data);
      }
      throw error;
    }
  }

  async logout() {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      await this.client.post('/MobileAuth/logout', { refreshToken });
    } catch (e) {
      // Ignore logout errors
    }
    await this.clearTokens();
  }

  async getCurrentUser() {
    const response = await this.client.get('/MobileAuth/me');
    return response.data;
  }

  // ── Biometric auth (SEC-G2) ─────────────────────────────────────────────
  // Le mobile reçoit un bio-token spécifique (Purpose=Biometric côté DB) qui
  // remplace le stockage email+password en clair dans SecureStore.
  async biometricEnable() {
    const response = await this.client.post('/MobileAuth/biometric-enable');
    return response.data as { bioToken: string; expiresInDays: number };
  }
  async biometricLogin(bioToken: string, tenantSlug?: string) {
    if (tenantSlug) {
      await this.saveTenantSlug(tenantSlug);
    }
    const response = await this.client.post('/MobileAuth/biometric-login', { refreshToken: bioToken });
    if (response.data?.token) {
      await this.saveTokens(response.data.token, response.data.refreshToken);
    }
    return response.data as { token: string; refreshToken: string; bioToken: string };
  }
  async biometricDisable() {
    try {
      const response = await this.client.post('/MobileAuth/biometric-disable');
      return response.data;
    } catch {
      // best-effort : si l'appel échoue (réseau), le token côté local est de
      // toute façon supprimé par disableBiometricLogin. L'admin peut révoquer
      // depuis le portail web.
      return { revoked: 0 };
    }
  }

  // Push notifications
  async registerPushToken(payload: { Token: string; Platform: string; DeviceId: string; Soccod?: string }) {
    const response = await this.client.post('/MobileAuth/register-push-token', payload);
    return response.data;
  }

  // Notifications center
  async listNotifications(take = 50, unreadOnly = false) {
    const response = await this.client.get(`/Notifications`, { params: { take, unreadOnly } });
    return response.data as Array<{
      id: number; title: string; body: string;
      category?: string | null; dataJson?: string | null;
      createdAt: string; readAt?: string | null;
    }>;
  }
  async unreadNotificationsCount() {
    const response = await this.client.get(`/Notifications/unread-count`);
    return response.data as { count: number };
  }
  async markNotificationRead(id: number) {
    const response = await this.client.post(`/Notifications/${id}/read`);
    return response.data;
  }
  async markAllNotificationsRead() {
    const response = await this.client.post(`/Notifications/read-all`);
    return response.data;
  }
  async deleteNotification(id: number) {
    const response = await this.client.delete(`/Notifications/${id}`);
    return response.data;
  }
  async getNotificationPreferences() {
    const response = await this.client.get(`/Notifications/preferences`);
    return response.data as Array<{ code: string; label: string; description: string; group: string; push: boolean; inapp: boolean }>;
  }
  async updateNotificationPreferences(updates: Array<{ code: string; push: boolean; inapp: boolean }>) {
    const response = await this.client.put(`/Notifications/preferences`, updates);
    return response.data;
  }
  async getQuietHours() {
    const response = await this.client.get(`/Notifications/quiet-hours`);
    return response.data as { enabled: boolean; mode: 'manual' | 'auto_poste'; start: string; end: string };
  }
  async updateQuietHours(payload: { Enabled: boolean; Mode: 'manual' | 'auto_poste'; Start: string; End: string }) {
    const response = await this.client.put(`/Notifications/quiet-hours`, payload);
    return response.data;
  }
  async getQuietStatus() {
    const response = await this.client.get(`/Notifications/quiet-status`);
    return response.data as { silent: boolean; until?: string | null; reason?: string; mode?: string };
  }
  /**
   * Envoie une notification push de test à tous les devices de l'utilisateur courant.
   * Endpoint self-service /Notifications/test-push : pas de check [Admin] (vs
   * /Roles/test-push qui renvoyait 403 pour les employés). Le caller-uticod est
   * extrait du JWT côté serveur, on n'envoie pas de paramètre.
   */
  async sendTestPush(_uticod?: string) {
    const response = await this.client.post(`/Notifications/test-push`);
    return response.data as { sent: number };
  }

  // Presence endpoints
  async getMyPresence(soccod: string, empcod: string) {
    const response = await this.client.get(`/Presences/emp-point/${soccod}/${empcod}`);
    return response.data;
  }

  async getMyPresenceByDate(soccod: string, empcod: string, dateDebut: string, dateFin: string) {
    const response = await this.client.get(
      `/Presences/emp-point-filtrer/${soccod}/${empcod}/${dateDebut}/${dateFin}`
    );
    return response.data;
  }

  async updatePresence(soccod: string, empcod: string, predat: string, presence: any) {
    const response = await this.client.put(
      `/Presences/${soccod}/${empcod}/${predat}`,
      presence
    );
    return response.data;
  }

  /**
   * Heartbeat de position « live » — appelé par liveLocation.ts toutes les 60 s
   * pendant que le salarié est pointé et l'app ouverte. UPSERT côté backend sur
   * la PK (soccod, empcod). Le serveur peut renvoyer { accepted: false, reason }
   * si la fenêtre RGPD ferme la capture (hors heure / hors jour autorisé) —
   * dans ce cas l'appelant arrête le polling jusqu'au prochain pointage.
   */
  async postLiveLocation(payload: {
    soccod: string;
    empcod: string;
    lat: number;
    lon: number;
    acc?: number;
    sessionId?: string;
    batteryLevel?: number;
  }) {
    const response = await this.client.post('/Presences/live-location', payload);
    return response.data as { accepted: boolean; reason?: string };
  }

  async markPresence(
    soccod: string,
    empcod: string,
    poicod?: string,
    gps?: { latitude: number; longitude: number; accuracy?: number }
  ) {
    const params = new URLSearchParams();
    if (poicod) params.append('poicod', poicod);
    if (gps) {
      params.append('lat', String(gps.latitude));
      params.append('lon', String(gps.longitude));
      if (gps.accuracy != null) params.append('acc', String(gps.accuracy));
    }
    // Horodatage = horloge locale du téléphone, format "YYYY-MM-DDTHH:mm:ss"
    // sans suffixe Z pour que le serveur le bind comme DateTimeKind.Unspecified
    // (heure locale de l'utilisateur, pas UTC).
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localStamp =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    params.append('clientTime', localStamp);
    const qs = params.toString();
    const response = await this.client.post(
      `/Presences/mark-presence/${soccod}/${empcod}${qs ? `?${qs}` : ''}`
    );
    return response.data;
  }

  // Leave request endpoints
  async getMyLeaveRequests(soccod: string, empcod: string) {
    const response = await this.client.get(`/DemConges/get-emp-demconge/${soccod}/${empcod}`);
    return response.data;
  }

  async getMyLeaveRequestsByPeriod(soccod: string, empcod: string, datedebut: string, datefin: string) {
    const response = await this.client.get(
      `/DemConges/get-demconge-by-periode/${soccod}/${empcod}/${datedebut}/${datefin}`
    );
    return response.data;
  }

  async getAllLeaveRequests(soccod: string, uticod: string) {
    const response = await this.client.get(`/DemConges/get-demconge/${soccod}/${uticod}`);
    return response.data;
  }

  async getAllLeaveRequestsByPeriod(soccod: string, uticod: string, datedebut: string, datefin: string) {
    const response = await this.client.get(
      `/DemConges/get-demconge-by-periode/${soccod}/${uticod}/${datedebut}/${datefin}`
    );
    return response.data;
  }

  async getPendingLeaveRequestsByPeriod(soccod: string, uticod: string, datedebut: string, datefin: string) {
    const response = await this.client.get(
      `/DemConges/get-pending-demconge-by-periode/${soccod}/${uticod}/${datedebut}/${datefin}`
    );
    return response.data;
  }

  async createLeaveRequest(conge: any) {
    const response = await this.client.post('/DemConges', conge);
    return response.data;
  }

  async getNextLeaveRequestCode(soccod: string) {
    const response = await this.client.get(`/DemConges/get-next-concod/${soccod}`);
    return response.data as { concod?: string };
  }

  // ─── CET : alimentation par le salarié ───────────────────────────────────
  async getCetEligibilite(soccod: string, empcod: string) {
    const response = await this.client.get(`/Cet/alimentation/eligibilite/${soccod}/${empcod}`);
    const d = response.data;
    return (Array.isArray(d) ? d : (d?.$values ?? [])) as Array<{
      abscod: string; abslib?: string | null; categorie: string;
      soldeDisponible: number; dejaTransfere: number;
      plafondAnnuel?: number | null; resteTransferable: number;
    }>;
  }

  async getMyCetAlimentations(soccod: string, empcod: string) {
    const response = await this.client.get(`/Cet/alimentation/mine/${soccod}/${empcod}`);
    const d = response.data;
    return (Array.isArray(d) ? d : (d?.$values ?? [])) as Array<{
      id: number; abscod?: string | null; abslib?: string | null;
      nbjours: number; datedemande: string; statut: string; motifrefus?: string | null;
    }>;
  }

  async requestCetAlimentation(soccod: string, empcod: string, abscod: string, nbjours: number) {
    const response = await this.client.post(`/Cet/alimentation?soccod=${encodeURIComponent(soccod)}`, {
      empcod, abscod, nbjours,
    });
    return response.data as { id: number; statut: string; applied: boolean };
  }

  async acceptLeaveRequest(soccod: string, concod: string, empcod: string) {
    const response = await this.client.post(
      `/DemConges/accept-demconge/${soccod}/${concod}/${empcod}`
    );
    return response.data;
  }

  async refuseLeaveRequest(soccod: string, concod: string, empcod: string) {
    const response = await this.client.post(
      `/DemConges/refuse-demconge/${soccod}/${concod}/${empcod}`
    );
    return response.data;
  }

  async updateLeaveRequest(conge: any) {
    const response = await this.client.put('/DemConges', conge);
    return response.data;
  }

  async deleteLeaveRequest(soccod: string, concod: string) {
    const response = await this.client.delete(`/DemConges/${soccod}/${concod}`);
    return response.data;
  }

  // ─── Télétravail ──────────────────────────────────────────────────────
  // Workflow demande/validation (cf. TeletravailController côté .NET). Le caller
  // (claim NameIdentifier == Uticod == Empcod) est implicite — pas besoin de
  // passer empcod en URL, le backend le résout depuis le token.
  async listMyRemoteWorkRequests() {
    const response = await this.client.get('/Teletravail/me');
    return response.data as Array<{
      id: number;
      empcod: string | null;
      employeeName: string | null;
      requestedAt: string;
      startDate: string;
      endDate: string;
      daysCount: number | null;
      reason: string | null;
      status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
      decidedBy: string | null;
      decidedByName: string | null;
      decidedAt: string | null;
      decisionComment: string | null;
    }>;
  }

  async createRemoteWorkRequest(payload: { startDate: string; endDate: string; reason?: string | null }) {
    const response = await this.client.post('/Teletravail', payload);
    return response.data;
  }

  async cancelRemoteWorkRequest(id: number) {
    const response = await this.client.post(`/Teletravail/${id}/cancel`);
    return response.data;
  }

  // ─── Demande d'absence avec justificatif ──────────────────────────────
  // Multipart pour la création (le justificatif est joint dans la même
  // requête). Les autres endpoints sont du JSON pur — comme Teletravail.
  async listMyAbsenceRequests() {
    const response = await this.client.get('/DemandeAbsence/me');
    return response.data;
  }

  async createAbsenceRequest(payload: {
    startDate: string;     // yyyy-mm-dd
    endDate: string;       // yyyy-mm-dd
    abscod?: string | null;
    reason?: string | null;
    file?: { uri: string; name: string; type: string } | null;
  }) {
    const fd = new FormData();
    fd.append('StartDate', payload.startDate);
    fd.append('EndDate', payload.endDate);
    if (payload.abscod) fd.append('Abscod', payload.abscod);
    if (payload.reason) fd.append('Reason', payload.reason);
    if (payload.file) {
      // React Native FormData : on attache un objet { uri, name, type } — pas
      // un Blob. La signature `any` est requise par TS car les types web ne
      // matchent pas la convention native.
      fd.append('file', payload.file as any);
    }
    const response = await this.client.post('/DemandeAbsence', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async cancelAbsenceRequest(id: number) {
    const response = await this.client.post(`/DemandeAbsence/${id}/cancel`);
    return response.data;
  }

  /**
   * Appelle l'IA pour pré-remplir le formulaire de demande d'absence depuis
   * une photo / PDF du justificatif. Retourne { success, extractedData: {
   * startDate, endDate, daysCount, absenceCategory, reason, issuer }, ... }.
   */
  async scanAbsenceJustification(file: { uri: string; name: string; type: string }) {
    const fd = new FormData();
    fd.append('file', file as any);
    const response = await this.client.post('/DocumentScan/scan-absence-justification', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  // Absence types
  async getAbsences() {
    const response = await this.client.get('/Absences');
    return response.data;
  }

  // Balance/Solde endpoints
  async getMyBalance(soccod: string, empcod: string) {
    const response = await this.client.get(`/Soldes/${soccod}/${empcod}`);
    return response.data;
  }

  async getEmpLeaveBalance(soccod: string, empcod: string, moisdeb: string, moisfin: string, annee: string) {
    const response = await this.client.get(
      `/Employes/get-emp-etat-conge/${soccod}/${empcod}/${moisdeb}/${moisfin}/${annee}`
    );
    return response.data;
  }

  // Contracts/Vault endpoints
  async getMyContracts(soccod: string, uticod: string) {
    const response = await this.client.get(`/Contrats/${soccod}/${uticod}`);
    return response.data;
  }

  // Contrats expirant bientôt — agrégation côté client : on récupère la liste
  // complète et on filtre les Empsort dans une fenêtre [today..today+days].
  // Le backend ne fournit pas (encore) un endpoint dédié.
  async getContractsForRenewal(soccod: string, uticod: string) {
    const response = await this.client.get(`/Contrats/${soccod}/${uticod}`);
    return response.data;
  }

  async getNextConcod(soccod: string) {
    const response = await this.client.get(`/Contrats/get-next-concod/${soccod}`);
    return response.data;
  }

  async renewContract(data: {
    soccod: string;
    sourceConcod: string;
    newConcod: string;
    condat: string;
    startDate: string;
    endDate: string;
    monthNumber?: number | null;
    contype?: string | null;
    empcontrat?: string | null;
    empmotif?: string | null;
  }) {
    const response = await this.client.post('/Contrats/renew', data);
    return response.data;
  }

  // Authorization de sortie endpoints
  async getMyAuthorizations(soccod: string, empcod: string) {
    const response = await this.client.get(`/Autorisers/my-auths/${soccod}/${empcod}`);
    return response.data;
  }

  async getAuthorizations(soccod: string, uticod: string) {
    const response = await this.client.get(`/Autorisers/${soccod}/${uticod}`);
    return response.data;
  }

  async createMyAuthorization(autoriser: any) {
    const response = await this.client.post('/Autorisers/my-auth', autoriser);
    return response.data;
  }

  async createAuthorization(autoriser: any) {
    const response = await this.client.post('/Autorisers', autoriser);
    return response.data;
  }

  async updateAuthorization(autoriser: any) {
    const response = await this.client.put('/Autorisers', autoriser);
    return response.data;
  }

  // Self-service : l'employé supprime SA propre demande (heures sup.) tant qu'elle
  // est en attente. Endpoint dédié non gardé par la permission gestionnaire
  // (cf. AutorisersController.DeleteMyAuthorization).
  async deleteMyAuthorization(soccod: string, concod: string) {
    const response = await this.client.delete(`/Autorisers/my-auth/${soccod}/${concod}`);
    return response.data;
  }

  // Employee endpoints
  async getEmployees(soccod: string, uticod: string) {
    const response = await this.client.get(`/Employes/${soccod}/${uticod}`);
    return response.data;
  }

  async getEmployeesBySite(soccod: string, uticod: string, site: string) {
    const response = await this.client.get(`/Employes/get-emps/${soccod}/${site}/${uticod}`);
    return response.data;
  }

  async getEmployee(soccod: string, empcod: string) {
    const response = await this.client.get(`/Employes/get-employe/${soccod}/${empcod}`);
    return response.data;
  }

  async addEmployee(employe: any) {
    const response = await this.client.post('/Employes', employe);
    return response.data;
  }

  /**
   * Self-service : un employé met à jour SES propres coordonnées (téléphone,
   * mobile, adresse, ville, email). Le backend vérifie que callerUticod === empcod
   * et limite la whitelist aux champs de contact (pas de fonction/salaire/etc.).
   */
  async updateMyContact(payload: {
    soccod: string;
    empcod: string;
    // Coordonnées
    emptel?: string;
    empmob?: string;
    empadr?: string;
    vilcod?: string;
    empemail?: string;
    // État civil (self-service étendu — la fonction/service/site/société/date
    // d'embauche restent toujours sous contrôle RH côté backend).
    empsexe?: string;
    empsitfam?: string;
    empnbp?: number;
    empdnais?: string;
    emplnais?: string;
    natcod?: string;
    // Identité arabe
    emplibar?: string;
    empadrar?: string;
  }) {
    const response = await this.client.put('/Employes/update-my-contact', {
      Soccod: payload.soccod,
      Empcod: payload.empcod,
      Emptel: payload.emptel,
      Empmob: payload.empmob,
      Empadr: payload.empadr,
      Vilcod: payload.vilcod,
      Empemail: payload.empemail,
      Empsexe: payload.empsexe,
      Empsitfam: payload.empsitfam,
      Empnbp: payload.empnbp,
      Empdnais: payload.empdnais,
      Emplnais: payload.emplnais,
      Natcod: payload.natcod,
      Emplibar: payload.emplibar,
      Empadrar: payload.empadrar,
    });
    return response.data;
  }

  async updateEmployee(employe: any) {
    const response = await this.client.put('/Employes/update-employe', employe);
    return response.data;
  }

  // Document scan (AI) endpoint
  async scanEmployeDocument(fileUri: string, fileType: string) {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'document.jpg';
    
    formData.append('file', {
      uri: fileUri,
      type: fileType || 'image/jpeg',
      name: filename,
    } as any);

    const response = await this.client.post('/DocumentScan/scan-employe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
    return response.data;
  }

  async quickScanDocument(fileUri: string, fileType: string) {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'document.jpg';
    
    formData.append('file', {
      uri: fileUri,
      type: fileType || 'image/jpeg',
      name: filename,
    } as any);

    const response = await this.client.post('/DocumentScan/quick-scan', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
    return response.data;
  }

  // Profile endpoints
  async getProfile(soccod: string, uticod: string) {
    const response = await this.client.get(`/Utilisateurs/get-profile/${soccod}/${uticod}`);
    return response.data;
  }

  async updateProfile(payload: {
    uticod: string;
    utinom?: string;
    utiprn?: string;
    utimail?: string;
  }) {
    const response = await this.client.put('/Utilisateurs/update-profile', {
      utilisateur: {
        uticod: payload.uticod,
        utinom: payload.utinom,
        utiprn: payload.utiprn,
        utimail: payload.utimail,
      },
      moduser: null,
    });
    return response.data as boolean;
  }

  async changePassword(payload: { uticod: string; currentPassword: string; newPassword: string }) {
    const response = await this.client.put('/Utilisateurs/change-password', payload);
    return response.data as boolean;
  }

  async enable2FA(uticod: string) {
    const response = await this.client.post(`/Utilisateurs/enable-2fa/${uticod}`);
    return response.data as { secret: string; qrCodeBase64: string; manualEntryKey: string };
  }

  async verify2FA(uticod: string, code: string) {
    const response = await this.client.post(`/Utilisateurs/verify-2fa/${uticod}`, { code });
    return response.data;
  }

  async disable2FA(uticod: string) {
    const response = await this.client.post(`/Utilisateurs/disable-2fa/${uticod}`);
    return response.data;
  }

  // Suppression de compte (RGPD / Google Play) — flux en 2 étapes.
  // Étape 1 : envoie un code de confirmation par email à l'utilisateur.
  async requestAccountDeletion() {
    const response = await this.client.post('/account/request-deletion', {});
    return response.data as { message: string; email: string; ttlMinutes: number };
  }

  // Étape 2 : confirme avec le code reçu → notifie support + admin (demande effective).
  async confirmAccountDeletion(code: string, reason?: string) {
    const response = await this.client.post('/account/confirm-deletion', { code, reason });
    return response.data as { message: string; supportEmail: string };
  }

  async uploadProfileImage(fileUri: string, uticod: string) {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'photo.jpg';
    
    formData.append('file', {
      uri: fileUri,
      type: 'image/jpeg',
      name: filename,
    } as any);

    const response = await this.client.post(
      `/Utilisateurs/upload-profile?uticod=${uticod}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data;
  }

  // KPI endpoints
  async getMyKPIs(soccod: string, uticod: string) {
    const response = await this.client.get(`/Employes/get-my-kpis/${soccod}/${uticod}`);
    return response.data;
  }

  // Expense (Note de frais) endpoints
  async getMyExpenses(soccod: string, empcod: string) {
    const response = await this.client.get(`/NoteDeFrais/by-emp/${soccod}/${empcod}`);
    return response.data;
  }

  async getAllExpenses(soccod: string) {
    const response = await this.client.get(`/NoteDeFrais/by-soc/${soccod}`);
    return response.data;
  }

  async createExpense(expense: any, fileUri?: string) {
    // Le backend NoteDeFraisController.Add utilise [FromForm] — on doit donc
    // TOUJOURS envoyer du multipart/form-data, y compris sans pièce jointe.
    // Précédemment, le cas "sans fichier" envoyait un body JSON, que [FromForm]
    // ne bind pas : Soccod/Empcod/Titre/Categorie restaient null et ASP.NET
    // retournait un 400 ModelState ("The Soccod field is required." …).
    const formData = new FormData();
    if (fileUri) {
      const filename = fileUri.split('/').pop() || 'justificatif.jpg';
      formData.append('file', {
        uri: fileUri,
        type: 'image/jpeg',
        name: filename,
      } as any);
    }
    formData.append('Soccod', expense.soccod);
    formData.append('Empcod', expense.empcod);
    formData.append('Titre', expense.titre);
    formData.append('Categorie', expense.categorie);
    formData.append('Montant', String(expense.montant));
    formData.append('DateDepense', expense.dateDepense);
    if (expense.projet) formData.append('Projet', expense.projet);
    if (expense.devise) formData.append('Devise', expense.devise);
    if (expense.missionId != null) formData.append('MissionId', String(expense.missionId));

    const response = await this.client.post('/NoteDeFrais/add', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  }

  // OCR reçu : extrait montant / devise / date / titre / catégorie depuis une photo
  // de justificatif pour pré-remplir le formulaire de note de frais. Consultatif :
  // l'utilisateur valide/corrige avant soumission. Endpoint backend /DocumentScan/scan-receipt.
  async scanReceipt(fileUri: string) {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'recu.jpg';
    formData.append('file', {
      uri: fileUri,
      type: 'image/jpeg',
      name: filename,
    } as any);
    const response = await this.client.post('/DocumentScan/scan-receipt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  }

  async deleteExpense(id: number) {
    const response = await this.client.delete(`/NoteDeFrais/${id}`);
    return response.data;
  }

  async updateExpenseStatus(id: number, status: string) {
    const response = await this.client.put(`/NoteDeFrais/update-status/${id}/${status}`);
    return response.data;
  }

  async deleteAuthorization(soccod: string, concod: string) {
    const response = await this.client.delete(`/Autorisers/${soccod}/${concod}`);
    return response.data;
  }

  // Demande Autorisation endpoints
  async getDemandeAutorisations(soccod: string, uticod: string) {
    const response = await this.client.get(`/DemandeAutorisations/get-all/${soccod}/${uticod}`);
    return response.data;
  }

  async getNextDemandeAutorisationCode(soccod: string) {
    const response = await this.client.get(`/DemandeAutorisations/get-next-concod/${soccod}`);
    return response.data as { concod?: string };
  }

  async getDemandeAutorisationsByEmp(soccod: string, empcod: string) {
    const response = await this.client.get(`/DemandeAutorisations/get-by-employe/${soccod}/${empcod}`);
    return response.data;
  }

  async createDemandeAutorisation(demande: any) {
    const response = await this.client.post('/DemandeAutorisations', demande);
    return response.data;
  }

  async updateDemandeAutorisation(demande: any) {
    const response = await this.client.put('/DemandeAutorisations', demande);
    return response.data;
  }

  async deleteDemandeAutorisation(id: number) {
    const response = await this.client.delete(`/DemandeAutorisations/${id}`);
    return response.data;
  }

  async approveDemandeAutorisation(id: number, traitePar: string, commentaire?: string) {
    const response = await this.client.post(`/DemandeAutorisations/approve/${id}`, { traitePar, commentaire });
    return response.data;
  }

  async refuseDemandeAutorisation(id: number, traitePar: string, commentaire?: string) {
    const response = await this.client.post(`/DemandeAutorisations/refuse/${id}`, { traitePar, commentaire });
    return response.data;
  }

  // Types de congé (parmi les absences). Mêmes données que le web (useGetCongeAbsenceLibs).
  async getCongeAbsenceLibs(soccod: string) {
    const response = await this.client.get(`/Absences/get-conge-libs/${soccod}`);
    return response.data;
  }

  // Variante enrichie : renvoie [{abscod, abslib, abscng}] pour permettre au
  // formulaire de demande de cacher les types RTT (abscng='R') aux employés
  // non éligibles. Fallback transparent sur l'ancien endpoint si 404 (vieux backend).
  async getCongeAbsenceLibsDetailed(soccod: string) {
    try {
      const response = await this.client.get(`/Absences/get-conge-libs-detailed/${soccod}`);
      return response.data;
    } catch (e: any) {
      if (e?.response?.status === 404) {
        return this.getCongeAbsenceLibs(soccod);
      }
      throw e;
    }
  }

  // Types d'autorisation de sortie. Mêmes données que le web (useGetAutorisationLibs).
  async getAutorisationLibs(soccod: string) {
    const response = await this.client.get(`/Absences/get-autorisations-libs/${soccod}`);
    return response.data;
  }

  async getAbsencesBySoc(soccod: string) {
    const response = await this.client.get(`/Absences/get-libs/${soccod}`);
    return response.data;
  }

  // Vault endpoints
  async getVaultDocuments(soccod: string, empcod: string) {
    const response = await this.client.get(`/Vault/${soccod}/${empcod}`);
    return response.data;
  }

  async uploadVaultDocument(fileUri: string, soccod: string, empcod: string, docType: string) {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'document.pdf';
    const ext = filename.split('.').pop()?.toLowerCase() || 'pdf';
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', doc: 'application/ms-word', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    formData.append('file', {
      uri: fileUri,
      type: mimeTypes[ext] || 'application/octet-stream',
      name: filename,
    } as any);
    formData.append('soccod', soccod);
    formData.append('empcod', empcod);
    formData.append('docType', docType);

    const response = await this.client.post('/Vault/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  }

  async signVaultDocument(id: number, signatureData: string, signerName: string) {
    const response = await this.client.post(`/Vault/sign/${id}`, {
      signatureData,
      signerName,
    });
    return response.data;
  }

  // ── Workflow de signature électronique (Phase 4) ──────────────────────────
  // Mappe api/Signatures/* (multi-étapes, OTP, scellement). Utilisé par
  // SignatureScreen quand on arrive via un deep-link push (requestId + stepId).
  async getSignatureInbox() {
    const response = await this.client.get(`/Signatures/inbox`);
    return response.data ?? [];
  }

  async getSignatureRequest(requestId: number) {
    const response = await this.client.get(`/Signatures/${requestId}`);
    return response.data;
  }

  /** Envoie un OTP e-mail au signataire de l'étape courante. Renvoie l'e-mail masqué. */
  async sendSignatureOtp(requestId: number, stepId: number) {
    const response = await this.client.post(`/Signatures/${requestId}/steps/${stepId}/otp`, {});
    return response.data;
  }

  async signSignatureStep(
    requestId: number,
    stepId: number,
    body: { signatureData: string; signerName?: string; mention?: string; location?: string; otpCode?: string; otpMethod?: 'email' | 'totp' },
  ) {
    const response = await this.client.post(`/Signatures/${requestId}/steps/${stepId}/sign`, body);
    return response.data;
  }

  async rejectSignatureStep(requestId: number, stepId: number, motif: string) {
    const response = await this.client.post(`/Signatures/${requestId}/steps/${stepId}/reject`, { motif });
    return response.data;
  }

  async deleteVaultDocument(id: number) {
    const response = await this.client.delete(`/Vault/${id}`);
    return response.data;
  }

  // ── Missions ─────────────────────────────────────────────────────────────
  // Endpoints calqués sur /api/Missions côté serveur (cf. MissionsController.cs).
  // Une mission = ordre de mission (déplacement, formation, événement client),
  // toujours rattachée à une nature d'absence Abscng="6" (Formation et mission).
  async getMissionsByEmp(soccod: string, empcod: string) {
    const response = await this.client.get(`/Missions/by-emp/${soccod}/${empcod}`);
    return response.data;
  }
  async getMissionsBySoc(soccod: string) {
    const response = await this.client.get(`/Missions/by-soc/${soccod}`);
    return response.data;
  }
  async getMissionNatures(soccod: string) {
    const response = await this.client.get(`/Missions/natures-formation-mission/${soccod}`);
    return response.data;
  }
  async createMission(data: {
    soccod: string; empcod: string; misobj: string; misdest?: string | null;
    misdatedeb: string; misdatefin: string; misnote?: string | null;
    misetat?: string; misbudget?: number | null; misdevise?: string | null; abscod: string;
  }) {
    const response = await this.client.post('/Missions', data);
    return response.data;
  }
  async updateMissionState(id: number, data: {
    soccod: string; empcod: string; misobj: string; misdest?: string | null;
    misdatedeb: string; misdatefin: string; misnote?: string | null;
    misetat: string; misbudget?: number | null; misdevise?: string | null; abscod: string;
  }) {
    const response = await this.client.put(`/Missions/${id}`, data);
    return response.data;
  }
  // Self-service employé : modifier SA mission encore « Pending » (le serveur force
  // le maintien de l'état Pending et refuse l'édition d'une mission déjà traitée).
  async updateMission(id: number, data: {
    soccod: string; empcod: string; misobj: string; misdest?: string | null;
    misdatedeb: string; misdatefin: string; misnote?: string | null;
    misetat?: string; misbudget?: number | null; misdevise?: string | null; abscod: string;
  }) {
    const response = await this.client.put(`/Missions/${id}`, data);
    return response.data;
  }
  // Self-service employé : supprimer SA mission encore « Pending ».
  async deleteMission(id: number) {
    const response = await this.client.delete(`/Missions/${id}`);
    return response.data;
  }

  // ── Manager dashboard summary ────────────────────────────────────────────
  // Endpoint léger qui renvoie en un seul appel les compteurs « actions à faire »
  // pour un manager : validations en attente, contrats expirant, absences du jour.
  // Scopé par les sites accessibles à l'utilisateur (table Socuser) — un manager
  // d'un site ne voit pas les compteurs des autres sites.
  async getManagerSummary(soccod: string, uticod: string) {
    const response = await this.client.get(`/ManagerDashboard/summary/${soccod}/${uticod}`);
    return response.data as {
      pendingLeaves: number;
      pendingAuth: number;
      pendingExpenses: number;
      pendingMissions: number;
      pendingTotal: number;
      contractsExpiring: number;
      absentToday: number;
    };
  }

  // Employee horaires (admin / manager — exige le droit "Gestion Employés")
  async getEmpHoraires(soccod: string, empcod: string) {
    const response = await this.client.get(`/Employes/get-emp-horaires/${soccod}/${empcod}`);
    return response.data;
  }

  // Self-service : l'employé consulte SES propres horaires sans permission spéciale
  async getMyHoraires(soccod: string, empcod: string) {
    const response = await this.client.get(`/Employes/get-my-horaires/${soccod}/${empcod}`);
    return response.data as Array<{
      soccod: string; empcod: string;
      codposte?: string | null; libposte?: string | null;
      lunhdmat?: string | null; lunhfmat?: string | null; lunhdam?: string | null; lunhfam?: string | null; lunrepos?: string | null;
      marhdmat?: string | null; marhfmat?: string | null; marhdam?: string | null; marhfam?: string | null; marrepos?: string | null;
      merhdmat?: string | null; merhfmat?: string | null; merhdam?: string | null; merhfam?: string | null; merrepos?: string | null;
      jeuhdmat?: string | null; jeuhfmat?: string | null; jeuhdam?: string | null; jeuhfam?: string | null; jeurepos?: string | null;
      venhdmat?: string | null; venhfmat?: string | null; venhdam?: string | null; venhfam?: string | null; venrepos?: string | null;
      samhdmat?: string | null; samhfmat?: string | null; samhdam?: string | null; samhfam?: string | null; samrepos?: string | null;
      dimhdmat?: string | null; dimhfmat?: string | null; dimhdam?: string | null; dimhfam?: string | null; dimrepos?: string | null;
      avantEnt?: number | null; avantSort?: number | null;
    }>;
  }

  // Admin daily pointage - uses dedicated endpoint with absence detection
  async getDailyPointage(soccod: string, date: string) {
    const response = await this.client.get(
      `/Presences/daily-pointage/${soccod}/${date}`
    );
    return response.data;
  }

  // Employee private presence history
  async getMyPresenceHistory(soccod: string, empcod: string, dateDebut: string, dateFin: string) {
    const response = await this.client.get(
      `/Presences/my-history/${soccod}/${empcod}/${dateDebut}/${dateFin}`
    );
    return response.data;
  }

  // Entry reminder for employee
  async getEntryReminder(soccod: string, empcod: string) {
    const response = await this.client.get(
      `/Presences/entry-reminder/${soccod}/${empcod}`
    );
    return response.data;
  }

  // Notifications
  async getNotifications(soccod: string, uticod: string) {
    try {
      const response = await this.client.get(`/DemConges/get-demconge/${soccod}/${uticod}`);
      return response.data;
    } catch {
      return [];
    }
  }

  // Holidays (jours fériés) — liste à partir d'aujourd'hui jusqu'à la fin de l'année visée
  async getUpcomingHolidays(soccod: string, year?: number) {
    const params = year ? { year } : undefined;
    const response = await this.client.get(`/Feriers/upcoming/${soccod}`, { params });
    return response.data as Array<{
      annee?: string | null;
      soccod?: string | null;
      ferdate?: string | null;
      fermotif?: string | null;
      ferfixe?: string | null;
      fertype?: string | null;
      ferheure?: number | null;
      fernpaye?: string | null;
      fertrv?: string | null;
    }>;
  }

  // Societies
  async getSocieties() {
    const response = await this.client.get('/Societes');
    return response.data;
  }

  // Reference data
  async getFonctions() {
    const response = await this.client.get('/Fonctions');
    return response.data;
  }

  async getQualifications() {
    const response = await this.client.get('/Qualifs');
    return response.data;
  }

  async getDirections() {
    const response = await this.client.get('/Directions');
    return response.data;
  }

  async getServices() {
    const response = await this.client.get('/Services');
    return response.data;
  }

  async getSections() {
    const response = await this.client.get('/Sections');
    return response.data;
  }

  async getVilles() {
    const response = await this.client.get('/Villes');
    return response.data;
  }

  async getPays() {
    const response = await this.client.get('/Pays');
    return response.data;
  }

  // RAG (Assistant RH) — chat sur les documents juridiques du tenant.
  // Le backend masque les PII (CIN) avant d'envoyer au LLM et journalise dans rag_chat_log.
  async askRag(question: string, topK = 5) {
    const response = await this.client.post('/ChatRag/ask', { question, topK }, {
      timeout: 60000,
    });
    return response.data as {
      logId: number;
      answer: string;
      sources: Array<{
        documentId: number;
        documentName: string;
        page?: number | null;
        snippet: string;
        score: number;
      }>;
      tokensIn?: number | null;
      tokensOut?: number | null;
      latencyMs: number;
    };
  }

  async sendRagFeedback(logId: number, score: number, comment?: string) {
    const response = await this.client.post(`/ChatRag/${logId}/feedback`, { score, comment });
    return response.data;
  }

  async ragHealth() {
    const response = await this.client.get('/Rag/health');
    return response.data as {
      ok: boolean;
      enabled: boolean;
      sidecar: boolean;
      provider: string;
      llmConfigured: boolean;
      model: string;
    };
  }
}

export const apiService = new ApiService();
export default apiService;
