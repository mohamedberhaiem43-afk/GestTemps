import { useState, useMemo } from 'react';
import {
  Box, Typography, Button, Snackbar, Alert, CircularProgress,
  Tooltip, TablePagination, Checkbox, FormControlLabel,
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { QueryClient, QueryClientProvider } from 'react-query';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import EventNoteIcon from '@mui/icons-material/EventNote';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import useGetAbsencesLibs from '../../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetEmployee from '../../../../../hooks/employeHooks/useGetEmployee';
import useAddSanction from '../../../../../hooks/sanctionHooks/useAddSanction';
import useGetSanctions from '../../../../../hooks/sanctionHooks/useGetSanctions';
import useDeleteSanction from '../../../../../hooks/sanctionHooks/useDeleteSanction';
import useUpdateSanction from '../../../../../hooks/sanctionHooks/useUpdateSanction';
import { Sanction } from '../../../../../models/Sanction';
import generateNumeroOrdre from '../../../../helper/GenerateNumOrdre';
import { useAuth } from '../../../../helper/AuthProvider';
import apiInstance from '../../../../API/apiInstance';
import AbsenceReportService from '../../../../../services/SanctionService/AbsenceReportService';
import AlertModal from '../../../../AlertModal/AlertModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './AbsenceSanctionModern.css';

function AbsenceSanctionModernContent() {
  const { soccod, hasPermission } = useAuth();

  const canAdd = hasPermission('Absences et Sanctions', 'add');
  const canModify = hasPermission('Absences et Sanctions', 'modify');
  const canDelete = hasPermission('Absences et Sanctions', 'delete');
  const canConsult = hasPermission('Absences et Sanctions', 'consult');

  // Form state
  const [empcod, setEmpcod] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [concod, setConcod] = useState(generateNumeroOrdre());
  const [conref, setConref] = useState('');
  const [condat, setCondat] = useState<Dayjs | null>(dayjs());
  const [condep, setCondep] = useState<Dayjs | null>(dayjs());
  const [conamdep, setConamdep] = useState(false);
  const [conret, setConret] = useState<Dayjs | null>(dayjs());
  const [conamret, setConamret] = useState(false);
  const [abscod, setAbscod] = useState('');
  const [mode, setMode] = useState<'save' | 'edit'>('save');

  // UI state
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [selectedSanction, setSelectedSanction] = useState<Sanction | null>(null);
  const [openModal, setOpenModal] = useState(false);

  // Hooks
  const { data: absencesRaw } = useGetAbsencesLibs();
  const absences = useMemo(() => {
    if (Array.isArray(absencesRaw)) return absencesRaw;
    if (absencesRaw && typeof absencesRaw === 'object') {
      // Could be an object like { abscod: abslib } or wrapped in .data
      if ('data' in absencesRaw) {
        const d = (absencesRaw as any).data;
        return Array.isArray(d) ? d : [];
      }
      return Object.entries(absencesRaw).map(([code, lib]) => ({ abscod: code, abslib: lib }));
    }
    return [];
  }, [absencesRaw]);
  const { data: employesRaw } = useGetEmployee();
  const employes = useMemo(() => {
    if (Array.isArray(employesRaw)) return employesRaw;
    if (employesRaw && typeof employesRaw === 'object') {
      if ('data' in employesRaw) {
        const d = (employesRaw as any).data;
        return Array.isArray(d) ? d : [];
      }
      return Object.entries(employesRaw).map(([code, lib]) => ({ empcod: code, emplib: lib }));
    }
    return [];
  }, [employesRaw]);
  const { mutate: addSanction } = useAddSanction();
  const { mutate: updateSanction } = useUpdateSanction();
  const { mutate: deleteSanction } = useDeleteSanction();
  const { data: sanctionsResponse, refetch } = useGetSanctions(soccod);

  // Parse sanctions
  const sanctions = useMemo<Sanction[]>(() => {
    if (sanctionsResponse && typeof sanctionsResponse === 'object' && 'data' in sanctionsResponse) {
      return (sanctionsResponse as any).data || [];
    }
    return Array.isArray(sanctionsResponse) ? sanctionsResponse : [];
  }, [sanctionsResponse]);

  // Calculate days
  const connbjour = useMemo(() => {
    if (condep && conret) {
      const diff = conret.diff(condep, 'day');
      return Math.max(diff, 0);
    }
    return 0;
  }, [condep, conret]);

  // Filtered table data
  const filteredData = useMemo(() => {
    if (!search) return sanctions;
    const q = search.toLowerCase();
    return sanctions.filter(
      (s: any) =>
        (s.concod || '').toLowerCase().includes(q) ||
        (s.emplib || '').toLowerCase().includes(q) ||
        (s.abslib || '').toLowerCase().includes(q)
    );
  }, [sanctions, search]);

  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  // Edit handler
  const handleEdit = (row: Sanction) => {
    if (row.concod) {
      apiInstance.get(`/Sanctions/get-sanction/${soccod}/${row.concod}`).then((res) => {
        const s = res.data;
        setEmpcod(s.empcod || '');
        setConcod(s.concod || '');
        setConref(s.conref || '');
        setCondat(s.condat ? dayjs(s.condat) : dayjs());
        setCondep(s.condep ? dayjs(s.condep) : dayjs());
        setConamdep(s.conamdep === '1');
        setConret(s.conret ? dayjs(s.conret) : dayjs());
        setConamret(s.conamret === '1');
        setAbscod(s.abscod || '');
        setMode('edit');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  // Save handler
  const handleSubmit = () => {
    if (!abscod) {
      setSnack({ open: true, msg: "Veuillez saisir le code absence.", sev: 'error' });
      return;
    }
    setIsSaving(true);

    const payload: Sanction = {
      soccod: soccod || '',
      empcod,
      concod,
      condat: condat?.toDate() || null,
      conref,
      condep: condep?.toDate() || null,
      conamdep: conamdep ? '1' : '0',
      conret: conret?.toDate() || null,
      conamret: conamret ? '1' : '0',
      connbjour,
      conjour: 'J',
      abscod,
      consanc: 'N',
    };

    const onSuccess = () => {
      setSnack({ open: true, msg: mode === 'edit' ? 'Sanction mise à jour.' : 'Sanction ajoutée.', sev: 'success' });
      resetForm();
      setIsSaving(false);
    };
    const onError = () => {
      setSnack({ open: true, msg: "Erreur lors de l'enregistrement.", sev: 'error' });
      setIsSaving(false);
    };

    if (mode === 'edit') {
      updateSanction(payload, { onSuccess, onError });
    } else {
      addSanction(payload, { onSuccess, onError });
    }
  };

  const resetForm = () => {
    setEmpcod('');
    setEmpSearch('');
    setConcod(generateNumeroOrdre());
    setConref('');
    setCondat(dayjs());
    setCondep(dayjs());
    setConamdep(false);
    setConret(dayjs());
    setConamret(false);
    setAbscod('');
    setMode('save');
    refetch();
  };

  // Delete
  const handleDelete = (row: Sanction) => {
    setSelectedSanction(row);
    setOpenModal(true);
  };
  const confirmDelete = () => {
    if (selectedSanction) {
      deleteSanction(
        { soccod: soccod || '', concod: selectedSanction.concod },
        {
          onSuccess: () => {
            setSnack({ open: true, msg: 'Sanction supprimée.', sev: 'success' });
            refetch();
          },
        }
      );
    }
    setOpenModal(false);
  };

  // PDF report
  const handleReport = async (row: Sanction) => {
    if (row.soccod && row.empcod && row.concod) {
      try {
        const response = await AbsenceReportService.getReport(`get-absence-report/${row.soccod}/${row.empcod}/${row.concod}`, 'blob');
        const blob = new Blob([response], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Absence.pdf';
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading the report:', error);
      }
    }
  };

  // Export PDF
  const handleExportRows = () => {
    const doc = new jsPDF();
    const tableData = filteredData.map((row) => [
      row.concod ?? '',
      (row as any).emplib ?? row.empcod ?? '',
      row.condat ? new Date(row.condat).toLocaleDateString('fr-FR') : '',
      (row as any).abslib ?? row.abscod ?? '',
      row.condep ? new Date(row.condep).toLocaleDateString('fr-FR') : '',
      row.conret ? new Date(row.conret).toLocaleDateString('fr-FR') : '',
      row.connbjour?.toString() ?? '0',
    ]);
    autoTable(doc, {
      head: [['N° Ordre', 'Employé', 'Date', 'Imputation', 'Départ', 'Retour', 'Nb. Jours']],
      body: tableData,
      styles: { cellPadding: 3, fontSize: 8, valign: 'middle', halign: 'center' },
      headStyles: { fillColor: [0, 64, 161], textColor: 255, fontStyle: 'bold' },
    });
    doc.save('absences-sanctions-export.pdf');
  };

  const getEmployeeName = (code: string) => {
    const emp = (employes as any[])?.find((e: any) => e.empcod === code || e.code === code);
    return emp?.emplib || emp?.lib || code;
  };

  return (
    <Box className="abs-container">
      {/* Header */}
      <Box className="abs-header">
        <Box>
          <Typography className="abs-header-title">Gestion des Absences</Typography>
          <Typography className="abs-header-heading">Absences & Sanctions</Typography>
          <Typography className="abs-header-sub">Saisie et suivi des mouvements du personnel</Typography>
        </Box>
        <Box className="abs-header-actions">
          <Button className="abs-cancel-btn" variant="outlined" startIcon={<RefreshIcon />} onClick={resetForm}>
            Nouveau
          </Button>
          {((mode === 'save' && canAdd) || (mode === 'edit' && canModify)) && (
            <Button
              className="abs-save-btn"
              variant="contained"
              startIcon={isSaving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SaveIcon />}
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? 'Enregistrement...' : mode === 'edit' ? 'Mettre à jour' : 'Enregistrer'}
            </Button>
          )}
        </Box>
      </Box>

      <Box className="abs-body">
        {!canConsult ? (
          <Box sx={{ p: 4, textAlign: 'center', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
             <EventNoteIcon sx={{ fontSize: 64, color: '#ba1a1a', opacity: 0.2, mb: 2 }} />
             <Typography variant="h6" color="error">Accès Refusé</Typography>
             <Typography sx={{ color: '#64748b' }}>Vous n'avez pas les droits nécessaires pour consulter ce module.</Typography>
          </Box>
        ) : (
          <>
          {/* Bento Grid - same as maquette: 4 cols left + 8 cols right */}
        <Box className="abs-grid">
          {/* Left: Informations Générales (4 cols) */}
          <Box className="abs-grid-left">
            <Box className="abs-card">
              <Box className="abs-card-header">
                <Box className="abs-card-icon"><PersonIcon fontSize="small" /></Box>
                <Typography className="abs-card-title">Informations Générales</Typography>
              </Box>
              <Box className="abs-form-stack">
                <Box className="abs-field">
                  <label>Collaborateur</label>
                  <div className="abs-field-with-icon">
                    <SearchIcon sx={{ fontSize: 18, color: '#8896a8' }} />
                    <input
                      type="text"
                      placeholder="Rechercher un employé..."
                      value={mode === 'edit' ? getEmployeeName(empcod) : empSearch}
                      onChange={(e) => { setEmpSearch(e.target.value); if (mode !== 'edit') setEmpcod(''); }}
                      readOnly={mode === 'edit'}
                    />
                    {mode !== 'edit' && empSearch && (
                      <Box className="abs-emp-dropdown">
                        {(employes as any[])?.filter((e: any) =>
                          (e.emplib || e.lib || '').toLowerCase().includes(empSearch.toLowerCase())
                        ).slice(0, 8).map((e: any) => (
                          <Box key={e.empcod || e.code} className="abs-emp-option"
                            onClick={() => { setEmpcod(e.empcod || e.code); setEmpSearch(e.emplib || e.lib || ''); }}>
                            {e.emplib || e.lib} <span style={{ color: '#8896a8', fontSize: 12 }}>({e.empcod || e.code})</span>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </div>
                  {empcod && <Typography sx={{ fontSize: 12, color: '#10b981', mt: 0.5 }}>✓ {getEmployeeName(empcod)}</Typography>}
                </Box>
                <Box className="abs-field">
                  <label>N° Ordre</label>
                  <input type="text" value={concod} onChange={(e) => setConcod(e.target.value)} readOnly={mode === 'edit'} className="abs-input-mono" />
                </Box>
                <Box className="abs-field">
                  <label>Référence</label>
                  <input type="text" placeholder="REF-XXXX" value={conref} onChange={(e) => setConref(e.target.value)} />
                </Box>
                <Box className="abs-field">
                  <label>Date</label>
                  <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
                    <DatePicker
                      value={condat}
                      onChange={setCondat}
                      format="DD/MM/YYYY"
                      slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 14 } } } }}
                    />
                  </LocalizationProvider>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Right: Détails du mouvement (8 cols) */}
          <Box className="abs-grid-right">
            <Box className="abs-card abs-card--full">
              <Box className="abs-card-header">
                <Box className="abs-card-icon"><EventNoteIcon fontSize="small" /></Box>
                <Typography className="abs-card-title">Détails du mouvement</Typography>
              </Box>
              <Box className="abs-details-grid">
                {/* Col 1: Type & Motif */}
                <Box className="abs-details-col">
                  <Box className="abs-field">
                    <label>Type d'imputation</label>
                    <select className="abs-select" value={abscod} onChange={(e) => setAbscod(e.target.value)}>
                      <option value="">-- Sélectionner --</option>
                      {(absences as any[])?.map((abs: any) => (
                        <option key={abs.abscod || abs.code} value={abs.abscod || abs.code}>
                          {abs.abslib || abs.lib}
                        </option>
                      ))}
                    </select>
                  </Box>
                </Box>

                {/* Col 2: Dates */}
                <Box className="abs-details-col">
                  <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
                    <Box className="abs-field">
                      <label>Date départ</label>
                      <DatePicker
                        value={condep}
                        onChange={setCondep}
                        format="DD/MM/YYYY"
                        slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 14 } } } }}
                      />
                    </Box>
                    <Box className="abs-checkbox-row">
                      <FormControlLabel
                        control={<Checkbox checked={conamdep} onChange={(e) => setConamdep(e.target.checked)} size="small" sx={{ color: '#0040a1' }} />}
                        label={<span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Après-midi</span>}
                      />
                    </Box>
                    <Box className="abs-field" sx={{ mt: 1 }}>
                      <label>Date retour prévue</label>
                      <DatePicker
                        value={conret}
                        onChange={setConret}
                        format="DD/MM/YYYY"
                        slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 14 } } } }}
                      />
                    </Box>
                    <Box className="abs-checkbox-row">
                      <FormControlLabel
                        control={<Checkbox checked={conamret} onChange={(e) => setConamret(e.target.checked)} size="small" sx={{ color: '#0040a1' }} />}
                        label={<span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Après-midi</span>}
                      />
                    </Box>
                  </LocalizationProvider>
                </Box>

                {/* Col 3: Days Counter */}
                <Box className="abs-days-counter">
                  <span className="abs-days-number">{connbjour}</span>
                  <span className="abs-days-label">Jours Décomptés</span>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Table Section */}
        <Box className="abs-table-section">
          <Box className="abs-table-header">
            <Box>
              <Typography className="abs-table-title">Mouvements Récents</Typography>
              <span className="abs-table-subtitle">Affichage des 10 dernières demandes</span>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Box className="abs-table-search">
                <SearchIcon sx={{ fontSize: 16, color: '#8896a8' }} />
                <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
              </Box>
              <Button size="small" startIcon={<DownloadIcon />} onClick={handleExportRows}
                sx={{ color: '#0040a1', fontWeight: 700, fontSize: 13, textTransform: 'none' }}>
                Exporter
              </Button>
            </Box>
          </Box>
          <table className="abs-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Actions</th>
                <th>N° Ordre</th>
                <th>Employé</th>
                <th>Date</th>
                <th>Type d'imputation</th>
                <th>Date Départ</th>
                <th>Date Retour</th>
                <th>Nb. Jours</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr><td colSpan={8} className="abs-empty">Aucun enregistrement trouvé.</td></tr>
              ) : paginatedData.map((row: any, idx: number) => (
                <tr key={row.concod || idx}>
                  <td>
                    <Box sx={{ display: 'flex', gap: '2px' }}>
                      {canModify && (
                        <Tooltip title="Modifier"><button className="abs-action-btn abs-action-btn--edit" onClick={() => handleEdit(row)}><EditIcon sx={{ fontSize: 15 }} /></button></Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip title="Supprimer"><button className="abs-action-btn abs-action-btn--delete" onClick={() => handleDelete(row)}><DeleteOutlineIcon sx={{ fontSize: 15 }} /></button></Tooltip>
                      )}
                      <Tooltip title="Rapport PDF"><button className="abs-action-btn abs-action-btn--pdf" onClick={() => handleReport(row)}><PictureAsPdfIcon sx={{ fontSize: 15 }} /></button></Tooltip>
                    </Box>
                  </td>
                  <td className="abs-cell-mono">{row.concod}</td>
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box className="abs-avatar-sm">{(row.emplib || row.empcod || '??').substring(0, 2).toUpperCase()}</Box>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{row.emplib || row.empcod}</div>
                      </div>
                    </Box>
                  </td>
                  <td className="abs-cell-date">{row.condat ? new Date(row.condat).toLocaleDateString('fr-FR') : '—'}</td>
                  <td><span className="abs-badge">{row.abslib || row.abscod || '—'}</span></td>
                  <td>{row.condep ? new Date(row.condep).toLocaleDateString('fr-FR') : '—'}</td>
                  <td>{row.conret ? new Date(row.conret).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="abs-cell-days">{row.connbjour || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Box className="abs-table-footer">
            <span>Affichage de {paginatedData.length} sur {filteredData.length} entrées</span>
            <TablePagination
              component="div" count={filteredData.length} page={page}
              onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[5, 10, 20]} labelRowsPerPage="Lignes:" sx={{ borderTop: 'none' }}
            />
          </Box>
        </Box>
          </>
        )}
      </Box>

      {/* Delete Modal */}
      <AlertModal open={openModal} onClose={() => setOpenModal(false)} onConfirm={confirmDelete}
        message="Voulez-vous vraiment supprimer cette sanction ?" />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function AbsenceSanctionModern() {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}><AbsenceSanctionModernContent /></QueryClientProvider>;
}
