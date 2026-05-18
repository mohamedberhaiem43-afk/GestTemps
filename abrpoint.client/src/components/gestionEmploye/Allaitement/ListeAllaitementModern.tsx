import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  Chip,
  Avatar,
  IconButton,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import useGetAllaitement from '../../../hooks/allaitementHooks/useGetAllaitement';
import { AllaitementDto } from '../../../models/Allaitement';
import useDeleteAllaitement from '../../../hooks/allaitementHooks/useDeleteAllaitement';
import AlertModal from '../../AlertModal/AlertModal';
import CustomizedSnackbars from '../../Snackbar/Snackbar';
import { useAllaitementContext } from '../../helper/AllaitementContext';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';
import { useTranslation } from 'react-i18next';

const formatDate = (date?: Date | string) => {
  if (!date) return '';
  const parsedDate = new Date(date);
  return parsedDate.toLocaleDateString('fr-FR');
};

const getStatusConfig = (conret: string) => {
  const endDate = new Date(conret);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (endDate < today) {
    return { label: 'Terminé', color: '#e0e3e5', textColor: '#515f74' };
  }
  return { label: 'Actif', color: '#006c49', textColor: '#ffffff' };
};

export const ListAllaitementModern: React.FC = () => {
  const { setSelectedAllaitement } = useAllaitementContext();
  const { t } = useTranslation();
  const [AllaitementToDelete, setAllaitementToDelete] = useState<{ soccod: string, concod: string } | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [forbiddenError, setForbiddenError] = useState(false);
  const [forbiddenDeleteError, setForbiddenDeleteError] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<AllaitementDto | null>(null);
  const rowsPerPage = 8;

  const { data = [], error, refetch } = useGetAllaitement();
  const { mutate: deleteAllaitement } = useDeleteAllaitement();

  useEffect(() => {
    if (error instanceof Error && error.message.includes("403")) {
      setForbiddenError(true);
      setTimeout(() => setForbiddenError(false), 5000);
    }
  }, [error]);

  const handleSnackbarClose = () => {
    setShowSuccessAlert(false);
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter((item: any) =>
      item.emplib?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.concod?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.empcod?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page]);


  const getAllaitementToEdit = (original: AllaitementDto) => {
    const selected = data.find((allaitement: any) => allaitement.concod === original.concod);
    if (selected) {
      setSelectedAllaitement(selected);
    }
  };

  const deleteAllaitementFunction = (soccod: string, concod: string) => {
    deleteAllaitement(
      { soccod, concod },
      {
        onSuccess() {
          setShowSuccessAlert(true);
          refetch();
        },
        onError(error: any) {
          if (error?.response?.status === 403 || error?.message?.includes('403')) {
            setForbiddenDeleteError(true);
          }
        },
      }
    );
  };

  const handleExportRows = (rows: any[]) => {
    const doc = new jsPDF();
    const tableHeaders = ['N° Ordre', 'Employée', 'Date Début', 'Date Fin', 'Statut'];
    const tableData = rows.map((row) => [
      row.concod,
      row.emplib,
      formatDate(row.condep),
      formatDate(row.conret),
      getStatusConfig(row.conret).label,
    ]);

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
    });

    doc.save('allaitement-export.pdf');
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, row: AllaitementDto) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%', minHeight: 0 }}>
      {/* Main Table Card */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(25,28,30,0.08)',
          backgroundColor: '#ffffff',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: { xs: 1.5, sm: 2 },
            borderBottom: '1px solid #e6e8ea',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1,
          }}
        >
          <Box>
            <Typography
              sx={{ fontWeight: 700, fontFamily: 'Manrope, sans-serif', fontSize: '1rem' }}
            >
              Historique des périodes
            </Typography>
            <Typography variant="body2" sx={{ color: '#515f74', fontSize: '12px' }}>
              {filteredData.length} dossier{filteredData.length > 1 ? 's' : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#737785', fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: { xs: '100%', sm: 180 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  backgroundColor: '#f2f4f6',
                  fontSize: '13px',
                  '& fieldset': { border: 'none' },
                },
              }}
            />
            <IconButton
              size="small"
              sx={{
                borderRadius: '8px',
                '&:hover': { backgroundColor: '#f2f4f6' },
              }}
            >
              <FilterListIcon sx={{ color: '#515f74', fontSize: 18 }} />
            </IconButton>
            <Button
              size="small"
              startIcon={<FileDownloadIcon sx={{ fontSize: 16 }} />}
              onClick={() => handleExportRows(filteredData)}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '12px',
                whiteSpace: 'nowrap',
              }}
            >
              PDF
            </Button>
          </Box>
        </Box>

        {/* Table */}
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#e6e8ea' }}>
                <TableCell sx={{ py: 1.5, px: 2 }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#515f74' }}>
                    Employée
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 1.5 }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#515f74' }}>
                    Réf.
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 1.5 }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#515f74' }}>
                    Période
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 1.5 }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#515f74' }}>
                    Statut
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2 }} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 4, textAlign: 'center' }}>
                    <Typography sx={{ color: '#515f74', fontSize: '14px' }}>
                      Aucune période d'allaitement enregistrée
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row: any) => {
                  const status = getStatusConfig(row.conret);
                  const initials = row.emplib?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'NA';

                  return (
                    <TableRow
                      key={row.concod}
                      hover
                      sx={{
                        '&:hover': { backgroundColor: 'rgba(242, 244, 246, 0.5)' },
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <TableCell sx={{ py: 1.5, px: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              backgroundColor: '#dae2ff',
                              color: '#0040a1',
                              fontSize: '10px',
                              fontWeight: 700,
                            }}
                          >
                            {initials}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: '13px', color: '#191c1e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.emplib}
                            </Typography>
                            <Typography sx={{ fontSize: '10px', color: '#515f74' }}>
                              {row.empcod}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 1.5 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, fontFamily: 'Manrope, sans-serif', color: '#0040a1' }}>
                          {row.concod}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 1.5 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                          {formatDate(row.condep)}
                        </Typography>
                        <Typography sx={{ fontSize: '10px', color: '#515f74' }}>
                          au {formatDate(row.conret)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 1.5 }}>
                        <Chip
                          label={status.label}
                          size="small"
                          sx={{
                            backgroundColor: status.color,
                            color: status.textColor,
                            fontSize: '9px',
                            fontWeight: 700,
                            height: '20px',
                            textTransform: 'uppercase',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2 }} align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, row)}
                          sx={{
                            padding: '4px',
                          }}
                        >
                          <MoreVertIcon sx={{ fontSize: '16px', color: '#515f74' }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box
            sx={{
              p: 1.5,
              backgroundColor: 'rgba(242, 244, 246, 0.4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #e6e8ea',
            }}
          >
            <Typography sx={{ fontSize: '11px', color: '#515f74', fontWeight: 500 }}>
              {((page - 1) * rowsPerPage) + 1}-{Math.min(page * rowsPerPage, filteredData.length)} / {filteredData.length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton
                size="small"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  '&:hover': { backgroundColor: '#f2f4f6' },
                  '&.Mui-disabled': { backgroundColor: '#f2f4f6' },
                }}
              >
                <Typography sx={{ fontSize: '10px', fontWeight: 700 }}>&lt;</Typography>
              </IconButton>
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 3) {
                  pageNum = i + 1;
                } else if (page === 1) {
                  pageNum = i + 1;
                } else if (page === totalPages) {
                  pageNum = totalPages - 2 + i;
                } else {
                  pageNum = page - 1 + i;
                }
                return (
                  <IconButton
                    key={pageNum}
                    size="small"
                    onClick={() => setPage(pageNum)}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '6px',
                      backgroundColor: pageNum === page ? '#0040a1' : '#ffffff',
                      color: pageNum === page ? '#ffffff' : '#515f74',
                      '&:hover': { backgroundColor: pageNum === page ? '#003380' : '#f2f4f6' },
                    }}
                  >
                    <Typography sx={{ fontSize: '10px', fontWeight: 700 }}>{pageNum}</Typography>
                  </IconButton>
                );
              })}
              <IconButton
                size="small"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  '&:hover': { backgroundColor: '#f2f4f6' },
                  '&.Mui-disabled': { backgroundColor: '#f2f4f6' },
                }}
              >
                <Typography sx={{ fontSize: '10px', fontWeight: 700 }}>&gt;</Typography>
              </IconButton>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (selectedRow) getAllaitementToEdit(selectedRow);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <Typography sx={{ fontSize: '13px' }}>{t('allaitement.actions.edit') || 'Modifier'}</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedRow) {
              setAllaitementToDelete({ soccod: selectedRow.soccod, concod: selectedRow.concod });
              setOpenModal(true);
            }
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <Typography sx={{ fontSize: '13px' }}>{t('allaitement.actions.delete') || 'Supprimer'}</Typography>
        </MenuItem>
      </Menu>

      {/* Alerts */}
      {showSuccessAlert && (
        <CustomizedSnackbars
          open={showSuccessAlert}
          message="Allaitement a été supprimée avec succès!"
          severity="success"
          onClose={handleSnackbarClose}
        />
      )}
      {forbiddenError && (
        <ForbiddenMessage message="Vous n'avez pas les droits nécessaires pour consulter ces données." />
      )}
      {forbiddenDeleteError && (
        <ForbiddenMessage message="Vous n'avez pas les droits nécessaires pour supprimer ces données." />
      )}

      {/* Delete Confirmation Modal */}
      <AlertModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onConfirm={() => {
          deleteAllaitementFunction(AllaitementToDelete?.soccod || '', AllaitementToDelete?.concod || '');
          setOpenModal(false);
        }}
        message="Vous êtes sûr de supprimer cette allaitement?"
      />
    </Box>
  );
};

export default ListAllaitementModern;