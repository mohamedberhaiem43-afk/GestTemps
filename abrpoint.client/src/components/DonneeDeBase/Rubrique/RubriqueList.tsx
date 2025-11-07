import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import { Rubrique } from '../../../models/Rubrique';
import useGetRubriques from '../../../hooks/rubriqueHooks/useGetRubriques';
import useDeleteRubrique from '../../../hooks/rubriqueHooks/useDeleteRubrique';
import DataList from '../../lists/list';

export function RubriqueList() {
    const { mutate: deleteRubrique } = useDeleteRubrique(); // Uncommented for delete functionality
    const { data: rubriques = [],refetch } = useGetRubriques();



    const columns = useMemo<MRT_ColumnDef<Rubrique>[]>(
        () => [
            {
                accessorKey: 'rubcod',
                header: 'Code',
                size: 60,
            },
            {
                accessorKey: 'rublib',
                header: 'Libellé',
                size: 300,
            },
        ],
        []
    );

    return (
        <>
        <DataList 
                data={rubriques}
                columns={columns}
                message="Êtes-vous sûr de vouloir supprimer cette rubrique ?"
                deleteMethod={deleteRubrique}
                refetchMethod={refetch}
                idKey="rubcod"
                reportGeneration1={undefined}
                reportGeneration2={undefined}
                reportGeneration3={undefined}
                reportGeneration4={undefined} empHoraires={undefined} setData={undefined} pageSize={5} purge={undefined}
                />
        </>
    );
}
