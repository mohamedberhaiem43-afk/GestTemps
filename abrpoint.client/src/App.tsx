import { useEffect, useState, useMemo } from "react";
import { ThemeProvider } from "@emotion/react";
import { createTheme, CssBaseline } from "@mui/material";
import DashboardLayoutBasic from "./components/navigation/Navigation";
import { BrowserRouter as Router } from "react-router-dom";
import { AuthProvider } from "./components/helper/AuthProvider";

// ── Color tokens ──
const lightTokens = {
  primary: '#0040a1',
  primaryLight: '#e0e7ff',
  bg: '#f7f9fb',
  paper: '#ffffff',
  paperAlt: '#f8fafc',
  text: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  appBar: 'rgba(255,255,255,0.85)',
  drawer: '#f8fafc',
};

const darkTokens = {
  primary: '#93c5fd',
  primaryLight: 'rgba(147,197,253,0.12)',
  bg: '#0f172a',
  paper: '#1e293b',
  paperAlt: '#1e293b',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: '#334155',
  borderLight: '#1e293b',
  appBar: 'rgba(15,23,42,0.9)',
  drawer: '#0f172a',
};

function buildTheme(mode: 'light' | 'dark') {
  const t = mode === 'dark' ? darkTokens : lightTokens;
  return createTheme({
    palette: {
      mode,
      primary: { main: mode === 'dark' ? '#93c5fd' : '#0040a1' },
      secondary: { main: '#ff9500' },
      background: {
        default: t.bg,
        paper: t.paper,
      },
      text: {
        primary: t.text,
        secondary: t.textSecondary,
      },
    },
    typography: {
      fontFamily: "'Inter', 'Manrope', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
      h1: { fontSize: "2.5rem", fontWeight: 600 },
      h2: { fontSize: "2rem", fontWeight: 600 },
      body1: { fontSize: "1rem", lineHeight: 1.5 },
      button: { textTransform: "none", fontWeight: 500 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: "8px",
            padding: "10px 20px",
            boxShadow: "none",
            ...(mode === 'light'
              ? { ':hover': { backgroundColor: "#f5f5f7", boxShadow: "0px 1px 3px rgba(0,0,0,0.1)" } }
              : { ':hover': { boxShadow: "0px 1px 3px rgba(0,0,0,0.3)" } }
            ),
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: "12px",
            padding: "12px",
            backgroundImage: 'none',
            ...(mode === 'light'
              ? { boxShadow: "0px 4px 6px rgba(0,0,0,0.1)" }
              : { boxShadow: "0px 4px 6px rgba(0,0,0,0.4)", border: `1px solid ${t.border}` }
            ),
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: t.drawer,
            borderRight: `1px solid ${t.border}`,
            backgroundImage: 'none',
            boxShadow: 'none',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: '12px',
            margin: '4px 12px',
            fontFamily: "'Manrope', sans-serif",
            fontSize: '13px',
            fontWeight: 600,
            color: t.textSecondary,
            padding: '10px 16px',
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: mode === 'dark' ? 'rgba(147,197,253,0.08)' : '#f1f5f9',
              color: t.text,
            },
            '&.Mui-selected': {
              backgroundColor: mode === 'dark' ? 'rgba(147,197,253,0.12)' : '#ffffff',
              color: mode === 'dark' ? '#93c5fd' : '#0040a1',
              fontWeight: 800,
              boxShadow: mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: '20%',
                bottom: '20%',
                width: '4px',
                backgroundColor: mode === 'dark' ? '#93c5fd' : '#0040a1',
                borderRadius: '0 4px 4px 0',
              },
              '&:hover': { backgroundColor: mode === 'dark' ? 'rgba(147,197,253,0.15)' : '#ffffff' },
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: t.appBar,
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${t.borderLight}`,
            boxShadow: 'none',
            color: t.text,
            backgroundImage: 'none',
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: '32px',
            color: 'inherit',
            '& .MuiSvgIcon-root': { fontSize: '20px' },
          },
        },
      },
      MuiToolbar: {
        styleOverrides: { root: { minHeight: '64px !important' } },
      },
      MuiTextField: {
        styleOverrides: {
          root: mode === 'dark' ? {
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255,255,255,0.05)',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
              '&.Mui-focused fieldset': { borderColor: '#93c5fd' },
              '& input': { color: '#f1f5f9' },
            },
            '& .MuiInputLabel-root': { color: '#94a3b8' },
          } : {},
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: mode === 'dark' ? {
            '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
            '& input': { color: '#f1f5f9' },
            '& textarea': { color: '#f1f5f9' },
          } : {},
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: mode === 'dark' ? {
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: '#f1f5f9',
            '& .MuiSelect-select': { color: '#f1f5f9' },
          } : {},
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: mode === 'dark' ? {
            color: '#f1f5f9',
            '&:hover': { backgroundColor: 'rgba(147,197,253,0.08)' },
          } : {},
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: mode === 'dark' ? {
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
          } : {},
        },
      },
      MuiSnackbar: {
        styleOverrides: {
          root: mode === 'dark' ? {} : {},
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: mode === 'dark' ? {} : {},
        },
      },
      MuiChip: {
        styleOverrides: {
          root: mode === 'dark' ? {
            borderColor: 'rgba(255,255,255,0.15)',
          } : {},
        },
      },
      MuiTable: {
        styleOverrides: {
          root: mode === 'dark' ? {
            '& th': { color: '#94a3b8', borderBottomColor: '#334155' },
            '& td': { color: '#e2e8f0', borderBottomColor: '#334155' },
          } : {},
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: mode === 'dark' ? {
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
          } : {},
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: mode === 'dark' ? {
            borderColor: 'rgba(255,255,255,0.08)',
          } : {},
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: mode === 'dark' ? {
            backgroundColor: '#334155',
            color: '#f1f5f9',
          } : {},
        },
      },
      MuiCircularProgress: {
        styleOverrides: {
          root: {
            color: mode === 'dark' ? '#93c5fd' : '#0040a1',
          },
        },
      },
    },
    breakpoints: {
      values: { xs: 200, sm: 600, md: 960, lg: 1280, xl: 1920 },
    },
  });
}

// ── Dark Mode Context ──
import { createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider } from "react-query";

interface ThemeModeContextType {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextType>({
  mode: 'light',
  toggleTheme: () => { },
});

export const useThemeMode = () => useContext(ThemeModeContext);


function AppContent() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme-mode');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  const toggleTheme = () => {
    setMode(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme-mode', next);
      return next;
    });
  };

  const theme = useMemo(() => buildTheme(mode), [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <AuthProvider>
            <DashboardLayoutBasic />
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;