import { useState } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControlLabel, Checkbox, Box, Typography, Tooltip, IconButton,
} from '@mui/material';
import TableChartIcon from '@mui/icons-material/TableChart';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { PointageMois } from '../../../models/PointageMois';

interface Props {
  pointageMois: PointageMois[];
  mois: string;
  annee: string;
  soclib?: string;
  services?: Record<string, string>;
}

// Legend codes shown in the mock-up. Order matters for the on-sheet legend block.
const LEGEND: { code: string; label: string; argb?: string }[] = [
  { code: 'CA',  label: 'Congé (payé)' },
  { code: 'CSF', label: 'Congé R. familiale (payé)' },
  { code: 'R',   label: 'Repos' },
  { code: 'M',   label: 'Maladie (non payé)' },
  { code: 'AJ',  label: 'Abs. Justifiée (non payé)' },
  { code: 'MIS', label: 'Formation/Mission (payé)' },
  { code: 'AT',  label: 'Arrêt Technique' },
  { code: 'F',   label: 'Férié (payé)' },
  { code: 'ATR', label: 'Acc. Travail (non payé)' },
  { code: 'ANJ', label: 'Abs. NJ (non payé)' },
  { code: 'MAP', label: 'Mise à pied (non payé)' },
  { code: 'CSS', label: 'Congé Sans Solde' },
  { code: 'BL',  label: 'Blâme' },
  { code: 'STC', label: 'STC (non payé)' },
  { code: 'AUTP', label: 'Aut. Sortie (payé)', argb: 'FFD9EAD3' },
  { code: 'AUTNP', label: 'Aut. Sortie (non payé)', argb: 'FF9FE2E0' },
];

// argb fill for known status codes.
const CODE_COLORS: Record<string, string> = {
  R:    'FFE7E6E6',
  F:    'FFFFE699',
  CA:   'FFC9DAF8',
  CSF:  'FFC9DAF8',
  CSS:  'FFD9D9D9',
  M:    'FFF8CBAD',
  AJ:   'FFFCE5CD',
  ANJ:  'FFF4B084',
  AT:   'FFFFD966',
  ATR:  'FFFFD966',
  MAP:  'FFE06666',
  MIS:  'FFB4C7E7',
  BL:   'FFE06666',
  STC:  'FFD9D9D9',
  AUTP: 'FFD9EAD3',
  AUTNP: 'FF9FE2E0',
};

type DayValue = { kind: 'hours' | 'code' | 'empty'; value: string | number; code?: string };

function parseDay(detail: string | undefined): DayValue {
  if (!detail) return { kind: 'empty', value: '' };
  const presentMatch = detail.match(/Présent:\s*([\d.,-]+)/);
  const sanctionMatch = detail.match(/Sanction\[([^\]]+)\]/);
  const congeMatch = detail.match(/Congé\[([^\]]+)\]/);
  const isFerier = /Férié/.test(detail);
  const isRepos = /Repos/.test(detail);

  if (presentMatch) {
    const v = parseFloat(presentMatch[1].replace(',', '.'));
    if (!isNaN(v) && v > 0) return { kind: 'hours', value: v };
  }
  if (sanctionMatch) {
    const code = (sanctionMatch[1] || '').trim().toUpperCase();
    return { kind: 'code', value: code, code };
  }
  if (congeMatch) {
    const code = (congeMatch[1] || '').trim().toUpperCase();
    return { kind: 'code', value: code, code };
  }
  if (isFerier) return { kind: 'code', value: 'F', code: 'F' };
  if (isRepos) return { kind: 'code', value: 'R', code: 'R' };
  return { kind: 'empty', value: '' };
}

function buildDayMap(pm: PointageMois): Map<string, DayValue> {
  const m = new Map<string, DayValue>();
  (pm.heuresSupplementairesResultats ?? []).forEach((w: any) => {
    const wd: Record<string, string> = w?.weekDetails ?? {};
    Object.keys(wd).forEach(dateKey => {
      m.set(dateKey, parseDay(wd[dateKey]));
    });
  });
  return m;
}

