import { useMemo } from 'react';
import { type MRT_ColumnDef } from 'material-react-table';
import { Pointeuse } from '../../models/PointeuseModel';
import useGetPointeuses from '../../hooks/pointeuseHooks/useGetPointeuses';
import useDeletePointeuse from '../../hooks/pointeuseHooks/useDeletePointeuse';
import DataList from '../lists/list';
import usePurgePointeuse from '../../hooks/pointeuseHooks/usePurgePointeuse';

const PointeuseList = ({ setSelected }: { setSelected: (p: Pointeuse) => void }) => {

  const {data = [],refetch} = useGetPointeuses();
  const { mutate: deletePointeuse } = useDeletePointeuse();
  
  const { mutate: purgePointeuse } = usePurgePointeuse();

  const handleDeleteConfirm = (obj:any) => {
    if (obj) {
      if (!obj) {
        return;
      }
      deletePointeuse(obj.poicod, {
        onSuccess: () => {
          refetch();
        },
      });
    }
  };
  const purge = (obj: any) => {
      if (!obj) return;
      purgePointeuse(
        {
          soccod: obj.soccod,
          poicod: obj.poicod,
          ip: `${obj.poiadrip1}.${obj.poiadrip2}.${obj.poiadrip3}.${obj.poiadrip4}`,
          port: obj.poiport,
          pswd: 123456,
        },
        {
          onSuccess: (res) => {
            alert(res);
          },
          onError: (err: any) => {
            alert(`Erreur purge: ${err.message}`);
          },
        }
      );
    };
  
// Function to delete a pointeuse
  const columns = useMemo<MRT_ColumnDef<Pointeuse>[]>(() => [
    {
      id: 'pointeuseDetails',
      header: '',
      columns: [
        {
          accessorKey: 'poicod',
          header: 'Code Pointeuse',
          size: 10,
          enableEditing: false,
        },
        {
          accessorKey: 'poilib',
          header: 'Libellé',
          size: 60,
        },
        {
          accessorFn: (row) => `${row.poiadrip1}.${row.poiadrip2}.${row.poiadrip3}.${row.poiadrip4}`,
          id: 'completeIpAddress',
          header: 'Adresse IP',
          size: 100,
          Cell: ({ cell }) => <span>{cell.getValue<string>()}</span>,
        },
        {
          accessorKey: 'poiport',
          header: 'N° Port',
          size: 60,
        },
      ],
    },
  ], []);


  return (
    <>
      <DataList data={data} columns={columns} message={`Êtes-vous sûr de vouloir supprimer cette pointeuse ?`}
      deleteMethod={handleDeleteConfirm} idKey={'poicod'} refetchMethod={refetch}
      reportGeneration1={undefined} reportGeneration2={undefined} reportGeneration3={undefined} reportGeneration4={undefined}
      purge={purge} empHoraires={undefined} setData={setSelected} actions={true} pageSize={10} />
    </>
  );
};

export default PointeuseList;
