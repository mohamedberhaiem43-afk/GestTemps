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
  const { soccod } = useAuth();
  const { t } = useTranslation();
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>();
  const [mode, setMode] = useState<'save' | 'update'>('save');

  const { selectedEmp } = useContext(EmployeeContext);
  
  // Initialize employeData with proper default values
  const getDefaultEmployeData = (): Employe => ({
    empcod: '',
    soccod: soccod || '',
    sitcod: '',
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
    empsbase: 0,
    empsbrut: 0,
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
    empsnet: 0,
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
      // Only reset if there's no existing data
      const defaultData = getDefaultEmployeData();
      setEmployeData(defaultData);
      setCombinedData(defaultData);
      setMode('save');
    }
  }, [selectedEmp]);

  const handleCombinedDataChange = (data: Employe) => {
    setCombinedData(data);
    setEmployeData(data); // Keep employeData in sync
  };
  const { mutate: addEmploye } = useAddEmploye();
  const { mutate: updateEmploye } = useUpdateEmploye();

  // Helper function to safely format dates
  const formatDate = (date: any): Date | null => {
    if (!date) return null;
    
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date;
    }
    
    if (typeof date === 'string') {
      const parsedDate = dayjs(date);
      if (parsedDate.isValid()) {
        return parsedDate.toDate();
      }
    }
    
    return null;
  };

  const saveEmp = () => {
    try {
      const employeToSave: Employe = {
        ...combinedData,
        soccod: soccod || '',
        empemb: formatDate(combinedData.empemb),
        empretraite: formatDate(combinedData.empretraite),
        empsort: formatDate(combinedData.empsort),
        empdcin: formatDate(combinedData.empdcin) || new Date(),
        empoptim: formatDate(combinedData.empoptim),
        // Ensure actif is properly set
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