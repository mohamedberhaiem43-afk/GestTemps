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
import AutorenewIcon from '@mui/icons-material/Autorenew';
import SearchIcon from '@mui/icons-material/Search';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import useGetAllContrats from '../../../hooks/contratHooks/useGetAllContrats';
import useDeleteContrat from '../../../hooks/contratHooks/useDeleteContrat';
import AlertModal from '../../AlertModal/AlertModal';
import CustomizedSnackbars from '../../Snackbar/Snackbar';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';
import { useAuth } from '../../helper/AuthProvider';
import { Contrat } from '../../../models/Contrat';
// Hook retournant uniquement les sites auxquels l'utilisateur connecté
// a accès (jointure Socusers côté backend dans /Sites/get-sitlibs/{soccod}/{uticod}).
// On l'utilise pour résoudre row.sitcod → libellé humain dans la table.
import useGetSiteLibs from '../../../hooks/siteHooks/useGetSiteLibs';

interface ListContratsModernProps {
  onEdit?: (contract: Contrat) => void;
  onRenew?: (contract: Contrat) => void;
}

const formatContractType = (type?: string) => {
  switch (type) {
    case '0': return { label: 'CDD', color: '#dbeafe', textColor: '#1d4ed8' };
    case '1': return { label: 'CDI', color: '#d1fae5', textColor: '#047857' };
    case '2': return { label: 'Ouvrier', color: '#fef3c7', textColor: '#b45309' };
    case '3': return { label: 'CIVP', color: '#ede9fe', textColor: '#6d28d9' };
    default: return { label: type || '-', color: '#f2f4f6', textColor: '#515f74' };
  }
};

const formatDate = (date?: Date | string) => {
  if (!date) return '';
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toLocaleDateString('fr-FR');
};

