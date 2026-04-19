import { Alert, Box, Button, Divider, Grid, Paper, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { FilterAlt } from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';
import SelectInputComponent from '../../../SelectInputComponent/SelectInputComponent';
import InputComponent from '../../../Inputs/Input';
import useGetSiteLibs from '../../../../hooks/siteHooks/useGetSiteLibs';
import useGetServiceLibs from '../../../../hooks/serviceHooks/useGetServiceLibs';
import useRenouvellementContrat from '../../../../hooks/contratHooks/useRenouvellementContrat';
import { Contrat } from '../../../../models/Contrat';
import generateNumeroOrdre from '../../../helper/GenerateNumOrdre';
import getTodayDate from '../../../helper/TimeConverter/TodayDate';
import { useAuth } from '../../../helper/AuthProvider';

export interface Filters {
  sitcod?: string;
  srvcod?: string;
  echdeb?: string;
  echfin?: string;
}

interface FiltrageRenouvellementProps {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  selectedContract: Contrat | null;
  onApplyFilters: () => void;
  onRenewSuccess?: () => void;
}

const contractTypes = {
  '0': 'CDD',
  '1': 'CDI',
  '2': 'Ouvrier',
  '3': 'CIVP',
};

const addDays = (dateValue: string, days: number) => {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const calculateMonths = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  return ((endDate.getFullYear() - startDate.getFullYear()) * 12) + endDate.getMonth() - startDate.getMonth() + 1;
};

function FiltrageRenouvellement({ filters, setFilters, selectedContract, onApplyFilters, onRenewSuccess }: FiltrageRenouvellementProps) {
  const { soccod, hasPermission } = useAuth();
  
  const canAdd = hasPermission('Contrats et Avenants', 'add');
  const canModify = hasPermission('Contrats et Avenants', 'modify');
  const canRenew = canAdd || canModify;
  const { sitcod = '', srvcod = '', echdeb = '', echfin = '' } = filters || {};
  const [newConcod, setNewConcod] = useState(generateNumeroOrdre());
  const [contractDate, setContractDate] = useState(getTodayDate());
  const [newContractDate, setNewContractDate] = useState(getTodayDate());
  const [newContractEndDate, setNewContractEndDate] = useState(getTodayDate());
  const [newContractMonthNumber, setNewContractMonthNumber] = useState(1);
  const [typeContrat, setTypeContrat] = useState('0');
  const [observations, setObservations] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const { data: services = [] } = useGetServiceLibs();
  const { data: filiale = [] } = useGetSiteLibs();
  const mutation = useRenouvellementContrat();

  const selectedContractType = useMemo(() => selectedContract?.contype || '0', [selectedContract]);

  useEffect(() => {
    if (!selectedContract) return;

    const baseDate = selectedContract.empsort
      ? new Date(selectedContract.empsort).toISOString().split('T')[0]
      : getTodayDate();
    const suggestedStart = addDays(baseDate, 1);

    setNewConcod(generateNumeroOrdre());
    setContractDate(getTodayDate());
    setNewContractDate(suggestedStart);
    setNewContractEndDate(suggestedStart);
    setNewContractMonthNumber(1);
    setTypeContrat(selectedContract.contype || '0');
    setObservations(selectedContract.empmotif || '');
  }, [selectedContract]);

  useEffect(() => {
    if (newContractDate && newContractEndDate) {
      setNewContractMonthNumber(calculateMonths(newContractDate, newContractEndDate));
    }
  }, [newContractDate, newContractEndDate]);

  const updateFilters = (key: keyof Filters, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleCreateContract = () => {
    if (!selectedContract) {
      setSnackbar({ open: true, message: 'Sélectionnez d\'abord un contrat à renouveler dans la liste.', severity: 'error' });
      return;
    }

    if (!newConcod || !contractDate || !newContractDate || !newContractEndDate || newContractMonthNumber <= 0) {
      setSnackbar({ open: true, message: 'Veuillez remplir correctement les informations du nouveau contrat.', severity: 'error' });
      return;
    }

    mutation.mutate(
      {
        soccod: soccod || '',
        sourceConcod: selectedContract.concod,
        newConcod,
        condat: contractDate,
        startDate: newContractDate,
        endDate: newContractEndDate,
        monthNumber: newContractMonthNumber,
        contype: typeContrat,
        empmotif: observations,
        empcontrat: selectedContract.empcontrat || '',
      },
      {
        onSuccess: (response: any) => {
          setSnackbar({
            open: true,
            message: response?.message || 'Contrat renouvelé avec succès.',
            severity: 'success',
          });
          setNewConcod(generateNumeroOrdre());
          onRenewSuccess?.();
        },
        onError: (error: any) => {
          setSnackbar({
            open: true,
            message: error?.response?.data?.message || 'Echec du renouvellement du contrat.',
            severity: 'error',
          });
        },
      }
    );
  };

  return (
    <Stack spacing={1.5}>
      {/* â”€â”€ Filtres â”€â”€ */}
      <Paper elevation={0} sx={{ px: 2, py: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={3} sm={3}>
            <SelectInputComponent
              label="Filiale"
              value={sitcod}
              setValue={(value: string) => updateFilters('sitcod', value)}
              maplist={filiale}
            />
          </Grid>
          <Grid item xs={3} sm={3}>
            <SelectInputComponent
              label="Service"
              value={srvcod}
              setValue={(value: string) => updateFilters('srvcod', value)}
              maplist={services}
            />
          </Grid>
          <Grid item xs={3} sm={3}>
            <InputComponent
              type="date"
              label="Échance début"
              value={echdeb}
              setValue={(value: string) => updateFilters('echdeb', value)}
            />
          </Grid>
          <Grid item xs={3} sm={3}>
            <InputComponent
              type="date"
              label="Échance fin"
              value={echfin}
              setValue={(value: string) => updateFilters('echfin', value)}
            />
          </Grid>
          <Grid item xs={12}>
            <Box display="flex" justifyContent="flex-end">
              <Button variant="contained" startIcon={<FilterAlt />} onClick={onApplyFilters}>
                Filtrer
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* â”€â”€ Nouveau contrat â”€â”€ */}
      <Paper elevation={0} sx={{ px: 2, py: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={1.5}>

          {/* Header + source info inline */}
          <Box display="flex" alignItems="baseline" gap={1.5} flexWrap="wrap">
            <Typography variant="subtitle1" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
              Nouveau contrat
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedContract
                ? `Source : ${selectedContract.concod} à l'Employé ${selectedContract.empcod}`
                : 'Choisissez un contrat dans la liste pour préremplir le renouvellement.'}
            </Typography>
          </Box>

          {/* Row 1 : identifiants */}
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={3} sm={3}>
              <InputComponent type="text" label="Contrat source" value={selectedContract?.concod || ''} readOnly />
            </Grid>
            <Grid item xs={3} sm={3}>
              <InputComponent type="text" label="Employé" value={selectedContract?.empcod || ''} readOnly />
            </Grid>
            <Grid item xs={3} sm={3}>
              <InputComponent type="text" label="N° nouveau contrat" value={newConcod} setValue={setNewConcod} />
            </Grid>
            <Grid item xs={3} sm={3}>
              <InputComponent type="date" label="Date contrat" value={contractDate} setValue={setContractDate} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 0 }} />

          {/* Row 2 : dates + durÃ©e + type */}
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={3} sm={3}>
              <InputComponent type="date" label="Date début" value={newContractDate} setValue={setNewContractDate} />
            </Grid>
            <Grid item xs={3} sm={3}>
              <InputComponent type="date" label="Date fin" value={newContractEndDate} setValue={setNewContractEndDate} />
            </Grid>
            <Grid item xs={3} sm={2}>
              <InputComponent
                type="number"
                label="Nb. mois"
                value={newContractMonthNumber}
                setValue={(value: string) => setNewContractMonthNumber(Number(value))}
              />
            </Grid>
            <Grid item xs={3} sm={4}>
              <SelectInputComponent
                label="Type contrat"
                value={typeContrat || selectedContractType}
                setValue={setTypeContrat}
                maplist={contractTypes}
              />
            </Grid>
          </Grid>

          {/* Row 3 : observations + action inline */}
          <Box display="flex" gap={1.5} alignItems="flex-start">
            <TextField
              label="Observations"
              multiline
              minRows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              fullWidth
              size="small"
            />
            {canRenew && (
              <Button
                variant="contained"
                onClick={handleCreateContract}
                disabled={mutation.isLoading}
                sx={{ whiteSpace: 'nowrap', alignSelf: 'center', height: 40 }}
              >
                {mutation.isLoading ? 'En cours...' : 'Valider'}
              </Button>
            )}
          </Box>

        </Stack>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((c) => ({ ...c, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((c) => ({ ...c, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

export default FiltrageRenouvellement;