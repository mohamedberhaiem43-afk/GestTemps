import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Snackbar,
  Alert,
  IconButton,
  Tooltip,
  Switch,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Avatar,
} from '@mui/material';
import {
  Save as SaveIcon,
  Functions as FunctionsIcon,
  EventAvailable as EventIcon,
  NightsStay as NightIcon,
  DeviceHub as DeviceIcon,
  NotificationsNone as NotifIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../helper/AuthProvider';
import useGetParametres from '../../hooks/parametreHooks/useGetParametres';
import useUpdateParametres from '../../hooks/parametreHooks/useUpdateParametres';
import useUpdateParTranche from '../../hooks/partrancheHooks/useUpdateParTranche';
import useUpdateSocHeures from '../../hooks/societeHooks/useUpdateSocHeures';
import useGetParTranche from '../../hooks/partrancheHooks/useGetParTranche';
import useGetSocHeures from '../../hooks/societeHooks/useGetSocHeures';
import { Parametre } from '../../models/Parametre';
import ParTranche from '../../models/ParTranche';
import './ParamSocModern.css';

export default function ParamSocModern() {
  const { soccod, userName } = useAuth();
  const { data: parametres, refetch } = useGetParametres();
  const { data: partranche } = useGetParTranche();
  const { data: socheures } = useGetSocHeures();

  const updateParametreMutation = useUpdateParametres();
  const updateParTrancheMutation = useUpdateParTranche();
  const updateSocHeuresMutation = useUpdateSocHeures();

  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const [formData, setFormData] = useState<Partial<Parametre>>({});
  const [tranchesH, setTranchesH] = useState<ParTranche[]>([]);
  const [tranchesM, setTranchesM] = useState<ParTranche[]>([]);
  const [socHeuresData, setSocHeuresData] = useState({ socpresence: 'P', sochsup: 'P' });

  useEffect(() => {
    if (parametres) setFormData(parametres);
    if (socheures) setSocHeuresData({ socpresence: socheures.socpresence || 'P', sochsup: socheures.sochsup || 'P' });
    if (partranche) {
      setTranchesH(partranche.filter(p => p.empreg === 'H') || []);
      setTranchesM(partranche.filter(p => p.empreg === 'M') || []);
    }
  }, [parametres, partranche, socheures]);

  const handleUpdate = () => {
    const dataToSend = { ...formData, soccod: soccod || '' } as Parametre;
    const trancheDataToSend = [...tranchesH, ...tranchesM];

    let successCount = 0;
    const total = 3;

    const checkAllDone = () => {
      successCount++;
      if (successCount >= total) {
        setSnackbar({ open: true, message: "Paramètres mis à jour avec succès !", severity: "success" });
        refetch();
      }
    };

    const onError = () => {
      setSnackbar({ open: true, message: "Erreur lors de la mise à jour.", severity: "error" });
    };

    updateParametreMutation.mutate(dataToSend, { onSuccess: checkAllDone, onError });
    updateParTrancheMutation.mutate(trancheDataToSend, { onSuccess: checkAllDone, onError });
    updateSocHeuresMutation.mutate(socHeuresData, { onSuccess: checkAllDone, onError });
  };

  const handleInputChange = (field: keyof Parametre, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTrancheChange = (idx: number, field: keyof ParTranche, value: any, type: 'H' | 'M') => {
    if (type === 'H') {
      const newTranches = [...tranchesH];
      newTranches[idx] = { ...newTranches[idx], [field]: value };
      setTranchesH(newTranches);
    } else {
      const newTranches = [...tranchesM];
      newTranches[idx] = { ...newTranches[idx], [field]: value };
      setTranchesM(newTranches);
    }
  };

  const addTranche = (type: 'H' | 'M') => {
    const newTranche: ParTranche = {
      soccod: soccod || '',
      ordre: (type === 'H' ? tranchesH.length : tranchesM.length) + 1,
      caltype: '',
      empreg: type,
      partranche1: 0,
      partaux1: 0,
      partranche2: 0,
      partaux2: 0
    };
    if (type === 'H') setTranchesH([...tranchesH, newTranche]);
    else setTranchesM([...tranchesM, newTranche]);
  };

  const removeTranche = (idx: number, type: 'H' | 'M') => {
    if (type === 'H') setTranchesH(tranchesH.filter((_, i) => i !== idx));
    else setTranchesM(tranchesM.filter((_, i) => i !== idx));
  };

  const tabs = [
    { label: 'Calculs & Dates', icon: <FunctionsIcon /> },
    { label: 'Heures Sup', icon: <EventIcon /> },
    { label: 'Heures de Nuit', icon: <NightIcon /> },
    { label: 'Pointeuses', icon: <DeviceIcon /> },
  ];

  return (
    <div className="ps-modern-container">
      <header className="ps-modern-header">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Configuration</span>
            <h1 className="ps-modern-title">Paramètres Système</h1>
            <p className="ps-modern-subtitle">Gérez les règles de calcul, les dates de paie et les paramètres avancés de pointage.</p>
          </Box>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Tooltip title="Notifications"><IconButton sx={{ bgcolor: 'white', borderRadius: '12px' }}><NotifIcon /></IconButton></Tooltip>
            {/* User Profile instead of Help */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>{userName || 'Administrateur'}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>Super Admin</Typography>
              </Box>
              <Avatar sx={{ bgcolor: 'var(--primary)', fontWeight: 800 }}>{userName?.charAt(0) || 'A'}</Avatar>
            </Box>
          </div>
        </Box>
      </header>

      <nav className="ps-modern-tabs">
        {tabs.map((tab, i) => (
          <button key={i} className={`ps-modern-tab ${activeTab === i ? 'ps-modern-tab--active' : ''}`} onClick={() => setActiveTab(i)}>{tab.label}</button>
        ))}
      </nav>

      {activeTab === 0 && (
        <div className="ps-modern-grid">
          <div className="ps-modern-card ps-modern-card--large">
            <div className="ps-modern-card-header">
              <h3 className="ps-modern-card-title">Logique de Calcul & Dates</h3>
              <FunctionsIcon sx={{ color: 'rgba(0, 64, 161, 0.1)', fontSize: 40 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              <div className="ps-modern-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="ps-modern-label">Diviseur Mensuel</label>
                <div className="ps-modern-input-wrapper">
                  <input type="number" className="ps-modern-input" value={formData.parjhnfixe || ''} onChange={(e) => handleInputChange('parjhnfixe', e.target.value)} />
                  <span className="ps-modern-unit">heures</span>
                </div>
              </div>

              <div className="ps-modern-form-group">
                <label className="ps-modern-label">Début de Mois</label>
                <input type="number" className="ps-modern-input" value={formData.joudeb || ''} onChange={(e) => handleInputChange('joudeb', e.target.value)} placeholder="01" />
              </div>
              <div className="ps-modern-form-group">
                <label className="ps-modern-label">Fin de Mois</label>
                <input type="number" className="ps-modern-input" value={formData.joufin || ''} onChange={(e) => handleInputChange('joufin', e.target.value)} placeholder="31" />
              </div>


              <div className="ps-modern-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="ps-modern-label">Intégration Paie</label>
                <Select fullWidth variant="standard" value={formData.paie || ''} onChange={(e) => handleInputChange('paie', e.target.value)}>
                  <MenuItem value="paie">Paie Interne</MenuItem>
                  <MenuItem value="navision">Navision</MenuItem>
                  <MenuItem value="sage">Sage</MenuItem>
                </Select>
              </div>

              <div className="ps-modern-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="ps-modern-label">Ancienneté Requise (ans)</label>
                <input type="number" className="ps-modern-input" value={formData.pardroitnbj || 0} onChange={(e) => handleInputChange('pardroitnbj', parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          <div className="ps-modern-card ps-modern-card--small">
            <h3 className="ps-modern-card-title">Pointage</h3>
            <div className="ps-modern-form-group">
              <label className="ps-modern-label">Écart minimum (min)</label>
              <input type="number" className="ps-modern-input" value={formData.parecart || 0} onChange={(e) => handleInputChange('parecart', parseInt(e.target.value) || 0)} />
            </div>
            <div className="ps-modern-switch-row"><span>Majorations fériés</span><Switch checked={formData.fertrv === 1} onChange={(e) => handleInputChange('fertrv', e.target.checked ? 1 : 0)} /></div>
            <div className="ps-modern-switch-row"><span>Arrondi auto</span><Switch checked={formData.arrondi === 1} onChange={(e) => handleInputChange('arrondi', e.target.checked ? 1 : 0)} /></div>
            <Button fullWidth variant="contained" startIcon={<SaveIcon />} onClick={handleUpdate} sx={{ mt: 2, borderRadius: '12px', bgcolor: 'var(--primary)', fontWeight: 800 }}>Enregistrer</Button>
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div className="ps-modern-grid">
          <div className="ps-modern-card ps-modern-card--large">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <h3 className="ps-modern-card-title">Tranches d'Heures Sup</h3>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel control={<Checkbox checked={formData.parcadre === '1'} onChange={(e) => handleInputChange('parcadre', e.target.checked ? '1' : '0')} />} label="Cadre" />
                <FormControlLabel control={<Checkbox checked={formData.parmaitrise === '1'} onChange={(e) => handleInputChange('parmaitrise', e.target.checked ? '1' : '0')} />} label="Maitrise" />
                <FormControlLabel control={<Checkbox checked={formData.parexec === '1'} onChange={(e) => handleInputChange('parexec', e.target.checked ? '1' : '0')} />} label="Exécutant" />
              </Box>
            </Box>

            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Hebdomadaire (H)</Typography>
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => addTranche('H')}>Ajouter</Button>
              </Box>
              <table className="ps-modern-table">
                <thead><tr><th>Cal.</th><th>Tr1</th><th>%1</th><th>Tr2</th><th>%2</th><th></th></tr></thead>
                <tbody>
                  {tranchesH.map((t, i) => (
                    <tr key={i}>
                      <td><input style={{ width: '60px', border: '1px solid #eee' }} value={t.caltype} onChange={(e) => handleTrancheChange(i, 'caltype', e.target.value, 'H')} /></td>
                      <td><input type="number" style={{ width: '60px', border: '1px solid #eee' }} value={t.partranche1} onChange={(e) => handleTrancheChange(i, 'partranche1', Number(e.target.value), 'H')} />h</td>
                      <td><input type="number" style={{ width: '60px', border: '1px solid #eee' }} value={t.partaux1} onChange={(e) => handleTrancheChange(i, 'partaux1', Number(e.target.value), 'H')} />%</td>
                      <td><input type="number" style={{ width: '60px', border: '1px solid #eee' }} value={t.partranche2} onChange={(e) => handleTrancheChange(i, 'partranche2', Number(e.target.value), 'H')} />h</td>
                      <td><input type="number" style={{ width: '60px', border: '1px solid #eee' }} value={t.partaux2} onChange={(e) => handleTrancheChange(i, 'partaux2', Number(e.target.value), 'H')} />%</td>
                      <td><IconButton size="small" onClick={() => removeTranche(i, 'H')}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Mensuel (M)</Typography>
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => addTranche('M')}>Ajouter</Button>
              </Box>
              <table className="ps-modern-table">
                <thead><tr><th>Cal.</th><th>Tr1</th><th>%1</th><th>Tr2</th><th>%2</th><th></th></tr></thead>
                <tbody>
                  {tranchesM.map((t, i) => (
                    <tr key={i}>
                      <td><input style={{ width: '60px', border: '1px solid #eee' }} value={t.caltype} onChange={(e) => handleTrancheChange(i, 'caltype', e.target.value, 'M')} /></td>
                      <td><input type="number" style={{ width: '60px', border: '1px solid #eee' }} value={t.partranche1} onChange={(e) => handleTrancheChange(i, 'partranche1', Number(e.target.value), 'M')} />h</td>
                      <td><input type="number" style={{ width: '60px', border: '1px solid #eee' }} value={t.partaux1} onChange={(e) => handleTrancheChange(i, 'partaux1', Number(e.target.value), 'M')} />%</td>
                      <td><input type="number" style={{ width: '60px', border: '1px solid #eee' }} value={t.partranche2} onChange={(e) => handleTrancheChange(i, 'partranche2', Number(e.target.value), 'M')} />h</td>
                      <td><input type="number" style={{ width: '60px', border: '1px solid #eee' }} value={t.partaux2} onChange={(e) => handleTrancheChange(i, 'partaux2', Number(e.target.value), 'M')} />%</td>
                      <td><IconButton size="small" onClick={() => removeTranche(i, 'M')}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </div>
        </div>
      )}

      {activeTab === 2 && (
        <div className="ps-modern-grid">
          <div className="ps-modern-card ps-modern-card--medium">
            <div className="ps-modern-card-header">
              <h3 className="ps-modern-card-title">Configuration Nuit</h3>
              <Switch checked={formData.parnuit === '1'} onChange={(e) => handleInputChange('parnuit', e.target.checked ? '1' : '0')} />
            </div>
            <div className="ps-modern-time-grid" style={{ marginBottom: '2rem' }}>
              <div className="ps-modern-input-wrapper">
                <label className="ps-modern-label">Début</label>
                <input type="text" className="ps-modern-input" value={formData.nuitdeb || '22:00'} onChange={(e) => handleInputChange('nuitdeb', e.target.value)} />
              </div>
              <div className="ps-modern-input-wrapper">
                <label className="ps-modern-label">Fin</label>
                <input type="text" className="ps-modern-input" value={formData.nuitfin || '06:00'} onChange={(e) => handleInputChange('nuitfin', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormControlLabel control={<Checkbox checked={formData.moinsrepas === 1} onChange={(e) => handleInputChange('moinsrepas', e.target.checked ? 1 : 0)} />} label="Diminuer panier nuit" />
              <FormControlLabel control={<Checkbox checked={formData.ajustupd === '1'} onChange={(e) => handleInputChange('ajustupd', e.target.checked ? '1' : '0')} />} label="Compter journée sortie" />
              <FormControlLabel control={<Checkbox checked={formData.parretabs === '1'} onChange={(e) => handleInputChange('parretabs', e.target.checked ? '1' : '0')} />} label="Exclure nuit si sortie jour" />
              <FormControlLabel control={<Checkbox checked={formData.parhnuitspec === '1'} onChange={(e) => handleInputChange('parhnuitspec', e.target.checked ? '1' : '0')} />} label="Majoré H.Nuit aux H.Norm" />
            </div>

            <div className="ps-modern-form-group" style={{ marginTop: 3, maxWidth: '200px' }}>
              <label className="ps-modern-label">Seuil Min Nuit (h)</label>
              <input type="number" className="ps-modern-input" value={formData.parminhjour || 0} onChange={(e) => handleInputChange('parminhjour', Number(e.target.value))} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 3 && (
        <div className="ps-modern-grid">
          <div className="ps-modern-card ps-modern-card--small">
            <h3 className="ps-modern-card-title">Configuration Pointeuse</h3>
            <div className="ps-modern-form-group">
              <label className="ps-modern-label">N° Communication</label>
              <Select fullWidth variant="standard" value={formData.ncom || ''} onChange={(e) => handleInputChange('ncom', e.target.value)}>
                {['T', 'K', 'Z', 'D', 'H', 'N', 'E', 'B', '1', '2', '3'].map((val) => (<MenuItem key={val} value={val}>{val}</MenuItem>))}
              </Select>
            </div>
            <div className="ps-modern-form-group">
              <label className="ps-modern-label">Nb. Pointeuses</label>
              <Select fullWidth variant="standard" value={formData.vitesse || 0} onChange={(e) => handleInputChange('vitesse', Number(e.target.value))}>
                {[10, 11, 12, 300, 600, 1200, 2400, 4800].map((val) => (<MenuItem key={val} value={val}>{val}</MenuItem>))}
              </Select>
            </div>
          </div>
        </div>
      )}

      <Tooltip title="Tout enregistrer"><button className="ps-modern-save-fab" onClick={handleUpdate}><SaveIcon sx={{ fontSize: 32 }} /></button></Tooltip>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} sx={{ width: '100%', borderRadius: '12px', fontWeight: 700 }}>{snackbar.message}</Alert>
      </Snackbar>
    </div>
  );
}