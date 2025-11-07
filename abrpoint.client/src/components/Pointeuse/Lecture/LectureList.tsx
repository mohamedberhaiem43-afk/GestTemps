import { MRT_ColumnDef } from 'material-react-table';
import { useMemo } from 'react';
import useGetPointeuses from '../../../hooks/pointeuseHooks/useGetPointeuses';
import { Pointeuse } from '../../../models/PointeuseModel';
import PointeusesList from '../../lists/PointeusesList';

type LectureListProps = {
  onRowClick?: (row: any) => void;
  onSelectionChange?: (ips: string[]) => void;
};

function LectureList({ onRowClick, onSelectionChange }: LectureListProps) {
  const { data = [] } = useGetPointeuses();

const columns = useMemo<MRT_ColumnDef<Pointeuse>[]>(() => [
  {
    id: 'pointeuseDetails',
    header: '',
    columns: [
      { accessorKey: 'poicod', header: 'Code Pointeuse', size: 10, enableEditing: false },
      { accessorKey: 'poilib', header: 'Libellé', size: 160 },
      {
        accessorFn: (row) => `${row.poiadrip1}.${row.poiadrip2}.${row.poiadrip3}.${row.poiadrip4}`,
        id: 'completeIpAddress',
        header: 'Adresse IP',
        size: 100,
      },
      { accessorKey: 'poiport', header: 'N° Port', size: 60 },
      { accessorKey: 'latest_read', header: 'Dernière lecture', size: 60 },
    ],
  },
], []);

  return (
    <PointeusesList
      data={data}
      columns={columns}
      pageSize={20}
      onRowClick={onRowClick}
      onSelectionChange={onSelectionChange} // 👈 forward it
    />
  );
}

export default LectureList;
