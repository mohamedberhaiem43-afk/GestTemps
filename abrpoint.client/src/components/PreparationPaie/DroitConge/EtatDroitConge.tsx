import { Button, Grid, Box, Container } from "@mui/material";
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
  const empcods = selectedEmpcods;
  const queryParams = new URLSearchParams();
  empcods.forEach(code => queryParams.append("empcods", code));
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
        { accessorKey: 'nbcongerecu', header: 'Congé recu', size: 30 },
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
      header: 'Absences par Mois',
      columns: [
        { accessorKey: 'empmat', header: 'Matricule', size: 30 },
        { accessorKey: 'emplib', header: 'Nom et Prénom', size: 200 },
        { accessorKey: 'empreg', header: 'Régime', size: 50 },
        { accessorKey: 'empemb', header: 'Date Embauche', size: 60 },
        { accessorKey: 'annee', header: 'Année', size: 30 },
        ...monthColumns,
        {
          accessorKey: 'nbabsences',
          header: 'Total Absences',
          size: 30,
        }
      ],
    }
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
      header: 'Congés Reçus par Mois',
      columns: [
        { accessorKey: 'empmat', header: 'Matricule', size: 30 },
        { accessorKey: 'emplib', header: 'Nom et Prénom', size: 200 },
        { accessorKey: 'empreg', header: 'Régime', size: 50 },
        { accessorKey: 'empemb', header: 'Date Embauche', size: 60 },
        { accessorKey: 'annee', header: 'Année', size: 30 },
        ...monthColumns,
        {
          accessorKey: 'nbcongerecu',
          header: 'Total Congés Reçus',
          size: 30,
        }
      ],
    }
  ];
}, [droitConges]);


const handleSearch = async () => {
    try {
      const res = await DroitCongeService.getAllWithParams(
        `get-droit-de-conge/${sessionStorage.getItem("soccod")}/${datedebut}/${datefin}?${queryString}`
      );
      setDroitConges(res);
      setErrorMsg(null); // reset erreur si ok
    } catch (error: any) {
      if (error.response?.status === 403) {
        setErrorMsg("Vous n’avez pas la permission d’effectuer cette action.");
      } else {
        setErrorMsg("Une erreur est survenue. Veuillez réessayer.");
      }
    }
  };

return (
  <>
    <Container>
      <Box width={'95vw'} height={'80vh'} mt={-5}>
        <BreadcrumbNavigation />
        {/* ⚠️ Message interdit affiché ici */}
        {errorMsg && <ForbiddenMessage message={errorMsg} />}

        <Box
          display="flex"
          flexDirection="row"
          justifyContent="center"
          gap={5}
          alignItems="center"
          marginBottom={2}
        >
          <Grid item xs={4} maxWidth={200} minWidth={100}>
            <SelectInputComponent
              label={t('integrationPaie.employees')}
              value={selectedEmpcods ?? []}
              setValue={setSelectedEmpcods}
              maplist={employeesLibs}
              multiple={true}
            />
          </Grid>
          <Grid item xs={4}>
            <InputComponent type="date" label={t('weeklyHoursTable.dateStart')} value={datedebut} setValue={setDatedebut} />
          </Grid>
          <Grid item xs={4}>
            <InputComponent type="date" label={t('weeklyHoursTable.dateEnd')} value={datefin} setValue={setDatefin} />
          </Grid>
          <Grid item xs={2}>
            <Button variant="contained" onClick={handleSearch}>
              {t('common.search')}
            </Button>
          </Grid>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <DataList
              data={droitConges}
              columns={columns}
              message={undefined}
              deleteMethod={undefined}
              idKey={undefined}
              refetchMethod={undefined}
              reportGeneration1={undefined}
              reportGeneration2={undefined}
              reportGeneration3={undefined}
              reportGeneration4={undefined}
              empHoraires={undefined} setData={undefined} pageSize={10} purge={undefined}              />
          </Grid>
          <Grid item xs={6}>
                <DataList
              data={droitConges}
              columns={columns2}
              message={undefined}
              deleteMethod={undefined}
              idKey={undefined}
              refetchMethod={undefined}
              reportGeneration1={undefined}
              reportGeneration2={undefined}
              reportGeneration3={undefined}
              reportGeneration4={undefined}
              empHoraires={undefined} setData={undefined} pageSize={10} purge={undefined}              />
            </Grid>

          <Grid item xs={6}>
            <DataList
              data={droitConges}
              columns={columns1}
              message={undefined}
              deleteMethod={undefined}
              idKey={undefined}
              refetchMethod={undefined}
              reportGeneration1={undefined}
              reportGeneration2={undefined}
              reportGeneration3={undefined}
              reportGeneration4={undefined}
              empHoraires={undefined} setData={undefined} pageSize={10} purge={undefined}              />
          </Grid>
        </Grid>
      </Box>
    </Container>
  </>
);

}

export default EtatDroitConge;
