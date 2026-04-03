import { Grid } from '@mui/material'
import DataList from '../../lists/list'
import { useMemo } from 'react';
import EchContrat from '../../../models/EcheanceContrat';
import { MRT_ColumnDef } from 'material-react-table';
import useGetEchContrats from '../../../hooks/contratHooks/useGetEchContrats';

function EcheanceContratList() {
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const today = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(today.getMonth() + 6);
    const { data: contrats = [] } = useGetEchContrats(formatDate(today), formatDate(sixMonthsLater));
    const columns = useMemo<MRT_ColumnDef<EchContrat>[]>(() => [
        {
        id: 'echeance-contrats',
        header: 'Liste des écheances contrats',
        columns: [
            {
            accessorKey: 'empmat',
            header: 'Matricule',
            size: 60,
            },
            {
            accessorKey: 'emplib',
            header: 'Nom et Prénom',
            size: 100,
            },
            {
            accessorKey: 'condat',
            header: 'Date Contrat',
            size: 60,
            Cell: ({ cell }) => {
                const value = cell.getValue<Date>();
                return value ? new Date(value).toLocaleDateString() : '';
            },
            },
            {
            accessorKey: 'concod',
            header: 'N°Contrat',
            size: 60,
            },
            {
            accessorKey: 'empemb',
            header: 'Date Début',
            size: 60,
            Cell: ({ cell }) => {
                const value = cell.getValue<Date>();
                return value ? new Date(value).toLocaleDateString() : '';
            },
            },
            {
            accessorKey: 'empsort',
            header: 'Date Fin',
            size: 60,
            Cell: ({ cell }) => {
                const value = cell.getValue<Date>();
                return value ? new Date(value).toLocaleDateString() : '';
            },
            },
        ],
        },
    ], []);
  return (
    <>
        <Grid mt={3}>
          <DataList data={contrats} columns={columns} message={undefined} deleteMethod={undefined}
              idKey={'concod'} refetchMethod={undefined} reportGeneration1={undefined} reportGeneration2={undefined}
              reportGeneration3={undefined} reportGeneration4={undefined} empHoraires={undefined} setData={undefined} pageSize={5} purge={undefined} />
        </Grid>
    </>
  )
}

export default EcheanceContratList