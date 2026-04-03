import { useMemo } from 'react';
import {
  type MRT_ColumnDef,
} from 'material-react-table';
import {
  Box,
} from '@mui/material';
import './ListConge.css'
import { Conge } from '../../../../models/Conge';
import useGetDemConges from '../../../../hooks/congeHooks/useGetDemConges';
import DataList from '../../../lists/list';
import { QueryClient, QueryClientProvider } from 'react-query';


export default function  DemCongeList (){
  const queryClient = new QueryClient();
  const { data = [] } = useGetDemConges();
  
  
    const columns = useMemo<MRT_ColumnDef<Conge>[]>(() => [
      {
        id: 'congeDetails',
        header: 'Liste des demande de congés',
        columns: [
          {
            accessorKey: 'concod',
            header: 'N° Ordre',
            size: 100,
          },
          {
            accessorKey: 'emplib',
            header: 'Nom et Prénom',
            size: 160,
          },
          {
            accessorKey: 'abscod',
            header: 'Imputation',
            size: 60,
          },
          {
            accessorKey: 'condat',
            header: 'Date',
            size: 100,
            Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
          },
          {
            accessorKey: 'condep',
            header: 'Date départ',
            size: 100,
            Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
          },
          {
            accessorKey: 'conret',
            header: 'Date retour',
            size: 100,
            Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
          },
          {
            accessorKey: 'connbjour',
            header: 'Nb.jours',
            size: 60,
          },
        ],
      },
    ], []);
    
  
  return (
    <QueryClientProvider client={queryClient}>

      <Box>
        <DataList data={data} columns={columns} message={undefined} deleteMethod={undefined} idKey={undefined}
        refetchMethod={undefined} reportGeneration1={undefined} reportGeneration2={undefined} reportGeneration3={undefined}
        reportGeneration4={undefined} empHoraires={undefined} setData={undefined} pageSize={5} purge={undefined}        />
      </Box>
    </QueryClientProvider>
  );
};

