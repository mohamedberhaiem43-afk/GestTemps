import { useMemo, useState, useContext, useEffect } from 'react';
import {
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { Box, Button, Checkbox, CircularProgress, Dialog, DialogContent, DialogTitle, FormControl, Grid, IconButton, InputLabel, MenuItem, Select, Tooltip, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { EmployeeContext } from './EmployeeContext';
import { useDateRange } from './FilterContext';
import useUpdatePresence from '../../../hooks/presenceHooks/useUpdatePresence';
import useGetEmpEtat from '../../../hooks/presenceHooks/useGetEmpEtat';
import SaisieAbsence from './SaisieAbsence';
import SaisieConge from './SaisieConge';
import SaisieAutorisation from './SaisieAutorisation';
import EmpEtat from '../../../models/EmpEtat';
import { useAuth } from '../../helper/AuthProvider';
import { useTranslation } from 'react-i18next';
import OptimisationPointage from '../Optimisation/OptimisationPointage';
import type {
  MRT_Cell,
  MRT_Column,
  MRT_Row,
  MRT_TableInstance,
} from 'material-react-table';
import { t } from 'i18next';
import InputComponent from '../../Inputs/Input';
import useUpdateCompensation from '../../../hooks/presenceHooks/useUpdateComponsation';
import useGetSanctionDate from '../../../hooks/sanctionHooks/useGetSanctionDate';
import { Sanction } from '../../../models/Sanction';
import useUpdateSanction from '../../../hooks/sanctionHooks/useUpdateSanction';


const Example = ({ empetat }: { empetat: EmpEtat[] }) => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const {mutate:updatePresence} = useUpdatePresence(); 
  const { soccod } = useAuth();
  const { t } = useTranslation();
  const [totcmpValue, setTotcmpValue] = useState<number | ''>('');
// In Example component
const [sanctionData, setSanctionData] = useState<Sanction | null>(null);

const { mutate: updateSanction } = useUpdateSanction();

const handleOpenSanctionDialog = (row: EmpEtat, value: string) => {
  const empcod = row.empcod;
  const date = row.predat;

  if (empcod && date) {
    setSelectedRow(row);
    setSanctionData(null);
    setDialogOpen(false); // ensure closed while fetching

    const motif = value.toLowerCase().includes('cong') ? 'conge' : 'absence';
    setMotif(motif); // set motif early so it's ready

    setFetchSanctionParams({ date, empcod });
  }
};
  const formatDateToLocalISO = (date: Date): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };
  const [fetchSanctionParams, setFetchSanctionParams] = useState<{
  date: string; empcod: string;
} | null>(null);


const { data: fetchedSanction } = useGetSanctionDate(
  fetchSanctionParams?.date ?? '',
  fetchSanctionParams?.empcod ?? '',
);
  // Quand la donnée arrive, ouvrir le bon dialog
  useEffect(() => {
  // Guard: only run when we actually triggered a fetch
  if (!fetchSanctionParams) return;
  
  // Wait until query has resolved (not undefined)
  if (fetchedSanction === undefined) return;
    console.log(fetchedSanction);
  setSanctionData(fetchedSanction ?? null);

  if (fetchedSanction?.abscod) {
    setMotif('absence');
  } else {
    setMotif('conge');
  }

  setDialogOpen(true);
  setFetchSanctionParams(null); // Reset AFTER opening dialog
}, [fetchedSanction, fetchSanctionParams]);  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<EmpEtat | null>(null);
  const [motif, setMotif] = useState<string>('');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const { mutate: updateCompensation, isPending: loadingComp } = useUpdateCompensation();

  const { setSelectedEmpPoste,setDate,setSelectedEmp,setArrondi,setArrondiSup } = useContext(EmployeeContext);

  const handleSaveRow = async ({
    values,
    table,
  }: {
    values: Record<string, any>;
    table: any;
  }) => {
    setValidationErrors({});
    if (!soccod) {
        return;
    }

    const presenceData = {
        predat: formatDateToLocalISO(new Date(values.predat)),
        preentamidiup: values.preentamidiup || "",
        preentmatup: values.preentmatup || "",
        preentsupup: values.preentsupup || "",
        prerepas: values.prerepas || 0,
        prerepos: values.prerepos || "0",
        presortamidiup: values.presortamidiup || "",
        presortmatup: values.presortmatup || "",
        presortsupup: values.presortsupup || "",
        tothnuit: values.tothnuit || "",
        tothre: values.tothre || "",
      };
    
    const encodedPredat = encodeURIComponent(presenceData.predat);
    
    updatePresence(
        { soccod, empcod: empetat[0].empcod, predat: encodedPredat, presence: presenceData },
        {
            onSuccess: () => {
            },
            onError: (error) => {
                console.error("Erreur lors de la mise à jour:", error);
            },
        }
    );

    table.setEditingRow(null);
  };
  
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setMotif('');
    setSelectedRow(null);
    setTotcmpValue('');
    setSanctionData(null);
  };


  const handleOpenDialog = (row: EmpEtat, selectedMotif?: string) => {
    setSelectedRow(row);
    setDialogOpen(true);
    if (selectedMotif) {
      setMotif(selectedMotif);
    }
  };
  const columns = useMemo<any[]>(() => [
    {
      accessorKey: 'predat',
      header: t('empEtatPeriodique.headers.date'),
      size: 80,
      Cell: ({ cell }: { cell: import('material-react-table').MRT_Cell<EmpEtat> }) => {
        const dateValue = cell.getValue();
        return (typeof dateValue === 'string' || typeof dateValue === 'number' || dateValue instanceof Date)
          ? new Date(dateValue).toLocaleDateString()
          : '';
      },
    },
    {
      header: t('empEtatPeriodique.headers.day'),
      accessorFn: (row: EmpEtat) => {
        const date = new Date(row.predat);
        return isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR', { weekday: 'long' });
      },
      id: 'journee',
      size: 30,
    },
    {
      accessorKey: 'prerepos',
      header: t('empEtatPeriodique.headers.rest'),
      size: 10,
      Cell: ({ row }: { row: MRT_Row<EmpEtat> }) => (
        <Checkbox
          size="small"
          checked={row.getValue('prerepos') === '1'}
          disabled
        />
      ),
      Edit: ({
        column,
        row,
        table,
      }: {
        cell: MRT_Cell<EmpEtat>;
        column: MRT_Column<EmpEtat>;
        row: MRT_Row<EmpEtat>;
        table: MRT_TableInstance<EmpEtat>;
      }) => (
        <Checkbox
          size="small"
          checked={row.getValue(column.id) === '1'}
          onChange={(e) => {
            row._valuesCache[column.id] = e.target.checked ? '1' : '0';
            table.setEditingRow(row);
          }}
        />
      ),
    },
    {
      accessorKey: 'preentmatup',
      header: t('empEtatPeriodique.headers.entry1'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
        required: true,
      },
    },
    {
      accessorKey: 'presortmatup',
      header: t('empEtatPeriodique.headers.exit1'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
        required: true,
      },
    },
    {
      accessorKey: 'prerepas',
      header: t('empEtatPeriodique.headers.meal'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
      },
    },
    {
      accessorKey: 'preentamidiup',
      header: t('empEtatPeriodique.headers.entry2'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
      },
    },
    {
      accessorKey: 'presortamidiup',
      header: t('empEtatPeriodique.headers.exit2'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
      },
    },
    {
      accessorKey: 'preentsupup',
      header: t('empEtatPeriodique.headers.entry3'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
      },
    },
    {
      accessorKey: 'presortsupup',
      header: t('empEtatPeriodique.headers.exit3'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'time',
      },
    },
    {
      accessorKey: 'poicod',
      header: t('empEtatPeriodique.headers.clockingMachine'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
    {
      accessorKey: 'totalHeure',
      header: t('empEtatPeriodique.headers.totalHour'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
    {
      accessorKey: 'tothnuit',
      header: t('empEtatPeriodique.headers.nightHour'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
      },
    },
    {
      accessorKey: 'tothsup',
      header: t('empEtatPeriodique.headers.overtimeHour'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
      },
      // Signalisation des h.supp selon l'état de validation (exigence produit
      // 2026-05) — depuis le passage en mode strict, AUCUNE h.supp n'est payée
      // sans demande approuvée. On le matérialise visuellement pour que
      // l'employé/RH comprenne pourquoi le total payable peut être inférieur
      // au total pointé :
      //   • null + tothsup>0  → triangle ambre « non validé » (pas de demande)
      //   • Pending / Mixed    → sablier orange
      //   • Rejected / Mixed   → croix rouge + barré
      //   • Approved (couvert) → affichage standard
      Cell: ({ cell, row }: { cell: import('material-react-table').MRT_Cell<EmpEtat>; row: MRT_Row<EmpEtat> }) => {
        const value = cell.getValue<string>();
        const status = row.original.overtimeRequestStatus ?? null;
        const rejected = row.original.overtimeRejectedHours ?? 0;
        const pending = row.original.overtimePendingHours ?? 0;
        const comment = row.original.overtimeDecisionComment;

        // tothsup arrive en string "HH:MM" — "00:00" / vide = pas d'h.supp,
        // on garde l'affichage neutre sans warning.
        const trimmed = (value ?? '').trim();
        const hasOvertime = trimmed !== '' && trimmed !== '00:00' && trimmed !== '0' && trimmed !== '0:00';

        // Aucune demande mais des h.supp détectées dans le pointage →
        // mention « non validé » : ces heures n'apparaîtront pas dans le total
        // payable tant qu'aucune demande n'est soumise et approuvée.
        if (!status && hasOvertime) {
          return (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <span style={{ color: '#b45309' }}>{value}</span>
              <Tooltip
                title={
                  <span style={{ whiteSpace: 'pre-line' }}>
                    {`Heures supp. non validées (${value}).\nAucune demande soumise — ces heures ne sont pas comptées dans la paie tant qu'un manager/admin ne les approuve pas.`}
                  </span>
                }
                arrow
              >
                <WarningAmberIcon sx={{ fontSize: 14, color: '#b45309' }} />
              </Tooltip>
            </Box>
          );
        }

        // Pas de demande et pas d'h.supp → affichage standard.
        if (!status) {
          return <span>{value}</span>;
        }

        // Refusée (totale ou partielle Mixed avec un Rejected) → croix rouge + tooltip.
        if (status === 'Rejected' || (status === 'Mixed' && rejected > 0)) {
          const tooltipText = [
            `Heures supp. refusées : ${rejected.toFixed(2)}h`,
            'Non comptées dans la paie.',
            comment ? `Motif : ${comment}` : null,
          ].filter(Boolean).join('\n');
          return (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{value}</span>
              <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{tooltipText}</span>} arrow>
                <CancelIcon sx={{ fontSize: 14, color: '#dc2626' }} />
              </Tooltip>
            </Box>
          );
        }

        // En attente → sablier orange + tooltip.
        if (status === 'Pending' || (status === 'Mixed' && pending > 0)) {
          return (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <span>{value}</span>
              <Tooltip title={`Heures supp. en attente de validation (${pending.toFixed(2)}h).`} arrow>
                <HourglassEmptyIcon sx={{ fontSize: 14, color: '#d97706' }} />
              </Tooltip>
            </Box>
          );
        }

        // Approuvée → on garde l'affichage standard (la valeur est déjà comptée).
        return <span>{value}</span>;
      },
    },
    {
      accessorKey: 'tothre',
      header: t('empEtatPeriodique.headers.total'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
    {
      accessorKey: 'jour',
      header: t('empEtatPeriodique.headers.dayLabel'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
    {
      accessorKey: 'etat',
      header: t('empEtatPeriodique.headers.state'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
      },
      Cell: ({ cell, row }: { cell: import('material-react-table').MRT_Cell<EmpEtat>; row: MRT_Row<EmpEtat> }) => {
        const value = cell.getValue<string>();
        const hasValue = value !== null && value !== undefined && value.trim() !== '';
        
        // Define colors based on state
        let backgroundColor = 'transparent';
        let color = 'inherit';
        
        if (hasValue) {
          const lowerVal = value.toLowerCase();
          if (lowerVal.includes('abs')) {
            backgroundColor = '#dc2626'; // Red-600
            color = '#ffffff';
          } else if (lowerVal.includes('cong')) {
            backgroundColor = '#dbeafe'; // Blue-100
            color = '#1e40af'; // Blue-800
          } else if (lowerVal.includes('aut')) {
            backgroundColor = '#fef9c3'; // Yellow-100
            color = '#854d0e'; // Yellow-800
          } else if (lowerVal.includes('repos')) {
            backgroundColor = '#dcfce7'; // Green-100
            color = '#166534'; // Green-800
          } else if (lowerVal.includes('féri')) {
            backgroundColor = '#f3e8ff'; // Purple-100
            color = '#6b21a8'; // Purple-800
          } else {
            backgroundColor = '#f1f5f9'; // Slate-100
            color = '#475569'; // Slate-800
          }
        }

        return (
          <Box
            sx={{
              backgroundColor: backgroundColor,
              color: color,
              padding: '4px 8px',
              borderRadius: '4px',
              fontWeight: hasValue ? 700 : 400,
              fontSize: '11px',
              textAlign: 'center',
              cursor: hasValue ? 'pointer' : 'default',
              boxShadow: hasValue && !value.toLowerCase().includes('repos') ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              textTransform: 'uppercase'
            }}
            onDoubleClick={() => {
              if (hasValue && !value.toLowerCase().includes('repos') && !value.toLowerCase().includes('féri')) {
                handleOpenSanctionDialog(row.original, value);
              }
            }}
          >
            {value}
          </Box>
        );
      },
    },
    {
      accessorKey: 'preobs',
      header: t('empEtatPeriodique.headers.observation'),
      size: 30,
      muiEditTextFieldProps: {
        type: 'text',
      },
      Cell: ({ row }:any) => {
        const totcmp = row.original.totcmp;
        const preobs = row.original.preobs;

        if (totcmp && Number(totcmp) !== 0) {
          return `Compensation(${totcmp})`;
        }

        return preobs ?? '';
      },
    },

    {
      accessorKey: 'totret',
      header: t('empEtatPeriodique.headers.late'),
      size: 10,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
    {
      accessorKey: 'hreaut',
      header: t('empEtatPeriodique.headers.hraut'),
      size: 10,
    },
    {
      accessorKey: 'tothabs',
      header: t('empEtatPeriodique.headers.totalAbsence'),
      size: 10,
      Cell: ({ cell }: { cell: import('material-react-table').MRT_Cell<EmpEtat> }) => {
        const value = cell.getValue<string>();
        const hasAbsence = value && value !== '00:00';
        return (
          <Box sx={{ color: hasAbsence ? '#dc2626' : 'inherit', fontWeight: hasAbsence ? 700 : 400 }}>
            {value}
          </Box>
        );
      },
    },
    {
      accessorKey: 'totcmp',
      header: t('empEtatPeriodique.headers.totcmp'),
      size: 10,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
    {
      accessorKey: 'predouche',
      header: t('empEtatPeriodique.headers.shower'),
      size: 10,
      muiEditTextFieldProps: {
        type: 'text',
        required: true,
      },
    },
  ], [validationErrors]);

  const table = useMaterialReactTable({
    columns,
    enablePagination: true,
    initialState: {
    pagination: {
      pageSize: 5,
      pageIndex: 0,
    },
  },
    pageCount: 5,
    data: empetat,
    enableEditing: true,
    createDisplayMode: 'row',
    editDisplayMode: 'row',
    enableColumnPinning: true,
    enableColumnDragging: true,
    getRowId: (row) => row.empcod + '-' + row.predat,
    onEditingRowSave: handleSaveRow,
    renderRowActions: ({ row, table }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title={t('common.edit')}>
          <IconButton onClick={() => table.setEditingRow(row)}>
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('empEtatPeriodique.actions.more')}>
          <IconButton
            color="primary"
            onClick={() => handleOpenDialog(row.original)}
          >
            +
          </IconButton>
        </Tooltip>
      </Box>
    ),
    muiTableBodyRowProps: ({ row }) => {
      const isRepos = row.original.prerepos === '1';
      const isAbsence = row.original.etat?.toLowerCase().includes('abs');
      const isIncomplete =
        (row.original.preentmatup && !row.original.presortmatup) ||
        (row.original.preentamidiup && !row.original.presortamidiup) ||
        (row.original.preentsupup && !row.original.presortsupup);

      const rowId = row.id;

      return {
        onClick: () => {
          setSelectedEmpPoste({
            codposte: row.original.codposte,
            day: new Date(row.original.predat).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
          });
          setArrondi(row.original.arrondi || 0);
          setArrondiSup(row.original.arrhsup || 0);
          setSelectedEmp(row.original.empcod);
          setDate(row.original.predat);
          setSelectedRowId(rowId);
        },
        sx: {
          cursor: 'pointer',
          backgroundColor:
            selectedRowId === rowId
              ? 'rgba(25, 118, 210, 0.2)'
              : isAbsence
              ? 'rgba(220, 38, 38, 0.1)' // Very light red for absence
              : isRepos
              ? 'rgba(0, 255, 0, 0.05)'
              : isIncomplete
              ? 'rgba(255, 165, 0, 0.1)' // Orange for incomplete
              : 'transparent',
          transition: 'background-color 0.2s ease',
        },
      };
    },
    muiTableBodyCellProps: {
      sx: {
        padding: '0',
        fontSize: '0.875rem',
      },
    },
  });

  return (
    <>
      <MaterialReactTable table={table} />
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        sx={{
          '& .MuiDialog-container': {
            alignItems: 'center',
          },
          '& .MuiDialog-paper': {
            margin: { xs: 0, sm: '32px' },
            width: { xs: '70%', sm: 'auto' },
            maxWidth: { xs: '100%', sm: '500px' },
          },
        }}
      >
      <DialogTitle>{t('empEtatPeriodique.enterReason')}</DialogTitle>
      <DialogContent>
          <FormControl size='small' fullWidth sx={{ mt: 2 }}>
            <InputLabel>{t('empEtatPeriodique.reason')}</InputLabel>
            <Select
              size='small'
              variant='standard'
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              label="Motif"
            >
              <MenuItem value={'absence'}>{t('empEtatPeriodique.menu.absence')}</MenuItem>
              <MenuItem value={'conge'}>{t('empEtatPeriodique.menu.conge')}</MenuItem>
              <MenuItem value={'autorisation'}>{t('empEtatPeriodique.menu.autorisation')}</MenuItem>
              <MenuItem value={'optimisation'}>{t('empEtatPeriodique.menu.optimisation')}</MenuItem>
              <MenuItem value={'compensation'}> {t('empEtatPeriodique.menu.compensation')}</MenuItem>

            </Select>
          </FormControl>
          {motif === 'absence' && (
          <SaisieAbsence empcod={selectedRow?.empcod || ''} date={selectedRow?.predat || ''} initialData={sanctionData}
            onSubmit={(data:any) => {
              updateSanction(data, {
                onSuccess: () => {
                  handleCloseDialog();
                },
              });
            }}
          />
        )}
        {motif === 'conge' && (
          <SaisieConge empcod={selectedRow?.empcod || ''} date={selectedRow?.predat || ''} 
          />
        )}
          {motif === 'autorisation' && <SaisieAutorisation date={selectedRow?.predat} empcod={selectedRow?.empcod || ''} />}
          {motif === 'compensation' && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 3 }}>

              <Grid item xs={5}>
                <InputComponent
                  type={'number'}
                  label={'Nb.Heures'}
                  value={totcmpValue}
                  setValue={setTotcmpValue}
                />
              </Grid>

              <Button
                variant="contained"
                disabled={totcmpValue === '' || !selectedRow || loadingComp}
                onClick={() => {
                  if (!selectedRow || !soccod) return;

                  const dateISO = formatDateToLocalISO(new Date(selectedRow.predat));

                  updateCompensation(
                    {
                      soccod,
                      empcod: selectedRow.empcod,
                      date: dateISO,
                      totcmp: Number(totcmpValue),
                    },
                    {
                      onSuccess: () => {
                        handleCloseDialog();
                      },
                    }
                  );
                }}
              >
                Confirmer
              </Button>

            </Box>
          )}


          {motif === 'optimisation' && (
            <OptimisationPointage 
              empcod={selectedRow?.empcod || ''} 
              date={selectedRow?.predat || ''} 
              onSuccess={() => { setDialogOpen(false); }} 
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};


function EmpEtatPeriodique() {
  const { selectedEmpMat } = useContext(EmployeeContext);
  const { setEmpEtatData } = useContext(EmployeeContext);
  const { dateRange } = useDateRange() as { dateRange: { dateDebut: Date; dateFin: Date; pres?: string; mois: string } };
  const { soccod } = useAuth();
  const { data: empetat = [], isLoading: loading, error } = useGetEmpEtat({ soccod, selectedEmpMat, dateRange });

useEffect(() => {
  if (!selectedEmpMat) {
    setEmpEtatData([]);
    return;
  }

    setEmpEtatData(empetat);

}, [selectedEmpMat, empetat]);
  
  return (
      <>
      {loading ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "300px",
          }}
        >
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2 }}>
            {t('loading.loading')}
          </Typography>
        </Box>
      ) : error ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "300px",
          }}
        >
          <Typography variant="body2" color="error">
            {t('empEtatPeriodique.errorLoading')}
          </Typography>
        </Box>
      ) : (
        <Example empetat={empetat} />
      )}
      </>
  );
}

export default EmpEtatPeriodique;