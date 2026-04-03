import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useTranslation } from 'react-i18next';
import DataList from "../../lists/list";
import { MRT_ColumnDef } from "material-react-table";
import { DroitConge } from "../../../models/DroitConge";
import { useMemo, useState } from "react";
import useGetEmployeesLibs from "../../../hooks/employeHooks/useGetEmployeesLibs";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import InputComponent from "../../Inputs/Input";
import DroitCongeService from "../../../services/CongeService/DroitCongeService";
import ForbiddenMessage from "../../AlertModal/ForbiddenMessage";
import BreadcrumbNavigation from "../../helper/BreadcrumbNavigation";

function EtatDroitConge() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedEmpcods, setSelectedEmpcods] = useState<string[]>([]);
  const { data: employeesLibs = [] } = useGetEmployeesLibs();
  const { t } = useTranslation();
  const [datedebut, setDatedebut] = useState("2023-01-01");
  const [datefin, setDatefin] = useState("2023-01-31");
  const [activeTab, setActiveTab] = useState(0);
  const queryParams = new URLSearchParams();
  selectedEmpcods.forEach(code => queryParams.append("empcods", code));
  const queryString = queryParams.toString();
  const [droitConges, setDroitConges] = useState<DroitConge[]>([]);

  const columns = useMemo<MRT_ColumnDef<DroitConge>[]>(() => [
    {
      id: 'droitConge',
      header: '',
      columns: [
        { accessorKey: 'empmat', header: 'Matricule', size: 30 },
        { accessorKey: 'emplib', header: 'Nom et Prénom', size: 200 },
        { accessorKey: 'empreg', header: 'Régime', size: 50 },
        { accessorKey: 'empemb', header: 'Date Embauche', size: 60 },
        { accessorKey: 'annee', header: 'Année', size: 30 },
        { accessorKey: 'soldeinit', header: 'Droit Congé', size: 30 },
        { accessorKey: 'nbcongerecu', header: 'Congé reçu', size: 30 },
        { accessorKey: 'droitrestant', header: 'Total Droit', size: 30 },
      ],
    },
  ], []);

  const columns1 = useMemo<MRT_ColumnDef<DroitConge>[]>(() => {
    const monthKeys = Object.keys(droitConges?.[0]?.nbabsenceparmois || {});

    const monthColumns = monthKeys.map((month): MRT_ColumnDef<DroitConge> => ({
      accessorFn: (row) => row.nbabsenceparmois[month],
      header: month.charAt(0).toUpperCase() + month.slice(1),
      id: month,
      size: 30,
    }));

    return [
      {
        id: 'absences-per-month',
        header: 'Absences par mois',
        columns: [
          { accessorKey: 'empmat', header: 'Matricule', size: 30 },
          { accessorKey: 'emplib', header: 'Nom et Prénom', size: 200 },
          { accessorKey: 'empreg', header: 'Régime', size: 50 },
          { accessorKey: 'empemb', header: 'Date Embauche', size: 60 },
          { accessorKey: 'annee', header: 'Année', size: 30 },
          ...monthColumns,
          { accessorKey: 'nbabsences', header: 'Total absences', size: 30 },
        ],
      },
    ];
  }, [droitConges]);

  const columns2 = useMemo<MRT_ColumnDef<DroitConge>[]>(() => {
    const monthKeys = Object.keys(droitConges?.[0]?.nbcongerecuparmois || {});

    const monthColumns = monthKeys.map((month): MRT_ColumnDef<DroitConge> => ({
      accessorFn: (row) => row.nbcongerecuparmois[month],
      header: month.charAt(0).toUpperCase() + month.slice(1),
      id: month,
      size: 30,
    }));

    return [
      {
        id: 'conges-per-month',
        header: 'Congés reçus par mois',
        columns: [
          { accessorKey: 'empmat', header: 'Matricule', size: 30 },
          { accessorKey: 'emplib', header: 'Nom et Prénom', size: 200 },
          { accessorKey: 'empreg', header: 'Régime', size: 50 },
          { accessorKey: 'empemb', header: 'Date Embauche', size: 60 },
          { accessorKey: 'annee', header: 'Année', size: 30 },
          ...monthColumns,
          { accessorKey: 'nbcongerecu', header: 'Total congés reçus', size: 30 },
        ],
      },
    ];
  }, [droitConges]);

  const totalRights = droitConges.reduce((sum, item) => sum + Number(item.droitrestant || 0), 0);
  const totalReceived = droitConges.reduce((sum, item) => sum + Number(item.nbcongerecu || 0), 0);
  const totalAbsences = droitConges.reduce((sum, item) => sum + Number(item.nbabsences || 0), 0);

  const handleSearch = async () => {
    try {
      const res = await DroitCongeService.getAllWithParams(
        `get-droit-de-conge/${sessionStorage.getItem("soccod")}/${datedebut}/${datefin}?${queryString}`
      );
      setDroitConges(res);
      setErrorMsg(null);
    } catch (error: any) {
      if (error.response?.status === 403) {
        setErrorMsg("Vous n'avez pas la permission d'effectuer cette action.");
      } else {
        setErrorMsg("Une erreur est survenue. Veuillez réessayer.");
      }
    }
  };

  const tabDefinitions = [
    {
      label: 'Synthése des droits',
      description: 'Vue globale par employ',
      columns,
    },
    {
      label: 'Congés reçus par mois',
      description: 'Répartition mensuelle des congés',
      columns: columns2,
    },
    {
      label: 'Absences par mois',
      description: 'Suivi détaillé des absences',
      columns: columns1,
    },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 1, md: 2 },
        pb: 2,
        gap: 2,
        overflow: 'hidden',
      }}
      width={'90vw'}
    >
      <BreadcrumbNavigation />

      {errorMsg && <ForbiddenMessage message={errorMsg} />}

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          background: 'linear-gradient(180deg, rgba(245,247,250,0.96) 0%, rgba(255,255,255,0.98) 100%)',
        }}
      >
        <Stack spacing={2}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Row 1: Employee select + Date début */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              alignItems: 'stretch',
            }}
          >
            <Grid item xs={6} sm={6}>
            <SelectInputComponent
              label={t('integrationPaie.employees')}
              value={selectedEmpcods ?? []}
              setValue={setSelectedEmpcods}
              maplist={employeesLibs}
              multiple={true}
            />
            <InputComponent type="date" label={t('weeklyHoursTable.dateStart')} value={datedebut} setValue={setDatedebut} />
            </Grid>
          </Box>

          {/* Row 2: Date fin + Bouton Rechercher */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
              alignItems: 'center',
            }}
          >
            <InputComponent type="date" label={t('weeklyHoursTable.dateEnd')} value={datefin} setValue={setDatefin} />
            <Button variant="contained" size="large" onClick={handleSearch} sx={{ height: 42, width: '100%' }}>
              {t('common.search')}
            </Button>
          </Box>
        </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`Employés: ${droitConges.length}`} color="primary" variant="outlined" />
            <Chip label={`Droits restants: ${totalRights.toFixed(2)}`} variant="outlined" />
               <Chip label={`Employes: ${droitConges.length}`} color="primary" variant="outlined" />
            <Chip label={`Droits restants: ${totalRights.toFixed(2)}`} variant="outlined" />
            <Chip label={`Conges recus: ${totalReceived.toFixed(2)}`} variant="outlined" />
            <Chip label={`Absences: ${totalAbsences.toFixed(2)}`} variant="outlined" />
          </Box>
        </Stack>      <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 1.5, pt: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          {tabDefinitions.map((tab) => (
            <Tab key={tab.label} label={tab.label} />
          ))}
        </Tabs>

        <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {tabDefinitions[activeTab].label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tabDefinitions[activeTab].description}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 1.5, pb: 1.5 }}>
          <DataList
            data={droitConges}
            columns={tabDefinitions[activeTab].columns}
            message={undefined}
            deleteMethod={undefined}
            idKey={undefined}
            refetchMethod={undefined}
            reportGeneration1={undefined}
            reportGeneration2={undefined}
            reportGeneration3={undefined}
            reportGeneration4={undefined}
            empHoraires={undefined}
            setData={undefined}
            pageSize={10}
            purge={undefined}
          />
        </Box>
      </Paper>
    </Box>
  );
}

export default EtatDroitConge;



