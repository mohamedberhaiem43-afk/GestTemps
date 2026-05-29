import { Box, Grid, TextField } from '@mui/material'
import DataList from '../../lists/list'
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EchContrat from '../../../models/EcheanceContrat';
import { MRT_ColumnDef } from 'material-react-table';
import useGetEchContrats from '../../../hooks/contratHooks/useGetEchContrats';

function EcheanceContratList() {
    const { t } = useTranslation();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    // Intervalle d'échéance saisissable par l'utilisateur. Par défaut aujourd'hui → +6 mois ;
    // les deux champs permettent d'élargir la fenêtre (ex. contrats expirant dans 1 an) au lieu
    // d'être figé sur 6 mois — un contrat n'apparaissait pas si sa date de fin dépassait la borne.
    const [echdeb, setEchdeb] = useState(() => formatDate(new Date()));
    const [echfin, setEchfin] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 6);
        return formatDate(d);
    });
    const { data: contrats = [] } = useGetEchContrats(echdeb, echfin);
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
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
          <TextField
            type="date"
            label={t('echeanceContrat.list.from', 'Échéance du')}
            size="small"
            value={echdeb}
            onChange={(e) => setEchdeb(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            label={t('echeanceContrat.list.to', 'au')}
            size="small"
            value={echfin}
            onChange={(e) => setEchfin(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
        <Grid mt={3}>
          <DataList data={contrats} columns={columns} message={undefined} deleteMethod={undefined}
              idKey={'concod'} refetchMethod={undefined} reportGeneration1={undefined} reportGeneration2={undefined}
              reportGeneration3={undefined} reportGeneration4={undefined} empHoraires={undefined} setData={undefined} pageSize={5} purge={undefined} />
        </Grid>
    </>
  )
}

export default EcheanceContratList