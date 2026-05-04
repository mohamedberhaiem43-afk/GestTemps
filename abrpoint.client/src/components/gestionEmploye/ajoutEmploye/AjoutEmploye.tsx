import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import './AjoutEmploye.css'
import EmployeDetails from '../EmployeDetails/EmployeDetails';
import { Alert, Button, IconButton, Snackbar, Tooltip } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Item } from '../../helper/Item/Item';
import Employe from '../../../models/Employe';
import { EmployeeContext, EmployeeProvider } from '../../Pointeuse/EtatPeriodique/EmployeeContext';
import SaveIcon from '@mui/icons-material/Save';
import useAddEmploye from '../../../hooks/employeHooks/useAddEmploye';
import useUpdateEmploye from '../../../hooks/employeHooks/useUpdateEmploye';
import { useAuth } from '../../helper/AuthProvider';
import { useTranslation } from 'react-i18next';

export default function BasicGrid() {
  const { soccod, sitcod } = useAuth();
  const { t } = useTranslation();
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>();
  const [mode, setMode] = useState<'save' | 'update'>('save');

  const { selectedEmp } = useContext(EmployeeContext);
  
  const getDefaultEmployeData = (): Employe => ({
    empcod: '',
    soccod: soccod || '',
    sitcod: sitcod || '',
    emplib: '',
    empmat: '',
    empsexe: '',
    sercod: '',
    empfonc: '',
    empelon: '',
    empreg: '',
    catcod: '',
    empnbp: 0,
    natcod: '',
    vilcod: '',
    empadr: '',
    empferepos: '',
    emptel: '',
    empmob: '',
    empemb: null,
    empsort: null,
    empmotif: '',
    actif: 'N',
    empdnais: '',
    emplnais: '',
    empcin: '',
    empdcin: null,
    empacin: '',
    empsbase: '',
    empsbrut: '',
    empdir: '',
    emptype: '',
    empniv: '',
    emplibar: '',
    empadrar: '',
    empfoncar: '',
    foncod: '',
    quacod: '',
    empmaxhre: 0,
    empoptim: null,
    dircod: '',
    empretraite: null,
    caltype: '',
    empmaxjour: 0,
    empretard: '0',
    empemail: '',
    empresp: '',
    empsnet: '',
    empcontrat: '',
    empsitfam: '',
    empech: '',
    empcat: '',
    empscat: '',
    empnuit: '',
    empminhjour: 0,
    emppanier: '',
    seccod: '',
    poscod: '',
    parmois: '',
  });

  const [employeData, setEmployeData] = useState<Employe>(getDefaultEmployeData());
  const [combinedData, setCombinedData] = useState<Employe>(getDefaultEmployeData());

  useEffect(() => {
    if (selectedEmp && selectedEmp.empcod) {
      setEmployeData(selectedEmp);
      setCombinedData(selectedEmp);
      setMode('update');
    } else if (!combinedData.empcod) {
      const defaultData = getDefaultEmployeData();
      setEmployeData(defaultData);
      setCombinedData(defaultData);
      setMode('save');
    }
  }, [selectedEmp]);

  const handleCombinedDataChange = (data: Employe) => {
    setCombinedData(data);
    setEmployeData(data);
  };
  const { mutate: addEmploye } = useAddEmploye();
  const { mutate: updateEmploye } = useUpdateEmploye();

  // Ancre la date à midi UTC pour empêcher les décalages de jour lors de la
  // sérialisation JSON (Date.toISOString convertit en UTC). Sans ça, en GMT+1
  // une saisie « 2026-05-04 » devient « 2026-05-03T23:00Z » → enregistrée en
  // base comme 2026-05-03 (la veille).
  const formatDate = (date: any): Date | null => {
    if (!date) return null;
    let y: number, m: number, d: number;
    if (date instanceof Date && !isNaN(date.getTime())) {
      y = date.getFullYear(); m = date.getMonth(); d = date.getDate();
    } else if (typeof date === 'string') {
      const parsedDate = dayjs(date);
      if (!parsedDate.isValid()) return null;
      y = parsedDate.year(); m = parsedDate.month(); d = parsedDate.date();
    } else {
      return null;
    }
    return new Date(Date.UTC(y, m, d, 12, 0, 0));
  };

  const saveEmp = () => {
    try {
      const employeToSave: Employe = {
        ...combinedData,
        soccod: soccod || '',
        sitcod: sitcod || '',
        empemb: formatDate(combinedData.empemb),
        empretraite: formatDate(combinedData.empretraite),
        empsort: formatDate(combinedData.empsort),
        empdcin: formatDate(combinedData.empdcin) || new Date(),
        empoptim: formatDate(combinedData.empoptim),
        actif: combinedData.actif,
      };

      
      addEmploye(employeToSave, {
        onSuccess: (res: any) => {
          setMessage(res.message || t('employe.addSuccess'));
          setSeverity('success');
          setIsSnackbarOpen(true);
        },
        onError: (error: any) => {
          console.error('Error saving employee:', error);
          const errorMessage = error?.response?.data?.message || t('employe.addError');
          setMessage(errorMessage);
          setSeverity('error');
          setIsSnackbarOpen(true);
        },
      });
    } catch (error) {
      console.error('Error preparing employee data:', error);
      setMessage(t('employe.prepareError'));
      setSeverity('error');
      setIsSnackbarOpen(true);
    }
  };

  const updateEmp = () => {
    try {
      const employeToUpdate: Employe = {
        ...combinedData,
        soccod: soccod || '',
        sitcod: sitcod || '',
        actif: combinedData.actif,
        empemb: formatDate(combinedData.empemb),
        empretraite: formatDate(combinedData.empretraite),
        empsort: formatDate(combinedData.empsort),
        empdcin: formatDate(combinedData.empdcin),
        empoptim: formatDate(combinedData.empoptim),
      };
      
      updateEmploye(employeToUpdate, {
        onSuccess: (res: any) => {
          setMessage(res.message || t('employe.updateSuccess'));
          setSeverity('success');
          setIsSnackbarOpen(true);
        },
        onError: (error: any) => {
          console.error('Error updating employee:', error);
          const errorMessage = error?.response?.data?.message || t('employe.updateError');
          setMessage(errorMessage);
          setSeverity('error');
          setIsSnackbarOpen(true);
        },
      });
    } catch (error) {
      console.error('Error preparing employee update data:', error);
      setMessage('Erreur lors de la préparation des données');
      setSeverity('error');
      setIsSnackbarOpen(true);
    }
  };

  const queryClient = new QueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <EmployeeProvider>
        <Box sx={{ flexGrow: 1 }} maxWidth={'97vw'} mt={-2} height={'55vh'}>
          <Grid item sx={{ float: 'right' }} position={'fixed'} top={60} right={0}>
            <Tooltip title={mode === 'save' ? t('employe.save') : t('employe.update')}>
              <IconButton color="primary" onClick={mode === 'save' ? saveEmp : updateEmp}>
                <Button
                  variant="contained"
                  color="primary"
                  component="span"
                  startIcon={<SaveIcon />}
                >
                </Button>
              </IconButton>
            </Tooltip>
          </Grid>
          <Grid container spacing={1}>
            <Grid item xs={12} maxHeight={50}>
              <Item>
                <EmployeDetails 
                  onCombinedDataChange={handleCombinedDataChange}
                  empData={employeData} 
                />
              </Item>
            </Grid>
          </Grid>
          <Snackbar open={isSnackbarOpen} autoHideDuration={6000} onClose={() => setIsSnackbarOpen(false)}>
            <Alert onClose={() => setIsSnackbarOpen(false)} severity={severity}>
              {message}
            </Alert>
          </Snackbar>
        </Box>
      </EmployeeProvider>
    </QueryClientProvider>
  );
}
