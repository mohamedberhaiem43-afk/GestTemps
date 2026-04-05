import React, { useEffect, useState } from "react";
import { ThemeProvider } from "@emotion/react";
import { createTheme } from "@mui/material/styles";
import DashboardLayoutBasic from "./components/navigation/Navigation";
import { BrowserRouter as Router, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/helper/AuthProvider";
import LanguageSwitcher from "./components/LanguageSwitcher/LanguageSwitcher";
import apiInstance from "./components/API/apiInstance";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Box,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";

const demoTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#f5f5f7", // Vibrant blue for Apple's interactive elements
    },
    secondary: {
      main: "#ff9500", // Accent orange
    },
    background: {
      default: "linear-gradient(180deg, #f7f8fa, #eaeef3)", // Soft shiny gradient
      paper: "#f5f5f7", // Pure white for card surfaces
    },
    text: {
      primary: "#1d1d1f", // Dark gray for high contrast
      secondary: "#6e6e73", // Subtle gray for less emphasis
    },
  },
  typography: {
    fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
    h1: {
      fontSize: "2.5rem",
      fontWeight: 600,
    },
    h2: {
      fontSize: "2rem",
      fontWeight: 600,
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.5,
    },
    button: {
      textTransform: "none", // No uppercase for a more natural look
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
          padding: "10px 20px",
          boxShadow: "none",
          ":hover": {
            backgroundColor: "#f5f5f7",
            boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: "12px",
          padding: "12px",
          boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
        },
      },
    },
  },
});