const ListContratsModern = ({ onEdit, onRenew }: ListContratsModernProps) => {
  const { uticod } = useAuth();
  const { data: allContracts, error } = useGetAllContrats('', '', { uticod: uticod || '' });
  const { mutate: deleteContrat } = useDeleteContrat();

  // Sites autorisés pour cet utilisateur — la map permet d'afficher
  // "Casablanca - Maarif" au lieu du code brut "S01" dans la colonne Site.
  // Si la map ne contient pas le code (cas d'un contrat hérité sur un site
  // qui a été retiré du périmètre de l'utilisateur), on retombe sur le code.
  const { data: sitLibs = {} } = useGetSiteLibs();
  const resolveSiteLabel = (code?: string | null) => {
    if (!code) return '-';
    return (sitLibs as Record<string, string>)[code] || code;
  };

  const [openModal, setOpenModal] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contrat | null>(null);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [forbiddenError, setForbiddenError] = useState(false);
  const [forbiddenDeleteError, setForbiddenDeleteError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<Contrat | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const data = allContracts || [];

  useEffect(() => {
    if (error instanceof Error && error.message.includes('403')) {
      setForbiddenError(true);
    }
  }, [error]);

  const filteredData = useMemo(() => {
    let result = data;

    // Apply type filter
    if (activeFilter !== 'all') {
      result = result.filter((item: Contrat) => item.contype === activeFilter);
    }

    // Apply search filter
    if (searchTerm) {
      result = result.filter((item: Contrat) =>
        item.concod?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.empcod?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return result;
  }, [data, searchTerm, activeFilter]);

  const handleDeleteConfirm = () => {
    if (!contractToDelete) return;

    deleteContrat(
      { soccod: contractToDelete.soccod, concod: contractToDelete.concod },
      {
        onSuccess: () => {
          setOpenModal(false);
          setShowSuccessAlert(true);
        },
        onError: (deleteError: any) => {
          if (deleteError?.response?.status === 403) {
            setForbiddenDeleteError(true);
          }
        },
      }
    );
  };

  const handleExportRows = (rows: Contrat[]) => {
    const doc = new jsPDF();
    const tableHeaders = ['N° Contrat', 'Employé', 'Nom et Prénom', 'Date Début', 'Date Fin', 'Type', 'Site'];
    const tableData = rows.map((row) => [
      row.concod ?? '',
      row.empcod ?? '',
      formatDate(row.empemb),
      formatDate(row.empsort),
      formatContractType(row.contype).label,
      resolveSiteLabel(row.sitcod),
    ]);

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
    });

    doc.save('contrats-export.pdf');
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, row: Contrat) => {
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const filterButtons = [
    { key: 'all', label: 'Tous' },
    { key: '1', label: 'CDI' },
    { key: '0', label: 'CDD' },
  ];

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
        {/* Filters */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1.5,
            borderBottom: '1px solid #e6e8ea',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {filterButtons.map((btn) => (
              <Button
                key={btn.key}
                size="small"
                onClick={() => setActiveFilter(btn.key)}
                sx={{
                  borderRadius: '20px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '11px',
                  padding: '4px 16px',
                  backgroundColor: activeFilter === btn.key ? '#dbeafe' : 'transparent',
                  color: activeFilter === btn.key ? '#1d4ed8' : '#515f74',
                  '&:hover': {
                    backgroundColor: activeFilter === btn.key ? '#bfdbfe' : '#f2f4f6',
                  },
                }}
              >
                {btn.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
            <Button
              size="small"
              startIcon={<PictureAsPdfIcon sx={{ fontSize: 16 }} />}
              onClick={() => handleExportRows(filteredData)}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '11px',
                backgroundColor: '#f2f4f6',
                color: '#515f74',
                '&:hover': { backgroundColor: '#e6e8ea' },
              }}
            >
              Export PDF
            </Button>
          </Box>
        </Box>

        {/* Table */}
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f2f4f6' }}>
                <TableCell sx={{ py: 1.5, px: 2 }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#515f74' }}>
                    N° Contrat
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 1.5 }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#515f74' }}>
                    Employé
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 1.5 }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#515f74' }}>
                    Période
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 1.5 }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#515f74' }}>
                    Type
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 1.5 }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#515f74' }}>
                    Site
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2 }} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, textAlign: 'center' }}>
                    <Typography sx={{ color: '#515f74', fontSize: '14px' }}>
                      Aucun contrat enregistré
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((row: Contrat) => {
                  const typeConfig = formatContractType(row.contype);
                  const initials = row.empcod?.substring(0, 2).toUpperCase() || 'NA';

                  return (
                    <TableRow
                      key={`${row.soccod}-${row.concod}`}
                      hover
                      sx={{
                        '&:hover': { backgroundColor: 'rgba(242, 244, 246, 0.5)' },
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <TableCell sx={{ py: 1.5, px: 2 }}>
                        <Typography sx={{ fontSize: '12px', fontFamily: 'monospace', color: '#515f74' }}>
                          {row.concod}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 1.5 }}>
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
                          <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#191c1e' }}>
                            {row.empcod}
                          </Typography>
                          <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#191c1e' }}>
                            {row.emplib}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 1.5 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                          {formatDate(row.empemb)}
                        </Typography>
                        <Typography sx={{ fontSize: '10px', color: '#515f74' }}>
                          {row.empsort ? `Jusqu'au ${formatDate(row.empsort)}` : 'Indéterminé'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 1.5 }}>
                        <Chip
                          label={typeConfig.label}
                          size="small"
                          sx={{
                            backgroundColor: typeConfig.color,
                            color: typeConfig.textColor,
                            fontSize: '10px',
                            fontWeight: 700,
                            height: '20px',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 1.5 }}>
                        <Typography sx={{ fontSize: '12px', color: '#515f74' }}>
                          {resolveSiteLabel(row.sitcod)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2 }} align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, row)}
                          sx={{ padding: '4px' }}
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

        {/* Footer */}
        <Box
          sx={{
            p: 1.5,
            backgroundColor: '#f2f4f6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #e6e8ea',
          }}
        >
          <Typography sx={{ fontSize: '11px', color: '#515f74' }}>
            {filteredData.length} contrat{filteredData.length > 1 ? 's' : ''}
          </Typography>
        </Box>
      </Paper>

      {/* Context Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        {onEdit && (
          <MenuItem
            onClick={() => {
              if (selectedRow) onEdit(selectedRow);
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <Typography sx={{ fontSize: '13px' }}>Modifier</Typography>
          </MenuItem>
        )}
        {onRenew && (
          <MenuItem
            onClick={() => {
              if (selectedRow) onRenew(selectedRow);
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <AutorenewIcon fontSize="small" />
            </ListItemIcon>
            <Typography sx={{ fontSize: '13px' }}>Renouveler</Typography>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (selectedRow) {
              setContractToDelete(selectedRow);
              setOpenModal(true);
            }
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <Typography sx={{ fontSize: '13px' }}>Supprimer</Typography>
        </MenuItem>
      </Menu>

      {/* Alerts */}
      {showSuccessAlert && (
        <CustomizedSnackbars
          open={showSuccessAlert}
          message="Le contrat a été supprimé avec succès !"
          severity="success"
          onClose={() => setShowSuccessAlert(false)}
        />
      )}
      {forbiddenError && (
        <ForbiddenMessage message="Vous n'avez pas les droits nécessaires pour consulter les contrats." />
      )}
      {forbiddenDeleteError && (
        <ForbiddenMessage message="Vous n'avez pas les droits nécessaires pour supprimer ce contrat." />
      )}

      {/* Delete Confirmation Modal */}
      <AlertModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onConfirm={handleDeleteConfirm}
        message="Voulez-vous vraiment supprimer ce contrat ?"
      />
    </Box>
  );
};

export default ListContratsModern;