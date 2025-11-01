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

const PointageDuMoisContent = () => {
  const context = useDateMoisPointageRange();
  const dateRange = context?.dateRange;
  
  const mois = dateRange?.mois || '';
  const annee = dateRange?.annee || '2025';
  const semaine = dateRange?.semaine || '1';
  const debutmois = dateRange?.dateDebut ;
  const finmois = dateRange?.dateFin;
  const empcods = dateRange?.empcods || [];
  const [selectedEmp, setSelectedEmp] = useState<PointageMois | null>(null);
  const [pointageMois, setPointageMois] = useState<PointageMois[]>([]);
  const weekRanges = (debutmois && finmois) ? getWeeksFromStartToSunday(debutmois, finmois) : [];
  const [selectedWeekDetails, setSelectedWeekDetails] = useState<Record<string, string> | null>(null);
  const [majorerHeures, setMajorerHeures] = useState<boolean>(false);

  const queryParams = new URLSearchParams();
  empcods.forEach(code => queryParams.append("empcods", code));
  const queryString = queryParams.toString();
  
  useEffect(() => {
    if(mois != '') {
      GetPointageMoisService.getAllWithParams(`${sessionStorage.getItem('soccod')}/${mois}/${annee}/${semaine}?${queryString}`)
        .then((response) => {
          const pointageData = response.map((item: any) => ({
            ...item,
            heuresSupplementairesResultats: item.heuresSupplementairesResultats || [],
          }));
          setPointageMois(pointageData);
        })
        .catch((error) => { 
          console.error('Error fetching pointage data:', error);
        });
      // Update the pointageMois state with the fetched data
      setSelectedEmp(null);
    }

  }, [dateRange]);
  const columns = useMemo<MRT_ColumnDef<PointageMois>[]>(
    () => [
      {
        id: 'employeDetails',
        header: '',
        columns: [
          {
            accessorKey: 'empCode',
            header: 'Code',
            size: 60,
          },
          {
            accessorKey: 'empMat',
            header: 'Matricule',
            size: 50,
          },
          {
            accessorKey: 'empLib',
            header: 'Nom et Prénom',
            size: 60,
          },
          {
            accessorKey: 'empReg',
            header: 'Régime',
            size: 50,
          },
        ],
      },
    ],
    [],
  );
 
  return (
    <Box p={4} sx={{ minHeight: '100vh' }}>
      <Grid container spacing={1}>
        <Grid item xs={12}>
          <FilterPointageMois />
          <Grid item xs={4}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <CheckboxComponent label="Majorer H.Férié et Congé aux Hre Normales" value={majorerHeures} setValue={setMajorerHeures} />
          </Box>
        </Grid>
        </Grid>
        <Grid item xs={3}>
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
        </Grid>
       {selectedEmp && (
        <>
        <Grid item xs={9}>
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Semaine', 'Nb. Heures', 'Nb. Jours','Total Retard', 'HS25', 'HS50', 'HS','Heures Fériés', 'H.Fériés Travaillé', 'H.Fériés Trav 2', 'J.Férié Travaillé', 'Allaitement',
                      'J. Abs N/Payé','Heure Absences', 'Jours Pointés','Nb. Nuits', 'Congé Payé', 'H.Congé Payé', 'H. Spéc Familiale', 'Heures Normales', 'Jours Repos','H.Nuits', 'Heure Repos', 'Déplacement', 'ACT',
                      'Formation Mission', 'Abs. Just', 'J. Arrêt  Technique', 'Maladie', 'Abs. NJ.', 'C. Spéc Familiale', 'CSS', 'MAP'].map((label) => (
                        <TableCell
                          key={label}
                          sx={{ color: '#1976d2', fontWeight: 'bold', fontSize: '0.85rem', backgroundColor: '#f5f5f5' }}
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
                      onClick={() => setSelectedWeekDetails(res.weekDetails as Record<string, string>)} // 💡 no need to index anymore
                    >
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{(res.tothre ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{(res.nbJours ?? 0).toFixed(2)}</TableCell>
                      <TableCell>
                        {(() => {
                          const retard = Math.round(res.retard ?? 0);
                          const heures = Math.floor(retard / 60);
                          const minutes = retard % 60;
                          return `${heures.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                        })()}
                      </TableCell>
                      <TableCell>{(res.heuresSupTranche1 ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{(res.heuresSupTranche2 ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{(res.hreSupSemaine ?? 0).toFixed(2)}</TableCell>
                      <TableCell width={10}>{(res.hreFerier ?? 0).toFixed(2)}</TableCell>
                      <TableCell width={10}>{(res.hreFerieTrv ?? 0).toFixed(2)}</TableCell>
                      <TableCell width={10}>{(res.hreFerieTrv2 ?? 0).toFixed(2)}</TableCell>
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

                  {/* Ligne de total */}
                  <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.tothre ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.nbJours ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const totalRetard = Math.round(selectedEmp.heuresSupplementairesResultats.reduce(
                          (sum, r) => sum + (r.retard ?? 0),
                          0
                        ));
                        const heures = Math.floor(totalRetard / 60);
                        const minutes = totalRetard % 60;
                        return `${heures.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                      })()}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.heuresSupTranche1 ?? 0), 0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.heuresSupTranche2 ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.hreSupSemaine ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.hreFerier ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.hreFerieTrv ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.hreFerieTrv2 ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.nbJourFerier ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.hreAllaitement ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.absnp ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.totalAbsence ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.nbJourPointer ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.nbNuits ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.nbJourCngPaye ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.nbHeureConge ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.hcsf ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(
                        selectedEmp.heuresSupplementairesResultats.reduce(
                          (sum, r) =>
                            sum +
                            (r.heuresNormales ?? 0) +
                            (majorerHeures ? (r.nbHeureConge ?? 0) + (r.hreFerier ?? 0) : 0),
                          0
                        )
                      ).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.jourRepos ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.hreNuits ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.heureRepos ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.deplacement ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.act ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.fm ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.absj ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.ct ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.maladie ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.absnj ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.csf ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.css ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {(selectedEmp.heuresSupplementairesResultats.reduce(
                        (sum, r) => sum + (r.map ?? 0),
                        0
                      )).toFixed(2)}
                    </TableCell>

                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            {/* <EtatGlobalButton pointageMois={pointageMois} /> */}
          </Grid>
            <Grid xs={10} item>
            {selectedWeekDetails && (
              <Box mt={1}>
                <Paper elevation={2} sx={{ p: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {Object.keys(selectedWeekDetails).map((key) => (
                          <TableCell key={key} sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
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
                </Paper>
              </Box>
            )}
            </Grid>
            </>
)}

        <Grid item xs={12} mt={-1}>
          <WeeklyHoursTable
            weekRanges={weekRanges}
            weeklyHours={selectedEmp?.heuresSupplementairesResultats?.map(r => r.nbhCalendSem) || []}
          />
        </Grid>
      </Grid>
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
