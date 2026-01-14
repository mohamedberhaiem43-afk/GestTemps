import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import { Rubrique } from '../../../models/Rubrique';
import useGetRubriques from '../../../hooks/rubriqueHooks/useGetRubriques';
import useDeleteRubrique from '../../../hooks/rubriqueHooks/useDeleteRubrique';
import DataList from '../../lists/list';

interface RubriqueListProps {
    setEditingRubrique: (rubrique: Rubrique | null) => void;
}

export function RubriqueList({ setEditingRubrique }: RubriqueListProps) {
    const { mutate: deleteRubrique } = useDeleteRubrique();
    const { data: rubriques = [], refetch } = useGetRubriques();

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

    const handleSetData = (rubrique: Rubrique) => {
        setEditingRubrique(rubrique);
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <>
            <DataList 
                data={rubriques}
                columns={columns}
                message="Êtes-vous sûr de vouloir supprimer cette rubrique ?"
                deleteMethod={deleteRubrique}
                refetchMethod={refetch}
                idKey="rubcod"
                setData={handleSetData}  // This connects to the handleEdit function in DataList
                pageSize={5}
                actions={true}  // Enable row actions
                reportGeneration1={undefined}
                reportGeneration2={undefined}
                reportGeneration3={undefined}
                reportGeneration4={undefined}
                empHoraires={undefined}
                purge={undefined}
            />
        </>
    );
}