import {
  Box,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Typography,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from '@mui/material';
import FilterPointageMois from './FilterPointageMois';
import WeeklyHoursTable from './WeeklyHoursTable';
import { DateMoisPointageRangeProvider, useDateMoisPointageRange } from './FilterPointageMoisContext';
import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { PointageMois } from '../../../models/PointageMois';
import DataList from '../../lists/list';
import { MRT_ColumnDef } from 'material-react-table';
import { getWeeksFromStartToSunday } from '../../helper/HelperFunctions';
import GetPointageMoisService from '../../../services/GetPointageMoisService';
import CheckboxComponent from '../../CheckboxComponent/CheckboxComponent';
import CloseIcon from '@mui/icons-material/Close';

const PointageDuMoisContent = () => {
  const context = useDateMoisPointageRange();
  const dateRange = context?.dateRange;

  const mois = dateRange?.mois || '';
  const annee = dateRange?.annee || '2025';
  const semaine = dateRange?.semaine || '1';
  const debutmois = dateRange?.dateDebut;
  const finmois = dateRange?.dateFin;
  const empcods = dateRange?.empcods || [];
  const [openDialog, setOpenDialog] = useState(false);

  const [selectedEmp, setSelectedEmp] = useState<PointageMois | null>(null);
  const [pointageMois, setPointageMois] = useState<PointageMois[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeekDetails, setSelectedWeekDetails] = useState<Record<string, string> | null>(null);
  const [majorerHeures, setMajorerHeures] = useState<boolean>(false);

  const weekRanges = (debutmois && finmois) ? getWeeksFromStartToSunday(debutmois, finmois) : [];

  const queryParams = new URLSearchParams();
  empcods.forEach(code => queryParams.append("empcods", code));
  const queryString = queryParams.toString();

  useEffect(() => {
    if (mois !== '') {
      setLoading(true);
      setError(null);

      GetPointageMoisService.getAllWithParams(
        `${sessionStorage.getItem('soccod')}/${mois}/${annee}/${semaine}?${queryString}`
      )
        .then((response) => {
          const pointageData = response.map((item: any) => ({
            ...item,
            heuresSupplementairesResultats: item.heuresSupplementairesResultats || [],
          }));
          setPointageMois(pointageData);
          setSelectedEmp(null);
        })
        .catch((error) => {
          console.error('Error fetching pointage data:', error);
          setError("Erreur lors du chargement des données.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [dateRange]);

  const columns = useMemo<MRT_ColumnDef<PointageMois>[]>(
    () => [
      {
        id: 'employeDetails',
        header: '',
        columns: [
          { accessorKey: 'empCode', header: 'Code', size: 60 },
          { accessorKey: 'empMat', header: 'Matricule', size: 50 },
          { accessorKey: 'empLib', header: 'Nom et Prénom', size: 60 },
          { accessorKey: 'empReg', header: 'Régime', size: 50 },
        ],
      },
    ],
    []
  );

  // 🌀 Indicateur de chargement
  // if (loading) {
  //   return (
  //     <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh" width={'95vw'} >
  //       <CircularProgress />
  //       <Typography mt={2} color="text.secondary">
  //         Chargement des pointages en cours...
  //       </Typography>
  //     </Box>
  //   );
  // }

  // ⚠️ Affichage de l'erreur
  if (error) {
    return (
      <Box textAlign="center" mt={4}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // ✅ Affichage normal après chargement
  return (
    <Box p={4} sx={{ minHeight: '100vh' }}>
      <Grid container spacing={2}>
        {/* 🔹 Filtre */}
        {
          !loading && (
          <Grid item xs={12}>
            <FilterPointageMois />
          </Grid>
          )
        }

        {/* 🔹 Loader */}
        {loading && (
          <Grid item xs={12}>
            <Box display="flex" justifyContent="center" alignItems="center" mt={2} height={'60vh'} width={'90vw'} >
              <CircularProgress size={24} />
            </Box>
          </Grid>
        )}

        {/* 🔹 Contenu principal */}
        {!loading && (
          <>
            {/* Ligne principale : DataList + Tableau principal */}
            <Grid item xs={3}>
              <Box display="flex" flexDirection="column" gap={1}>
                <CheckboxComponent
                  label="Majorer H.Férié et Congé aux Hre Normales"
                  value={majorerHeures}
                  setValue={setMajorerHeures}
                />

                <DataList
                  data={pointageMois}
                  columns={columns}
                  message="Êtes-vous sûr de vouloir supprimer cet employé ?"
                  deleteMethod={undefined}
                  idKey="empCode"
                  refetchMethod={undefined}
                  reportGeneration1={undefined}
                  reportGeneration2={undefined}
                  reportGeneration3={undefined}
                  reportGeneration4={undefined}
                  empHoraires={undefined}
                  actions={false}
                  onRowClick={(row) => setSelectedEmp(row)}
                  setData={undefined}
                  pageSize={10}   
                  purge={undefined}
                />
              </Box>
            </Grid>

            <Grid item xs={9}>
              {/* TABLE PRINCIPALE */}
              {selectedEmp && (
                <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {[
                          'Semaine', 'Nb. Heures', 'Nb. Jours', 'Total Retard', 'HS25', 'HS50', 'HS', 'Heures Fériés',
                          'H.Fériés Travaillé', 'H.Fériés Trav 2', 'J.Férié Travaillé', 'Allaitement',
                          'J. Abs N/Payé', 'Heure Absences', 'Jours Pointés', 'Nb. Nuits', 'Congé Payé',
                          'H.Congé Payé', 'H. Spéc Familiale', 'Heures Normales', 'Jours Repos', 'H.Nuits',
                          'Heure Repos', 'Déplacement', 'ACT', 'Formation Mission', 'Abs. Just',
                          'J. Arrêt  Technique', 'Maladie', 'Abs. NJ.', 'C. Spéc Familiale', 'CSS', 'MAP',
                        ].map((label) => (
                          <TableCell
                            key={label}
                            sx={{
                              color: '#1976d2',
                              fontWeight: 'bold',
                              fontSize: '0.85rem',
                              backgroundColor: '#f5f5f5',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedEmp?.heuresSupplementairesResultats?.map((res, idx) => (
                        <TableRow
                          key={idx}
                          hover
                          onDoubleClick={() => {
                            setSelectedWeekDetails(res.weekDetails as Record<string, string>);
                            setOpenDialog(true);
                          }}
                        >
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{(res.tothre ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.nbJours ?? 0).toFixed(2)}</TableCell>
                          <TableCell>
                            {(() => {
                              const retard = Math.round(res.retard ?? 0);
                              const heures = Math.floor(retard / 60);
                              const minutes = retard % 60;
                              return `${heures.toString().padStart(2, '0')}:${minutes
                                .toString()
                                .padStart(2, '0')}`;
                            })()}
                          </TableCell>
                          <TableCell>{(res.heuresSupTranche1 ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.heuresSupTranche2 ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.hreSupSemaine ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.hreFerier ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.hreFerieTrv ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.hreFerieTrv2 ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.nbJourFerier ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.hreAllaitement ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.absnp ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.totalAbsence ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.nbJourPointer ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.nbNuits ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.nbJourCngPaye ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.nbHeureConge ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.hcsf ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.heuresNormales ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.jourRepos ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.hreNuits ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.heureRepos ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.deplacement ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.act ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.fm ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.absj ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.ct ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.maladie ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.absnj ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.csf ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.css ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.map ?? 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Grid>

       

            {/* Ligne finale : Weekly Hours */}
            <Grid item xs={12}>
              <WeeklyHoursTable
                weekRanges={weekRanges}
                weeklyHours={selectedEmp?.heuresSupplementairesResultats?.map((r) => r.nbhCalendSem) || []}
              />
            </Grid>
          </>
        )}
      </Grid>
      {/* 🔹 Popup for week details */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
        },
        '& .MuiDialog-paper': {
          margin: { xs: 0, sm: '32px' },
          width: { xs: '60%', sm: 'auto' },
          maxWidth: { xs: '70%', sm: '500px' },
        },
      }}
        //maxWidth="xl"
        //fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Détails de la semaine</Typography>
          <IconButton onClick={() => setOpenDialog(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {selectedWeekDetails && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  {Object.keys(selectedWeekDetails).map((key) => (
                    <TableCell
                      key={key}
                      sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', backgroundColor: '#f5f5f5' }}
                    >
                      {key}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  {Object.values(selectedWeekDetails).map((value, idx) => (
                    <TableCell key={idx}>{value}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

    </Box>
  );

};

const PointageDuMois = () => {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <DateMoisPointageRangeProvider>
        <Box maxWidth={'95vw'}>
          <PointageDuMoisContent />
        </Box>
      </DateMoisPointageRangeProvider>
    </QueryClientProvider>
  );
};

export default PointageDuMois;
