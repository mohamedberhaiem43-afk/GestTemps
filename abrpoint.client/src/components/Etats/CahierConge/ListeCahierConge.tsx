import { MRT_ColumnDef } from "material-react-table";
import DataList from "../../lists/list"
import { useDateRange } from "../../Pointeuse/EtatPeriodique/FilterContext";
import { useMemo } from "react";
import CahierConge from "../../../models/CahierConge";
import useGetCahierConge from "../../../hooks/congeHooks/useGetCahierConge";

function ListeCahierConge() {
      const round4 = (num: number) => Math.round(num * 10000) / 10000;
      const { dateRange } = useDateRange();
      const { data = [] } = useGetCahierConge(dateRange.dateDebut, dateRange.dateFin,dateRange.empcods);
      const columns = useMemo<MRT_ColumnDef<CahierConge>[]>(() => [
        {
          id: 'cahier-conge',
          header: '',
          columns: [
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
              accessorKey: 'empdnais',
              header: 'Date Naissance',
              size: 60,
            },
            {
              accessorFn: (row: CahierConge) => {
                if (!row.empemb) return '';
                const date = new Date(row.empemb);
                return !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : '';
              },
              accessorKey: 'empemb',
              header: 'Date Embauche',
              size: 60,
            },
            {
              accessorKey: 'empreg',
              header: 'Régime',
              size: 60,
            },
            {
              accessorKey: 'saljou',
              header: 'Salaire Journalier',
              size: 60,
              Cell: ({ cell }) => {
              const val = cell.getValue<number>();
              return val != null ? round4(val).toFixed(4) : '';
            },
            },
            {
              accessorKey: 'somper',
              header: 'Somme Percue',
              size: 60,
              Cell: ({ cell }) => {
              const val = cell.getValue<number>();
              return val != null ? round4(val).toFixed(4) : '';
            },
            },
            {
                accessorKey:'pretemps',
                header: 'Temps de présence',
                size: 10,
                Cell: ({ cell }) => {
                const val = cell.getValue<number>();
                return val != null ? round4(val).toFixed(4) : '';
              },
            },
            
            {
                accessorKey:'soldini',
                header: 'Solde Initial',
                size: 10,
            },
            {
              accessorKey:'congedu',
              header: 'Jours Congé dû',
              size: 10,
            },
            {
                accessorKey:'indemdu',
                header: 'Indeminité Congé dû',
                size: 10,
            },
            {
                accessorKey:'jouanc',
                header: 'Jour Ancien.',
                size: 10,
            },
            {
                accessorKey:'montanc',
                header: 'Montant Ancienneté',
                size: 10,
            },
            {
                accessorKey:'conjeutrv',
                header: 'Congé Jeune Trv',
                size: 10,
            },
            {
                accessorKey:'montjeutrv',
                header: 'Montant Jeune Trv',
                size: 10,
            },
            {
                accessorKey:'jourjeutrv',
                header: 'Jour Jeune Trv',
                size: 10,
            },
            {
                accessorKey:'montjourjeutrv',
                header: 'Montant Jeune Trv',
                size: 10,
            },
            {
                accessorKey:'totdupres',
                header: 'Total dû  Présence',
                size: 10,
            },
            {
                accessorKey:'indemcong',
                header: 'Indeminité Congé',
                size: 10,
            },
            {
              accessorFn: (row: CahierConge) => {
                if (!row.datdep) return '';
                const date = new Date(row.datdep);
                return !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : '';
              },
                accessorKey:'datdep',
                header: 'Date Départ',
                size: 60,
            },
            {
                accessorKey:'depam',
                header: 'AM',
                size: 10,
            },
            {
              accessorFn: (row: CahierConge) => {
                if (!row.datret) return '';
                const date = new Date(row.datret);
                return !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : '';
              },
                accessorKey:'datret',
                header: 'Date Retour',
                size: 60,
            },
            {
                accessorKey:'retam',
                header: 'AM',
                size: 10,
            },
            
          ],
        },
      ], []);
    
  return (
      <>
        <DataList data={data} columns={columns} message={undefined} deleteMethod={undefined} idKey={'empmat'}
      refetchMethod={undefined} reportGeneration1={undefined} reportGeneration2={undefined} reportGeneration3={undefined}
      reportGeneration4={undefined} empHoraires={undefined} setData={undefined} pageSize={5} purge={undefined} />
      </>
  )
}

export default ListeCahierConge;