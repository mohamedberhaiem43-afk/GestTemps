import * as React from 'react';
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
    <div className="sndt-secondary">
      <div className="sndt-secondary-header">
        <span className="sndt-secondary-title">{activePrimary.label}</span>
      </div>
      <div className="sndt-secondary-scroll">
        <nav className="sndt-secondary-nav">
          {children.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <button
                key={item.href}
                className={`sndt-sec-item${active ? ' sndt-sec-item--active' : ''}`}
                onClick={() => onNavigate(item.href)}
              >
                <Icon size={16} />
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
  children,
}: SidebarNavigationDualTierProps) {
  const [activePrimaryHref, setActivePrimaryHref] = React.useState<string>(() => {
    const matched = items.find((node) => hasDescendant(node, pathname));
    return matched?.href ?? items[0]?.href ?? '/dashboard';
  });
  const [mobileSecondaryOpen, setMobileSecondaryOpen] = React.useState(false);

  React.useEffect(() => {
    // Auto-close mobile drawer on route change
    setMobileSecondaryOpen(false);
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
          {/* Logo */}
          <div className="sndt-rail-logo">
            {logo ?? <LayoutGrid size={22} color="#0040a1" />}
          </div>

          {/* Primary items */}
          <nav className="sndt-rail-nav">
            {items.map((node) => {
              const Icon = node.icon;
              const active = activePrimaryHref === node.href;
              return (
                <button
                  key={node.href}
                  title={node.label}
                  className={`sndt-rail-item${active ? ' sndt-rail-item--active' : ''}`}
                  onClick={() => {
                    setActivePrimaryHref(node.href);
                    if (!node.items?.length) onNavigate(node.href);
                  }}
                >
                  <Icon size={20} />
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
                    <Icon size={20} />
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sndt-mobile-menu-trigger">
                <IconButton 
                  size="small" 
                  onClick={() => setMobileSecondaryOpen(true)}
                  sx={{ color: '#0040a1' }}
                >
                  <Menu size={20} />
                </IconButton>
              </div>
              <span className="sndt-topbar-title">{title}</span>
            </div>
            <div className="sndt-topbar-actions">{toolbarActions}</div>
          </header>
          {/* Page content */}
          <main className="sndt-content">{children}</main>
        </div>

        {/* ── Mobile Drawer ── */}
        <Drawer
          anchor="left"
          open={mobileSecondaryOpen}
          onClose={() => setMobileSecondaryOpen(false)}
          PaperProps={{
            sx: {
              width: 280,
              display: 'flex',
              flexDirection: 'row',
              overflow: 'hidden',
              borderRight: 'none',
            }
          }}
        >
          <div style={{ width: 72, background: '#fff', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0' }}>
             <IconButton size="small" onClick={() => setMobileSecondaryOpen(false)} sx={{ mb: 2 }}>
               <X size={20} />
             </IconButton>
             {items.map(node => (
               <IconButton 
                 key={node.href}
                 onClick={() => {
                   setActivePrimaryHref(node.href);
                   if (!node.items?.length) {
                     onNavigate(node.href);
                     setMobileSecondaryOpen(false);
                   }
                 }}
                 sx={{ 
                   color: activePrimaryHref === node.href ? '#0040a1' : '#64748b',
                   bgcolor: activePrimaryHref === node.href ? '#eff6ff' : 'transparent',
                   borderRadius: '10px',
                   mb: 1
                 }}
               >
                 <node.icon size={20} />
               </IconButton>
             ))}
          </div>
          <div style={{ flex: 1, background: '#fff' }}>
             {activePrimary && (
               <SecondaryPanel
                 activePrimary={activePrimary}
                 pathname={pathname}
                 onNavigate={(h) => {
                   onNavigate(h);
                   setMobileSecondaryOpen(false);
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

.sndt-rail-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 52px;
  min-height: 52px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  padding: 6px 4px;
}

.sndt-rail-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.sndt-rail-item--active {
  background: #eff6ff;
  color: #0040a1;
}

.sndt-rail-label {
  font-size: 9.5px;
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
  max-width: 56px;
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
  .sndt-root > .sndt-rail { display: none; }
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
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  text-align: left;
}

.sndt-sec-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.sndt-sec-item--active {
  background: #eff6ff;
  color: #0040a1;
  font-weight: 600;
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
}

.sndt-mobile-menu-trigger {
  display: none;
}

@media (max-width: 768px) {
  .sndt-mobile-menu-trigger {
    display: block;
  }
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
`;
