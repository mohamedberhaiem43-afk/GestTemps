import { useMemo, useState, useEffect } from 'react';
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  MRT_Row,
  useMaterialReactTable,
} from 'material-react-table';
import { Box,Snackbar,Alert, CircularProgress, IconButton, Tooltip, Checkbox } from '@mui/material';
import { useTranslation } from 'react-i18next';
import apiInstance from '../../API/apiInstance';

import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import { ServiceModel } from '../../../models/Service';
import './Service.css'
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';
import ExcelImportButton from '../shared/ExcelImportButton';
const Service = () => {
  const { t } = useTranslation();
  const soccod = sessionStorage.getItem('soccod') || '01';
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const [editedServices, setEditedServices] = useState<Record<string, ServiceModel>>({});
  const [services, setServices] = useState<ServiceModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openDeleteConfirmModal = (row: MRT_Row<ServiceModel>) => {
    if (window.confirm(t('donneeDeBase.service.confirmDelete'))) {
      apiInstance.delete(`/Services/${row.original.soccod}/${row.original.sercod}`)
        .then(() => {
          setServices((prev) => prev.filter((service) => service.sercod !== row.original.sercod));
        })
        .catch((error) => {
          console.error("Error deleting service: ", error);
        });
    }
  };

  useEffect(() => {
    apiInstance.get(`/Services/get-services/${sessionStorage.getItem('soccod')}`)
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
      header: t('donneeDeBase.service.code'),
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
      header: t('donneeDeBase.service.soccod'),
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
      header: t('donneeDeBase.service.label'),
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
      header: t('donneeDeBase.service.external'),
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
      header: t('donneeDeBase.service.headcount'),
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
  ], [t]);

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

        const response = await apiInstance.post(`/Services`, sanitizedService);
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

          await apiInstance.put(`/Services/${service.soccod}/${service.sercod}`, sanitizedService);
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
          children: t('donneeDeBase.common.errorLoading'),
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
        <Tooltip title={t('donneeDeBase.common.delete')}>
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
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Tooltip title={t('donneeDeBase.service.addNew')}>
          <IconButton
            color="primary"
            onClick={() => {
              table.setCreatingRow(true);
            }}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
        <ExcelImportButton
          endpoint="/BulkImport/services"
          extraBody={{ Soccod: soccod }}
          columnMap={{ Serlib: ['serlib', 'libelle', 'libellé', 'service', 'nom'] }}
          onImported={() => {
            // Refresh local list après import
            apiInstance.get(`/Services/get-services/${soccod}`).then(r => setServices(r.data)).catch(() => {});
          }}
          label={t('donneeDeBase.service.importExcel')}
        />
      </Box>
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
