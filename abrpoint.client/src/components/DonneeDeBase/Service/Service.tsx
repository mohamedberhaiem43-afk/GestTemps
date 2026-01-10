import { useMemo, useState, useEffect } from 'react';
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  MRT_Row,
  useMaterialReactTable,
} from 'material-react-table';
import { Box,Snackbar,Alert, CircularProgress, IconButton, Tooltip, Checkbox } from '@mui/material';
import axios from 'axios';

import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import { ServiceModel } from '../../../models/Service';
import './Service.css'
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';
const Service = () => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const [editedServices, setEditedServices] = useState<Record<string, ServiceModel>>({});
  const [services, setServices] = useState<ServiceModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = localStorage.getItem('authToken');
  
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const openDeleteConfirmModal = (row: MRT_Row<ServiceModel>) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      axios.delete(`${import.meta.env.VITE_REACT_APP_API_URL}/Services/${row.original.soccod}/${row.original.sercod}`, { headers })
        .then(() => {
          setServices((prev) => prev.filter((service) => service.sercod !== row.original.sercod));
        })
        .catch((error) => {
          console.error("Error deleting service: ", error);
        });
    }
  };

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Services/get-services/${sessionStorage.getItem('soccod')}`, { headers })
      .then((res) => {
        setServices(res.data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsError(true);
        setIsLoading(false);
      });
  }, []); // Runs once on component mount

  const columns = useMemo<MRT_ColumnDef<ServiceModel>[]>(() => [
    {
      accessorKey: 'sercod',
      header: 'Code',
      size: 60,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;

          setEditedServices((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              sercod: updatedValue,
            },
          }));
        },
      }),
    },
    {
      accessorKey: 'soccod',
      header: 'Soc. Code',
      size: 60,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;

          setEditedServices((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              soccod: updatedValue,
            },
          }));
        },
      }),
    },
    {
      accessorKey: 'serlib',
      header: 'Libellé',
      size: 200,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;

          setEditedServices((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              serlib: updatedValue,
            },
          }));
        },
      }),
    },
    {
      accessorKey: 'serloc',
      header: 'Externe',
      size: 60,
      Cell: ({ cell }) => (
        <Checkbox
          checked={cell.getValue() === '1'}
          onChange={(event) => {
            const checked = event.target.checked ? '1' : '0';
            const rowId = cell.row.id;
            setEditedServices((prev) => ({
              ...prev,
              [rowId]: {
                ...prev[rowId],
                serloc: checked,
              },
            }));
          }}
        />
      ),
    },
    {
      accessorKey: 'effectif',
      header: 'Effectif',
      size: 60,
      muiEditTextFieldProps: ({ cell }) => ({
        type: 'number',
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = parseInt(event.target.value, 10);

          setEditedServices((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              effectif: updatedValue,
            },
          }));
        },
      }),
    },
  ], []);

 const handleSaveServices = async () => {
  if (Object.values(validationErrors).some((error) => !!error)) return;

  try {
    await Promise.all(
      Object.values(editedServices).map(async (service) => {
        const sanitizedService = {
          sercod: service.sercod,
          soccod: service.soccod,
          serlib: service.serlib,
          serloc: service.serloc,
          effectif: service.effectif,
        };

        const response = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/Services`, sanitizedService, { headers });
        setServices((prev) => [...prev, response.data]);
      })
    );
    setEditedServices({});
  } catch (error: any) {
    if (error.response && error.response.data) {
        setErrorMessage(error.response.data.message);
        setIsSnackbarOpen(true);
    } else {
      console.error('Error saving services:', error);
    }
  }
};

  const handleEditServices = async () => {
    try {
      await Promise.all(
        Object.values(editedServices).map(async (service) => {
          const sanitizedService = {
            sercod: service.sercod,
            soccod: service.soccod,
            serlib: service.serlib,
            serloc: service.serloc,
            effectif: service.effectif,
          };

          await axios.put(`${import.meta.env.VITE_REACT_APP_API_URL}/Services/${service.soccod}/${service.sercod}`, sanitizedService, { headers });
        })
      );

      setEditedServices({});
    } catch (error) {
      console.error('Error editing services:', error);
    }
  };

  const table = useMaterialReactTable({
    columns,
    data: services,
    createDisplayMode: 'row',
    enableClickToCopy: 'context-menu',
    enableEditing: true,
    enableRowActions: true,
    editDisplayMode: 'cell',
    getRowId: (row) => row.sercod,

    muiToolbarAlertBannerProps: isError
      ? {
          color: 'error',
          children: 'Error loading data',
        }
      : undefined,
    muiTableContainerProps: {
      sx: {
        minHeight: '85px',
        maxHeight:'400px'
      },
    },
    muiTableBodyCellProps: {
      sx: {
        padding: '0',
      },
    },
    onCreatingRowCancel: () => setValidationErrors({}),
    onCreatingRowSave: handleSaveServices,
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
          onClick={handleEditServices}
          disabled={Object.keys(editedServices).length === 0}
        >
          {isLoading ? <CircularProgress size={25} /> : <SaveIcon />}
        </IconButton>
      </Box>
    ),
    renderTopToolbarCustomActions: ({ table }) => (
      <Tooltip title="Create New Service">
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
      <Box height={'90vh'} width={'95vw'}>
        <BreadcrumbNavigation />
        <MaterialReactTable table={table} />
         {/* Snackbar for error messages */}
    <Snackbar open={isSnackbarOpen} autoHideDuration={6000} onClose={() => setIsSnackbarOpen(false)}>
      <Alert onClose={() => setIsSnackbarOpen(false)} severity="error">
        {errorMessage}
      </Alert>
    </Snackbar>
      </Box>
  );
};

export default Service;
