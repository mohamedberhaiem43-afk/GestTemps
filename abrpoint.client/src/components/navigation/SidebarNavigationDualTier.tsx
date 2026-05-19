import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Home,
  LayoutGrid,
  Users,
  User,
  CheckSquare,
  PieChart,
  LifeBuoy,
  Settings,
  // App-specific
  Database,
  Building2,
  MapPin,
  Globe,
  Briefcase,
  Award,
  BookOpen,
  Fingerprint,
  MonitorDot,
  Activity,
  Badge,
  FileText,
  RefreshCw,
  Baby,
  CalendarDays,
  CalendarX,
  Timer,
  Gavel,
  Shield,
  Eye,
  CalendarClock,
  Wallet,
  CalendarCheck,
  Banknote,
  Receipt,
  BarChart,
  Clock3,
  ClipboardList,
  CalendarMinus,
  Notebook,
  CircleUser,
  KeyRound,
  MessageSquare,
  SlidersHorizontal,
  Map,
  Flag,
  Network,
  AlarmClock,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Drawer, IconButton } from '@mui/material';

/* ─────────────────────────────────────────────────────── */
/* Types                                                    */
/* ─────────────────────────────────────────────────────── */
export type NavLeaf = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};

export type NavGroup = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  items?: NavLeaf[];
};

export type FooterItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  onClick?: () => void;
};

export type SidebarNavigationDualTierProps = {
  items: NavGroup[];
  footerItems?: FooterItem[];
  featureCard?: React.ReactNode;
  pathname: string;
  onNavigate: (href: string) => void;
  title?: string;
  logo?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  isAdmin?: boolean;
  children: React.ReactNode;
};

/* ─────────────────────────────────────────────────────── */
/* Helpers                                                 */
/* ─────────────────────────────────────────────────────── */
const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const hasDescendant = (item: NavGroup, pathname: string): boolean => {
  if (isActive(pathname, item.href)) return true;
  return (item.items ?? []).some((child) => isActive(pathname, child.href));
};