function AdminNotifications() {
  const { utiadm, soccod, uticod } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const isAdmin = utiadm === "1";
  const pendingCount = notifications.length;
  const notificationsOpen = Boolean(anchorEl);

  const isPendingLeaveRequest = (conge: any) => {
    const normalizedEtat = conge.etat?.trim().toLowerCase() || "";
    const isRefused = conge.conrefus === "1" || normalizedEtat.includes("refus") || normalizedEtat.includes("refused");
    const isPending = normalizedEtat.includes("attente") || normalizedEtat.includes("pending") || (!normalizedEtat && conge.conrefus !== "1");
    return !isRefused && isPending;
  };

  const fetchLeaveNotifications = async () => {
    if (!isAdmin || !soccod || !uticod) {
      setNotifications([]);
      return;
    }

    setIsLoadingNotifications(true);
    try {
      const response = await apiInstance.get(`/DemConges/get-demconge/${soccod}/${uticod}`);
      const data = Array.isArray(response.data) ? response.data : [];
      const pendingRequests = data.filter(isPendingLeaveRequest);
      setNotifications(pendingRequests);
    } catch (error) {
      console.error("Erreur lors de la récupération des notifications de congé :", error);
      setNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  useEffect(() => {
    fetchLeaveNotifications();
    const intervalId = setInterval(fetchLeaveNotifications, 60000);
    return () => clearInterval(intervalId);
  }, [isAdmin, soccod, uticod]);

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setAnchorEl(null);
  };

  const handleViewLeaveRequests = () => {
    setAnchorEl(null);
    navigate("/dashboard/gestion-de-conge");
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip
        title={
          pendingCount > 0
            ? t("notifications.pendingTooltip", {
                count: pendingCount,
              }) || `${pendingCount} demande(s) de congé en attente`
            : t("notifications.noPendingTooltip") || "Aucune nouvelle demande de congé"
        }
      >
        <IconButton
          onClick={handleNotificationClick}
          size="large"
          sx={{
            bgcolor: pendingCount > 0 ? "rgba(244, 67, 54, 0.08)" : "transparent",
            border: pendingCount > 0 ? "1px solid rgba(244, 67, 54, 0.3)" : "none",
            color: pendingCount > 0 ? "#d32f2f" : "inherit",
            '&:hover': {
              bgcolor: pendingCount > 0 ? "rgba(244, 67, 54, 0.12)" : "rgba(0, 0, 0, 0.04)",
            },
          }}
        >
          <Badge badgeContent={pendingCount} color={pendingCount > 0 ? "error" : "default"}>
            <NotificationsIcon sx={{ fontSize: 28 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      {pendingCount > 0 && (
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            bgcolor: "rgba(244, 67, 54, 0.12)",
            color: "#d32f2f",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {t("notifications.pendingRequests", {
            count: pendingCount,
          }) || `${pendingCount} demande(s) en attente`}
        </Box>
      )}

      <Menu anchorEl={anchorEl} open={notificationsOpen} onClose={handleNotificationClose}>
        <MenuItem disabled>
          {isLoadingNotifications
            ? t("notifications.loading") || "Chargement..."
            : pendingCount > 0
            ? t("notifications.newLeaveRequests", { count: pendingCount }) || `${pendingCount} nouvelles demandes de congé`
            : t("notifications.noNewLeaveRequests") || "Aucune nouvelle demande de congé"}
        </MenuItem>
        {!isLoadingNotifications && pendingCount > 0 && notifications.slice(0, 3).map((conge) => (
          <MenuItem key={`${conge.concod}-${conge.empcod}`}>
            <ListItemText
              primary={`${conge.empcod || ""} — ${conge.concod || ""}`}
              secondary={conge.condat ? new Date(conge.condat).toLocaleDateString() : ""}
            />
          </MenuItem>
        ))}
        {!isLoadingNotifications && pendingCount > 0 && (
          <MenuItem onClick={handleViewLeaveRequests}>
            <ListItemText primary={t("notifications.viewLeaveRequests") || "Voir les demandes de congé"} />
          </MenuItem>
        )}
        {!isLoadingNotifications && pendingCount === 0 && (
          <MenuItem onClick={fetchLeaveNotifications}>
            <ListItemText primary={t("notifications.refresh") || "Actualiser"} />
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}

function EmployeeNotifications() {
  const { utiadm, soccod, uticod } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const isEmployee = utiadm !== "1";
  const approvedCount = notifications.length;
  const notificationsOpen = Boolean(anchorEl);

  const fetchApprovedNotifications = async () => {
    if (!isEmployee || !soccod || !uticod) {
      setNotifications([]);
      return;
    }

    setIsLoadingNotifications(true);
    try {
      const response = await apiInstance.get(`/DemConges/get-emp-demconge/${soccod}/${uticod}`);
      const data = Array.isArray(response.data) ? response.data : [];
      const approvedRequests = data.filter((req: any) => req.etat === "Accepté");
      setNotifications(approvedRequests);
    } catch (error) {
      console.error("Erreur lors de la récupération des notifications d'approbation :", error);
      setNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  useEffect(() => {
    fetchApprovedNotifications();
    const intervalId = setInterval(fetchApprovedNotifications, 60000);
    return () => clearInterval(intervalId);
  }, [isEmployee, soccod, uticod]);

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setAnchorEl(null);
  };

  const handleViewLeaveRequests = () => {
    setAnchorEl(null);
    navigate("/dashboard");
  };

  if (!isEmployee) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip
        title={
          approvedCount > 0
            ? `${approvedCount} demande(s) de congé approuvée(s)`
            : "Aucune demande approuvée récemment"
        }
      >
        <IconButton
          onClick={handleNotificationClick}
          size="large"
          sx={{
            bgcolor: approvedCount > 0 ? "rgba(76, 175, 80, 0.08)" : "transparent",
            border: approvedCount > 0 ? "1px solid rgba(76, 175, 80, 0.3)" : "none",
            color: approvedCount > 0 ? "#2e7d32" : "inherit",
            '&:hover': {
              bgcolor: approvedCount > 0 ? "rgba(76, 175, 80, 0.12)" : "rgba(0, 0, 0, 0.04)",
            },
          }}
        >
          <Badge badgeContent={approvedCount} color={approvedCount > 0 ? "success" : "default"}>
            <NotificationsIcon sx={{ fontSize: 28 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      {approvedCount > 0 && (
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            bgcolor: "rgba(76, 175, 80, 0.12)",
            color: "#2e7d32",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {`${approvedCount} approuvée(s)`}
        </Box>
      )}

      <Menu anchorEl={anchorEl} open={notificationsOpen} onClose={handleNotificationClose}>
        <MenuItem disabled>
          {isLoadingNotifications
            ? "Chargement..."
            : approvedCount > 0
            ? `${approvedCount} demande(s) approuvée(s)`
            : "Aucune demande approuvée"}
        </MenuItem>
        {!isLoadingNotifications && approvedCount > 0 && notifications.slice(0, 3).map((req) => (
          <MenuItem key={req.concod}>
            <ListItemText
              primary={`Demande ${req.concod}`}
              secondary={req.condat ? new Date(req.condat).toLocaleDateString() : ""}
            />
          </MenuItem>
        ))}
        {!isLoadingNotifications && approvedCount > 0 && (
          <MenuItem onClick={handleViewLeaveRequests}>
            <ListItemText primary="Voir mes demandes de congé" />
          </MenuItem>
        )}
        {!isLoadingNotifications && approvedCount === 0 && (
          <MenuItem onClick={fetchApprovedNotifications}>
            <ListItemText primary="Actualiser" />
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}

function App() {
  return (

    <ThemeProvider theme={demoTheme}>
      <Router>
        <AuthProvider>
          <Box
            sx={{
              position: "fixed",
              top: 10,
              right: 70,
              zIndex: 2000,
              p: 2,
              display: "flex",
              gap: 1,
              alignItems: "center",
            }}
          >
            <AdminNotifications />
            <EmployeeNotifications />
            <LanguageSwitcher />
          </Box>
          <DashboardLayoutBasic />
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
