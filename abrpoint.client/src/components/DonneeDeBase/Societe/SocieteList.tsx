import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const { mutate: deleteSociete } = useDeleteSociete();
    const { data: Societes = [],refetch } = useGetSocietes();



    const columns = useMemo<MRT_ColumnDef<Societe>[]>(
        () => [
             {
                id: 'actions',
                header: t('donneeDeBase.societe.list.actions'),
                size: 80,
                Cell: ({ row }) => (
                    <Tooltip title={t('donneeDeBase.societe.list.edit')}>
                        <IconButton size="small" onClick={() => onEdit(row.original)}>
                            <Edit fontSize="small" />
                        </IconButton>
                    </Tooltip>
                ),
            },
            {
                accessorKey: 'soccod',
                header: t('donneeDeBase.societe.list.code'),
                size: 60,
            },
            {
                accessorKey: 'soclib',
                header: t('donneeDeBase.societe.list.label'),
                size: 300,
            },
            {
                accessorKey: 'soctype',
                header: t('donneeDeBase.societe.list.type'),
                size: 60,
            },
            {
                accessorKey: 'soctel',
                header: t('donneeDeBase.societe.list.phone'),
                size: 100,
            },
            {
                accessorKey: 'socfax',
                header: t('donneeDeBase.societe.list.fax'),
                size: 100,
            },
            {
                accessorKey: 'socemail',
                header: t('donneeDeBase.societe.list.email'),
                size: 100,
            },
            {
                accessorKey: 'socresp',
                header: t('donneeDeBase.societe.list.responsible'),
                size: 60,
            },
            {
                accessorKey: 'socadr',
                header: t('donneeDeBase.societe.list.address'),
                size: 350,
            }
        ],
        [onEdit, t]
    );

    return (
        <>
        <DataList
                data={Societes}
                columns={columns}
                message={t('donneeDeBase.societe.list.confirmDelete')}
                deleteMethod={deleteSociete}
                refetchMethod={refetch}
                idKey="soccod" reportGeneration1={undefined} reportGeneration2={undefined} reportGeneration3={undefined}
                reportGeneration4={undefined} empHoraires={undefined} setData={undefined} pageSize={5} purge={undefined}/>
        </>
    );
}
