import { useState, useEffect, useCallback } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Button,
  TextField, MenuItem, Select, FormControl,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Tooltip, Checkbox
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Pointeuse as PointeuseModel } from "../../models/PointeuseModel";
import useGetPointeuses from "../../hooks/pointeuseHooks/useGetPointeuses";
import useDeletePointeuse from "../../hooks/pointeuseHooks/useDeletePointeuse";
import usePurgePointeuse from "../../hooks/pointeuseHooks/usePurgePointeuse";
import apiInstance from "../API/apiInstance";
import { useAuth } from "../helper/AuthProvider";
import AccessDenied from "../helper/AccessDenied";
import { useTranslation, Trans } from "react-i18next";
import BreadcrumbNavigation from "../helper/BreadcrumbNavigation";

export default function Pointeuse() {
  const { hasPermission, soccod } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation();

  const { data: pointeuses = [], refetch } = useGetPointeuses();
  const { mutate: deletePointeuse } = useDeletePointeuse();
  const { mutate: purgePointeuse } = usePurgePointeuse();

  const [selected, setSelected] = useState<PointeuseModel | null>(null);
  const [formData, setFormData] = useState<PointeuseModel>({
    poicod: "",
    soccod: soccod || "",
    poilib: "",
    poiadrip1: undefined,
    poiadrip2: undefined,
    poiadrip3: undefined,
    poiadrip4: undefined,
    poiport: 4370,
    poietat: "",
    poicom: "D",
  });
  const [ipInput, setIpInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PointeuseModel | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false, message: "", severity: "success",
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  // Stats
  const total = pointeuses.length;
  const online = pointeuses.filter(p => p.poietat === "1" || p.poietat === "C").length;
  const offline = total - online;

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      poicod: "",
      soccod: soccod || "",
      poilib: "",
      poiadrip1: undefined,
      poiadrip2: undefined,
      poiadrip3: undefined,
      poiadrip4: undefined,
      poiport: 4370,
      poietat: "",
      poicom: "D",
    });
    setIpInput("");
    setSelected(null);
  }, [soccod]);

  // Load selected into form
  useEffect(() => {
    if (selected) {
      setFormData(selected);
      setIpInput(
        [selected.poiadrip1, selected.poiadrip2, selected.poiadrip3, selected.poiadrip4].join(".")
      );
      setDialogOpen(true);
    }
  }, [selected]);

  // Parse IP
  const parseIp = (ip: string): [number | undefined, number | undefined, number | undefined, number | undefined] => {
    const parts = ip.split(".").map(p => (p ? parseInt(p, 10) || undefined : undefined));
    return [parts[0], parts[1], parts[2], parts[3]];
  };

  // Submit
  const handleSubmit = async () => {
    const [ip1, ip2, ip3, ip4] = parseIp(ipInput);
    const payload = { ...formData, poiadrip1: ip1, poiadrip2: ip2, poiadrip3: ip3, poiadrip4: ip4 };

    try {
      if (selected) {
        await apiInstance.put(`/Pointeuse`, payload);
        setSnackbar({ open: true, message: t("pointeuse.list.msgUpdated"), severity: "success" });
      } else {
        await apiInstance.post(`/Pointeuse`, payload);
        setSnackbar({ open: true, message: t("pointeuse.list.msgAdded"), severity: "success" });
      }
      resetForm();
      setDialogOpen(false);
      refetch();
    } catch (error) {
      setSnackbar({ open: true, message: t("pointeuse.list.msgSaveError"), severity: "error" });
    }
  };

  // Delete
  const handleDelete = () => {
    if (deleteTarget) {
      deletePointeuse(deleteTarget.poicod, {
        onSuccess: () => {
          refetch();
          setSnackbar({ open: true, message: t("pointeuse.list.msgDeleted"), severity: "success" });
        },
      });
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  // Purge
  const handlePurge = (p: PointeuseModel) => {
    purgePointeuse(
      {
        soccod: p.soccod,
        poicod: p.poicod,
        ip: `${p.poiadrip1}.${p.poiadrip2}.${p.poiadrip3}.${p.poiadrip4}`,
        port: p.poiport,
        pswd: 123456,
      },
      {
        onSuccess: () => {
          setSnackbar({ open: true, message: t("pointeuse.list.msgPurgeOk"), severity: "success" });
        },
        onError: (err: any) => {
          setSnackbar({ open: true, message: t("pointeuse.list.msgPurgeError", { msg: err.message }), severity: "error" });
        },
      }
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(pointeuses.map(p => p.poicod));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (poicod: string) => {
    setSelectedRows(prev =>
      prev.includes(poicod) ? prev.filter(id => id !== poicod) : [...prev, poicod]
    );
  };

  if (!hasPermission("Pointage et Temps", "consult")) {
    return <AccessDenied message={t("pointeuse.list.noConsultRight")} />;
  }

  const paginatedData = pointeuses.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Color palette
  const colors = {
    bg: isDark ? "#0f172a" : "#f7f9fb",
    surface: isDark ? "#1e293b" : "#ffffff",
    surfaceLow: isDark ? "#1e293b" : "#f2f4f6",
    border: isDark ? "#334155" : "#e2e8f0",
    text: isDark ? "#f1f5f9" : "#1e293b",
    textSecondary: isDark ? "#94a3b8" : "#64748b",
    primary: isDark ? "#93c5fd" : "#0040a1",
    primaryBg: isDark ? "rgba(147,197,253,0.12)" : "#e0e7ff",
    tertiary: isDark ? "#4edea3" : "#005136",
    tertiaryBg: isDark ? "rgba(78,222,163,0.12)" : "#dcfce7",
    error: isDark ? "#fca5a5" : "#dc2626",
    errorBg: isDark ? "rgba(252,165,165,0.12)" : "#fef2f2",
    secondary: isDark ? "#b9c7df" : "#515f74",
    secondaryBg: isDark ? "rgba(185,199,223,0.12)" : "#f1f5f9",
  };

  return (
    // Padding responsive : sur mobile on serre pour gagner de la place horizontale
    // (sinon p:3 = 24px de marge gauche+droite consomment ~10% de la largeur).
    <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      <BreadcrumbNavigation />

      {/* ── Stats Cards ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 3, mb: 4 }}>
        {/* Total */}
        <Paper elevation={0} sx={{
          p: 3, borderRadius: 3,
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`,
          transition: "all 0.3s",
          "&:hover": { boxShadow: isDark ? "0 8px 25px rgba(0,0,0,0.3)" : "0 8px 25px rgba(0,0,0,0.08)", transform: "translateY(-2px)" },
        }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: colors.primaryBg, display: "flex" }}>
              <span className="material-symbols-outlined" style={{ color: colors.primary, fontSize: 22 }}>dns</span>
            </Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>{t("pointeuse.list.stats.total")}</Typography>
          </Box>
          <Typography sx={{ fontSize: 32, fontWeight: 900, fontFamily: "'Manrope', sans-serif", color: colors.text }}>{String(total).padStart(2, "0")}</Typography>
          <Typography sx={{ fontSize: 12, color: colors.textSecondary, mt: 0.5 }}>{t("pointeuse.list.stats.totalSub")}</Typography>
        </Paper>

        {/* Online */}
        <Paper elevation={0} sx={{
          p: 3, borderRadius: 3,
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`,
          transition: "all 0.3s",
          "&:hover": { boxShadow: isDark ? "0 8px 25px rgba(0,0,0,0.3)" : "0 8px 25px rgba(0,0,0,0.08)", transform: "translateY(-2px)" },
        }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: colors.tertiaryBg, display: "flex" }}>
              <span className="material-symbols-outlined" style={{ color: colors.tertiary, fontSize: 22 }}>check_circle</span>
            </Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>{t("pointeuse.list.stats.online")}</Typography>
          </Box>
          <Typography sx={{ fontSize: 32, fontWeight: 900, fontFamily: "'Manrope', sans-serif", color: colors.text }}>{String(online).padStart(2, "0")}</Typography>
          <Typography sx={{ fontSize: 12, color: colors.tertiary, mt: 0.5 }}>{t("pointeuse.list.stats.onlineSub")}</Typography>
        </Paper>

        {/* Offline */}
        <Paper elevation={0} sx={{
          p: 3, borderRadius: 3,
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`,
          transition: "all 0.3s",
          "&:hover": { boxShadow: isDark ? "0 8px 25px rgba(0,0,0,0.3)" : "0 8px 25px rgba(0,0,0,0.08)", transform: "translateY(-2px)" },
        }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: colors.errorBg, display: "flex" }}>
              <span className="material-symbols-outlined" style={{ color: colors.error, fontSize: 22 }}>error</span>
            </Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>{t("pointeuse.list.stats.offline")}</Typography>
          </Box>
          <Typography sx={{ fontSize: 32, fontWeight: 900, fontFamily: "'Manrope', sans-serif", color: colors.text }}>{String(offline).padStart(2, "0")}</Typography>
          <Typography sx={{ fontSize: 12, color: colors.error, mt: 0.5 }}>{t("pointeuse.list.stats.offlineSub")}</Typography>
        </Paper>

        {/* Sync */}
        <Paper elevation={0} sx={{
          p: 3, borderRadius: 3,
          bgcolor: colors.surface,
          border: `1px solid ${colors.border}`,
          transition: "all 0.3s",
          "&:hover": { boxShadow: isDark ? "0 8px 25px rgba(0,0,0,0.3)" : "0 8px 25px rgba(0,0,0,0.08)", transform: "translateY(-2px)" },
        }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: colors.secondaryBg, display: "flex" }}>
              <span className="material-symbols-outlined" style={{ color: colors.secondary, fontSize: 22 }}>sync</span>
            </Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>{t("pointeuse.list.stats.sync")}</Typography>
          </Box>
          <Typography sx={{ fontSize: 18, fontWeight: 900, fontFamily: "'Manrope', sans-serif", color: colors.text }}>
            {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </Typography>
          <Typography sx={{ fontSize: 12, color: colors.textSecondary, mt: 0.5 }}>{t("pointeuse.list.stats.syncSub")}</Typography>
        </Paper>
      </Box>

      {/* ── Configuration Section ── */}
      <Paper elevation={0} sx={{
        p: { xs: 2, sm: 3, md: 4 }, borderRadius: 3, mb: { xs: 2, sm: 4 },
        bgcolor: colors.surfaceLow,
        border: `1px solid ${colors.border}`,
      }}>
        <Box sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: { xs: 1.5, sm: 0 },
          mb: 3,
        }}>
          <Box>
            <Typography sx={{ fontSize: 22, fontWeight: 700, fontFamily: "'Manrope', sans-serif", color: isDark ? "#93c5fd" : "#0040a1" }}>
              {selected ? t("pointeuse.list.config.editTitle") : t("pointeuse.list.config.newTitle")}
            </Typography>
            <Typography sx={{ fontSize: 13, color: colors.textSecondary, mt: 0.5 }}>
              {selected ? t("pointeuse.list.config.editSubtitle") : t("pointeuse.list.config.newSubtitle")}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>}
            onClick={() => setDialogOpen(true)}
            sx={{
              background: isDark
                ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
                : "linear-gradient(135deg, #0040a1, #0056d2)",
              color: "#fff",
              px: 4, py: 1.5,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: "none",
              boxShadow: isDark ? "0 4px 15px rgba(59,130,246,0.3)" : "0 4px 15px rgba(0,64,161,0.2)",
              "&:hover": {
                background: isDark
                  ? "linear-gradient(135deg, #60a5fa, #3b82f6)"
                  : "linear-gradient(135deg, #0056d2, #0040a1)",
                transform: "translateY(-2px)",
              },
              transition: "all 0.3s",
            }}
          >
            {selected ? t("pointeuse.list.config.editBtn") : t("pointeuse.list.config.newBtn")}
          </Button>
        </Box>
      </Paper>

      {/* ── Data Table ── */}
      <Paper elevation={0} sx={{
        borderRadius: 3, overflow: "hidden",
        bgcolor: colors.surface,
        border: `1px solid ${colors.border}`,
      }}>
        {/* Table Header */}
        <Box sx={{
          px: { xs: 2, sm: 3, md: 4 }, py: { xs: 2, sm: 3 },
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, fontFamily: "'Manrope', sans-serif", color: colors.text }}>
            {t("pointeuse.list.table.title")}
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title={t("pointeuse.list.table.filter")}>
              <IconButton sx={{ color: colors.textSecondary, "&:hover": { bgcolor: colors.surfaceLow } }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>filter_list</span>
              </IconButton>
            </Tooltip>
            <Tooltip title={t("pointeuse.list.table.export")}>
              <IconButton sx={{ color: colors.textSecondary, "&:hover": { bgcolor: colors.surfaceLow } }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc" }}>
                <TableCell sx={{ px: 4, py: 2, width: 48 }}>
                  <Checkbox
                    checked={selectedRows.length === pointeuses.length && pointeuses.length > 0}
                    indeterminate={selectedRows.length > 0 && selectedRows.length < pointeuses.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    size="small"
                    sx={{ color: colors.primary, "&.Mui-checked": { color: colors.primary } }}
                  />
                </TableCell>
                <TableCell sx={{ px: 2, py: 2, fontSize: 10, fontWeight: 700, color: colors.textSecondary, letterSpacing: 1.2, textTransform: "uppercase" }}>{t("pointeuse.list.table.code")}</TableCell>
                <TableCell sx={{ px: 2, py: 2, fontSize: 10, fontWeight: 700, color: colors.textSecondary, letterSpacing: 1.2, textTransform: "uppercase" }}>{t("pointeuse.list.table.label")}</TableCell>
                <TableCell sx={{ px: 2, py: 2, fontSize: 10, fontWeight: 700, color: colors.textSecondary, letterSpacing: 1.2, textTransform: "uppercase" }}>{t("pointeuse.list.table.ip")}</TableCell>
                <TableCell sx={{ px: 2, py: 2, fontSize: 10, fontWeight: 700, color: colors.textSecondary, letterSpacing: 1.2, textTransform: "uppercase", textAlign: "center" }}>{t("pointeuse.list.table.port")}</TableCell>
                <TableCell sx={{ px: 2, py: 2, fontSize: 10, fontWeight: 700, color: colors.textSecondary, letterSpacing: 1.2, textTransform: "uppercase", textAlign: "center" }}>{t("pointeuse.list.table.status")}</TableCell>
                <TableCell sx={{ px: 4, py: 2, fontSize: 10, fontWeight: 700, color: colors.textSecondary, letterSpacing: 1.2, textTransform: "uppercase", textAlign: "right" }}>{t("pointeuse.list.table.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((p) => {
                const isOnline = p.poietat === "1" || p.poietat === "C";
                const isSelected = selectedRows.includes(p.poicod);
                return (
                  <TableRow
                    key={p.poicod}
                    hover
                    selected={isSelected}
                    onClick={() => handleSelectRow(p.poicod)}
                    sx={{
                      cursor: "pointer",
                      transition: "background 0.2s",
                      "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc" },
                      "&.Mui-selected": { bgcolor: isDark ? "rgba(147,197,253,0.06)" : "#eff6ff" },
                      td: { borderColor: colors.border },
                    }}
                  >
                    <TableCell sx={{ px: 4, py: 2.5 }}>
                      <Checkbox
                        checked={isSelected}
                        size="small"
                        sx={{ color: colors.primary, "&.Mui-checked": { color: colors.primary } }}
                      />
                    </TableCell>
                    <TableCell sx={{ px: 2, py: 2.5 }}>
                      <Typography sx={{ fontWeight: 700, color: colors.primary, fontSize: 13 }}>{p.poicod}</Typography>
                    </TableCell>
                    <TableCell sx={{ px: 2, py: 2.5 }}>
                      <Typography sx={{ fontWeight: 500, fontSize: 13, color: colors.text }}>{p.poilib || "—"}</Typography>
                    </TableCell>
                    <TableCell sx={{ px: 2, py: 2.5 }}>
                      <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: colors.textSecondary }}>
                        {p.poiadrip1}.{p.poiadrip2}.{p.poiadrip3}.{p.poiadrip4}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ px: 2, py: 2.5, textAlign: "center" }}>
                      <Typography sx={{ fontSize: 13, color: colors.text }}>{p.poiport}</Typography>
                    </TableCell>
                    <TableCell sx={{ px: 2, py: 2.5, textAlign: "center" }}>
                      <Chip
                        icon={<Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: isOnline ? colors.tertiary : colors.error, ml: 1 }} />}
                        label={isOnline ? t("pointeuse.list.table.connected") : t("pointeuse.list.table.disconnected")}
                        size="small"
                        sx={{
                          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                          bgcolor: isOnline ? colors.tertiaryBg : colors.errorBg,
                          color: isOnline ? colors.tertiary : colors.error,
                          borderRadius: 5, px: 1,
                          "& .MuiChip-icon": { mr: 0 },
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ px: 4, py: 2.5, textAlign: "right" }}>
                      <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                        <Tooltip title={t("pointeuse.list.table.purge")}>
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePurge(p); }} sx={{ color: colors.textSecondary, "&:hover": { color: colors.primary } }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sync</span>
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t("pointeuse.list.table.edit")}>
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelected(p); }} sx={{ color: colors.textSecondary, "&:hover": { color: colors.primary } }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t("pointeuse.list.table.delete")}>
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); setDeleteDialogOpen(true); }} sx={{ color: colors.textSecondary, "&:hover": { color: colors.error } }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paginatedData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: "center", py: 8, color: colors.textSecondary }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, display: "block", marginBottom: 8, opacity: 0.3 }}>devices_other</span>
                    {t("pointeuse.list.table.noTerminal")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{
          px: 4, py: 2,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          bgcolor: colors.surfaceLow,
          borderTop: `1px solid ${colors.border}`,
        }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1 }}>
            {t("pointeuse.list.table.pagination", { start: page * rowsPerPage + 1, end: Math.min((page + 1) * rowsPerPage, total), total })}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Button size="small" disabled={page === 0} onClick={() => setPage(page - 1)} sx={{
              minWidth: 32, px: 1, fontSize: 12, fontWeight: 600,
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: 1,
            }}>{t("pointeuse.list.table.prev")}</Button>
            {Array.from({ length: Math.ceil(total / rowsPerPage) }, (_, i) => (
              <Button key={i} size="small" onClick={() => setPage(i)} sx={{
                minWidth: 32, px: 1, fontSize: 12, fontWeight: 600,
                bgcolor: page === i ? colors.primary : "transparent",
                color: page === i ? "#fff" : colors.textSecondary,
                border: `1px solid ${page === i ? colors.primary : colors.border}`,
                borderRadius: 1,
                "&:hover": { bgcolor: page === i ? colors.primary : colors.surfaceLow },
              }}>{i + 1}</Button>
            ))}
            <Button size="small" disabled={page >= Math.ceil(total / rowsPerPage) - 1} onClick={() => setPage(page + 1)} sx={{
              minWidth: 32, px: 1, fontSize: 12, fontWeight: 600,
              color: colors.textSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: 1,
            }}>{t("pointeuse.list.table.next")}</Button>
          </Box>
        </Box>
      </Paper>

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); resetForm(); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, color: colors.text }}>
          {selected ? t("pointeuse.list.dialog.editTitle") : t("pointeuse.list.dialog.newTitle")}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2.5, mt: 1 }}>
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, mb: 1, ml: 0.5 }}>{t("pointeuse.list.dialog.code")}</Typography>
              <TextField
                fullWidth size="small" placeholder={t("pointeuse.list.dialog.codePlaceholder")}
                name="poicod" value={formData.poicod}
                onChange={(e) => setFormData(prev => ({ ...prev, poicod: e.target.value }))}
                disabled={!!selected}
                variant="outlined"
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, mb: 1, ml: 0.5 }}>{t("pointeuse.list.dialog.label")}</Typography>
              <TextField
                fullWidth size="small" placeholder={t("pointeuse.list.dialog.labelPlaceholder")}
                name="poilib" value={formData.poilib || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, poilib: e.target.value }))}
                variant="outlined"
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, mb: 1, ml: 0.5 }}>{t("pointeuse.list.dialog.ip")}</Typography>
              <TextField
                fullWidth size="small" placeholder={t("pointeuse.list.dialog.ipPlaceholder")}
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                variant="outlined"
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, mb: 1, ml: 0.5 }}>{t("pointeuse.list.dialog.port")}</Typography>
              <TextField
                fullWidth size="small" placeholder={t("pointeuse.list.dialog.portPlaceholder")} type="number"
                name="poiport" value={formData.poiport || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, poiport: parseInt(e.target.value) || undefined }))}
                variant="outlined"
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, mb: 1, ml: 0.5 }}>{t("pointeuse.list.dialog.com")}</Typography>
              <FormControl fullWidth size="small">
                <Select
                  name="poicom" value={formData.poicom || "D"}
                  onChange={(e) => setFormData(prev => ({ ...prev, poicom: e.target.value }))}
                >
                  <MenuItem value="D">ZKTeco SDK</MenuItem>
                  <MenuItem value="H">Hikvision</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setDialogOpen(false); resetForm(); }} sx={{ color: colors.textSecondary, textTransform: "none" }}>{t("pointeuse.list.dialog.cancel")}</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            startIcon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>}
            sx={{
              background: isDark ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" : "linear-gradient(135deg, #0040a1, #0056d2)",
              color: "#fff", borderRadius: 2, fontWeight: 600, textTransform: "none",
              px: 4, py: 1,
              "&:hover": { transform: "translateY(-1px)" },
              transition: "all 0.2s",
            }}
          >
            {t("pointeuse.list.dialog.save")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs">
        <DialogTitle sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700 }}>{t("pointeuse.list.dialog.deleteTitle")}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: colors.textSecondary }}>
            <Trans
              i18nKey="pointeuse.list.dialog.deleteConfirm"
              values={{ code: deleteTarget?.poicod ?? '' }}
              components={{ strong: <strong /> }}
            />
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: colors.textSecondary, textTransform: "none" }}>{t("pointeuse.list.dialog.cancel")}</Button>
          <Button variant="contained" color="error" onClick={handleDelete} sx={{ borderRadius: 2, fontWeight: 600, textTransform: "none" }}>
            {t("pointeuse.list.dialog.deleteBtn")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}