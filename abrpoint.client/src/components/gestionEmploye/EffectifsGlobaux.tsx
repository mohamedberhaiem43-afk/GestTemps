import { Box, Typography, Button, TextField, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, InputAdornment, CircularProgress, Avatar } from "@mui/material";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  }, [soccod, uticod, isManagerScoped, sercod]);

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
    navigate(`/dashboard/profil-employe?id=${empcod}`);
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
      console.error("Erreur lors de la suppression", err);
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
    return (
      <Box className="effectifs-loading">
        <CircularProgress size={60} />
        <Typography mt={2}>Chargement des effectifs...</Typography>
      </Box>
    );
  }

  if (!canConsult) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', m: 3 }}>
        <GroupsIcon sx={{ fontSize: 64, color: '#ba1a1a', opacity: 0.2, mb: 2 }} />
        <Typography variant="h6" color="error">Accès Refusé</Typography>
        <Typography sx={{ color: '#64748b' }}>Vous n'avez pas les droits nécessaires pour consulter la liste des effectifs.</Typography>
      </Box>
    );
  }

  return (
    <Box className="effectifs-container">
      {/* Hero Header Section */}
      <Box className="effectifs-header">
        <Box className="effectifs-header-left">
          <Typography className="effectifs-subtitle">
            Annuaire des Collaborateurs
          </Typography>
          <Typography className="effectifs-title">Effectifs Globaux</Typography>
          <Typography className="effectifs-description">
            Gérez et visualisez l'ensemble de vos effectifs avec précision et simplicité.
          </Typography>
        </Box>
        <Box className="effectifs-header-right">
          {canAdd && (
            <Button
              className="add-employee-btn"
              startIcon={<PersonAddIcon />}
              onClick={handleAddEmployee}
            >
              Ajouter un Collaborateur
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
              <label>Département</label>
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
                <MenuItem value="">{isManagerScoped ? "Mon département" : "Tous les départements"}</MenuItem>
                {Object.entries(departments).map(([code, label]) => (
                  <MenuItem key={code} value={code}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              
            </Box>
            <Box className="filter-field">
              <label>Position</label>
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
                <MenuItem value="">Toutes les positions</MenuItem>
                {Object.entries(fonctions).map(([code, label]) => (
                  <MenuItem key={code} value={code}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box className="filter-field">
              <label>Site</label>
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
                <MenuItem value="">Tous les sites</MenuItem>
                {Object.entries(sites).map(([code, label]) => (
                  <MenuItem key={code} value={code}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box className="filter-field">
              <label>Type de Contrat</label>
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
                <MenuItem value="">Tous les contrats</MenuItem>
                <MenuItem value="CDI">CDI</MenuItem>
                <MenuItem value="CDD">CDD</MenuItem>
                <MenuItem value="STAGE">Stage</MenuItem>
                <MenuItem value="FREELANCE">Freelance</MenuItem>
              </TextField>
            </Box>
            <Box className="filter-field">
              <label>Niveau</label>
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
                <MenuItem value="">Tous les niveaux</MenuItem>
                <MenuItem value="0">Exécutant</MenuItem>
                <MenuItem value="1">Maitrise</MenuItem>
                <MenuItem value="2">Cadre</MenuItem>
              </TextField>
            </Box>
            <Box className="filter-field">
              <label>Statut</label>
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
                <MenuItem value="">Tous les statuts</MenuItem>
                <MenuItem value="actif">Actif</MenuItem>
                <MenuItem value="inactif">Inactif</MenuItem>
              </TextField>
            </Box>
          </Box>
        </Paper>

        {/* Stats Summary Card */}
        <Paper className="stats-card">
          <Box className="stats-content">
            <Typography className="stats-label">Total Effectif</Typography>
            <Typography className="stats-value">{stats.totalEmployees.toLocaleString()}</Typography>
          </Box>
          <Box className="stats-trend">
            <TrendingUpIcon className="stats-trend-icon" />
            <span>+{stats.newThisMonth} ce mois</span>
          </Box>
          <GroupsIcon className="stats-decoration" />
        </Paper>
      </Box>

      {/* Search Bar */}
      <Paper className="search-container">
        <TextField
          placeholder="Rechercher un collaborateur par nom, matricule ou email..."
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
                <TableCell className="table-header">Collaborateur</TableCell>
                <TableCell className="table-header">Matricule</TableCell>
                <TableCell className="table-header">Position</TableCell>
                <TableCell className="table-header">Département</TableCell>
                <TableCell className="table-header">Contrat</TableCell>
                <TableCell className="table-header">Statut</TableCell>
                <TableCell className="table-header table-header-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="empty-cell">
                    <Typography>Aucun collaborateur trouvé</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEmployees.map((employee) => (
                  <TableRow key={employee.empcod} className="table-row">
                    <TableCell>
                      <Box className="employee-cell">
                        <Avatar className="employee-avatar">
                          {employee.emplib?.charAt(0) || "N"}
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
                          {employee.actif === "A" ? "Actif" : "Inactif"}
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
            Affichage de <strong>{page * rowsPerPage + 1}</strong> à{" "}
            <strong>{Math.min((page + 1) * rowsPerPage, filteredEmployees.length)}</strong> sur{" "}
            <strong>{filteredEmployees.length}</strong> collaborateurs
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
        message={`Voulez-vous vraiment supprimer l'employé "${deleteTarget?.emplib}" ?`}
      />
    </Box>
  );
};

export default EffectifsGlobaux;
