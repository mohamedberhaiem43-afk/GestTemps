import * as React from 'react';
import {
  Box, Dialog, InputBase, Typography, Chip, keyframes,
} from '@mui/material';
import { Search as SearchIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiInstance from '../../API/apiInstance';
import type { NavGroup } from '../../navigation/SidebarNavigationDualTier';
import { useAuth } from '../AuthProvider';

/**
 * Command Palette — invocable via Ctrl+K (Cmd+K sur Mac).
 *
 * Sources de résultats :
 *   • Pages : items du sidebar filtrés par permissions de l'utilisateur.
 *   • Employés : `/Employes/by-soc/{soccod}` (chargés une fois, gardés en
 *     mémoire pendant la session). Cliquer ouvre la fiche employé.
 *   • Demandes en attente : `/DemConges/by-soc/{soccod}` filtrées sur
 *     `etat=pending`. Cliquer navigue vers la page « Demande de congé ».
 *
 * Contrôles clavier : ↑/↓ pour bouger, Enter pour ouvrir, Esc pour fermer.
 *
 * Pourquoi c'est un gain : avant, l'utilisateur devait soit naviguer dans
 * un sidebar à 2 niveaux (peut être long quand on connaît l'item), soit
 * passer par la liste filtrée des employés. Cmd+K court-circuite tout ça
 * — c'est *le* shortcut attendu sur les apps SaaS récentes (Notion,
 * Linear, Slack, GitHub).
 */

interface Employee {
  empcod: string;
  emplib?: string;
  emppre?: string;
  empnom?: string;
  empmail?: string;
}

interface PendingLeave {
  concod: string;
  empcod: string;
  emplib?: string;
  abscod?: string;
  condep?: string;
  conret?: string;
}

type ResultKind = 'page' | 'employee' | 'leave';

interface Result {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  /** Texte normalisé (lowercase, sans accents) utilisé pour le matching. */
  searchKey: string;
}

const sectionLabels: Record<ResultKind, string> = {
  page: 'Pages',
  employee: 'Employés',
  leave: 'Demandes en attente',
};

const sectionOrder: ResultKind[] = ['page', 'employee', 'leave'];

// Normalise (lowercase + retire accents) pour un matching tolérant. Sans ça,
// "Léa" ne matche pas "lea" — le test naïf .toLowerCase() laisse les
// diacritiques en place.
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
`;

interface Props {
  open: boolean;
  onClose: () => void;
  navigation: NavGroup[];
}

export default function CommandPalette({ open, onClose, navigation }: Props) {
  const navigate = useNavigate();
  const { soccod } = useAuth();
  const [query, setQuery] = React.useState('');
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [pendingLeaves, setPendingLeaves] = React.useState<PendingLeave[]>([]);
  const [, setLoadedOnce] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  // Charge employés + demandes la première fois qu'on ouvre la palette.
  // Ne refetch pas par la suite pour rester instantané — le menu Recherche
  // n'a pas vocation à servir d'écran de référence en temps réel ; un Cmd+K
  // est suivi d'une navigation, et la page de destination sera fraîche.
  React.useEffect(() => {
    if (!open || !soccod) return;
    setLoadedOnce(prev => {
      if (prev) return prev;
      apiInstance.get(`/Employes/${soccod}`).then((res) => {
        const list: Employee[] = Array.isArray(res.data) ? res.data : [];
        setEmployees(list);
      }).catch(() => {});
      apiInstance.get(`/DemConges/by-soc/${soccod}`).then((res) => {
        const list: PendingLeave[] = (Array.isArray(res.data) ? res.data : [])
          .filter((c: any) => {
            const e = (c.etat || '').toString().toLowerCase();
            return !e.includes('accept') && !e.includes('refus') && c.conrefus !== '1';
          });
        setPendingLeaves(list);
      }).catch(() => {});
      return true;
    });
  }, [open, soccod]);

  // Reset query + curseur à chaque ouverture pour éviter de réafficher la
  // dernière recherche du user (souvent obsolète d'une session à l'autre).
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      // L'autoFocus ne suffit pas dans un Dialog quand l'animation MUI
      // est en cours — on force le focus une frame plus tard.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ── Construction de la liste de résultats ──
  const results = React.useMemo<Result[]>(() => {
    const flatNav = navigation.flatMap(g =>
      (g.items || []).map(i => ({ label: i.label, href: i.href }))
    );
    const pageResults: Result[] = flatNav.map(n => ({
      kind: 'page' as const,
      id: `page:${n.href}`,
      title: n.label,
      subtitle: n.href,
      href: n.href,
      searchKey: normalize(`${n.label} ${n.href}`),
    }));

    const empResults: Result[] = employees.map(e => {
      const fullName = e.emplib || `${e.emppre || ''} ${e.empnom || ''}`.trim() || e.empcod;
      return {
        kind: 'employee' as const,
        id: `emp:${e.empcod}`,
        title: fullName,
        subtitle: `${e.empcod}${e.empmail ? ' · ' + e.empmail : ''}`,
        href: `/dashboard/profil-employe?id=${encodeURIComponent(e.empcod)}&new=false`,
        searchKey: normalize(`${fullName} ${e.empcod} ${e.empmail || ''}`),
      };
    });

    const leaveResults: Result[] = pendingLeaves.map(l => ({
      kind: 'leave' as const,
      id: `leave:${l.concod}`,
      title: l.emplib || l.empcod,
      subtitle: `Demande #${l.concod} · en attente`,
      href: `/dashboard/dem-conge`,
      searchKey: normalize(`${l.emplib || ''} ${l.empcod} ${l.concod} congé attente`),
    }));

    const all = [...pageResults, ...empResults, ...leaveResults];
    if (!query.trim()) {
      // Sans requête : on montre les pages + 5 employés + 5 demandes
      // (suggestions par défaut, comportement Spotlight).
      return [
        ...pageResults.slice(0, 12),
        ...empResults.slice(0, 5),
        ...leaveResults.slice(0, 5),
      ];
    }
    const q = normalize(query.trim());
    const tokens = q.split(/\s+/).filter(Boolean);
    return all
      .filter(r => tokens.every(tok => r.searchKey.includes(tok)))
      .slice(0, 30);
  }, [navigation, employees, pendingLeaves, query]);

  // Regroupement par section pour l'affichage.
  const grouped = React.useMemo(() => {
    const m: Record<ResultKind, Result[]> = { page: [], employee: [], leave: [] };
    results.forEach(r => m[r.kind].push(r));
    return m;
  }, [results]);

  // Liste plate des résultats dans l'ordre d'affichage — sert à l'index actif.
  const flatOrdered = React.useMemo<Result[]>(() => {
    const acc: Result[] = [];
    sectionOrder.forEach(k => grouped[k].forEach(r => acc.push(r)));
    return acc;
  }, [grouped]);

  // Réaligne l'index quand la liste filtrée change (sinon il pointe dans le vide).
  React.useEffect(() => {
    if (activeIdx >= flatOrdered.length) setActiveIdx(0);
  }, [flatOrdered.length, activeIdx]);

  const select = (r: Result) => {
    onClose();
    navigate(r.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(flatOrdered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = flatOrdered[activeIdx];
      if (target) select(target);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scrolle l'item actif dans la vue.
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '14px',
          mt: { xs: '8vh', sm: '12vh' },
          mb: 'auto',
          overflow: 'hidden',
          animation: `${fadeIn} 180ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
        },
      }}
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
    >
      {/* ── Search input ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
        <SearchIcon size={18} color="#94a3b8" />
        <InputBase
          inputRef={inputRef}
          fullWidth
          placeholder="Rechercher pages, employés, demandes…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
          onKeyDown={handleKeyDown}
          sx={{ fontSize: '15px', fontWeight: 500 }}
        />
        <Chip label="Esc" size="small" sx={{ fontSize: '10px', height: 20, fontFamily: 'monospace', color: '#94a3b8', backgroundColor: '#f8fafc' }} />
      </Box>

      {/* ── Results ── */}
      <Box ref={listRef} sx={{ maxHeight: '52vh', overflowY: 'auto', py: 0.5 }}>
        {flatOrdered.length === 0 ? (
          <Box sx={{ px: 3, py: 6, textAlign: 'center', color: '#94a3b8' }}>
            <Typography sx={{ fontSize: 14 }}>Aucun résultat pour « {query} »</Typography>
          </Box>
        ) : (
          sectionOrder.map(kind => {
            const items = grouped[kind];
            if (items.length === 0) return null;
            return (
              <Box key={kind} sx={{ mb: 0.5 }}>
                <Typography
                  sx={{
                    fontSize: '10px', fontWeight: 700, color: '#94a3b8',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    px: 2, pt: 1.2, pb: 0.5,
                  }}
                >
                  {sectionLabels[kind]}
                </Typography>
                {items.map((r) => {
                  const idx = flatOrdered.indexOf(r);
                  const isActive = idx === activeIdx;
                  return (
                    <Box
                      key={r.id}
                      data-idx={idx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onMouseDown={(e) => { e.preventDefault(); select(r); }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        px: 2, py: 1.1,
                        cursor: 'pointer',
                        backgroundColor: isActive ? 'rgba(0,64,161,0.08)' : 'transparent',
                        borderLeft: isActive ? '3px solid #0040a1' : '3px solid transparent',
                        transition: 'background-color 120ms ease, border-color 120ms ease',
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title}
                        </Typography>
                        {r.subtitle && (
                          <Typography sx={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.subtitle}
                          </Typography>
                        )}
                      </Box>
                      {isActive && (
                        <Chip label="↵" size="small" sx={{ fontSize: '10px', height: 20, fontFamily: 'monospace', color: '#0040a1', backgroundColor: '#e0e7ff' }} />
                      )}
                    </Box>
                  );
                })}
              </Box>
            );
          })
        )}
      </Box>

      {/* ── Footer (raccourcis) ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1, borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip label="↑↓" size="small" sx={{ fontSize: '10px', height: 18, fontFamily: 'monospace', color: '#64748b', backgroundColor: '#fff' }} />
          <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>Naviguer</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip label="↵" size="small" sx={{ fontSize: '10px', height: 18, fontFamily: 'monospace', color: '#64748b', backgroundColor: '#fff' }} />
          <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>Ouvrir</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 10, color: '#cbd5e1' }}>{flatOrdered.length} résultat{flatOrdered.length > 1 ? 's' : ''}</Typography>
      </Box>
    </Dialog>
  );
}