/* ─────────────────────────────────────────────────────── */
/* SecondaryPanel                                          */
/* ─────────────────────────────────────────────────────── */
function SecondaryPanel({
  activePrimary,
  pathname,
  onNavigate,
  featureCard,
}: {
  activePrimary: NavGroup | undefined;
  pathname: string;
  onNavigate: (href: string) => void;
  featureCard?: React.ReactNode;
}) {
  if (!activePrimary) return null;

  const children = activePrimary.items ?? [];

  return (
    // key={activePrimary.href} : force React à remonter le panel quand l'utilisateur
    // change de section principale, ce qui re-déclenche l'animation `sndt-slide-in-left`.
    <div className="sndt-secondary" key={activePrimary.href}>
      <div className="sndt-secondary-header">
        <span className="sndt-secondary-title">{activePrimary.label}</span>
      </div>
      <div className="sndt-secondary-scroll">
        <nav className="sndt-secondary-nav">
          {children.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <button
                key={item.href}
                className={`sndt-sec-item${active ? ' sndt-sec-item--active' : ''}`}
                onClick={() => onNavigate(item.href)}
                // Stagger : chaque item entre 30 ms après le précédent. Borné à
                // 12 items pour éviter qu'une section longue ne donne 1 s d'attente.
                style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
              >
                <Icon size={24} />
                <span className="sndt-sec-label">{item.label}</span>
                {!!item.badge && (
                  <span className="sndt-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
        {featureCard && <div className="sndt-feature-card">{featureCard}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────── */
/* Main Component                                          */
/* ─────────────────────────────────────────────────────── */
export default function SidebarNavigationDualTier({
  items,
  footerItems = [],
  featureCard,
  pathname,
  onNavigate,
  title,
  logo,
  toolbarActions,
  isAdmin,
  children,
}: SidebarNavigationDualTierProps) {
  const { t } = useTranslation();
  const [activePrimaryHref, setActivePrimaryHref] = React.useState<string>(() => {
    const matched = items.find((node) => hasDescendant(node, pathname));
    return matched?.href ?? items[0]?.href ?? '/dashboard';
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    // Auto-close mobile drawer on route change
    setMobileDrawerOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    // Only update the active group if the new path belongs to a group WITH sub-items
    // This keeps the secondary panel stable on leaf routes
    const matched = items.find((node) => hasDescendant(node, pathname) && (node.items?.length ?? 0) > 0);
    if (matched) setActivePrimaryHref(matched.href);
  }, [items, pathname]);

  const activePrimary = items.find((n) => n.href === activePrimaryHref) ?? items[0];
  const hasSecondary = (activePrimary?.items?.length ?? 0) > 0;

  return (
    <>
      <style>{styles}</style>
      <div className="sndt-root">
        {/* ── Icon Rail (primary) ── */}
        <aside className="sndt-rail">
          {/* Le logo société est désormais affiché dans la topbar à côté du nom
              de la société (cf. .sndt-topbar). Le rail commence directement par
              les items de navigation pour une utilisation verticale plus dense. */}

          {/* Primary items */}
          <nav className="sndt-rail-nav">
            {items.map((node, index) => {
              const Icon = node.icon;
              const active = activePrimaryHref === node.href;
              return (
                <button
                  key={node.href}
                  title={node.label}
                  className={`sndt-rail-item${active ? ' sndt-rail-item--active' : ''}`}
                  // Cascade au mount initial : 25 ms par item, plafonné à 12 pour
                  // que le rail "déroule" visuellement de haut en bas.
                  style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                  onClick={() => {
                    setActivePrimaryHref(node.href);
                    if (!node.items?.length) {
                      onNavigate(node.href);
                    }
                  }}
                >
                  <Icon size={30} />
                  {!!node.badge && (
                    <span className="sndt-rail-badge">{node.badge}</span>
                  )}
                  <span className="sndt-rail-label">{node.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer items */}
          {footerItems.length > 0 && (
            <div className="sndt-rail-footer">
              {footerItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <button
                    key={item.href}
                    title={item.label}
                    className={`sndt-rail-item${active ? ' sndt-rail-item--active' : ''}`}
                    onClick={() => {
                      if (item.onClick) item.onClick();
                      else onNavigate(item.href);
                    }}
                  >
                    <Icon size={28} />
                    <span className="sndt-rail-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* ── Secondary panel ── */}
        {hasSecondary && (
          <SecondaryPanel
            activePrimary={activePrimary}
            pathname={pathname}
            onNavigate={onNavigate}
            featureCard={featureCard}
          />
        )}

        {/* ── Main content area ── */}
        <div className="sndt-main">
          {/* Top bar */}
          <header className="sndt-topbar">
            {/* flex: 1 + min-width: 0 + overflow: hidden : sans ces 3 contraintes,
                text-overflow: ellipsis sur .sndt-topbar-title ne s'applique pas car
                le parent flex grandit à la taille du contenu. Avec un soclib long
                ("Société Internationale de Maintenance Industrielle"), la barre
                débordait et masquait les actions à droite. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <div className="sndt-mobile-menu-trigger">
                <IconButton
                  size="small"
                  onClick={() => setMobileDrawerOpen(true)}
                  sx={{ color: '#0040a1' }}
                >
                  <Menu size={24} />
                </IconButton>
              </div>
              {/* Logo société uniquement (sans nom du tenant). Le nom de société
                  affiché en topbar a été retiré sur demande produit — l'identité
                  visuelle passe désormais 100% par le logo. */}
              <span className="sndt-topbar-logo" aria-hidden>
                {logo ?? <LayoutGrid size={22} color="#0040a1" />}
              </span>
            </div>
            <div className="sndt-topbar-actions">{toolbarActions}</div>
          </header>
          {/* Page content */}
          <main className="sndt-content">{children}</main>

          {/* Mobile Bottom Navigation */}
          <nav className="sndt-mobile-bottom-nav">
            <button
              onClick={() => onNavigate('/dashboard')}
              className={`sndt-nav-btn${pathname === '/dashboard' ? ' sndt-nav-btn--active' : ''}`}
            >
              <Home size={20} />
              <span>Tableau de bord</span>
            </button>
            <button
              onClick={() => onNavigate('/dashboard/demande-autorisation')}
              className={`sndt-nav-btn${pathname === '/dashboard/demande-autorisation' ? ' sndt-nav-btn--active' : ''}`}
            >
              <Timer size={20} />
              <span>Autorisation</span>
            </button>
            <button
              onClick={() => onNavigate('/dashboard/gestion-de-conge')}
              className={`sndt-nav-btn${pathname === '/dashboard/gestion-de-conge' ? ' sndt-nav-btn--active' : ''}`}
            >
              <CalendarX size={20} />
              <span>Demandes</span>
            </button>
            {isAdmin ? (
              <button
                onClick={() => onNavigate('/dashboard/etat-periodique')}
                className={`sndt-nav-btn${pathname === '/dashboard/etat-periodique' ? ' sndt-nav-btn--active' : ''}`}
              >
                <Activity size={20} />
                <span>{t('i18nFix.sidebarLegacy.etatPeriodique')}</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate('/dashboard/gestion-de-solde')}
                className={`sndt-nav-btn${pathname === '/dashboard/gestion-de-solde' ? ' sndt-nav-btn--active' : ''}`}
              >
                <PieChart size={20} />
                <span>Solde</span>
              </button>
            )}
          </nav>
        </div>

        {/* ── Unified Mobile Dual-Tier Drawer ── */}
        <Drawer
          anchor="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          PaperProps={{
            sx: {
              width: '100%',
              maxWidth: 320,
              display: 'flex',
              flexDirection: 'row',
              overflow: 'hidden',
              borderRight: 'none',
              background: '#fff'
            }
          }}
        >
          {/* Left Rail Part */}
          <div className="sndt-mobile-drawer-rail">
            <IconButton
              size="small"
              onClick={() => setMobileDrawerOpen(false)}
              sx={{ mb: 4, mt: 1, color: '#64748b' }}
            >
              <X size={24} />
            </IconButton>

            {items.map((node) => {
              const Icon = node.icon;
              const active = activePrimaryHref === node.href;
              return (
                <button
                  key={node.href}
                  className={`sndt-mobile-rail-btn${active ? ' sndt-mobile-rail-btn--active' : ''}`}
                  onClick={() => {
                    setActivePrimaryHref(node.href);
                    if (!node.items?.length) {
                      onNavigate(node.href);
                      setMobileDrawerOpen(false);
                    }
                  }}
                >
                  <Icon size={32} />
                </button>
              );
            })}
          </div>

          {/* Right Secondary Part */}
          <div className="sndt-mobile-drawer-content">
            {activePrimary && (
              <SecondaryPanel
                activePrimary={activePrimary}
                pathname={pathname}
                onNavigate={(h) => {
                  onNavigate(h);
                  setMobileDrawerOpen(false);
                }}
                featureCard={featureCard}
              />
            )}
          </div>
        </Drawer>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────── */
/* App nav items (matching actual routes)                  */
/* ─────────────────────────────────────────────────────── */
export {
  Home,
  LayoutGrid,
  Database,
  Building2,
  Network,
  Flag,
  Map,
  MapPin,
  Globe,
  Briefcase,
  Award,
  BookOpen,
  Fingerprint,
  MonitorDot,
  Activity,
  Badge,
  FileText,
  RefreshCw,
  Baby,
  CalendarDays,
  CalendarX,
  Timer,
  Gavel,
  Shield,
  Eye,
  CalendarClock,
  Wallet,
  CalendarCheck,
  Banknote,
  Receipt,
  BarChart,
  Clock3,
  ClipboardList,
  CalendarMinus,
  Notebook,
  CircleUser,
  KeyRound,
  MessageSquare,
  SlidersHorizontal,
  Users,
  Settings,
  LifeBuoy,
  CheckSquare,
  PieChart,
  AlarmClock,
  User,
};

/* ─────────────────────────────────────────────────────── */
/* CSS-in-JS styles                                        */
/* ─────────────────────────────────────────────────────── */
const styles = `
/* ── Animations (keyframes) ──
   Toutes les animations respectent prefers-reduced-motion : dans ce mode système,
   on désactive transitions et keyframes pour préserver l'accessibilité. */
@keyframes sndt-fade-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sndt-slide-in-left {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes sndt-pop-in {
  0%   { opacity: 0; transform: scale(0.85); }
  60%  { opacity: 1; transform: scale(1.04); }
  100% { transform: scale(1); }
}
@keyframes sndt-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Easing partagé : cubic-bezier "out-quart" donne un mouvement naturel,
   accélération initiale puis decélération douce. Plus agréable que "ease". */
.sndt-root { --sndt-ease: cubic-bezier(0.22, 1, 0.36, 1); }

/* ── Root layout ── */
.sndt-root {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #f8fafc;
  font-family: 'Inter', 'Manrope', system-ui, sans-serif;
}

/* ── Icon Rail ── */
.sndt-rail {
  width: 72px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 12px 0;
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  z-index: 50;
  box-shadow: 1px 0 4px rgba(15,23,42,0.04);
}

.sndt-rail-logo {
  width: 72px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.sndt-rail-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 6px;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
}

.sndt-rail-nav::-webkit-scrollbar { width: 0; }

.sndt-rail-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 6px;
  width: 100%;
  border-top: 1px solid #f1f5f9;
}

@media (max-width: 768px) {
  .sndt-rail-footer {
    padding-bottom: 72px;
  }
}

.sndt-rail-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 60px;
  min-height: 50px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  /* Transitions plus complètes : ajoute transform pour le micro-zoom au hover
     + box-shadow pour le subtil glow sur active. */
  transition: background 0.18s var(--sndt-ease),
              color 0.18s var(--sndt-ease),
              transform 0.18s var(--sndt-ease),
              box-shadow 0.25s var(--sndt-ease);
  padding: 6px 4px;
  /* Entrée en cascade au montage du rail (cf. delay calculé inline). */
  animation: sndt-fade-up 0.35s var(--sndt-ease) both;
}

.sndt-rail-item:hover {
  background: #f1f5f9;
  color: #1e293b;
  transform: translateY(-1px) scale(1.04);
}

.sndt-rail-item:active {
  transform: translateY(0) scale(0.97);
  transition-duration: 0.08s;
}

.sndt-rail-item--active {
  background: #eff6ff;
  color: #0040a1;
  box-shadow: 0 4px 12px -4px rgba(0, 64, 161, 0.25);
}

/* Indicateur vertical animé à gauche de l'item actif. Sa hauteur grandit avec
   un easing élastique pour donner une impression de "se verrouiller" sur l'item. */
.sndt-rail-item--active::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 50%;
  width: 3px;
  height: 24px;
  background: linear-gradient(180deg, #0056d2 0%, #0040a1 100%);
  border-radius: 0 4px 4px 0;
  transform: translateY(-50%);
  animation: sndt-pop-in 0.3s var(--sndt-ease) both;
}

.sndt-rail-label {
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
  max-width: 58px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sndt-rail-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: #ef4444;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  border-radius: 99px;
  padding: 1px 4px;
  line-height: 1.4;
  /* Pop-in à l'apparition : signale visuellement les nouvelles notifications. */
  animation: sndt-pop-in 0.4s var(--sndt-ease) both;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.35);
}

/* ── Secondary panel ── */
.sndt-secondary {
  width: 240px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 72px;
  height: 100vh;
  z-index: 40;
  /* Animation d'entrée à chaque mount/changement de section. Le déplacement
     part de -12px à gauche pour donner l'impression que le panel "pousse"
     à partir du rail. */
  animation: sndt-slide-in-left 0.32s var(--sndt-ease) both;
}

/* Fix for mobile drawer */
.MuiDrawer-root .sndt-secondary {
  position: static;
  width: 100%;
  height: 100%;
  border-right: none;
  display: flex !important;
}

@media (max-width: 768px) {
  .sndt-root > .sndt-secondary { display: none; }
}

.sndt-secondary-header {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.sndt-secondary-title {
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.sndt-secondary-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 8px 12px;
}

.sndt-secondary-scroll::-webkit-scrollbar { width: 3px; }
.sndt-secondary-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
.sndt-secondary-scroll::-webkit-scrollbar-track { background: transparent; }

.sndt-secondary-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sndt-sec-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.18s var(--sndt-ease),
              color 0.18s var(--sndt-ease),
              transform 0.15s var(--sndt-ease),
              padding-left 0.18s var(--sndt-ease);
  text-align: left;
  /* Entrée en cascade quand le panel secondaire change (cf. delay inline). */
  animation: sndt-slide-in-left 0.32s var(--sndt-ease) both;
}

.sndt-sec-item:hover {
  background: #f1f5f9;
  color: #1e293b;
  /* Micro-shift à droite : signale clairement la zone cliquable + crée du
     mouvement perceptible sans pousser le contenu adjacent (largeur stable). */
  padding-left: 16px;
}

.sndt-sec-item:active {
  transform: scale(0.985);
  transition-duration: 0.08s;
}

.sndt-sec-item--active {
  background: #eff6ff;
  color: #0040a1;
  font-weight: 600;
  padding-left: 18px;
}

/* Indicateur gauche animé sur item actif (mêmes principes que le rail). */
.sndt-sec-item--active::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 50%;
  width: 3px;
  height: 18px;
  background: #0040a1;
  border-radius: 99px;
  transform: translateY(-50%);
  animation: sndt-pop-in 0.28s var(--sndt-ease) both;
}

/* Icône intérieure : léger pivot/scale au hover du parent — pas trop
   pour ne pas distraire de la lecture. */
.sndt-sec-item svg,
.sndt-rail-item svg {
  transition: transform 0.2s var(--sndt-ease);
}
.sndt-sec-item:hover svg {
  transform: scale(1.08) rotate(-3deg);
}
.sndt-rail-item:hover svg {
  transform: scale(1.1);
}

.sndt-sec-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sndt-badge {
  flex-shrink: 0;
  background: #dbeafe;
  color: #1e40af;
  font-size: 10px;
  font-weight: 700;
  border-radius: 99px;
  padding: 1px 6px;
  animation: sndt-pop-in 0.32s var(--sndt-ease) both;
}

.sndt-feature-card {
  margin-top: 12px;
}

/* ── Main content ── */
.sndt-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  /* offset for rail + secondary */
  margin-left: 312px;
  height: 100vh;
  overflow: hidden;
}

/* When no secondary panel (leaf route) */
.sndt-root:not(:has(.sndt-secondary)) .sndt-main {
  margin-left: 72px;
}

@media (max-width: 768px) {
  .sndt-main, .sndt-root:not(:has(.sndt-secondary)) .sndt-main {
    margin-left: 0 !important;
  }
  .sndt-root > .sndt-rail {
    display: none;
  }
}

.sndt-mobile-drawer-rail {
  width: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  background: #fff;
  border-right: 1px solid #f1f5f9;
}

.sndt-mobile-rail-btn {
  width: 58px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1.5px solid transparent;
  background: transparent;
  color: #64748b;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.sndt-mobile-rail-btn--active {
  border-color: #000;
  color: #0040a1;
  background: #fff;
}

.sndt-mobile-drawer-content {
  flex: 1;
  background: #fff;
  overflow-y: auto;
}

/* ── Top bar ── */
.sndt-topbar {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 20px;
  border-bottom: 1px solid #e2e8f0;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  position: sticky;
  top: 0;
  z-index: 30;
  flex-shrink: 0;
  min-width: 0;
}

@media (max-width: 768px) {
  .sndt-topbar { padding: 0 12px; gap: 6px; }
  .sndt-topbar-title { font-size: 13px; }
}
@media (max-width: 480px) {
  .sndt-topbar-title { font-size: 12px; }
}

/* ── Mobile Bottom Nav ── */
.sndt-mobile-bottom-nav {
  display: none;
  position: fixed;
  bottom: -8px;
  left: 0;
  width: 100%;
  height: 62px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid #e2e8f0;
  justify-content: space-around;
  align-items: center;
  padding: 0 12px 12px;
  z-index: 100;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.04);
}

@media (max-width: 768px) {
  .sndt-mobile-bottom-nav {
    display: flex;
  }
  .sndt-content {
    padding-bottom: 64px;
  }
}

.sndt-nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  padding: 8px 12px;
  border-radius: 12px;
}

.sndt-nav-btn--active {
  color: #0040a1;
  background: rgba(0, 64, 161, 0.05);
}

.sndt-nav-btn--active svg {
  fill: rgba(0, 64, 161, 0.1);
}

.sndt-mobile-menu-trigger {
  display: none;
}

@media (max-width: 768px) {
  .sndt-mobile-menu-trigger {
    display: block;
  }
}

.sndt-topbar-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}
.sndt-topbar-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.sndt-topbar-title {
  font-size: 14px;
  font-weight: 800;
  color: #1e293b;
  letter-spacing: -0.02em;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sndt-topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: nowrap;
}

/* ── Page content ── */
.sndt-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
`