function sumCols(pm: PointageMois) {
  return (pm.heuresSupplementairesResultats ?? []).reduce((a, r) => ({
    nbJours: a.nbJours + (r.nbJours ?? 0),
    absences: a.absences + ((r.absj ?? 0) + (r.absnj ?? 0) + (r.absnp ?? 0)),
    heuresNormales: a.heuresNormales + (r.heuresNormales ?? 0),
    totalAbsence: a.totalAbsence + (r.totalAbsence ?? 0),
    hs25: a.hs25 + (r.heuresSupTranche1 ?? 0),
    hs75: a.hs75 + (r.heuresSupTranche2 ?? 0),
    nbJourFerier: a.nbJourFerier + (r.nbJourFerier ?? 0),
    hreFerier: a.hreFerier + (r.hreFerier ?? 0),
    hreFerieTrv: a.hreFerieTrv + (r.hreFerieTrv ?? 0),
    heureRepos: a.heureRepos + (r.heureRepos ?? 0),
    nbJourCngPaye: a.nbJourCngPaye + (r.nbJourCngPaye ?? 0),
    nbHeureConge: a.nbHeureConge + (r.nbHeureConge ?? 0),
    hreNuits: a.hreNuits + (r.hreNuits ?? 0),
    nbNuits: a.nbNuits + (r.nbNuits ?? 0),
    hreAllaitement: a.hreAllaitement + (r.hreAllaitement ?? 0),
    tothre: a.tothre + (r.tothre ?? 0),
  }), {
    nbJours: 0, absences: 0, heuresNormales: 0, totalAbsence: 0,
    hs25: 0, hs75: 0, nbJourFerier: 0, hreFerier: 0, hreFerieTrv: 0,
    heureRepos: 0, nbJourCngPaye: 0, nbHeureConge: 0, hreNuits: 0,
    nbNuits: 0, hreAllaitement: 0, tothre: 0,
  });
}

