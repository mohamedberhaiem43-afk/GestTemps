import { ThemeProvider } from "@emotion/react";
import { createTheme } from "@mui/material/styles";
import DashboardLayoutBasic from "./components/navigation/Navigation";
import { BrowserRouter as Router } from "react-router-dom";
import { useRef, useEffect } from "react";
import { AuthProvider } from "./components/helper/AuthProvider";


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
  const headerRef = useRef<HTMLElement | null>(null);
  const headerimg = useRef<HTMLInputElement | null>(null)
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const headertop = useRef<HTMLElement | null>(null);
  const navside = useRef<HTMLElement | null>(null);
  useEffect(() => {
    headerRef.current = document.querySelector(
      "#root > div.MuiBox-root.css-k008qs > header > div > div.MuiBox-root.css-wxgfmz > a > div > h6"
    );
    headerimg.current = document.querySelector("#root > div.MuiBox-root.css-k008qs > header > div > div.MuiBox-root.css-wxgfmz > a > div > div > svg")
    
    linkRef.current = document.querySelector("#root > div.MuiBox-root.css-k008qs > header > div > div.MuiBox-root.css-wxgfmz > a")
    
    navside.current = document.querySelector(
      "body > div.MuiDrawer-root.MuiDrawer-modal.MuiModal-root.css-ttvm69-MuiModal-root-MuiDrawer-root > div.MuiPaper-root.MuiPaper-elevation.MuiPaper-elevation16.MuiDrawer-paper.MuiDrawer-paperAnchorLeft.css-4t3x6l-MuiPaper-root-MuiDrawer-paper > nav"
    );
    headertop.current = document.querySelector(
      "header"
    );
    if (linkRef.current) {
      linkRef.current.addEventListener("click", (event) => {
        event.preventDefault();
        linkRef.current?.setAttribute("href", "/dashboard");
      });
    }

    if (headerRef.current) {
      const soclib = sessionStorage.getItem('soclib');

      headerRef.current.textContent = soclib;
    }

}, []);

    
  


  return (

    <ThemeProvider theme={demoTheme}>
      <Router>
        <AuthProvider>
          <DashboardLayoutBasic />
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
