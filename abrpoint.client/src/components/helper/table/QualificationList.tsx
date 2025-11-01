import React, { useMemo } from 'react';
import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import axios from 'axios';
import { Button } from '@mui/material';
import { Qualification } from '../../../models/Qualification';



interface QualificationPropsList {
  onSelectQualification: (qualification: Qualification) => void;
}

export const QualificationList: React.FC<QualificationPropsList> = ({ onSelectQualification }) => {
  const [data, setData] = React.useState<Qualification[]>([]);

  // Fetch data from API
  React.useEffect(() => {
    // Retrieve the token from local storage
    const token = localStorage.getItem('authToken');

    // Set up the Axios request with the Authorization header
    axios.get('https://localhost:7189/api/Qualifs', {
      headers: {
        Authorization: `Bearer ${token}` // Add the JWT token here
      }
    })
    .then((res) => setData(res.data))
    .catch((err) => console.error(err));
  }, []);

  const columns = useMemo<MRT_ColumnDef<Qualification>[]>(
    () => [
      {
        accessorKey: 'quacod',
        header: 'Code',
        size: 60,
      },
      {
        accessorKey: 'qualib',
        header: 'Libellé',
        size: 160,
      },
      {
        accessorKey: 'quairpp',
        header: 'S/S Irpp',
        size: 50,
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        Cell: ({ row }) => (
          <Button onClick={() => onSelectQualification(row.original)}>Manipuler</Button>
        ),
        size: 100,
      }
    ],
    []
  );

  return <MaterialReactTable columns={columns} data={data} />;
};
