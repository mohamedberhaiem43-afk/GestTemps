import { useMemo, useState } from 'react';
import {
  type MRT_ColumnDef,
  MRT_Row,
} from 'material-react-table';
import { Box, Select, MenuItem, FormControl } from '@mui/material';
import apiInstance from '../../API/apiInstance';
import './Section.css';
import useGetSections from '../../../hooks/sectionHooks/useGetSections';
import DataList from '../../lists/list';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';

const Section = () => {
  const [setEditedSections] = useState<any>();

  const openDeleteConfirmModal = (row: MRT_Row<any>) => {
    if (window.confirm('Ete vous sure de supprimer cette section?')) {
      apiInstance.delete(`/Sections/${row.original.soccod}/${row.original.seccod}`)
        .then(() => {
          // setSections((prev) => prev.filter((section) => section.seccod !== row.original.seccod));
        })
        .catch((error) => {
          console.error("Error deleting section: ", error);
        });
    }
  };

  const{ data:sections = [],refetch } = useGetSections();

  const columns = useMemo<MRT_ColumnDef<any>[]>(() => [
    {
      accessorKey: 'seccod',
      header: 'Section Code',
      size: 60,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;

          setEditedSections((prev:any) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              seccod: updatedValue,
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

          setEditedSections((prev:any) => ({
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
      accessorKey: 'seclib',
      header: 'Libellé',
      size: 200,
      muiEditTextFieldProps: ({ cell }) => ({
        onBlur: (event) => {
          const rowId = cell.row.id;
          const updatedValue = event.target.value;

          setEditedSections((prev:any) => ({
            ...prev,
            [rowId]: {
              ...prev[rowId],
              seclib: updatedValue,
            },
          }));
        },
      }),
    },
    {
      accessorKey: 'sectype',
      header: 'Type',
      size: 100,
      Cell: ({ cell }) => (
        <FormControl variant='standard' fullWidth>
          <Select
            value={cell.getValue() ?? ''}
            onChange={(event) => {
              const selectedType = event.target.value;
              const rowId = cell.row.id;
              setEditedSections((prev:any) => ({
                ...prev,
                [rowId]: {
                  ...prev[rowId],
                  sectype: selectedType,
                },
              }));
            }}
          >
            <MenuItem value="Poste">Poste</MenuItem>
            <MenuItem value="Section">Section</MenuItem>
          </Select>
        </FormControl>
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

          setEditedSections((prev:any) => ({
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


  
  return (
      <Box height={'90vh'} width={'95vw'}>
        <BreadcrumbNavigation />
        <DataList data={sections} columns={columns} message={undefined} deleteMethod={openDeleteConfirmModal} idKey={'seccod'} refetchMethod={refetch}
      reportGeneration1={undefined} reportGeneration2={undefined} reportGeneration3={undefined} reportGeneration4={undefined}
      empHoraires={undefined} setData={undefined} pageSize={5} purge={undefined} />
        </Box>
  )
}
export default Section;
