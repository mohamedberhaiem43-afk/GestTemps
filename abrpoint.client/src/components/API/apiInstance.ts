// src/api.js
import axios from 'axios';

const apiInstance = axios.create({
    baseURL: import.meta.env.VITE_REACT_APP_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true // Enable cookies to be sent automatically
});

// ─────────────────────────────────────────────────────────────────────────
// Multi-tenant : injection automatique du slug tenant dans chaque requête.
// Sources, par ordre de priorité :
//   1. localStorage('tenantSlug') — pour basculer entre tenants en local sans changer de DNS.
//   2. Sous-domaine de window.location.host (acme.concorde.com → "acme").
// Bypass : reste vide quand on est sur www / app / api / localhost simple.
// ─────────────────────────────────────────────────────────────────────────
function resolveTenantSlug(): string | null {
    const override = localStorage.getItem('tenantSlug');
    if (override && override.trim()) return override.trim().toLowerCase();

    const host = window.location.hostname.toLowerCase();
    // Ignore localhost / 127.0.0.1 / IP nu : pas de tenant déductible.
    if (host === 'localhost' || /^[\d.]+$/.test(host)) return null;

    const parts = host.split('.');
    // Exige au moins sub.domain.tld (3 niveaux) pour considérer un sous-domaine.
    if (parts.length < 3) return null;
    const sub = parts[0];
    if (['www', 'app', 'api', 'admin'].includes(sub)) return null;
    return sub;
}

apiInstance.interceptors.request.use((config) => {
    const slug = resolveTenantSlug();
    if (slug) {
        config.headers = config.headers ?? {};
        (config.headers as any)['X-Tenant-Slug'] = slug;
    }
    return config;
});

// ─────────────────────────────────────────────────────────────────────────
// FILET DE SÉCURITÉ : on patche aussi l'instance axios *globale* + tout
// `axios.create()` créé ailleurs (UtilisateurService, FilterPointageMois,
// FilterEtatPeriodique, SaisieProfile, apiClient...) pour qu'aucun appel HTTP
// ne sorte de l'app sans le header X-Tenant-Slug. Sinon le backend retombe sur
// la base legacy → mix de données entre tenants.
// ─────────────────────────────────────────────────────────────────────────
const injectTenantHeader = (config: any) => {
    const slug = resolveTenantSlug();
    if (slug) {
        config.headers = config.headers ?? {};
        config.headers['X-Tenant-Slug'] = slug;
    }
    return config;
};
axios.interceptors.request.use(injectTenantHeader);

// Wrap axios.create pour que toute future instance hérite aussi de l'interceptor.
const originalCreate = axios.create.bind(axios);
(axios as any).create = (config?: any) => {
    const inst = originalCreate(config);
    inst.interceptors.request.use(injectTenantHeader);
    return inst;
};

// Add a response interceptor to handle token refresh on 401
apiInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Attempt to refresh the token - send empty body, cookies are sent automatically
                await axios.post(
                    `${import.meta.env.VITE_REACT_APP_API_URL}/Utilisateurs/refresh`,
                    {},
                    { withCredentials: true }
                );

                // Retry the original request with new token (automatically included in cookies)
                return apiInstance(originalRequest);
            } catch (refreshError) {
                // Refresh failed - redirect to login
                console.error('Token refresh failed:', refreshError);
                window.location.href = '/';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default apiInstance;

