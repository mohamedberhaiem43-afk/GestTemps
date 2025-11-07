import { AppProvider } from '@toolpad/core';
import { useTheme } from '@mui/material/styles';
import { Box, Button, Typography, Grid, Paper, CircularProgress, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import SelectInputComponent from '../SelectInputComponent/SelectInputComponent';
import InputComponent from '../Inputs/Input';
import { useAuth } from '../helper/AuthProvider';

interface UserLoginModel {
  Utimail: string;
  Utimps: string;
  Usersit?: string;
  Company?: string;
}

const Item = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

export default function CredentialsSignInPage() {
  const { setAuthData } = useAuth();
  const theme = useTheme();
  const [utimail, setUtimail] = useState('');
  const [usersit, setUsersit] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [societes, setSocietes] = useState<Record<string, string>>({});
  const [sites, setSites] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetching Societes and Sites in parallel
    axios.all([
      axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Societes/get-soclibs`),
      axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Sites/get-sitlibs`)
    ])
    .then(axios.spread((societesRes, sitesRes) => {
      setSocietes(societesRes.data);
      setSites(sitesRes.data);
    }))
    .catch(err => {
      console.error('Error fetching data', err);
      setError('Failed to load data.');
    });
  }, []);

  const handleSignIn = () => {
    setError(null);  // Clear previous errors
    if (!utimail || !password) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const user: UserLoginModel = {
      Utimail: utimail,
      Utimps: password,
      Usersit: usersit || undefined,
      Company: company || undefined,
    };

    setLoading(true);
    axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/Utilisateurs/connect`, user)
  .then(response => {
    const { societe, token } = response.data;
    setAuthData({
      soccod: societe.soccod,
      sitcod: societe.sitcod,
      authToken:token,
      userName: response.data.utinom,
    });
    localStorage.setItem('Uticod',response.data.uticod)
    localStorage.setItem('authToken',token)
    navigate('/dashboard');
  }).catch(error => {
        console.error('Login failed', error);
        setError('Login failed. Please check your credentials.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <AppProvider theme={theme}>
      <Box sx={{ width: '50%'}} ml={33} component="form" >
        
        
        {error && <Alert severity="error">{error}</Alert>}

          <Item>
              <Typography variant='h6' gutterBottom color={'primary'} fontWeight={'bold'} mb={5}>
                    Se Connecter
              </Typography>
              <Grid  container spacing={2}>
                <Grid item xs={6} sm={6}>
                  <InputComponent type='text' label='Email' value={utimail} setValue={setUtimail} />
                </Grid>
                <Grid item xs={6}>
                  <InputComponent type='password' label='Mot de passe' value={password} setValue={setPassword} />
                </Grid>
                <Grid item xs={6} mt={1}>
                  <SelectInputComponent label='Société' value={company} setValue={setCompany} maplist={societes} />
                </Grid>
                <Grid item xs={6} mt={1}>
                  <SelectInputComponent label='Filiale/Site' value={usersit} setValue={setUsersit} maplist={sites} />
                </Grid>
                <Grid item xs={12}>
                  <Button variant="outlined" color="primary" onClick={handleSignIn} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : 'Connecter'}
                  </Button>
                </Grid>
              </Grid>
        </Item>
      </Box>
    </AppProvider>
  );
}
