import { Box, Typography, Button, TextField, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, InputAdornment, Avatar, Skeleton } from "@mui/material";
import { staggerSx } from '../helper/animations/Stagger';
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { useAuth } from "../helper/AuthProvider";
import apiInstance from "../API/apiInstance";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import GroupsIcon from "@mui/icons-material/Groups";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Employe from "../../models/Employe";
import useDeleteEmploye from "../../hooks/employeHooks/useDeleteEmploye";
import AlertModal from "../AlertModal/AlertModal";
import ExcelImportButton from "../DonneeDeBase/shared/ExcelImportButton";
import { resolveAssetUrl } from "../../helpers/assetUrl";
import "./EffectifsGlobaux.css";

interface EmployeeWithDetails extends Employe {
  serlib?: string;
  fonlib?: string;
  sitlib?: string;
  contractType?: string;
}

interface Statistics {
  totalEmployees: number;
  activeEmployees: number;
  newThisMonth: number;
  inactiveEmployees: number;
}

const EffectifsGlobaux = () => {
  const { t } = useTranslation();
  const { soccod, uticod, isManager, sercod, hasPermission } = useAuth();
  const canAdd = hasPermission('Gestion Employés', 'add');
  const canModify = hasPermission('Gestion Employés', 'modify');
  const canDelete = hasPermission('Gestion Employés', 'delete');
  const canConsult = hasPermission('Gestion Employés', 'consult');
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<EmployeeWithDetails[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedContract, setSelectedContract] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"" | "actif" | "inactif">("");
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<Employe | null>(null);
  // Compteur rechargé après un import Excel pour ré-exécuter le useEffect de fetch.
  const [reloadKey, setReloadKey] = useState(0);
  const { mutateAsync: deleteEmploye } = useDeleteEmploye();

  const [departments, setDepartments] = useState<Record<string, string>>({});
  const [sites, setSites] = useState<Record<string, string>>({});
  const [fonctions, setFonctions] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Statistics>({
    totalEmployees: 0,
    activeEmployees: 0,
    newThisMonth: 0,
    inactiveEmployees: 0,
  });
  const isManagerScoped = Boolean(isManager && sercod);

  useEffect(() => {
    if (isManagerScoped) {
      setSelectedDepartment(sercod || "");
    }
  }, [isManagerScoped, sercod]);

  // Fetch employees
  useEffect(() => {
    if (!soccod || !uticod) return;

    setIsLoading(true);
    apiInstance
      .get(`/Employes/${soccod}/${uticod}`)
      .then((res) => {
        const empData = res.data ?? [];
        const scopedData = isManagerScoped
          ? empData.filter((e: Employe) => e.sercod === sercod)
          : empData;
        setEmployees(scopedData);
        setFilteredEmployees(scopedData);

        // Calculate stats
        const active = scopedData.filter((e: Employe) => e.actif === "A").length;
        const inactive = scopedData.filter((e: Employe) => e.actif !== "A").length;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const newThisMonth = scopedData.filter((e: Employe) => {
          if (!e.empemb) return false;
          const hireDate = new Date(e.empemb);
          return hireDate.getMonth() === currentMonth && hireDate.getFullYear() === currentYear;
        }).length;

        setStats({
          totalEmployees: scopedData.length,
          activeEmployees: active,
          newThisMonth,
          inactiveEmployees: inactive,
        });
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, [soccod, uticod, isManagerScoped, sercod, reloadKey]);

  // Fetch departments (services)
  useEffect(() => {
    if (!soccod) return;
    apiInstance
      .get(`/Services/get-servlibs/${soccod}`)
      .then((res) => {
        const allDepartments = res.data ?? {};
        if (isManagerScoped && sercod) {
          setDepartments(
            allDepartments[sercod]
              ? { [sercod]: allDepartments[sercod] }
              : {}
          );
          return;
        }
        setDepartments(allDepartments);
      })
      .catch((err) => console.error(err));
  }, [soccod, isManagerScoped, sercod]);

  // Fetch sites
  useEffect(() => {
    if (!soccod) return;
    apiInstance
      .get(`/Sites/get-sitlibs/${soccod}`)
      .then((res) => setSites(res.data ?? {}))
      .catch((err) => console.error(err));
  }, [soccod]);

  // Fetch fonctions (for Position libelle)
  useEffect(() => {
    if (!soccod) return;
    apiInstance
      .get(`/Fonctions/get-fonlibs/${soccod}`)
      .then((res) => {
        const rawData = res.data ?? {};
        const normalizedFonctions: Record<string, string> = Array.isArray(rawData)
          ? rawData.reduce((acc: Record<string, string>, item: any) => {
              if (item?.foncod) {
                acc[item.foncod] = item.fonlib ?? item.foncod;
              }
              return acc;
            }, {})
          : rawData;
        setFonctions(normalizedFonctions);
      })
      .catch((err) => console.error(err));
  }, [soccod]);

  // Filter employees
  useEffect(() => {
    let result = [...employees];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.emplib?.toLowerCase().includes(query) ||
          e.empmat?.toLowerCase().includes(query) ||
          e.empcod?.toLowerCase().includes(query) ||
          e.empemail?.toLowerCase().includes(query)
      );
    }

    if (selectedDepartment) {
      result = result.filter((e) => e.sercod === selectedDepartment);
    }

    if (selectedSite) {
      result = result.filter((e) => e.sitcod === selectedSite);
    }

    if (selectedContract) {
      const contractValue = selectedContract.trim().toUpperCase();
      result = result.filter((e) =>
        (e.empcontrat || '').trim().toUpperCase() === contractValue
      );
    }

    if (selectedLevel) {
      const levelValue = selectedLevel.trim();
      result = result.filter((e) => {
        const empNiv = e.empniv != null ? String(e.empniv).trim() : '';
        return empNiv === levelValue;
      });
    }

    if (selectedPosition) {
      const positionValue = selectedPosition.trim().toUpperCase();
      result = result.filter((e) => {
        const fonCode = (e.foncod || e.empfonc || '').trim().toUpperCase();
        return fonCode === positionValue;
      });
    }

    if (selectedStatus) {
      result = result.filter((e) =>
        selectedStatus === "actif" ? e.actif === "A" : e.actif !== "A"
      );
    }
    setFilteredEmployees(result);
    setPage(0);
  }, [searchQuery, selectedDepartment, selectedSite, selectedContract, selectedLevel, selectedPosition, selectedStatus, employees]);

  const paginatedEmployees = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredEmployees.slice(start, start + rowsPerPage);
  }, [filteredEmployees, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage);

  const handleViewEmployee = (empcod: string) => {
    // L'œil ouvre la fiche CV (lecture seule, présentable) plutôt que le
    // formulaire de modification. L'admin peut basculer en édition depuis
    // la fiche elle-même via le bouton "Modifier".
    navigate(`/dashboard/fiche-employe?id=${empcod}`);
  };

  const handleEditEmployee = (empcod: string) => {
    navigate(`/dashboard/profil-employe?id=${empcod}&edit=true`);
  };

  const handleAddEmployee = () => {
    navigate("/dashboard/profil-employe?new=true");
  };

  const handleDeleteEmployee = async (empcod: string) => {
    try {
      await deleteEmploye({ empcod });
      setEmployees(prev => prev.filter(e => e.empcod !== empcod));
      setDeleteTarget(null);
    } catch (err) {
      console.error(t('effectifs.deleteError'), err);
    }
  };

  const getContractLabel = (contract: string | null): string => {
    const normalized = (contract || '').trim().toUpperCase();
    if (!normalized) return 'N/A';
    if (normalized === 'CDI') return 'CDI';
    if (normalized === 'CDD') return 'CDD';
    if (normalized === 'STAGE') return 'Stage';
    if (normalized === 'FREELANCE') return 'Freelance';
    return contract?.trim() || 'N/A';
  };

  const getContractColor = (contract: string | null): "primary" | "secondary" | "success" | "warning" | "default" => {
    const normalized = (contract || '').trim().toUpperCase();
    if (normalized === 'CDI') return 'success';
    if (normalized === 'CDD') return 'primary';
    if (normalized === 'STAGE') return 'warning';
    if (normalized === 'FREELANCE') return 'secondary';
    return 'default';
  };

  if (isLoading) {
    // Skeleton de la liste : on garde le même layout que la version peuplée
    // (header + filtres + table) avec des silhouettes pulsantes — l'utilisateur
    // perçoit immédiatement la structure de la page au lieu d'un spinner centré.
    return (
      <Box className="effectifs-container">
        <Box className="effectifs-header">
          <Box className="effectifs-header-left">
            <Skeleton variant="text" width={140} height={16} sx={{ mb: 1 }} />
            <Skeleton variant="text" width={280} height={36} sx={{ mb: 1 }} />
            <Skeleton variant="text" width={420} height={16} />
          </Box>
        </Box>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={`fk-${i}`} variant="rounded" width={160} height={40} />
            ))}
          </Box>
          <Paper sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #edf0f5' }}>
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <Box key={`sk-eg-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderBottom: i === 6 ? 'none' : '1px solid #f1f5f9' }}>
                <Skeleton variant="circular" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" sx={{ fontSize: 14, width: '40%' }} />
                  <Skeleton variant="text" sx={{ fontSize: 11, width: '25%' }} />
                </Box>
                <Skeleton variant="rounded" width={60} height={22} />
                <Skeleton variant="text" width={80} />
                <Skeleton variant="circular" width={24} height={24} />
              </Box>
            ))}
          </Paper>
        </Box>
      </Box>
    );
  }

  if (!canConsult) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', m: 3 }}>
        <GroupsIcon sx={{ fontSize: 64, color: '#ba1a1a', opacity: 0.2, mb: 2 }} />
        <Typography variant="h6" color="error">{t('effectifs.accessDenied')}</Typography>
        <Typography sx={{ color: '#64748b' }}>{t('effectifs.noConsultRight')}</Typography>
      </Box>
    );
  }

  return (
    <Box className="effectifs-container">
      {/* Hero Header Section */}
      <Box className="effectifs-header">
        <Box className="effectifs-header-left">
          <Typography className="effectifs-subtitle">
            {t('effectifs.directorySubtitle')}
          </Typography>
          <Typography className="effectifs-title">{t('effectifs.title')}</Typography>
          <Typography className="effectifs-description">
            {t('effectifs.description')}
          </Typography>
        </Box>
        <Box className="effectifs-header-right" sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {canAdd && (
            <ExcelImportButton
              label={t('effectifs.importExcel')}
              endpoint="/BulkImport/employes"
              extraBody={{ Soccod: soccod, Sitcod: '01' }}
              columnMap={{
                Empcod: ['empcod', 'matricule', 'code'],
                Emplib: ['emplib', 'nom', 'nom complet', 'nom et prenom', 'nom et prénom', 'employe', 'employé'],
                Emplnais: ['emplnais', 'lieu de naissance', 'lieu naissance'],
                Empdnais: ['empdnais', 'date de naissance', 'date naissance', 'naissance'],
                Empsexe: ['empsexe', 'sexe', 'genre'],
                Empcin: ['empcin', 'cin', 'cnie', 'identite', 'identité'],
                Emptel: ['emptel', 'telephone', 'téléphone', 'tel', 'mobile'],
                Empemail: ['empemail', 'email', 'mail', 'e-mail'],
                Empadr: ['empadr', 'adresse', 'address'],
                Empemb: ['empemb', 'date embauche', "date d'embauche", 'embauche', 'hire date'],
                ServiceLib: ['servicelib', 'service', 'serlib', 'departement', 'département'],
                FonctionLib: ['fonctionlib', 'fonction', 'fonlib', 'poste', 'job'],
              }}
              onImported={() => setReloadKey(k => k + 1)}
            />
          )}
          {canAdd && (
            <Button
              className="add-employee-btn"
              startIcon={<PersonAddIcon />}
              onClick={handleAddEmployee}
            >
              {t('effectifs.addCollaborator')}
            </Button>
          )}
        </Box>
      </Box>

      {/* Filters & Stats Grid */}
      <Box className="effectifs-filters-grid">
        {/* Search & Filters Container */}
        <Paper className="filters-container">
          <Box className="filters-row">
            <Box className="filter-field">
              <label>{t('effectifs.department')}</label>
              <TextField
                select
                size="small"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="filter-select"
                disabled={isManagerScoped}
                SelectProps={{
                  displayEmpty: true,
                }}
              >
                <MenuItem value="">{isManagerScoped ? t('effectifs.myDepartment') : t('effectifs.allDepartments')}</MenuItem>
                {Object.entries(departments).map(([code, label]) => (
                  <MenuItem key={code} value={code}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>

            </Box>
            <Box className="filter-field">
              <label>{t('effectifs.position')}</label>
              <TextField
                select
                size="small"
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="filter-select"
                SelectProps={{
                  displayEmpty: true,
                }}
              >
                <MenuItem value="">{t('effectifs.allPositions')}</MenuItem>
                {Object.entries(fonctions).map(([code, label]) => (
                  <MenuItem key={code} value={code}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box className="filter-field">
              <label>{t('effectifs.site')}</label>
              <TextField
                select
                size="small"
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="filter-select"
                SelectProps={{
                  displayEmpty: true,
                }}
              >
                <MenuItem value="">{t('effectifs.allSites')}</MenuItem>
                {Object.entries(sites).map(([code, label]) => (
                  <MenuItem key={code} value={code}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box className="filter-field">
              <label>{t('effectifs.contractType')}</label>
              <TextField
                select
                size="small"
                value={selectedContract}
                onChange={(e) => setSelectedContract(e.target.value)}
                className="filter-select"
                SelectProps={{
                  displayEmpty: true,
                }}
              >
                <MenuItem value="">{t('effectifs.allContracts')}</MenuItem>
                <MenuItem value="CDI">CDI</MenuItem>
                <MenuItem value="CDD">CDD</MenuItem>
                <MenuItem value="STAGE">Stage</MenuItem>
                <MenuItem value="FREELANCE">Freelance</MenuItem>
              </TextField>
            </Box>
            <Box className="filter-field">
              <label>{t('effectifs.level')}</label>
              <TextField
                select
                size="small"
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="filter-select"
                SelectProps={{
                  displayEmpty: true,
                }}
              >
                <MenuItem value="">{t('effectifs.allLevels')}</MenuItem>
                <MenuItem value="0">{t('effectifs.executant')}</MenuItem>
                <MenuItem value="1">{t('effectifs.maitrise')}</MenuItem>
                <MenuItem value="2">{t('effectifs.cadre')}</MenuItem>
              </TextField>
            </Box>
            <Box className="filter-field">
              <label>{t('effectifs.status')}</label>
              <TextField
                select
                size="small"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as "" | "actif" | "inactif")}
                className="filter-select"
                SelectProps={{
                  displayEmpty: true,
                }}
              >
                <MenuItem value="">{t('effectifs.allStatuses')}</MenuItem>
                <MenuItem value="actif">{t('effectifs.active')}</MenuItem>
                <MenuItem value="inactif">{t('effectifs.inactive')}</MenuItem>
              </TextField>
            </Box>
          </Box>
        </Paper>

        {/* Stats Summary Card */}
        <Paper className="stats-card">
          <Box className="stats-content">
            <Typography className="stats-label">{t('effectifs.totalHeadcount')}</Typography>
            <Typography className="stats-value">{stats.totalEmployees.toLocaleString()}</Typography>
          </Box>
          <Box className="stats-trend">
            <TrendingUpIcon className="stats-trend-icon" />
            <span>{t('effectifs.newThisMonth', { count: stats.newThisMonth })}</span>
          </Box>
          <GroupsIcon className="stats-decoration" />
        </Paper>
      </Box>

      {/* Search Bar */}
      <Paper className="search-container">
        <TextField
          placeholder={t('effectifs.searchPlaceholder')}
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon className="search-icon" />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Employees Table */}
      <Paper className="table-container">
        <TableContainer>
          <Table className="employees-table">
            <TableHead>
              <TableRow>
                <TableCell className="table-header">{t('effectifs.columns.collaborator')}</TableCell>
                <TableCell className="table-header">{t('effectifs.columns.matricule')}</TableCell>
                <TableCell className="table-header">{t('effectifs.columns.position')}</TableCell>
                <TableCell className="table-header">{t('effectifs.columns.department')}</TableCell>
                <TableCell className="table-header">{t('effectifs.columns.contract')}</TableCell>
                <TableCell className="table-header">{t('effectifs.columns.status')}</TableCell>
                <TableCell className="table-header table-header-right">{t('effectifs.columns.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="empty-cell" sx={{ py: 5 }}>
                    {/* Dead-end transformé en CTA : on utilise le vide pour
                        rassurer (« en 1 minute ») et orienter l'admin vers
                        l'import/création — bien plus engageant qu'un simple
                        « aucun résultat ». */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, textAlign: 'center', maxWidth: 420, mx: 'auto' }}>
                      <Box
                        sx={{
                          width: 64, height: 64, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #dae2ff 0%, #b2c5ff 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 6px 16px rgba(0,64,161,0.15)',
                        }}
                      >
                        <PersonAddIcon sx={{ fontSize: 30, color: '#0040a1' }} />
                      </Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#0040a1' }}>
                        {t('effectifs.emptyTitle')}
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                        {t('effectifs.emptyHint')}
                      </Typography>
                      {canAdd && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                          <Button
                            variant="contained"
                            startIcon={<PersonAddIcon />}
                            onClick={handleAddEmployee}
                            sx={{ textTransform: 'none', fontWeight: 700, background: '#0040a1', '&:hover': { background: '#003280' } }}
                          >
                            {t('effectifs.addCollaborator')}
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEmployees.map((employee, idx) => (
                  <TableRow key={employee.empcod} className="table-row" sx={staggerSx(idx)}>
                    <TableCell>
                      <Box className="employee-cell">
                        {/* Photo de l'utilisateur lié (Utilisateurs.Utiimg) jointe
                            côté serveur. Fallback sur l'initiale si l'employé n'a
                            pas encore de compte ou pas uploadé de photo. */}
                        <Avatar
                          className="employee-avatar"
                          src={employee.utiimg ? resolveAssetUrl(employee.utiimg) : undefined}
                          alt={employee.emplib || employee.empcod}
                        >
                          {employee.emplib?.charAt(0)?.toUpperCase() || "N"}
                        </Avatar>
                        <Box className="employee-info">
                          <Typography className="employee-name">
                            {employee.emplib || "N/A"}
                          </Typography>
                          <Typography className="employee-email">
                            {employee.empemail || "N/A"}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={employee.empcod || employee.empmat || "N/A"} className="matricule-chip" size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography className="position-text">
                        {fonctions[employee.foncod || ''] || fonctions[employee.empfonc || ''] || employee.empfonc || departments[employee.sercod || ""] || "N/A"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography className="department-text">
                        {departments[employee.sercod || ""] || "N/A"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getContractLabel(employee.empcontrat)}
                        color={getContractColor(employee.empcontrat)}
                        size="small"
                        className="contract-chip"
                      />
                    </TableCell>
                    <TableCell>
                      <Box className="status-cell">
                        <span
                          className={`status-dot ${
                            employee.actif === "A" ? "status-active" : "status-inactive"
                          }`}
                        />
                        <Typography
                          className={`status-text ${
                            employee.actif === "A" ? "status-active-text" : "status-inactive-text"
                          }`}
                        >
                          {employee.actif === "A" ? t('effectifs.active') : t('effectifs.inactive')}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell className="actions-cell">
                      <Box className="actions-buttons">
                        <IconButton
                          size="small"
                          className="action-btn view-btn"
                          onClick={() => handleViewEmployee(employee.empcod)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        {canModify && (
                          <IconButton
                            size="small"
                            className="action-btn edit-btn"
                            onClick={() => handleEditEmployee(employee.empcod)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        )}
                        {canDelete && (
                          <IconButton
                            size="small"
                            className="action-btn delete-btn"
                            onClick={() => setDeleteTarget(employee)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box className="pagination-container">
          <Typography className="pagination-info">
            <Trans
              i18nKey="effectifs.paginationInfo"
              values={{
                start: page * rowsPerPage + 1,
                end: Math.min((page + 1) * rowsPerPage, filteredEmployees.length),
                total: filteredEmployees.length,
              }}
              components={{ 0: <strong />, 1: <strong />, 2: <strong /> }}
            />
          </Typography>
          <Box className="pagination-buttons">
            <IconButton
              className="pagination-btn"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeftIcon />
            </IconButton>
            <Box className="pagination-numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i;
                return (
                  <Button
                    key={pageNum}
                    className={`pagination-number ${page === pageNum ? "active" : ""}`}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <Typography className="pagination-ellipsis">...</Typography>
                  <Button
                    className={`pagination-number ${page === totalPages - 1 ? "active" : ""}`}
                    onClick={() => setPage(totalPages - 1)}
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </Box>
            <IconButton
              className="pagination-btn"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      <AlertModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteEmployee(deleteTarget.empcod)}
        message={t('effectifs.deleteConfirm', { name: deleteTarget?.emplib ?? '' })}
      />
    </Box>
  );
};

export default EffectifsGlobaux;
