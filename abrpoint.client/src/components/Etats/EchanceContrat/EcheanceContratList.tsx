import { Grid } from '@mui/material'
import DataList from '../../lists/list'
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import EchContrat from '../../../models/EcheanceContrat';
import { MRT_ColumnDef } from 'material-react-table';
import useGetEchContrats from '../../../hooks/contratHooks/useGetEchContrats';

function EcheanceContratList() {
    const { t } = useTranslation();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const today = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(today.getMonth() + 6);
    const { data: contrats = [] } = useGetEchContrats(formatDate(today), formatDate(sixMonthsLater));
    const columns = useMemo<MRT_ColumnDef<EchContrat>[]>(() => [
        {
        id: 'echeance-contrats',
        header: t('echeanceContrat.list.title'),
        columns: [
            {
            accessorKey: 'empmat',
            header: t('echeanceContrat.list.headers.matricule'),
            size: 60,
            },
            {
            accessorKey: 'emplib',
            header: t('echeanceContrat.list.headers.name'),
            size: 100,
            },
            {
            accessorKey: 'condat',
            header: t('echeanceContrat.list.headers.contractDate'),
            size: 60,
            Cell: ({ cell }) => {
                const value = cell.getValue<Date>();
                return value ? new Date(value).toLocaleDateString() : '';
            },
            },
            {
            accessorKey: 'concod',
            header: t('echeanceContrat.list.headers.contractNo'),
            size: 60,
            },
            {
            accessorKey: 'empemb',
            header: t('echeanceContrat.list.headers.startDate'),
            size: 60,
            Cell: ({ cell }) => {
                const value = cell.getValue<Date>();
                return value ? new Date(value).toLocaleDateString() : '';
            },
            },
            {
            accessorKey: 'empsort',
            header: t('echeanceContrat.list.headers.endDate'),
            size: 60,
            Cell: ({ cell }) => {
                const value = cell.getValue<Date>();
                return value ? new Date(value).toLocaleDateString() : '';
            },
            },
        ],
        },
    ], [t]);
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