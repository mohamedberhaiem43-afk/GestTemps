import { ThemeProvider } from "@emotion/react";
import { createTheme } from "@mui/material/styles";
import DashboardLayoutBasic from "./components/navigation/Navigation";
import { BrowserRouter as Router } from "react-router-dom";
import { AuthProvider } from "./components/helper/AuthProvider";
import LanguageSwitcher from "./components/LanguageSwitcher/LanguageSwitcher";
import { Box } from "@mui/material";

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

function App() {
  
  return (

    <ThemeProvider theme={demoTheme}>
      <Router>
        <AuthProvider>
          <Box
            sx={{
              position: "fixed",
              top: -25,
              right: 70,      // change to left: 0 if you want it left
              zIndex: 2000,  // very important so it's above everything
              p: 2
            }}
          >
            <LanguageSwitcher />
          </Box>
          <DashboardLayoutBasic />
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
