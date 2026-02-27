import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  Snackbar,
} from '@mui/material';
import SaveIcon from "@mui/icons-material/Save";
import CheckboxComponent from '../../CheckboxComponent/CheckboxComponent';
import InputComponent from '../../Inputs/Input';
import RadioGroupComponent, {
  FormControlLabelComponent,
} from '../../RadioGroupComponent/RadioGroupComponent';
import SelectInputComponent from '../../SelectInputComponent/SelectInputComponent';
import useGetAbsencesLibs from '../../../hooks/absenceHooks/useGetAbsenceLibs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAddSanction from '../../../hooks/sanctionHooks/useAddSanction';
import { Sanction } from '../../../models/Sanction';
import generateNumeroOrdre from '../../helper/GenerateNumOrdre';
import { useAuth } from '../../helper/AuthProvider';

interface Props {
  empcod: string;
  date: string;
  initialData?: Sanction | null;
  onSubmit?: (data: Sanction) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Always returns "YYYY-MM-DD" from any date-like value, with no UTC shift */
const toDateString = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

/** Adds `offset` days to a "YYYY-MM-DD" or ISO string, returns "YYYY-MM-DD" */
const addDays = (dateStr: string, offset: number): string => {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  const d = new Date(year, month - 1, day + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ────────────────────────────────────────────────────────────────────────────

function SaisieAbsence({ empcod, date, initialData, onSubmit }: Props) {
  const { t } = useTranslation();
  const { soccod } = useAuth();
  const { data: absences = [] } = useGetAbsencesLibs();
  const { mutate } = useAddSanction();

  /* ========================
     STATES — all dates stored as "YYYY-MM-DD" strings
  ======================== */

  const [concod, setOrdre] = useState(
    initialData?.concod ?? generateNumeroOrdre()
  );

  const [condat, setDate] = useState<string>(
    initialData?.condat ? toDateString(initialData.condat) : addDays(date, 0)
  );

  const [conref, setReference] = useState(initialData?.conref ?? '');

  const [condep, setDateDepart] = useState<string>(
    initialData?.condep ? toDateString(initialData.condep) : addDays(date, 0)
  );

  const [conret, setDateReprise] = useState<string>(
    initialData?.conret ? toDateString(initialData.conret) : addDays(date, 1)
  );

  const [conamdep, setApresMidiDepart] = useState(
    initialData?.conamdep === '1'
  );
  const [conamret, setApresMidiReprise] = useState(
    initialData?.conamret === '1'
  );
  const [conjour, setTimePeriod] = useState(initialData?.conjour ?? 'J');
  const [abscod, setAbscod] = useState(initialData?.abscod ?? '');
  const [connbjour, setConnbjour] = useState<number>(initialData?.connbjour ?? 1);

  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>('success');

  /* ========================
     EFFECTS
  ======================== */

  useEffect(() => {
    if (initialData) {
      setOrdre(initialData.concod || '');
      setReference(initialData.conref ?? '');
      setAbscod(initialData.abscod ?? '');
      setTimePeriod(initialData.conjour ?? 'J');
      setApresMidiDepart(initialData.conamdep === '1');
      setApresMidiReprise(initialData.conamret === '1');
      if (initialData.condat) setDate(toDateString(initialData.condat));
      if (initialData.condep) setDateDepart(toDateString(initialData.condep));
      if (initialData.conret) setDateReprise(toDateString(initialData.conret));
      if (initialData.connbjour !== undefined) setConnbjour(initialData.connbjour);
    }
  }, [initialData]);

  // Calcul inclusif des jours
useEffect(() => {
  if (!condep || !conret) return;

  const [sy, sm, sd] = condep.split('-').map(Number);
  const [ey, em, ed] = conret.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  if (end < start) {
    setConnbjour(0);
    return;
  }

  const diff = end.getTime() - start.getTime();
  // +1 because both start and end days are inclusive
  let days = Math.floor(diff / (1000 * 3600 * 24));

  // Departure in afternoon → employee misses half the first day
  if (conamdep) days -= 0.5;
  // Return in afternoon → employee misses half the last day  
  if (conamret) days += 0.5;

  setConnbjour(Math.max(0, days));
}, [condep, conret, conamdep, conamret]);

  /* ========================
     HANDLERS
  ======================== */

  const handleSnackbarOpening = (msg: string, sev: 'success' | 'error') => {
    setMessage(msg);
    setSeverity(sev);
    setIsSnackbarOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!abscod) {
      handleSnackbarOpening(t('sanction.fillImputation'), 'error');
      return;
    }

    if (conret < condep) {
      handleSnackbarOpening(t('sanction.invalidDates'), 'error');
      return;
    }

    // Dates sent as plain "YYYY-MM-DD" strings — no Date objects,
    // no JSON serialization UTC shift, arrives at backend exactly as typed.
    const sanctionData: Sanction = {
      soccod,
      empcod,
      concod,
      condat: condat || null,
      conref,
      condep: condep || null,
      conamdep: conamdep ? '1' : '0',
      conret: conret || null,
      conamret: conamret ? '1' : '0',
      connbjour,
      conjour,
      abscod,
      consanc: 'N',
    };

    if (onSubmit) {
      onSubmit(sanctionData);
      return;
    }

    mutate(sanctionData, {
      onSuccess() {
        handleSnackbarOpening(t('sanction.addSuccess'), 'success');
        resetForm();
      },
      onError() {
        handleSnackbarOpening(t('sanction.addError'), 'error');
      },
    });
  };

  const resetForm = () => {
    setOrdre(generateNumeroOrdre());
    setDate(addDays(date, 0));
    setDateDepart(addDays(date, 0));
    setDateReprise(addDays(date, 1));
    setReference('');
    setApresMidiDepart(false);
    setApresMidiReprise(false);
    setTimePeriod('J');
    setAbscod('');
    setConnbjour(1);
  };

  /* ========================
     RENDER
  ======================== */

  return (
    <Box
      component="form"
      sx={{ maxWidth: 1200, mx: 'auto', p: 1 }}
      onSubmit={handleSubmit}
    >
      <Grid container spacing={1.5}>

        <Grid item xs={1}>
          <InputComponent
            type="text"
            label={t('common.orderNumber')}
            value={concod}
            setValue={setOrdre}
          />
        </Grid>

        <Grid item xs={2}>
          <InputComponent
            label={t('common.date')}
            type="date"
            value={condat}
            setValue={setDate}
          />
        </Grid>

        <Grid item xs={1}>
          <InputComponent
            type="text"
            label={t('common.ref')}
            value={conref}
            setValue={setReference}
            required={false}
          />
        </Grid>

        <Grid item xs={2}>
          <InputComponent
            label={t('common.dateStart')}
            type="date"
            value={condep}
            setValue={setDateDepart}
          />
        </Grid>

        <Grid item xs={1.5} mt={2}>
          <CheckboxComponent
            label={t('common.afternoon')}
            value={conamdep}
            setValue={setApresMidiDepart}
          />
        </Grid>

        <Grid item xs={2}>
          <InputComponent
            label={t('common.dateEnd')}
            type="date"
            value={conret}
            setValue={setDateReprise}
          />
        </Grid>

        <Grid item xs={1.5} mt={2}>
          <CheckboxComponent
            label={t('common.afternoon')}
            value={conamret}
            setValue={setApresMidiReprise}
          />
        </Grid>

        <Grid item xs={2}>
          <SelectInputComponent
            label={t('common.imputation')}
            value={abscod}
            setValue={setAbscod}
            maplist={absences}
          />
        </Grid>

        <Grid item xs={4.5} mt={2}>
          <RadioGroupComponent
            value={conjour}
            setValue={setTimePeriod}
          >
            <FormControlLabelComponent
              radioValue="J"
              label={t('common.wholeDay')}
            />
            <FormControlLabelComponent
              radioValue="M"
              label={t('common.mornings')}
            />
            <FormControlLabelComponent
              radioValue="A"
              label={t('common.afternoons')}
            />
          </RadioGroupComponent>
        </Grid>

        <Grid item xs={1}>
          <InputComponent
            type="number"
            label={t('common.nbDays')}
            value={connbjour}
            setValue={setConnbjour}
          />
        </Grid>

        <Grid
          item
          xs={3}
          display="flex"
          justifyContent="space-around"
          mt={2.5}
        >
          <IconButton
            color="primary"
            aria-label={t('common.save')}
            type="submit"
          >
            <SaveIcon />
          </IconButton>

          <Button onClick={resetForm} color="secondary">
            {t('common.new')}
          </Button>
        </Grid>
      </Grid>

      <Snackbar
        open={isSnackbarOpen}
        autoHideDuration={2000}
        onClose={() => setIsSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setIsSnackbarOpen(false)}
          severity={severity}
        >
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default SaisieAbsence;