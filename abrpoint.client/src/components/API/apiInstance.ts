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

// Coalesce concurrent refresh attempts : sans ça, plusieurs requêtes parallèles qui 401
// déclenchent N appels /refresh simultanés, chacun révoque le token précédent → boucle infinie.
let refreshInFlight: Promise<unknown> | null = null;

apiInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const url: string = originalRequest?.url ?? '';

        // Ne jamais tenter de refresh suite à un échec sur /refresh lui-même (sinon boucle).
        const isRefreshCall = url.includes('/Utilisateurs/refresh');

        if (error.response?.status === 401 && !originalRequest._retry && !isRefreshCall) {
            originalRequest._retry = true;

            try {
                if (!refreshInFlight) {
                    refreshInFlight = axios.post(
                        `${import.meta.env.VITE_REACT_APP_API_URL}/Utilisateurs/refresh`,
                        {},
                        { withCredentials: true }
                    ).finally(() => { refreshInFlight = null; });
                }
                await refreshInFlight;
                return apiInstance(originalRequest);
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                return Promise.reject(refreshError);
            }
        }

        // 402 plan_feature_locked : feature non incluse dans le plan du tenant.
        // On redirige vers la page Upgrade avec le contexte (quelle feature, depuis où),
        // sauf si l'utilisateur est déjà sur la page upgrade ou pricing (évite boucle).
        if (error.response?.status === 402
            && error.response?.data?.code === 'plan_feature_locked'
            && !window.location.pathname.startsWith('/upgrade')
            && !window.location.pathname.startsWith('/pricing')) {
            const data = error.response.data;
            const params = new URLSearchParams({
                feature: data.feature ?? '',
                currentPlan: data.currentPlan ?? '',
                from: window.location.pathname,
            });
            // Hard redirect : on contourne react-router pour que la page Upgrade reçoive
            // immédiatement le state via URL params, même si l'appel API vient d'un endroit
            // hors d'une route React active (hooks, services).
            window.location.href = `/upgrade?${params.toString()}`;
        }

        return Promise.reject(error);
    }
);

export default apiInstance;

