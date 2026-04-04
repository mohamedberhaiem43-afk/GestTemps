import { useMemo, useContext } from 'react';
import {
  type MRT_ColumnDef,
} from 'material-react-table';
import {
  Skeleton,
} from '@mui/material';
import { useDateRange } from '../../Pointeuse/EtatPeriodique/FilterContext';
import { EmployeeContext } from '../../Pointeuse/EtatPeriodique/EmployeeContext';
import useGetEtatAbsence from '../../../hooks/absenceHooks/useGetEtatAbsence';
import EtatAbsence from '../../../models/EtatAbsence';
import DataList from '../../lists/list';
import { useAbsenceContext } from '../../helper/AbsParamsContext';

const ListeAbsence = () => {
  const {  } = useContext(EmployeeContext);
  const context = useDateRange();
  if (!context) {
    throw new Error("useDateRange must be used within a DateRangeProvider");
  }
  const { dateRange } = context;
  const { absParams } = useAbsenceContext();

   const { data = [], isLoading } = useGetEtatAbsence(
    dateRange.dateDebut, 
    dateRange.dateFin,
    dateRange.empcods, // Utilisez empcods au lieu de selectedEmpMat
    absParams.absaut,
    absParams.absret,
    absParams.presNonOpt,
    absParams.sansPointageInvalide,
    absParams.radioValue
  );
  
  const columns = useMemo<MRT_ColumnDef<EtatAbsence>[]>(() => [
    {
      id: 'etat-absence',
      header: '',
      columns: [
        
        {
          accessorKey: 'empcod',
          header: 'Code',
          size: 60,
          enableEditing: false,
        },
        {
            accessorKey: 'empmat',
            header: 'Matricule',
            size: 60,
        },
        {
          accessorKey: 'emplib',
          header: 'Nom et Prénom',
          size: 180,
        },
        {
          accessorKey: 'empreg',
          header: 'Régime',
          size: 60,
        },
        {
          accessorKey: 'date',
          header: 'Date',
          size: 60,
          Cell: ({ cell }) => {
            const value = cell.getValue<Date>();
            return value ? new Date(value).toLocaleDateString() : '';
          },
        },
        {
          accessorKey: 'abscod',
          header: 'Code Abs',
          size: 60,
        },
        {
          accessorKey: 'motif',
          header: 'Motif',
          size: 100,
        },
        {
          accessorKey: 'congepaye',
          header: 'Congé Payé',
          size: 60,
        },
        {
          accessorKey: 'acctrav',
          header: 'Acc. Travail',
          size: 60,
        },
        {
          accessorKey: 'csf',
          header: 'C.S.F',
          size: 60,
        },
        {
          accessorKey: 'absjust',
          header: 'Abs. Just',
          size: 60,
        },
        {
            accessorKey:'fm',
            header: 'Formation + Mission',
            size: 10,

        },
        {
            accessorKey:'Arret Technique',
            header: 'arrtech',
            size: 10,

        },
        {
            accessorKey:'absmal',
            header: 'Abs. Maladie',
            size: 10,

        },
        {
            accessorKey:'absnj',
            header: 'Abs. Non Just.',
            size: 10,

        },
        {
            accessorKey:'map',
            header: 'MAP',
            size: 10,

        },
        {
            accessorKey:'autsp',
            header: 'Aut. S. Payé',
            size: 10,

        },
        {
            accessorKey:'autsnp',
            header: 'Aut. S. Non Payé',
            size: 10,

        },

        {
            accessorKey:'css',
            header: 'Congé Sans Solde',
            size: 10,

        },
        {
            accessorKey:'absjourretard',
            header: 'Abs.jour+Retard.',
            size: 10,

        },
        {
            accessorKey:'absence',
            header: 'Absence.',
            size: 10,

        },
        
      ],
    },
  ], []);

  return (
    <>
      {isLoading ? (
        <div>
          <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" height={40} style={{ marginTop: 10 }} />
          <Skeleton variant="rectangular" height={40} style={{ marginTop: 10 }} />
        </div>
      ) : (
        <DataList data={data} columns={columns} message={undefined} deleteMethod={undefined} idKey={'abscod'}
          refetchMethod={undefined} reportGeneration1={undefined} reportGeneration2={undefined} reportGeneration3={undefined}
          reportGeneration4={undefined} empHoraires={undefined} setData={undefined} pageSize={5} purge={undefined} />
      )}
    </>
  );
  
};

export default ListeAbsence;

