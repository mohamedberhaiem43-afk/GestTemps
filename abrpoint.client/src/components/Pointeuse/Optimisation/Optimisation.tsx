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
} from '@mui/material';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PointageMois } from '../../../models/PointageMois';
import DataList from '../../lists/list';
import { MRT_ColumnDef } from 'material-react-table';
import GetPointageMoisService from '../../../services/GetPointageMoisService';
import CheckboxComponent from '../../CheckboxComponent/CheckboxComponent';
import FilterPointageMois from '../../PreparationPaie/PointageDuMois/FilterPointageMois';
import { DateMoisPointageRangeProvider, useDateMoisPointageRange } from '../../PreparationPaie/PointageDuMois/FilterPointageMoisContext';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';

const PointageDuMoisContent = () => {
  const { hasPermission } = useAuth();
  const context = useDateMoisPointageRange();
  const dateRange = context?.dateRange;

  const mois = dateRange?.mois || '';
  const annee = dateRange?.annee || '2025';
  const semaine = dateRange?.semaine || '1';
  const empcods = dateRange?.empcods || [];

  const [selectedEmp, setSelectedEmp] = useState<PointageMois | null>(null);
  const [pointageMois, setPointageMois] = useState<PointageMois[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [majorerHeures, setMajorerHeures] = useState<boolean>(false);
  const { t } = useTranslation();

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
          setError(t('pointageDuMois.errorLoading'));
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
          { accessorKey: 'empSite', header: 'Site', size: 50 },
        ],
      },
    ],
    []
  );

  // ⚠️ Affichage de l'erreur
  if (error) {
    return (
      <Box textAlign="center" mt={4}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (!hasPermission('Pointage et Temps', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter l'optimisation des pointages." />;
  }

  // ✅ Affichage normal après chargement
  return (
    <Box p={4} sx={{ minHeight: '100vh' }}>
      <Grid container spacing={2}>
        {/* 🔹 Filtre */}
      
          <Grid item xs={12} display={loading ? 'none' : 'block'}>
            <FilterPointageMois />
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

            <Grid item xs={7}>
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
          </>
        )}
      </Grid>

    </Box>
  );

};

const Optimisation = () => {
  return (
    <DateMoisPointageRangeProvider>
        <Box maxWidth={'95vw'}>
          <PointageDuMoisContent />
        </Box>
      </DateMoisPointageRangeProvider>
  );
};

export default Optimisation;