const MONTH_FR_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export default function PointageMensuelExportButton({ pointageMois, mois, annee, soclib, services }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [withLegend, setWithLegend] = useState(true);
  const [withColors, setWithColors] = useState(true);
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (!pointageMois.length) {
      toast.error(t('pointageMois.errors.noData'));
      return;
    }
    setBusy(true);
    try {
      const year = parseInt(annee);
      const monthIdx = parseInt(mois) - 1;
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      const dates: string[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        dates.push(`${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = 'ABRPOINT';
      wb.created = new Date();
      const ws = wb.addWorksheet('Pointage du mois', {
        views: [{ state: 'frozen', xSplit: 4, ySplit: 0 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      });

      let r = 1;

      // ── Title block ──
      const titleCell = ws.getCell(r, 1);
      titleCell.value = (soclib || 'ABRPOINT').toUpperCase();
      titleCell.font = { bold: true, size: 14, color: { argb: 'FFC00000' } };
      r += 1;

      // ── Legend block (optional) ──
      if (withLegend) {
        const legendStartRow = r;
        // 4 columns: code | label | code | label  (so we fit ~16 codes in 4 rows)
        const colsPerRow = 4;
        for (let i = 0; i < LEGEND.length; i += colsPerRow) {
          const slice = LEGEND.slice(i, i + colsPerRow);
          slice.forEach((leg, j) => {
            const codeCell = ws.getCell(r, 1 + j * 2);
            codeCell.value = leg.code;
            codeCell.alignment = { horizontal: 'center', vertical: 'middle' };
            codeCell.font = { bold: true, size: 10, color: { argb: 'FF0040A1' } };
            if (withColors) {
              const fill = leg.argb || CODE_COLORS[leg.code];
              if (fill) {
                codeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
              }
            }
            const labelCell = ws.getCell(r, 2 + j * 2);
            labelCell.value = leg.label;
            labelCell.font = { size: 9, color: { argb: 'FF1F2937' } };
          });
          r += 1;
        }
        // border around legend
        for (let row = legendStartRow; row < r; row++) {
          for (let col = 1; col <= colsPerRow * 2; col++) {
            const c = ws.getCell(row, col);
            c.border = {
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            };
          }
        }
        r += 1;
      }

      // ── Date + sub-title ──
      const today = new Date();
      const dateLine = ws.getCell(r, 1);
      dateLine.value = `Date : ${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      dateLine.font = { size: 10 };
      const periodLine = ws.getCell(r, 5);
      periodLine.value = `POINTAGE MENSUEL DU MOIS ${annee}/${String(mois).padStart(2, '0')}`;
      periodLine.font = { bold: true, size: 11 };
      r += 1;
      const subTitle = ws.getCell(r, 5);
      subTitle.value = 'POINTAGE MENSUEL DU MOIS';
      subTitle.font = { bold: true, size: 11 };
      r += 2;

      // ── Header row ──
      const headerRow = r;
      const fixedHeaders = ['MAT', 'NOM ET PRENOM', 'REGIME', 'SITE'];
      const summaryHeaders = [
        'Nb. Jours', 'J. Abs.', 'H. Nor', 'H. Abs', 'Aut.S Payé',
        'HS. 25%', 'HS. 75%', 'Férier', 'H. Férier', 'H.Fer.Trv',
        'H.Rep.Trav', 'Congé', 'H. Congé', 'H. Nuit', 'Nb. Nuit',
        'Nb. Allait', 'TOT. HEURE', 'TOT. JOUR',
      ];
      const allHeaders = [
        ...fixedHeaders,
        ...dates.map(d => {
          const dt = new Date(d);
          return `${dt.getDate()}-${MONTH_FR_SHORT[dt.getMonth()]}`;
        }),
        ...summaryHeaders,
      ];
      allHeaders.forEach((h, i) => {
        const c = ws.getCell(headerRow, i + 1);
        c.value = h;
        c.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
        if (withColors) {
          const isSummary = i >= fixedHeaders.length + dates.length;
          c.fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: isSummary ? 'FFE2EFDA' : 'FFDDEBF7' },
          };
        }
      });
      ws.getRow(headerRow).height = 28;
      r += 1;

      // ── Body rows ──
      pointageMois.forEach(emp => {
        const dayMap = buildDayMap(emp);
        const totals = sumCols(emp);
        const siteLabel = (services && services[emp.empSite]) || emp.empSite || '';
        const cells: (string | number)[] = [
          emp.empMat, emp.empLib, emp.empReg, siteLabel,
        ];
        const dayValues: DayValue[] = dates.map(d => dayMap.get(d) || { kind: 'empty', value: '' });
        dayValues.forEach(v => cells.push(v.value as any));
        cells.push(
          totals.nbJours,
          totals.absences,
          +totals.heuresNormales.toFixed(2),
          +totals.totalAbsence.toFixed(2),
          0, // Aut.S Payé : non disponible côté DTO
          +totals.hs25.toFixed(2),
          +totals.hs75.toFixed(2),
          totals.nbJourFerier,
          +totals.hreFerier.toFixed(2),
          +totals.hreFerieTrv.toFixed(2),
          +totals.heureRepos.toFixed(2),
          totals.nbJourCngPaye,
          +totals.nbHeureConge.toFixed(2),
          +totals.hreNuits.toFixed(2),
          totals.nbNuits,
          +totals.hreAllaitement.toFixed(2),
          +totals.tothre.toFixed(2),
          totals.nbJours,
        );

        cells.forEach((val, i) => {
          const c = ws.getCell(r, i + 1);
          c.value = val as any;
          c.alignment = { horizontal: i < 2 ? 'left' : 'center', vertical: 'middle' };
          c.font = { size: 10 };
          c.border = {
            top: { style: 'hair', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
            left: { style: 'hair', color: { argb: 'FFE2E8F0' } },
            right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
          };
          // color for status code cells
          const dayIdx = i - fixedHeaders.length;
          if (withColors && dayIdx >= 0 && dayIdx < dates.length) {
            const dv = dayValues[dayIdx];
            if (dv.kind === 'code' && dv.code && CODE_COLORS[dv.code]) {
              c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CODE_COLORS[dv.code] } };
              c.font = { size: 10, bold: true };
            }
          }
        });
        r += 1;
      });

      // ── Column widths ──
      ws.getColumn(1).width = 8;   // MAT
      ws.getColumn(2).width = 28;  // NOM
      ws.getColumn(3).width = 8;   // REGIME
      ws.getColumn(4).width = 12;  // SITE
      for (let i = 0; i < dates.length; i++) {
        ws.getColumn(fixedHeaders.length + 1 + i).width = 7;
      }
      const summaryStart = fixedHeaders.length + dates.length;
      summaryHeaders.forEach((_, i) => {
        ws.getColumn(summaryStart + 1 + i).width = 10;
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `PointageMensuel_${annee}_${String(mois).padStart(2, '0')}.xlsx`);
      setOpen(false);
      toast.success(t('pointageMois.export'));
    } catch (e) {
      console.error(e);
      toast.error(t('pointageMois.errors.reportError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tooltip title={t('pointageMois.exportExcelMonthly')}>
        <IconButton
          className="pdm-export-btn"
          onClick={() => setOpen(true)}
          disabled={!pointageMois.length}
          sx={{ borderRadius: '12px', padding: '10px' }}
        >
          <TableChartIcon />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800 }}>
          {t('pointageMois.excelDialog.title')}
          <IconButton onClick={() => setOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: '#64748b', mb: 2 }}>
            {t('pointageMois.excelDialog.subtitle')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={<Checkbox checked={withLegend} onChange={(e) => setWithLegend(e.target.checked)} />}
              label={t('pointageMois.excelDialog.includeLegend')}
            />
            <FormControlLabel
              control={<Checkbox checked={withColors} onChange={(e) => setWithColors(e.target.checked)} />}
              label={t('pointageMois.excelDialog.includeColors')}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ textTransform: 'none' }}>
            {t('pointageMois.excelDialog.cancel')}
          </Button>
          <Button onClick={handleExport} variant="contained" disabled={busy}
            sx={{ textTransform: 'none', bgcolor: '#0040a1', '&:hover': { bgcolor: '#003080' } }}>
            {busy ? t('pointageMois.excelDialog.generating') : t('pointageMois.excelDialog.generate')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
