import { useState, useMemo } from 'react';
import {
  Box, Typography, Button, Snackbar, Alert, CircularProgress,
  Tooltip, TablePagination,
} from '@mui/material';
import { LocalizationProvider, DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { QueryClient, QueryClientProvider } from 'react-query';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CategoryIcon from '@mui/icons-material/Category';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import useGetAbsencesLibs from '../../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetEmployee from '../../../../../hooks/employeHooks/useGetEmployee';
import useAddSortie from '../../../../../hooks/sortieHooks/useAddSortie';
import useGetSortie from '../../../../../hooks/sortieHooks/useGetSortie';
import useDeleteSortie from '../../../../../hooks/sortieHooks/useDeleteSortie';
import useUpdateSortie from '../../../../../hooks/sortieHooks/useUpdateSortie';
import { Autoriser } from '../../../../../models/Autoriser';
import generateNumeroOrdre from '../../../../helper/GenerateNumOrdre';
import { useAuth } from '../../../../helper/AuthProvider';
import SortieService from '../../../../../services/SortieService/SortieService';
import SortieReportService from '../../../../../services/SortieService/SortieReportService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import AlertModal from '../../../../AlertModal/AlertModal';
import './AutSortieModern.css';

dayjs.extend(duration);

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} H`;
}

function AutSortieModernContent() {
  const { soccod, uticod } = useAuth();

  // Form state
  const [empcod, setEmpcod] = useState<string>('');
  const [empSearch, setEmpSearch] = useState('');
  const [concod, setConcod] = useState<string>(generateNumeroOrdre());
  const [conmotif, setConmotif] = useState<string>('');
  const [abscod, setAbscod] = useState<string>('');
  const [conref, setConref] = useState<string>('');
  const [condat, setCondat] = useState<[Dayjs | null, Dayjs | null]>([dayjs(), dayjs()]);
  const [mode, setMode] = useState<'save' | 'edit'>('save');

  // UI state
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [selectedAutoriser, setSelectedAutoriser] = useState<{ concod: string } | null>(null);
  const [openModal, setOpenModal] = useState(false);

  // Hooks
  const { data: absencesRaw } = useGetAbsencesLibs();
  const absences = useMemo(() => {
    if (Array.isArray(absencesRaw)) return absencesRaw;
    if (absencesRaw && typeof absencesRaw === 'object') {
      if ('data' in absencesRaw) { const d = (absencesRaw as any).data; return Array.isArray(d) ? d : []; }
      return Object.entries(absencesRaw).map(([code, lib]) => ({ abscod: code, abslib: lib }));
    }
    return [];
  }, [absencesRaw]);
  const { data: employesRaw } = useGetEmployee();
  const employes = useMemo(() => {
    if (Array.isArray(employesRaw)) return employesRaw;
    if (employesRaw && typeof employesRaw === 'object') {
      if ('data' in employesRaw) { const d = (employesRaw as any).data; return Array.isArray(d) ? d : []; }
      return Object.entries(employesRaw).map(([code, lib]) => ({ empcod: code, emplib: lib }));
    }
    return [];
  }, [employesRaw]);
  const { mutate: addSortie } = useAddSortie();
  const { mutate: updateSortie } = useUpdateSortie();
  const { mutate: deleteSortie } = useDeleteSortie();
  const { data: sorties = [], refetch } = useGetSortie(uticod);

  // Calculate hours difference
  const hoursDiff = useMemo(() => {
    if (condat[0] && condat[1]) {
      const sMin = condat[0].hour() * 60 + condat[0].minute();
      const eMin = condat[1].hour() * 60 + condat[1].minute();
      let diff = eMin - sMin;
      if (diff < 0) diff += 24 * 60;
      return dayjs.duration(diff, 'minutes').asHours();
    }
    return 0;
  }, [condat]);

  // Filtered table data
  const filteredData = useMemo(() => {
    if (!search) return sorties;
    const q = search.toLowerCase();
    return (sorties as Autoriser[]).filter(
      (s: any) =>
        (s.concod || '').toLowerCase().includes(q) ||
        (s.emplib || '').toLowerCase().includes(q) ||
        (s.abslib || '').toLowerCase().includes(q)
    );
  }, [sorties, search]);

  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  // Edit handler
  const handleEdit = (row: any) => {
    if (row.concod) {
      SortieService.getWithParams(`get-autorisation/${soccod}/${row.concod}`).then((res: any) => {
        setAbscod(res.abscod || '');
        setConcod(res.concod || '');
        setConmotif(res.conmotif || '');
        setCondat([dayjs(res.condep), dayjs(res.conret)]);
        setConref(res.conref || '');
        setEmpcod(res.empcod || '');
        setMode('edit');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  // Save handler
  const handleSubmit = () => {
    if (!concod) {
      setSnack({ open: true, msg: 'N° Ordre est obligatoire.', sev: 'error' });
      return;
    }
    setIsSaving(true);

    const payload: Autoriser = {
      empcod,
      concod,
      abscod: abscod || null,
      conref: conref || null,
      conmotif: conmotif || null,
      condat: condat[0]?.format('YYYY-MM-DD'),
      condep: `${condat[0]?.format('YYYY-MM-DD')}T${condat[0]?.format('HH:mm:ss')}`,
      conret: `${condat[1]?.format('YYYY-MM-DD')}T${condat[1]?.format('HH:mm:ss')}`,
      connbjour: parseFloat(hoursDiff.toFixed(2)),
      soccod: soccod || '01',
    };

    const onSuccess = () => {
      setSnack({ open: true, msg: mode === 'edit' ? 'Autorisation mise à jour.' : 'Autorisation ajoutée.', sev: 'success' });
      resetForm();
      setIsSaving(false);
    };
    const onError = () => {
      setSnack({ open: true, msg: "Erreur lors de l'enregistrement.", sev: 'error' });
      setIsSaving(false);
    };

    if (mode === 'edit') {
      updateSortie(payload, { onSuccess, onError });
    } else {
      addSortie(payload, { onSuccess, onError });
    }
  };

  const resetForm = () => {
    setEmpcod('');
    setConcod(generateNumeroOrdre());
    setConmotif('');
    setAbscod('');
    setConref('');
    setCondat([dayjs(), dayjs()]);
    setMode('save');
    refetch();
  };

  // Delete
  const handleDelete = (concod: string) => {
    setSelectedAutoriser({ concod });
    setOpenModal(true);
  };
  const confirmDelete = () => {
    if (selectedAutoriser) {
      deleteSortie({ code: selectedAutoriser.concod }, {
        onSuccess: () => {
          setSnack({ open: true, msg: 'Autorisation supprimée.', sev: 'success' });
          refetch();
        },
      });
    }
    setOpenModal(false);
  };

  // PDF report
  const handleReport = async (soccod: string, concod: string) => {
    try {
      const response = await SortieReportService.getReport(`get-autorisation-report/${soccod}/${concod}`, 'blob');
      const blob = new Blob([response], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'AutorisationSortie.pdf';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading the report:', error);
    }
  };

  // Export PDF
  const handleExportRows = () => {
    const doc = new jsPDF();
    const tableData = (filteredData as Autoriser[]).map((row) => [
      row.concod ?? '',
      row.condat ? new Date(row.condat).toLocaleDateString('fr-FR') : '',
      (row as any).emplib ?? row.empcod ?? '',
      (row as any).abslib ?? row.abscod ?? '',
      row.condep ? new Date(row.condep).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      row.conret ? new Date(row.conret).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      row.connbjour?.toString() ?? '',
    ]);
    autoTable(doc, {
      head: [['N° Ordre', 'Date', 'Employé', 'Imputation', 'Sortie', 'Retour', 'Durée']],
      body: tableData,
      styles: { cellPadding: 3, fontSize: 8, valign: 'middle', halign: 'center' },
      headStyles: { fillColor: [0, 64, 161], textColor: 255, fontStyle: 'bold' },
    });
    doc.save('autorisation-sortie-export.pdf');
  };

  // Get employee name for display
  const getEmployeeName = (code: string) => {
    const emp = (employes as any[])?.find((e: any) => e.empcod === code || e.code === code);
    return emp?.emplib || emp?.lib || code;
  };

  return (
    <Box className="aut-container">
      {/* Header */}
      <Box className="aut-header">
        <Box>
          <Typography className="aut-header-title">Gestion des Absences</Typography>
          <Typography className="aut-header-heading">Autorisation de Sortie</Typography>
          <Typography className="aut-header-sub">Gestion des autorisations d'absence</Typography>
        </Box>
        <Box className="aut-header-actions">
          <Button
            className="aut-cancel-btn"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={resetForm}
          >
            Nouveau
          </Button>
          <Button
            className="aut-save-btn"
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SaveIcon />}
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? 'Enregistrement...' : mode === 'edit' ? 'Mettre à jour' : 'Enregistrer'}
          </Button>
        </Box>
      </Box>

      <Box className="aut-body">
        {/* Bento Grid */}
        <Box className="aut-grid">
          {/* Left Column */}
          <Box className="aut-grid-left">
            {/* Card: Informations Générales */}
            <Box className="aut-card">
              <Box className="aut-card-header">
                <Box className="aut-card-icon"><PersonIcon fontSize="small" /></Box>
                <Typography className="aut-card-title">Informations Générales</Typography>
              </Box>
              <Box className="aut-form-grid aut-form-grid--2">
                <Box className="aut-field">
                  <label>Sélection de l'employé</label>
                  <div className="aut-field-with-icon">
                    <SearchIcon sx={{ fontSize: 18, color: '#8896a8' }} />
                    <input
                      type="text"
                      placeholder="Rechercher un employé..."
                      value={mode === 'edit' ? getEmployeeName(empcod) : empSearch}
                      onChange={(e) => {
                        setEmpSearch(e.target.value);
                        if (mode !== 'edit') setEmpcod('');
                      }}
                      readOnly={mode === 'edit'}
                    />
                    {mode !== 'edit' && empSearch && (
                      <Box className="aut-emp-dropdown">
                        {(employes as any[])
                          ?.filter((e: any) =>
                            (e.emplib || e.lib || '').toLowerCase().includes(empSearch.toLowerCase())
                          )
                          .slice(0, 8)
                          .map((e: any) => (
                            <Box
                              key={e.empcod || e.code}
                              className="aut-emp-option"
                              onClick={() => {
                                setEmpcod(e.empcod || e.code);
                                setEmpSearch(e.emplib || e.lib || '');
                              }}
                            >
                              {(e.emplib || e.lib || '')} <span style={{ color: '#8896a8', fontSize: 12 }}>({e.empcod || e.code})</span>
                            </Box>
                          ))}
                      </Box>
                    )}
                  </div>
                  {empcod && <Typography sx={{ fontSize: 12, color: '#10b981', mt: 0.5 }}>✓ {getEmployeeName(empcod)}</Typography>}
                </Box>
                <Box className="aut-field-row">
                  <Box className="aut-field">
                    <label>N° Ordre</label>
                    <input
                      type="text"
                      value={concod}
                      onChange={(e) => setConcod(e.target.value)}
                      readOnly={mode === 'edit'}
                      className="aut-input-mono"
                    />
                  </Box>
                  <Box className="aut-field">
                    <label>Référence</label>
                    <input
                      type="text"
                      placeholder="REF-XXXX"
                      value={conref || ''}
                      onChange={(e) => setConref(e.target.value)}
                    />
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Card: Planification des Horaires */}
            <Box className="aut-card">
              <Box className="aut-card-header">
                <Box className="aut-card-icon"><ScheduleIcon fontSize="small" /></Box>
                <Typography className="aut-card-title">Planification des Horaires</Typography>
              </Box>
              <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
                <Box className="aut-form-grid aut-form-grid--4">
                  <Box className="aut-field">
                    <label>Date</label>
                    <DatePicker
                      value={condat[0]}
                      onChange={(v) => setCondat([v, condat[1]])}
                      format="DD/MM/YYYY"
                      slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 14 } } } }}
                    />
                  </Box>
                  <Box className="aut-field">
                    <label>Heure de Début</label>
                    <TimePicker
                      value={condat[0]}
                      onChange={(v) => setCondat([v, condat[1]])}
                      ampm={false}
                      slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 14 } } } }}
                    />
                  </Box>
                  <Box className="aut-field">
                    <label>Heure de Fin</label>
                    <TimePicker
                      value={condat[1]}
                      onChange={(v) => setCondat([condat[0], v])}
                      ampm={false}
                      slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 14 } } } }}
                    />
                  </Box>
                  <Box className="aut-field">
                    <label>Durée Totale</label>
                    <Box className="aut-duration-badge">{formatDuration(hoursDiff)}</Box>
                  </Box>
                </Box>
              </LocalizationProvider>
            </Box>
          </Box>

          {/* Right Column */}
          <Box className="aut-grid-right">
            <Box className="aut-card aut-card--full">
              <Box className="aut-card-header">
                <Box className="aut-card-icon"><CategoryIcon fontSize="small" /></Box>
                <Typography className="aut-card-title">Type d'Autorisation</Typography>
              </Box>
              <Box className="aut-type-section">
                <label className="aut-section-label">Imputation</label>
                <Box className="aut-type-list">
                  {(absences as any[])?.map((abs: any) => (
                    <label
                      key={abs.abscod || abs.code}
                      className={`aut-type-item ${abscod === (abs.abscod || abs.code) ? 'aut-type-item--active' : ''}`}
                      onClick={() => setAbscod(abs.abscod || abs.code)}
                    >
                      <input type="radio" name="type" checked={abscod === (abs.abscod || abs.code)} readOnly />
                      <span>{abs.abslib || abs.lib}</span>
                      <span className="aut-type-dot" />
                    </label>
                  ))}
                </Box>
              </Box>
              <Box className="aut-motif-section">
                <label className="aut-section-label">Commentaires / Motif</label>
                <textarea
                  className="aut-textarea"
                  placeholder="Précisez la raison de la sortie..."
                  rows={4}
                  value={conmotif || ''}
                  onChange={(e) => setConmotif(e.target.value)}
                />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Table Section */}
        <Box className="aut-table-section">
          <Box className="aut-table-header">
            <Box>
              <Typography className="aut-table-title">Registre des Autorisations de Sortie</Typography>
              <Typography className="aut-table-subtitle">Historique des entrées récentes pour l'unité opérationnelle</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box className="aut-table-search">
                <SearchIcon sx={{ fontSize: 16, color: '#8896a8' }} />
                <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
              </Box>
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleExportRows}
                sx={{ color: '#0040a1', fontWeight: 700, fontSize: 13, textTransform: 'none' }}
              >
                Exporter
              </Button>
            </Box>
          </Box>
          <table className="aut-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Actions</th>
                <th>N° Ordre</th>
                <th>Employé</th>
                <th>Date</th>
                <th>Type</th>
                <th>Sortie</th>
                <th>Retour</th>
                <th>Durée</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr><td colSpan={8} className="aut-empty">Aucune autorisation trouvée.</td></tr>
              ) : paginatedData.map((row: any) => (
                <tr key={row.concod}>
                  <td>
                    <Box sx={{ display: 'flex', gap: '2px' }}>
                      <Tooltip title="Modifier">
                        <button className="aut-action-btn aut-action-btn--edit" onClick={() => handleEdit(row)}><EditIcon sx={{ fontSize: 15 }} /></button>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <button className="aut-action-btn aut-action-btn--delete" onClick={() => handleDelete(row.concod)}><DeleteOutlineIcon sx={{ fontSize: 15 }} /></button>
                      </Tooltip>
                      <Tooltip title="Rapport PDF">
                        <button className="aut-action-btn aut-action-btn--pdf" onClick={() => handleReport(row.soccod || soccod || '', row.concod)}><PictureAsPdfIcon sx={{ fontSize: 15 }} /></button>
                      </Tooltip>
                    </Box>
                  </td>
                  <td className="aut-cell-mono">{row.concod}</td>
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box className="aut-avatar-sm">{(row.emplib || row.empcod || '??').substring(0, 2).toUpperCase()}</Box>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{row.emplib || row.empcod}</span>
                    </Box>
                  </td>
                  <td className="aut-cell-date">{row.condat ? new Date(row.condat).toLocaleDateString('fr-FR') : '—'}</td>
                  <td>
                    <span className="aut-badge">{row.abslib || row.abscod || '—'}</span>
                  </td>
                  <td className="aut-cell-time">{row.condep ? new Date(row.condep).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="aut-cell-time">{row.conret ? new Date(row.conret).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="aut-cell-duration">{row.connbjour ? formatDuration(row.connbjour) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Box className="aut-table-footer">
            <span>Affichage de {paginatedData.length} sur {filteredData.length} enregistrements</span>
            <TablePagination
              component="div"
              count={filteredData.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[5, 10, 20]}
              labelRowsPerPage="Lignes:"
              sx={{ borderTop: 'none' }}
            />
          </Box>
        </Box>
      </Box>

      {/* Delete Confirmation Modal */}
      {selectedAutoriser && (
        <AlertModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          onConfirm={confirmDelete}
          message="Êtes-vous sûr de vouloir supprimer cette autorisation de sortie ?"
        />
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function AutSortieModern() {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}><AutSortieModernContent /></QueryClientProvider>;
}