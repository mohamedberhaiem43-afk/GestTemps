import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import { useTranslation } from 'react-i18next';
import { Filiale } from '../../../models/Filiale';
import DataList from '../../lists/list';
import useGetSites from '../../../hooks/siteHooks/useGetSites';
import useDeleteSite from '../../../hooks/siteHooks/useDeleteSite';
import { IconButton, Tooltip } from '@mui/material';
import { Edit } from '@mui/icons-material';

interface FilialeListProps {
    onEdit: (filiale: Filiale) => void;
}

export function FilialeList({ onEdit }: FilialeListProps) {
    const { t } = useTranslation();
    const { mutate: deleteFiliale } = useDeleteSite();
    const { data: Filiales = [], refetch } = useGetSites();

    const columns = useMemo<MRT_ColumnDef<Filiale>[]>(
        () => [
            {
                id: 'edit',
                header: '',
                size: 50,
                Cell: ({ row }) => (
                    <Tooltip title={t('donneeDeBase.filiale.list.edit')}>
                        <IconButton size="small" color="primary" onClick={() => onEdit(row.original)}>
                            <Edit fontSize="small" />
                        </IconButton>
                    </Tooltip>
                ),
            },
            { accessorKey: 'sitcod', header: t('donneeDeBase.filiale.list.code'), size: 10 },
            { accessorKey: 'sitlib', header: t('donneeDeBase.filiale.list.label'), size: 60 },
            { accessorKey: 'sitadr', header: t('donneeDeBase.filiale.list.address'), size: 120 },
            { accessorKey: 'sittel', header: t('donneeDeBase.filiale.list.phone'), size: 60 },
            { accessorKey: 'sitemail', header: t('donneeDeBase.filiale.list.email'), size: 120 },
            { accessorKey: 'sitmois', header: t('donneeDeBase.filiale.list.months'), size: 80 },
            { accessorKey: 'sitconge', header: t('donneeDeBase.filiale.list.leaves'), size: 80 },
            { accessorKey: 'sitsoc', header: t('donneeDeBase.filiale.list.society'), size: 10 },
        ],
        [onEdit, t]
    );

    return (
        <DataList
            data={Filiales}
            columns={columns}
            message={t('donneeDeBase.filiale.list.confirmDelete')}
            deleteMethod={deleteFiliale}
            refetchMethod={refetch}
            idKey="sitcod"
            reportGeneration1={undefined}
            reportGeneration2={undefined}
            reportGeneration3={undefined}
            reportGeneration4={undefined}
            empHoraires={undefined}
            setData={undefined}
            pageSize={5}
            purge={undefined}
        />
    );
}