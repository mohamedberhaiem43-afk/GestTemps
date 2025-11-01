import { useEffect, useMemo } from 'react';
import {
  type MRT_ColumnDef,
} from 'material-react-table';

import { Compenser } from '../../../../../Compense';
import dayjs from 'dayjs';
import useGetEmployee from '../../../../../hooks/employeHooks/useGetEmployee';
import useGetAbsencesLibs from '../../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetCompensations from '../../../../../hooks/compensationHooks/useGetCompensations';
import useDeleteCompensation from '../../../../../hooks/compensationHooks/useDeleteCompensation';
import DataList from '../../../../lists/list';

const CompensationList = () => {
  
  const soccod = sessionStorage.getItem('soccod');
  // const { setSelectedCompensation } = useCompensationContext();
  // const [deleteConcod, setDeleteConcod] = useState<string | null>(null); // Track selected concod for deletion
  const {data:employeOptions = []} = useGetEmployee();
  const {data:absences} = useGetAbsencesLibs();
  const{mutate:deleteCompensation} = useDeleteCompensation();
  // const [compensations,setCompensation] = useState([])
  const { data : compensationsReponse =[],refetch } = useGetCompensations(soccod);
  // const handleDelete = (concod: string) => {
  //   setDeleteConcod(concod); // Set concod to delete
  // };
  useEffect(() => {
    if (compensationsReponse) {
      // setCompensation(compensationsReponse);
    }
  }, [compensationsReponse]);
  
  // const getCompensationToUpdate = (object: Compenser | undefined) => {
  //   const selectedCompensation = compensations.find((compensation:Compenser) => compensation.concod == object?.concod );
  //   if(selectedCompensation){
  //     setSelectedCompensation(selectedCompensation);
  //   }
  // }

  // const confirmDelete = () => {
  //   if (deleteConcod) {
  //     deleteCompensation({ soccod: soccod || '', concod: deleteConcod },
  //       {
  //         onSuccess: () => {
  //           handleSnackbarOpening("compensation supprimé avec succées.",'success')
  //           setCompensation((prevCompensations) =>
  //             prevCompensations.filter(
  //               (sanction:Compenser) => sanction.concod !== deleteConcod
  //             )
  //           );
  //         },
  //         onError: () => {
  //           alert();
  //         },
  //       }
  //     );
  //   }
  //   setOpenModal(false);
  // };


  const columns = useMemo<MRT_ColumnDef<Compenser>[]>(
    () => [
      {
        id: 'compenserDetails',
        header: '',
        columns: [
          {
            accessorKey: 'concod',
            header: 'N° Ordre',
            size: 60,
          },
          {
            accessorKey: 'empcod',
            header: 'Employé',
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
            size: 60,
            Cell: ({ cell }) => dayjs(cell.getValue() as string | number | Date | null | undefined).format('DD-MM-YYYY'),
          },
          
          {
            accessorKey: 'condep',
            header: 'Date Départ',
            size: 60,
            Cell: ({ cell }) => dayjs(cell.getValue() as string | number | Date | null | undefined).format('DD-MM-YYYY:HH:MM'),
          },
          {
            accessorKey: 'conret',
            header: 'Date Retour',
            size: 60,
            Cell: ({ cell }) => dayjs(cell.getValue() as string | number | Date | null | undefined).format('DD-MM-YYYY:HH:MM'),
          },
          {
            accessorKey: 'connbjour',
            header: 'Nb.Heures',
            size: 60,
          },
        ],
      },
    ],
    [[employeOptions, absences]],
  );

  

  return (
      <DataList data={compensationsReponse} columns={columns} message={"Vous etes sure de supprimer cette compensation ?"}
    deleteMethod={deleteCompensation} idKey={"concod"} refetchMethod={refetch} reportGeneration1={undefined}
    reportGeneration2={undefined} reportGeneration3={undefined} reportGeneration4={undefined} empHoraires={undefined}
    actions={true} setData={undefined} pageSize={5} purge={undefined}      />      
  );
};

export default CompensationList;
