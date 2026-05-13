import { useMemo, useState, useEffect } from 'react';
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  MRT_Row,
  useMaterialReactTable,
} from 'material-react-table';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import apiInstance from '../../API/apiInstance';
import { DirectionModel } from '../../../models/DirectionModel';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import './Direction.css'
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';

const DirectionTable = () => {
  const { t } = useTranslation();
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const [editedDirections, setEditedDirections] = useState<Record<string, DirectionModel>>({});
  const [directions, setDirections] = useState<DirectionModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  const soccod = sessionStorage.getItem('soccod') || '01';

  const openDeleteConfirmModal = (row: MRT_Row<DirectionModel>) => {
    if (window.confirm(t('donneeDeBase.direction.confirmDelete'))) {
      apiInstance.delete(`/Directions/${row.original.soccod}/${row.original.dircod}`)
        .then(() => {
          setDirections((prev) => prev.filter((dir) => dir.dircod !== row.original.dircod));
        })
        .catch((error) => {
          console.error("Error deleting user: ", error);
        });
    }
  };

  useEffect(() => {
    const soc = sessionStorage.getItem('soccod') || '01';
    const uti = sessionStorage.getItem('uticod') || '';
    
    setIsLoading(true);
    Promise.all([
      apiInstance.get(`/Directions/get-directions/${soc}`),
      apiInstance.get(`/Utilisateurs/users-list/${soc}/${uti}`)
    ])
      .then(([dirRes, userRes]) => {
        setDirections(dirRes.data);
        setUsers(userRes.data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsError(true);
        setIsLoading(false);
      });
  }, []);

  const columns = useMemo<MRT_ColumnDef<DirectionModel>[]>(() => [
    {
      accessorKey: 'dircod',
      header: t('donneeDeBase.direction.code'),
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
      header: t('donneeDeBase.direction.label'),
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
      header: t('donneeDeBase.direction.location'),
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
      header: t('donneeDeBase.direction.email'),
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
            [cell.id]: isValidEmail ? undefined : t('donneeDeBase.direction.invalidEmail'),
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
    {
      accessorKey: 'dirresp',
      header: t('donneeDeBase.direction.responsible'),
      editVariant: 'select',
      editSelectOptions: users.map(u => ({
        label: `${u.utiprn} ${u.utinom}`,
        value: u.uticod
      })),
      muiEditTextFieldProps: ({ cell }) => ({
        select: true,
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;
          setEditedDirections((prev) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              dirresp: updatedValue,
            },
          }));
        },
      }),
    },
  ], [validationErrors, users, t]);

  const handleSaveDirections = async () => {
    if (Object.values(validationErrors).some((error) => !!error)) return;

    try {
      await Promise.all(
        Object.values(editedDirections).map(async (direction) => {
          const sanitizedDirection = {
            soccod: soccod,
            dircod: direction.dircod,
            dirlib: direction.dirlib,
            dirloc: direction.dirloc,
            diremail: direction.diremail,
            dirresp: direction.dirresp,
          };

            const response = await apiInstance.post(`/Directions`, sanitizedDirection);
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
              soccod: soccod,
              dircod: direction.dircod,
              dirlib: direction.dirlib,
              dirloc: direction.dirloc,
              diremail: direction.diremail,
              dirresp: direction.dirresp,
            };
              await apiInstance.put(`/Directions`, sanitizedDirection);
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
          children: t('donneeDeBase.common.errorLoading'),
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
          onClick={handleEditDirections}
          disabled={Object.keys(editedDirections).length === 0}
        >
          {isLoading ? <CircularProgress size={25} /> : <SaveIcon />}
        </IconButton>
      </Box>
    ),
    renderTopToolbarCustomActions: ({ table }) => (
      <Tooltip title={t('donneeDeBase.direction.addNew')}>
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
const Direction = () => (
  <DirectionTable />
);

export default Direction;

function validateEmail(email: string) {
  return !!email.match(
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  );
}
