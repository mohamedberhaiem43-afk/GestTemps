import { useMemo, useState, useEffect } from 'react';
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  MRT_Row,
  useMaterialReactTable,
} from 'material-react-table';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import axios from 'axios';
import { DirectionModel } from '../../../models/DirectionModel';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import './Direction.css'
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';

const DirectionTable = () => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const [editedDirections, setEditedDirections] = useState<Record<string, DirectionModel>>({});
  const [directions, setDirections] = useState<DirectionModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const token = localStorage.getItem('authToken');
  
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const openDeleteConfirmModal = (row: MRT_Row<DirectionModel>) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      axios.delete(`${import.meta.env.VITE_REACT_APP_API_URL}/Directions/${row.original.soccod}/${row.original.dircod}`, { headers })
        .then(() => {
          setDirections((prev) => prev.filter((dir) => dir.dircod !== row.original.dircod));
        })
        .catch((error) => {
          console.error("Error deleting user: ", error);
        });
    }
  };

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Directions/get-directions/${sessionStorage.getItem('soccod')}`, { headers })
      .then((res) => {
        setDirections(res.data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsError(true);
        setIsLoading(false);
      });
  }, []); // Ensure this effect runs only once on mount

  const columns = useMemo<MRT_ColumnDef<DirectionModel>[]>(() => [
    {
      accessorKey: 'dircod',
      header: 'Code',
    //   enableEditing:false,
      size: 80,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;

          setEditedDirections((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              dircod: updatedValue,
            },
          }));
        },
      }),
    },
    {
      accessorKey: 'dirlib',
      header: 'Libellé',
      size: 260,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;

          setEditedDirections((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              dirlib: updatedValue,
            },
          }));
        },
      }),
    },
    {
      accessorKey: 'dirloc',
      header: 'Location',
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;

          setEditedDirections((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              dirloc: updatedValue,
            },
          }));
        },
      }),
    },
    {
      accessorKey: 'diremail',
      header: 'Email',
      muiEditTextFieldProps: ({ cell }) => ({
        type: 'email',
        error: !!validationErrors[cell.id],
        helperText: validationErrors[cell.id],
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;
          const isValidEmail = validateEmail(updatedValue);

          setValidationErrors({
            ...validationErrors,
            [cell.id]: isValidEmail ? undefined : 'Invalid Email',
          });

          setEditedDirections((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              diremail: updatedValue,
            },
          }));
        },
      }),
    },
  ], [validationErrors]);

  const handleSaveDirections = async () => {
    if (Object.values(validationErrors).some((error) => !!error)) return;

    try {
      await Promise.all(
        Object.values(editedDirections).map(async (direction) => {
          const sanitizedDirection = {
            soccod: "01",
            dircod: direction.dircod,
            dirlib: direction.dirlib,
            dirloc: direction.dirloc,
            diremail: direction.diremail,
          };

            const response = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/Directions`, sanitizedDirection, { headers });
            setDirections((prev) => [...prev, response.data]);
        })
      );

      setEditedDirections({});
    } catch (error) {
      console.error('Error saving directions:', error);
    }
  };
const handleEditDirections = async()=>{
    try {
        await Promise.all(
          Object.values(editedDirections).map(async (direction) => {
            const sanitizedDirection = {
              soccod: "01",
              dircod: direction.dircod,
              dirlib: direction.dirlib,
              dirloc: direction.dirloc,
              diremail: direction.diremail,
            };
              await axios.put(`${import.meta.env.VITE_REACT_APP_API_URL}/Directions`, sanitizedDirection, { headers });
          })
        );
  
        setEditedDirections({});
      } catch (error) {
        console.error('Error saving directions:', error);
      }
    }
  const table = useMaterialReactTable({
    columns,
    data: directions,
    createDisplayMode: 'row',
    enableClickToCopy: 'context-menu',
    enableEditing: true,
    enableRowActions: true,
    editDisplayMode: 'cell',
    getRowId: (row) => row.dircod,

    muiToolbarAlertBannerProps: isError
      ? {
          color: 'error',
          children: 'Error loading data',
        }
      : undefined,
    muiTableContainerProps: {
      sx: {
        minHeight: '85px',
        maxHeight: '400px', // Set maximum height
        overflowY: 'auto',  // Enables scrolling if content exceeds max height
      },
    },
    muiTableBodyCellProps: {
      sx: {
        padding: '0', // Minimum padding
      },
    },
    onCreatingRowCancel: () => setValidationErrors({}),
    onCreatingRowSave: handleSaveDirections,
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Delete">
          <IconButton color="error" onClick={() => openDeleteConfirmModal(row)}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderBottomToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <IconButton
          color="success"
          onClick={handleEditDirections}
          disabled={Object.keys(editedDirections).length === 0}
        >
          {isLoading ? <CircularProgress size={25} /> : <SaveIcon />}
        </IconButton>
      </Box>
    ),
    renderTopToolbarCustomActions: ({ table }) => (
      <Tooltip title="Create New User">
        <IconButton
          color="primary"
          onClick={() => {
            table.setCreatingRow(true);
          }}
        >
          <AddIcon />
        </IconButton>
      </Tooltip>
    ),
    initialState: {
      columnPinning: {
        right: ['mrt-row-actions'],
      },
    },
    state: {
      isLoading,
      showAlertBanner: isError,
      showProgressBars: isLoading,
    },
  });

  return (
        <Box ml={5} width={'95vw'} height={'90vh'}>
        <BreadcrumbNavigation />
        <MaterialReactTable table={table} />
        </Box>
  );};

const queryClient = new QueryClient();

const Direction = () => (
  <QueryClientProvider client={queryClient}>
    <DirectionTable />
  </QueryClientProvider>
);

export default Direction;

function validateEmail(email: string) {
  return !!email.match(
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  );
}
