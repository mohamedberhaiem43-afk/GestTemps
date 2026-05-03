import { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, TextField,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Select, MenuItem, FormControl, InputAdornment, IconButton,
  Snackbar, Alert, Chip, Tooltip, Avatar, Stack
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import EventIcon from '@mui/icons-material/Event';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import PersonIcon from '@mui/icons-material/Person';
import { QueryClient, QueryClientProvider, useQueryClient } from 'react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../helper/AuthProvider';
import useGetSolde from '../../../../hooks/soldeCongeHooks/useGetSolde';
import useGetEmployeesLibs from '../../../../hooks/employeHooks/useGetEmployeesLibs';
import useAddSolde from '../../../../hooks/soldeCongeHooks/useAddSolde';
import useUpdateSolde from '../../../../hooks/soldeCongeHooks/useUpdateSolde';
import { Solde } from '../../../../models/Solde';

const queryClient = new QueryClient();

function SoldeCongeAdminInner() {
  const { t } = useTranslation();
  const { soccod } = useAuth();
  const queryClientLocal = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRows, setEditingRows] = useState<Record<string, string>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  });

  const { data: soldesData, isLoading: loadingSoldes } = useGetSolde();
  const { data: employeesData, isLoading: loadingEmployees } = useGetEmployeesLibs();

  // Ensure we always work with arrays (API may return non-array values)
  const soldes = useMemo(() => Array.isArray(soldesData) ? soldesData : [], [soldesData]);
  const employees = useMemo(() => {
    if (Array.isArray(employeesData)) return employeesData;
    // API returns Dictionary<string, string> (empcod -> emplib), convert to array
    if (employeesData && typeof employeesData === 'object') {
      return Object.entries(employeesData).map(([empcod, emplib]) => ({ empcod, emplib }));
    }
    return [];
  }, [employeesData]);

  const addSolde = useAddSolde();
  const updateSolde = useUpdateSolde();

  // Filter soldes by year
  const soldesByYear = useMemo(() => {
    return soldes.filter((s: Solde) => s.annee === selectedYear);
  }, [soldes, selectedYear]);

  // Build solde map: empcod -> solde
  const soldeMap = useMemo(() => {
    const map: Record<string, Solde> = {};
    soldesByYear.forEach((s: Solde) => {
      map[s.empcod] = s;
    });
    return map;
  }, [soldesByYear]);

  // Filter employees by search
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter((emp: any) =>
      (emp.empcod?.toLowerCase() || '').includes(term) ||
      (emp.emplib?.toLowerCase() || '').includes(term)
    );
  }, [employees, searchTerm]);

  // Stats
  const totalEmployees = filteredEmployees.length;
  const withSolde = filteredEmployees.filter((emp: any) => soldeMap[emp.empcod]).length;
  const totalSolde = soldesByYear.reduce((sum: number, s: Solde) => sum + (s.conge || 0), 0);

  const handleSave = useCallback(async (empcod: string, emplib: string) => {
    const value = editingRows[empcod];
    if (value === undefined) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      setSnackbar({ open: true, message: t('conge.soldeAdmin.msg.invalid'), severity: 'error' });
      return;
    }

    const existing = soldeMap[empcod];

    try {
      if (existing) {
        // Update existing
        await updateSolde.mutateAsync({
          empcod,
          soccod: soccod || existing.soccod,
          annee: selectedYear,
          conge: numValue,
          empconge: existing.empconge,
        } as Solde);
      } else {
        // Add new
        await addSolde.mutateAsync({
          solde: {
            empcod,
            soccod,
            annee: selectedYear,
            conge: numValue,
            empconge: 0,
          }
        });
      }

      setSnackbar({
        open: true,
        message: t('conge.soldeAdmin.msg.updateSuccess', { name: emplib }),
        severity: 'success'
      });

      // Remove from editing
      setEditingRows(prev => {
        const next = { ...prev };
        delete next[empcod];
        return next;
      });

      // Refresh data
      queryClientLocal.invalidateQueries('soldes');
    } catch (err) {
      console.error('Save error:', err);
      setSnackbar({
        open: true,
        message: t('conge.soldeAdmin.msg.saveError'),
        severity: 'error'
      });
    }
  }, [editingRows, soldeMap, soccod, selectedYear, addSolde, updateSolde, queryClientLocal]);

  const handleSoldeChange = (empcod: string, value: string) => {
    setEditingRows(prev => ({ ...prev, [empcod]: value }));
  };

  const isLoading = loadingSoldes || loadingEmployees;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} sx={{ color: '#0040a1' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 }, maxWidth: 1200, margin: '0 auto', fontFamily: 'Manrope, sans-serif' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', color: '#0f172a', fontFamily: 'Manrope' }}>
            {t('conge.soldeAdmin.title')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <EventIcon sx={{ fontSize: 16, color: '#64748b' }} />
            <Typography sx={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
              {t('conge.soldeAdmin.yearLabel', { year: selectedYear })}
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              sx={{
                fontWeight: 700, fontSize: '14px', borderRadius: '10px',
                '& .MuiSelect-select': { py: 1 }
              }}
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                <MenuItem key={y} value={String(y)}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            startIcon={<RefreshIcon />}
            onClick={() => queryClientLocal.invalidateQueries('soldes')}
            sx={{ textTransform: 'none', fontWeight: 700, color: '#0040a1' }}
          >
            {t('conge.soldeAdmin.refresh')}
          </Button>
        </Stack>
      </Box>

      {/* Stats Cards — 1 col mobile, 3 cols desktop */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        <Paper sx={{ p: 2.5, borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'rgba(0,64,161,0.1)', color: '#0040a1' }}>
              <PersonIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{t('conge.soldeAdmin.stats.totalEmployees')}</Typography>
              <Typography sx={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{totalEmployees}</Typography>
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ p: 2.5, borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'rgba(16,185,129,0.1)', color: '#059669' }}>
              <BeachAccessIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{t('conge.soldeAdmin.stats.withSolde')}</Typography>
              <Typography sx={{ fontSize: '24px', fontWeight: 800, color: '#059669' }}>{withSolde}</Typography>
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ p: 2.5, borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'rgba(234,179,8,0.1)', color: '#ca8a04' }}>
              <EventIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{t('conge.soldeAdmin.stats.totalDays')}</Typography>
              <Typography sx={{ fontSize: '24px', fontWeight: 800, color: '#ca8a04' }}>{totalSolde.toFixed(1)}</Typography>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder={t('conge.soldeAdmin.search')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: '100%', sm: 320 },
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
              '& fieldset': { borderColor: '#e2e8f0' },
              '&:hover fieldset': { borderColor: '#0040a1' },
            }
          }}
        />
      </Box>

      {/* Table */}
      <Paper sx={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{
                  fontWeight: 800, fontSize: '11px', textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#64748b', bgcolor: '#f8fafc', py: 2
                }}>
                  {t('conge.soldeAdmin.headers.matricule')}
                </TableCell>
                <TableCell sx={{
                  fontWeight: 800, fontSize: '11px', textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#64748b', bgcolor: '#f8fafc', py: 2
                }}>
                  {t('conge.soldeAdmin.headers.employee')}
                </TableCell>
                <TableCell sx={{
                  fontWeight: 800, fontSize: '11px', textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#64748b', bgcolor: '#f8fafc', py: 2
                }}>
                  {t('conge.soldeAdmin.headers.status')}
                </TableCell>
                <TableCell align="center" sx={{
                  fontWeight: 800, fontSize: '11px', textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#64748b', bgcolor: '#f8fafc', py: 2,
                  minWidth: 180
                }}>
                  {t('conge.soldeAdmin.headers.balance')}
                </TableCell>
                <TableCell align="center" sx={{
                  fontWeight: 800, fontSize: '11px', textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#64748b', bgcolor: '#f8fafc', py: 2,
                  width: 100
                }}>
                  {t('conge.soldeAdmin.headers.action')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <PersonIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                      <Typography sx={{ color: '#94a3b8', fontWeight: 600 }}>{t('conge.soldeAdmin.noEmployees')}</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp: any, index: number) => {
                  const empcod = emp.empcod || emp.code;
                  const emplib = emp.emplib || emp.libelle || emp.nom || empcod;
                  const existingSolde = soldeMap[empcod];
                  const hasSolde = !!existingSolde;
                  const currentSolde = existingSolde?.conge ?? 0;
                  const isEditing = editingRows[empcod] !== undefined;
                  const editValue = isEditing ? editingRows[empcod] : String(currentSolde);
                  const isSaving = addSolde.isLoading || updateSolde.isLoading;

                  return (
                    <TableRow
                      key={empcod}
                      sx={{
                        bgcolor: index % 2 === 0 ? '#fff' : '#f8fafc',
                        '&:hover': { bgcolor: '#eff6ff' },
                        transition: 'background-color 0.15s',
                      }}
                    >
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#334155' }}>
                          {empcod}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#0040a1', fontSize: '12px', fontWeight: 700 }}>
                            {(emplib || '?').charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography sx={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                            {emplib}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {hasSolde ? (
                          <Chip
                            label={t('conge.soldeAdmin.status.assigned')}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(5,150,105,0.1)', color: '#059669',
                              fontWeight: 700, fontSize: '10px', borderRadius: '6px'
                            }}
                          />
                        ) : (
                          <Chip
                            label={t('conge.soldeAdmin.status.notAssigned')}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(234,179,8,0.1)', color: '#ca8a04',
                              fontWeight: 700, fontSize: '10px', borderRadius: '6px'
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          type="number"
                          size="small"
                          value={editValue}
                          onChange={e => handleSoldeChange(empcod, e.target.value)}
                          onFocus={() => {
                            if (!isEditing) {
                              setEditingRows(prev => ({ ...prev, [empcod]: String(currentSolde) }));
                            }
                          }}
                          inputProps={{
                            min: 0,
                            step: 0.5,
                            style: { textAlign: 'center', fontWeight: 700, fontSize: '14px', padding: '6px 8px' }
                          }}
                          sx={{
                            width: 120,
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '8px',
                              '& fieldset': {
                                borderColor: isEditing ? '#0040a1' : '#e2e8f0',
                                borderWidth: isEditing ? 2 : 1,
                              },
                              '&:hover fieldset': { borderColor: '#0040a1' },
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={t('conge.soldeAdmin.tooltip.save')}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleSave(empcod, emplib)}
                              disabled={isSaving || !isEditing}
                              sx={{
                                bgcolor: isEditing ? '#0040a1' : 'transparent',
                                color: isEditing ? '#fff' : '#94a3b8',
                                '&:hover': { bgcolor: isEditing ? '#003080' : 'rgba(0,64,161,0.05)' },
                                borderRadius: '8px',
                                transition: 'all 0.2s',
                              }}
                            >
                              {isSaving && isEditing ? (
                                <CircularProgress size={16} color="inherit" />
                              ) : (
                                <SaveIcon sx={{ fontSize: 18 }} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ borderRadius: '12px', fontWeight: 600 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function SoldeCongeAdmin() {
  return (
    <QueryClientProvider client={queryClient}>
      <SoldeCongeAdminInner />
    </QueryClientProvider>
  );
}