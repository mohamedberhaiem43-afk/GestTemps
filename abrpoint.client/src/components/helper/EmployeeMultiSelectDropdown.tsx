import { Box } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

export type EmployeeOption = { code: string; label: string };

interface Props {
  options: EmployeeOption[];
  value: string[];
  onChange: (selected: string[]) => void;
  /** Texte affiché quand aucune sélection (= tous les employés) */
  allLabel?: string;
  /** Largeur min du wrapper */
  minWidth?: number | string;
  /** Hauteur max du panneau déroulé */
  maxHeight?: number;
  disabled?: boolean;
}

/**
 * Dropdown multi-select uniforme avec checkboxes — utilisé dans EtatPériodique,
 * EtatRetard et EtatAbsence pour offrir la même UX de sélection d'employés.
 */
export default function EmployeeMultiSelectDropdown({
  options,
  value,
  onChange,
  allLabel = 'Tous les employés',
  minWidth = 220,
  maxHeight = 280,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside → close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const labelOf = (code: string) => options.find(o => o.code === code)?.label ?? code;

  const summary =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? labelOf(value[0])
        : `${value.length} sélectionné(s)`;

  return (
    <Box ref={wrapperRef} sx={{ position: 'relative', minWidth, width: '100%' }}>
      <Box
        onClick={() => !disabled && setOpen(v => !v)}
        sx={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          userSelect: 'none', minHeight: 32, px: 1, py: 0.5,
          fontSize: '13px', fontWeight: 600,
          border: '1px solid #e2e8f0', borderRadius: '8px', bgcolor: '#f8fafc',
          color: '#191c1e', opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {summary}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>▼</span>
      </Box>
      {open && !disabled && (
        <Box sx={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1200,
          bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight, overflowY: 'auto', mt: 0.5,
        }}>
          <Box
            onClick={() => { onChange([]); setOpen(false); }}
            sx={{
              p: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
              borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: 13,
              color: value.length === 0 ? '#0040a1' : '#334155',
            }}
          >
            <input type="checkbox" readOnly checked={value.length === 0} style={{ accentColor: '#0040a1' }} />
            {allLabel}
          </Box>
          {options.map(({ code, label }) => {
            const checked = value.includes(code);
            return (
              <Box
                key={code}
                onClick={() => {
                  onChange(checked ? value.filter(c => c !== code) : [...value, code]);
                }}
                sx={{
                  p: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
                  fontSize: 13,
                  color: checked ? '#0040a1' : '#334155',
                  bgcolor: checked ? '#f0f5ff' : 'transparent',
                  '&:hover': { bgcolor: checked ? '#e0eaff' : '#f8fafc' },
                }}
              >
                <input type="checkbox" readOnly checked={checked} style={{ accentColor: '#0040a1' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </Box>
            );
          })}
          {options.length === 0 && (
            <Box sx={{ p: '12px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
              Aucun employé pour les filtres sélectionnés
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
