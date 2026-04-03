import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
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
    const { mutate: deleteFiliale } = useDeleteSite();
    const { data: Filiales = [], refetch } = useGetSites();

    const columns = useMemo<MRT_ColumnDef<Filiale>[]>(
        () => [
            {
                id: 'edit',
                header: '',
                size: 50,
                Cell: ({ row }) => (
                    <Tooltip title="Modifier">
                        <IconButton size="small" color="primary" onClick={() => onEdit(row.original)}>
                            <Edit fontSize="small" />
                        </IconButton>
                    </Tooltip>
                ),
            },
            { accessorKey: 'sitcod', header: 'Code', size: 10 },
            { accessorKey: 'sitlib', header: 'Libellé', size: 60 },
            { accessorKey: 'sitadr', header: 'Adresse', size: 120 },
            { accessorKey: 'sittel', header: 'Téléphone', size: 60 },
            { accessorKey: 'sitemail', header: 'Email', size: 120 },
            { accessorKey: 'sitmois', header: 'Mois', size: 80 },
            { accessorKey: 'sitconge', header: 'Congés', size: 80 },
            { accessorKey: 'sitsoc', header: 'Société', size: 10 },
        ],
        [onEdit]
    );

    return (
        <DataList
            data={Filiales}
            columns={columns}
            message="Êtes-vous sûr de vouloir supprimer cette Filiale ?"
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