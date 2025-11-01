import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import { Filiale } from '../../../models/Filiale';
import DataList from '../../lists/list';
import useGetSites from '../../../hooks/siteHooks/useGetSites';
import useDeleteSite from '../../../hooks/siteHooks/useDeleteSite';

export function FilialeList() {
    const { mutate: deleteFiliale } = useDeleteSite(); // Uncommented for delete functionality
    const { data: Filiales = [],refetch } = useGetSites();



    const columns = useMemo<MRT_ColumnDef<Filiale>[]>(
        () => [
            {
                accessorKey: 'sitcod',
                header: 'Code',
                size: 10,
              },
              {
                accessorKey: 'sitlib',
                header: 'Libellé',
                size: 60,
              },
              {
                accessorKey: 'sitadr',
                header: 'Adresse',
                size: 120,
              },
              {
                accessorKey: 'sittel',
                header: 'Téléphone',
                size: 60,
              },
              {
                accessorKey: 'sitemail',
                header: 'Email',
                size: 120,
              },
              {
                accessorKey: 'sitmois',
                header: 'Mois',
                size: 80,
              },
              {
                accessorKey: 'sitconge',
                header: 'Congés',
                size: 80,
              },
              {
                accessorKey: 'sitsoc',
                header: 'Société',
                size: 10,
              },
              {
                accessorKey: 'actions',
                header: 'Actions',
                size: 50,
              }
        ],
        []
    );

    return (
        <>
        <DataList 
          data={Filiales}
          columns={columns}
          message="Êtes-vous sûr de vouloir supprimer cette Filiale ?"
          deleteMethod={deleteFiliale}
          refetchMethod={refetch}
          idKey="sitcod"
          reportGeneration1={undefined} reportGeneration2={undefined} reportGeneration3={undefined} reportGeneration4={undefined}
          empHoraires={undefined} setData={undefined} pageSize={5} purge={undefined}/>
        </>
    );
}
