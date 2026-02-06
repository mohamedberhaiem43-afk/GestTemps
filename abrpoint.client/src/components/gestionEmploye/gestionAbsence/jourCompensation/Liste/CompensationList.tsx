import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useCompensationContext } from '../../../../helper/CompensationContext';
import { useAuth } from '../../../../helper/AuthProvider';

const CompensationList = () => {
  const { t } = useTranslation();
  const { setSelectedCompensation } = useCompensationContext();
  
  const {data:employeOptions = []} = useGetEmployee();
  const {data:absences} = useGetAbsencesLibs();
  const{mutate:deleteCompensation} = useDeleteCompensation();
  const { data : compensationsReponse =[],refetch } = useGetCompensations();
  const { soccod } = useAuth();
  const handleEditCompensation = (compensation: string) => {
    getCompensationToUpdate(compensation);
  };

  useEffect(() => {
    refetch();
  }, [compensationsReponse,deleteCompensation,refetch]);
  
const getCompensationToUpdate = (concod: string) => {
  
  const selectedCompensation = compensationsReponse.find(
    (compensation: Compenser) => {
      const matches = compensation.concod === concod && compensation.soccod === soccod;
      if (compensation.concod === concod) {
      }
      return matches;
    }
  );
  
  console.log('Selected compensation:', selectedCompensation);
  
  if (selectedCompensation) {
    setSelectedCompensation(selectedCompensation);
  } else {
    console.warn(`No compensation found for concod: ${concod} and soccod: ${soccod}`);
  }
}



  const columns = useMemo<MRT_ColumnDef<Compenser>[]>(
    () => [
      {
        id: 'compenserDetails',
        header: '',
        columns: [
          {
            accessorKey: 'concod',
            header: t('common.orderNumber'),
            size: 60,
          },
          {
            accessorKey: 'empcod',
            header: t('common.employee'),
            size: 160,
          },
          {
            accessorKey: 'abscod',
            header: t('common.imputation'),
            size: 60,
          },
          {
            accessorKey: 'condat',
            header: t('common.date'),
            size: 60,
            Cell: ({ cell }) => dayjs(cell.getValue() as string | number | Date | null | undefined).format('DD-MM-YYYY'),
          },
          
          {
            accessorKey: 'condep',
            header: t('common.dateStart'),
            size: 60,
            Cell: ({ cell }) => dayjs(cell.getValue() as string | number | Date | null | undefined).format('DD-MM-YYYY:HH:MM'),
          },
          {
            accessorKey: 'conret',
            header: t('common.dateEnd'),
            size: 60,
            Cell: ({ cell }) => dayjs(cell.getValue() as string | number | Date | null | undefined).format('DD-MM-YYYY:HH:MM'),
          },
          {
            accessorKey: 'connbjour',
            header: t('common.nbHours'),
            size: 60,
          },
        ],
      },
    ],
    [[employeOptions, absences, t]],
  );

  

  return (
      <DataList data={compensationsReponse} columns={columns} message={t('common.confirmDelete') || "Êtes-vous sûr de vouloir supprimer cette compensation ?"}
    deleteMethod={deleteCompensation} idKey={"concod"} refetchMethod={refetch} reportGeneration1={undefined}
    reportGeneration2={undefined} reportGeneration3={undefined} reportGeneration4={undefined} empHoraires={undefined}
    actions={true} setData={handleEditCompensation} pageSize={5} purge={undefined}      />      
  );
};

export default CompensationList;
