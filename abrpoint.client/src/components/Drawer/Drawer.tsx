import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import MailIcon from '@mui/icons-material/Mail';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Fade from '@mui/material/Fade';
import { Link as RouterLink } from 'react-router-dom';
import './Drawer.css'

const drawerWidth = 240;

export default function LeftDrawer() {
const [anchorEl, setAnchorEl] = useState<Record<string, HTMLElement | null>>({});

  const handleClick = (menuName :any) => (event :any) => {
    setAnchorEl({ ...anchorEl, [menuName]: event.currentTarget });
  };

  const handleClose = (menuName :any) => () => {
    setAnchorEl({ ...anchorEl, [menuName]: null });
  };

  const menuItems = [
    {
      text: 'Donnée de base',
      items: [
        { label: 'Directions', path: '/directions' },
        { label: 'Services', path: '/services' },
        { label: 'Sections', path: '/sections' },
        { label: 'Pays', path: '/pays' },
        { label: 'Villes', path: '/villes' },
        { label: 'Filiales', path: '/filiales' },
        { label: 'Fonctions', path: '/fonctions' },
      ],
    },
    {
      text: 'Employés',
      items: [
        { label: "Gestion d'employés", path: '/gestion-employe' },
        { label: "Allaitement", path: '/allaitement-employe' },
        { label: "Gestion Contrats", path: '/contrat-employe' },
      ],
    },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          backgroundColor: '#f5f5f5',
          color: 'black',
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Permanent drawer
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar />
        <Divider />
        <List>
          {menuItems.map((menu, index) => (
            <React.Fragment key={menu.text}>
              <ListItem disablePadding>
                <ListItemButton onClick={handleClick(menu.text)}>
                  <ListItemIcon>
                    {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
                  </ListItemIcon>
                  <ListItemText primary={menu.text} />
                </ListItemButton>
              </ListItem>
              <Menu
                id={`${menu.text.toLowerCase().replace(' ', '-')}-menu`}
                MenuListProps={{ 'aria-labelledby': `${menu.text.toLowerCase().replace(' ', '-')}-button` }}
                anchorEl={anchorEl[menu.text]}
                open={Boolean(anchorEl[menu.text])}
                onClose={handleClose(menu.text)}
                TransitionComponent={Fade}
              >
                {menu.items.map((item) => (
                  <MenuItem
                    key={item.path}
                    component={RouterLink}
                    to={item.path}
                    onClick={handleClose(menu.text)}
                  >
                    {item.label}
                  </MenuItem>
                ))}
              </Menu>
            </React.Fragment>
          ))}
        </List>
        <Divider />
        <List>
          {['All mail', 'Trash', 'Spam'].map((text, index) => (
            <ListItem key={text} disablePadding>
              <ListItemButton component={RouterLink} to={`/${text.toLowerCase()}`}>
                <ListItemIcon>
                  {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
                </ListItemIcon>
                <ListItemText primary={text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}
      >
        <Toolbar />
      </Box>
    </Box>
  );
}
