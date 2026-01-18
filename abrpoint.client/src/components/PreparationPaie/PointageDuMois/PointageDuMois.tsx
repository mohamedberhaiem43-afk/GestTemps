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
import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { PointageMois } from '../../../models/PointageMois';
import DataList from '../../lists/list';
import { MRT_ColumnDef } from 'material-react-table';
import CheckboxComponent from '../../CheckboxComponent/CheckboxComponent';
import CloseIcon from '@mui/icons-material/Close';
import useGetPointageMois from '../../../hooks/pointagemoisHooks/useGetPointageMois';
import IntegrationPaieButton from '../../helper/IntegrationPaieButton';
import useGetRubriquesPaire from '../../../hooks/rubriqueHooks/useGetRubriquePaire';

const PointageDuMoisContent = () => {
  const context = useDateMoisPointageRange();
  const dateRange = context?.dateRange;

  const mois = dateRange?.mois || '';
  const annee = dateRange?.annee || '2025';
  const semaine = dateRange?.semaine || '1';
  const empcods = dateRange?.empcods || [];
  const [openDialog, setOpenDialog] = useState(false);
  const [numSem, setNumSem] = useState(1);
  const {data: rubriques = []} = useGetRubriquesPaire();
  const [selectedEmp, setSelectedEmp] = useState<PointageMois | null>(null);
  const [selectedWeekDetails, setSelectedWeekDetails] = useState<Record<string, string> | null>(null);
  const [majorerHeures, setMajorerHeures] = useState<boolean>(false);

  // const weekRanges = (debutmois && finmois) ? getWeeksFromStartToSunday(debutmois, finmois) : [];
  // Use the hook instead of manual fetching
  const { data: pointageMoisData = [], isLoading: loading, error } = useGetPointageMois(
    empcods,
    mois,
    annee,
    semaine
  );
  // Process the data similar to the original useEffect
  const pointageMois = useMemo(() => {
    return pointageMoisData.map((item: any) => ({
      ...item,
      heuresSupplementairesResultats: item.heuresSupplementairesResultats || [],
    }));
  }, [pointageMoisData]);
  
 // Extract week ranges from the selected employee's data
  const weekRanges = useMemo(() => {
    if (!selectedEmp?.heuresSupplementairesResultats) return [];
    
    return selectedEmp.heuresSupplementairesResultats
      .filter(r => r.weekStartDate && r.weekEndDate)
      .map(r => ({
        start: r.weekStartDate!,
        end: r.weekEndDate!,
      }));
  }, [selectedEmp]);
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

  // ⚠️ Affichage de l'erreur
  if (error) {
    return (
      <Box textAlign="center" mt={4}>
        <Typography color="error">Erreur lors du chargement des données.</Typography>
      </Box>
    );
  }
const totals = useMemo(() => {
  if (!selectedEmp?.heuresSupplementairesResultats) return null;

  return selectedEmp.heuresSupplementairesResultats.reduce(
    (acc, r) => {
      acc.jourFerier += r.jourFerier ?? 0;
      acc.panier += r.panier ?? 0;
      acc.heureFerier += r.heureFerier ?? 0;
      acc.nbhFerierTrv += r.nbhFerierTrv ?? 0;
      acc.tothre += r.tothre ?? 0;
      acc.nbJours += r.nbJours ?? 0;
      acc.retard += r.retard ?? 0;
      acc.hs25 += r.heuresSupTranche1 ?? 0;
      acc.hs50 += r.heuresSupTranche2 ?? 0;
      acc.hs += r.hreSupSemaine ?? 0;
      acc.hreFerier += r.hreFerier ?? 0;
      acc.hreFerieTrv += r.hreFerieTrv ?? 0;
      acc.hreFerieTrv2 += r.hreFerieTrv2 ?? 0;
      acc.nbJourFerier += r.nbJourFerier ?? 0;
      acc.hreAllaitement += r.hreAllaitement ?? 0;
      acc.absnp += r.absnp ?? 0;
      acc.caltype += r.caltype ?? '0';
      acc.totalAbsence += r.totalAbsence ?? 0;
      acc.nbJourPointer += r.nbJourPointer ?? 0;
      acc.nbNuits += r.nbNuits ?? 0;
      acc.nbJourCngPaye += r.nbJourCngPaye ?? 0;
      acc.nbHeureConge += r.nbHeureConge ?? 0;
      acc.hcsf += r.hcsf ?? 0;
      acc.heuresNormales += r.heuresNormales ?? 0;
      acc.jourRepos += r.jourRepos ?? 0;
      acc.hreNuits += r.hreNuits ?? 0;
      acc.heureRepos += r.heureRepos ?? 0;
      acc.deplacement += r.deplacement ?? 0;
      acc.act += r.act ?? 0;
      acc.fm += r.fm ?? 0;
      acc.absj += r.absj ?? 0;
      acc.ct += r.ct ?? 0;
      acc.maladie += r.maladie ?? 0;
      acc.absnj += r.absnj ?? 0;
      acc.csf += r.csf ?? 0;
      acc.css += r.css ?? 0;
      acc.map += r.map ?? 0;
      acc.jourSamediTrv += r.jourSamediTrv ?? 0;
      acc.hreSamediTrv += r.hreSamediTrv ?? 0;
      return acc;
    },
    {
      tothre: 0,
      nbJours: 0,
      retard: 0,
      panier: 0,
      hs25: 0,
      hs50: 0,
      hs: 0,
      jourFerier: 0,
      heureFerier: 0,
      nbhFerierTrv: 0,
      hreFerier: 0,
      hreFerieTrv: 0,
      hreFerieTrv2: 0,
      nbJourFerier: 0,
      hreAllaitement: 0,
      absnp: 0,
      caltype: '0',
      totalAbsence: 0,
      nbJourPointer: 0,
      nbNuits: 0,
      nbJourCngPaye: 0,
      nbHeureConge: 0,
      hcsf: 0,
      heuresNormales: 0,
      jourRepos: 0,
      hreNuits: 0,
      heureRepos: 0,
      deplacement: 0,
      act: 0,
      fm: 0,
      absj: 0,
      ct: 0,
      maladie: 0,
      absnj: 0,
      csf: 0,
      css: 0,
      map: 0,
      jourSamediTrv: 0,
      hreSamediTrv: 0,
    }
  );
}, [selectedEmp]);

  // ✅ Affichage normal après chargement
  return (
    <Box p={4} sx={{ minHeight: '100vh' }}>
      <Grid container spacing={2}>
        {/* 🔹 Filtre */}
      
          <Grid item xs={12} display={loading ? 'none' : 'block'}>
            <FilterPointageMois />
            <IntegrationPaieButton
                pointageMoisData={pointageMois}
                rubriques={rubriques}
                mois={mois}
                annee={annee}
              />
          </Grid>

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
            <Grid item xs={5}>
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

            <Grid item xs={7} mt={4}>
              {/* TABLE PRINCIPALE */}
              {selectedEmp && (
                <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {[
                          'Semaine', 'Nb. Heures', 'Nb. Jours', 'Total Retard', 'HS25', 'HS50', 'HS','Jours Fériés','Heures Fériés','Heures Fériés Trav',
                          'H.Fériés Trav 1', 'H.Fériés Trav 2', 'J.Férié Travaillé', 'Allaitement',
                          'J. Abs N/Payé','Calend', 'Heure Absences','Jours Pointés' ,'Panier', 'Nb. Nuits', 'Congé Payé',
                          'H.Congé Payé', 'H. Spéc Familiale', 'Heures Normales', 'Jours Repos', 'H.Nuits',
                          'Heure Repos', 'Déplacement', 'ACT', 'Formation Mission', 'Abs. Just',
                          'J. Arrêt  Technique', 'Maladie', 'Abs. NJ.', 'C. Spéc Familiale', 'CSS', 'MAP','Samedi Trav','Heure R.Samedi Trv',
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
                            setNumSem(idx + 1);
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
                          <TableCell>{(res.jourFerier ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.heureFerier ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.nbhFerierTrv ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.hreFerieTrv ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.hreFerieTrv2 ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.nbJourFerier ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.hreAllaitement ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.absnp ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{res.caltype ?? '0'}</TableCell>
                          <TableCell>{(res.totalAbsence ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.nbJourPointer ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.panier ?? 0).toFixed(2)}</TableCell>
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
                          <TableCell>{(res.jourSamediTrv ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{(res.hreSamediTrv ?? 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {totals && (
  <TableRow sx={{ backgroundColor: '#f0f4ff' }}>
    <TableCell sx={{ fontWeight: 'bold' }}>TOTAL</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.tothre.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.nbJours.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>
      {(() => {
        const retard = Math.round(totals.retard);
        const heures = Math.floor(retard / 60);
        const minutes = retard % 60;
        return `${heures.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}`;
      })()}
    </TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.hs25.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.hs50.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.hs.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.jourFerier.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.heureFerier.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.nbhFerierTrv.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.hreFerieTrv.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.hreFerieTrv2.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.nbJourFerier.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.hreAllaitement.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.absnp.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.caltype.slice(-2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.totalAbsence.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.nbJourPointer.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.panier.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.nbNuits.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.nbJourCngPaye.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.nbHeureConge.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.hcsf.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.heuresNormales.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.jourRepos.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.hreNuits.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.heureRepos.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.deplacement.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.act.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.fm.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.absj.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.ct.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.maladie.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.absnj.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.csf.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.css.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.map.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.jourSamediTrv.toFixed(2)}</TableCell>
    <TableCell sx={{ fontWeight: 'bold' }}>{totals.hreSamediTrv.toFixed(2)}</TableCell>
  </TableRow>
)}

                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Grid>

       

            {/* Ligne finale : Weekly Hours */}
            <Grid item xs={12}>
              <WeeklyHoursTable
                weekRanges={weekRanges}
                weeklyHours={selectedEmp?.heuresSupplementairesResultats?.map((r) => {
                  const hours = r.nbhCalendSem;
                  return hours !== undefined && hours !== null ? parseFloat(hours.toString()) : undefined;
                }) || []} />
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
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography color={'secondary'} variant="h6">Détails de la semaine {numSem}</Typography>
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
                      sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', backgroundColor: '#f5f5f5' , color: '#1976d2' }}
                    >
                      {key.substring(0,10)}
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
