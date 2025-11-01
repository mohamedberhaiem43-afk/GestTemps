import React, { useState } from 'react';
import { AppBar, Toolbar, IconButton, Typography, Button, Drawer, List, ListItem, ListItemText, Box, Fade, Menu, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link as RouterLink } from 'react-router-dom';
import './Navbar.css';

const Navbar: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [baseAnchorEl, setBaseAnchorEl] = useState<null | HTMLElement>(null);
  const [outilAnchorEl, setOutilAnchorEl] = useState<null | HTMLElement>(null);

  const baseMenuOpen = Boolean(baseAnchorEl);
  const outilMenuOpen = Boolean(outilAnchorEl);

  const toggleDrawer = (open: boolean) => () => {
    setDrawerOpen(open);
  };

  const handleBaseClick = (event: React.MouseEvent<HTMLElement>) => {
    setBaseAnchorEl(event.currentTarget);
  };

  const handleOutilClick = (event: React.MouseEvent<HTMLElement>) => {
    setOutilAnchorEl(event.currentTarget);
  };

  const handleBaseClose = () => {
    setBaseAnchorEl(null);
  };

  const handleOutilClose = () => {
    setOutilAnchorEl(null);
  };

  const drawer = (
    <div role="presentation" onClick={toggleDrawer(false)} onKeyDown={toggleDrawer(false)}>
      <List>
        <ListItem button component={RouterLink} to="/">
          <ListItemText primary="Home" />
        </ListItem>
        <ListItem button component={RouterLink} to="/about">
          <ListItemText primary="About" />
        </ListItem>
        <ListItem button component={RouterLink} to="/services">
          <ListItemText primary="Services" />
        </ListItem>
        <ListItem button component={RouterLink} to="/contact">
          <ListItemText primary="Contact" />
        </ListItem>
      </List>
    </div>
  );

  return (
    <div className='navContainer'>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" aria-label="menu" onClick={toggleDrawer(true)} sx={{ display: { xs: 'block', sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            MyApp
          </Typography>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Button color="inherit" component={RouterLink} to="/">Home</Button>
            <Button
              color='inherit'
              id="fade-button"
              aria-controls={baseMenuOpen ? 'fade-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={baseMenuOpen ? 'true' : undefined}
              onClick={handleBaseClick}
            >
              Données de base
            </Button>
            <Menu
              id="fade-menu"
              MenuListProps={{ 'aria-labelledby': 'fade-button' }}
              anchorEl={baseAnchorEl}
              open={baseMenuOpen}
              onClose={handleBaseClose}
              TransitionComponent={Fade}
            >
              <MenuItem component={RouterLink} to="/directions" onClick={handleBaseClose}>Directions</MenuItem>
              <MenuItem component={RouterLink} to="/services" onClick={handleBaseClose}>Services</MenuItem>
              <MenuItem component={RouterLink} to="/sections" onClick={handleBaseClose}>Sections</MenuItem>
              <MenuItem component={RouterLink} to="/pays" onClick={handleBaseClose}>Pays</MenuItem>
              <MenuItem component={RouterLink} to="/villes" onClick={handleBaseClose}>Villes</MenuItem>
              <MenuItem component={RouterLink} to="/filiales" onClick={handleBaseClose}>Filiales</MenuItem>
              <MenuItem component={RouterLink} to="/fonctions" onClick={handleBaseClose}>Fonctions</MenuItem>
            </Menu>
            <Button
              color='inherit'
              id="outil-button"
              aria-controls={outilMenuOpen ? 'outil-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={outilMenuOpen ? 'true' : undefined}
              onClick={handleOutilClick}
            >
              Outils
            </Button>
            <Menu
              id="outil-menu"
              MenuListProps={{ 'aria-labelledby': 'outil-button' }}
              anchorEl={outilAnchorEl}
              open={outilMenuOpen}
              onClose={handleOutilClose}
              TransitionComponent={Fade}
            >
              <MenuItem component={RouterLink} to="/societes" onClick={handleOutilClose}>Sociétés</MenuItem>
              <MenuItem component={RouterLink} to="/parametres-societe" onClick={handleOutilClose}>Parmétres societe</MenuItem>

            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
        {drawer}
      </Drawer>
    </div>
  );
};

export default Navbar;
