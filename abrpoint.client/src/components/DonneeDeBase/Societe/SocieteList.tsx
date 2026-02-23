import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import { Societe } from '../../../models/Societe';
import DataList from '../../lists/list';
import useGetSocietes from '../../../hooks/societeHooks/useGetSocietes';
import useDeleteSociete from '../../../hooks/societeHooks/useDeleteSociete';
import { Edit } from '@mui/icons-material';
import { IconButton,Tooltip } from '@mui/material';

interface SocieteListProps {
    onEdit: (societe: Societe) => void;
}

export function SocieteList({ onEdit }: SocieteListProps) {
    const { mutate: deleteSociete } = useDeleteSociete();
    const { data: Societes = [],refetch } = useGetSocietes();



    const columns = useMemo<MRT_ColumnDef<Societe>[]>(
        () => [
             {
                id: 'actions',
                header: 'Actions',
                size: 80,
                Cell: ({ row }) => (
                    <Tooltip title="Modifier">
                        <IconButton size="small" onClick={() => onEdit(row.original)}>
                            <Edit fontSize="small" />
                        </IconButton>
                    </Tooltip>
                ),
            },
            {
                accessorKey: 'soccod',
                header: 'Code',
                size: 60,
            },
            {
                accessorKey: 'soclib',
                header: 'Libellé',
                size: 300,
            },
            {
                accessorKey: 'soctype',
                header: 'Type',
                size: 60,
            },
            {
                accessorKey: 'soctel',
                header: 'Tél',
                size: 100,
            },
            {
                accessorKey: 'socfax',
                header: 'Fax',
                size: 100,
            },
            {
                accessorKey: 'socemail',
                header: 'E-Mail',
                size: 100,
            },
            {
                accessorKey: 'socresp',
                header: 'Responsable',
                size: 60,
            },
            {
                accessorKey: 'socadr',
                header: 'Adresse',
                size: 350,
            }
        ],
        [onEdit]
    );

    return (
        <>
        <DataList 
                data={Societes}
                columns={columns}
                message="Êtes-vous sûr de vouloir supprimer cette Societe ?"
                deleteMethod={deleteSociete}
                refetchMethod={refetch}
                idKey="soccod" reportGeneration1={undefined} reportGeneration2={undefined} reportGeneration3={undefined}
                reportGeneration4={undefined} empHoraires={undefined} setData={undefined} pageSize={5} purge={undefined}/>
        </>
    );
}
