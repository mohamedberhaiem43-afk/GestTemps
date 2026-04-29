import { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Button, Typography, Snackbar, Alert, Menu, MenuItem } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DomainIcon from '@mui/icons-material/Domain';
import HubIcon from '@mui/icons-material/Hub';
import MapIcon from '@mui/icons-material/Map';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FilterListIcon from '@mui/icons-material/FilterList';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ApartmentIcon from '@mui/icons-material/Apartment';
import BadgeIcon from '@mui/icons-material/Badge';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import apiInstance from '../../API/apiInstance';
import { DirectionModel } from '../../../models/DirectionModel';
import '../Societe/SocieteModern.css';
import './OrgStructureModern.css';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import ExcelImportButton from '../shared/ExcelImportButton';

type OrgUnit = {
  code: string;
  libelle: string;
  type: 'direction' | 'service' | 'section';
  location: string;
  email: string;
  responsable: string;
  soccod: string;
};

const PER_PAGE = 10;

function OrgStructureContent() {
  const { hasPermission } = useAuth();
  const [directions, setDirections] = useState<DirectionModel[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'direction' | 'service' | 'section'>('all');
  const [page, setPage] = useState(1);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'direction' | 'service' | 'section'>('direction');
  const [editUnit, setEditUnit] = useState<OrgUnit | null>(null);
  const [form, setForm] = useState({ code: '', libelle: '', location: '', email: '' });
  const addMenuAnchor = useRef<HTMLButtonElement | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const soccod = sessionStorage.getItem('soccod') || '01';

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter la structure organisationnelle." />;
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dirRes, srvRes, secRes] = await Promise.all([
        apiInstance.get(`/Directions/get-directions/${soccod}`).catch(() => ({ data: [] })),
        apiInstance.get(`/Services/get-services/${soccod}`).catch(() => ({ data: [] })),
        apiInstance.get(`/Sections/${soccod}`).catch(() => ({ data: [] })),
      ]);
      setDirections(dirRes.data);
      setServices(srvRes.data);
      setSections(secRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const allUnits: OrgUnit[] = useMemo(() => {
    const dirs: OrgUnit[] = directions.map(d => ({
      code: d.dircod, libelle: d.dirlib, type: 'direction' as const,
      location: d.dirloc || '', email: d.diremail || '', responsable: d.dirresp || '', soccod: d.soccod,
    }));
    const srvs: OrgUnit[] = services.map((s: any) => ({
      code: s.sercod, libelle: s.serlib, type: 'service' as const,
      location: s.serloc || '', email: '', responsable: '', soccod: s.soccod,
    }));
    const secs: OrgUnit[] = sections.map((s: any) => ({
      code: s.seccod, libelle: s.seclib || '', type: 'section' as const,
      location: '', email: '', responsable: '', soccod: s.soccod,
    }));
    return [...dirs, ...srvs, ...secs];
  }, [directions, services, sections]);

  const filtered = useMemo(() => filter === 'all' ? allUnits : allUnits.filter(u => u.type === filter), [allUnits, filter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const openAddDialog = (type: 'direction' | 'service' | 'section') => {
    setDialogMode(type); setEditUnit(null);
    setForm({ code: '', libelle: '', location: '', email: '' }); setDialogOpen(true);
  };

  const openEditDialog = (unit: OrgUnit) => {
    setDialogMode(unit.type); setEditUnit(unit);
    setForm({ code: unit.code, libelle: unit.libelle, location: unit.location, email: unit.email });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Le libellé est obligatoire dans tous les cas. Le code est facultatif à la création
    // (auto-généré côté serveur) mais obligatoire pour les directions (clé fonctionnelle).
    if (!form.libelle) { setSnack({ open: true, msg: 'Libellé obligatoire.', sev: 'error' }); return; }
    if (editUnit && !form.code) { setSnack({ open: true, msg: 'Code obligatoire en modification.', sev: 'error' }); return; }
    if (!editUnit && dialogMode === 'direction' && !form.code) { setSnack({ open: true, msg: 'Code obligatoire pour une direction.', sev: 'error' }); return; }
    try {
      if (editUnit) {
        if (dialogMode === 'direction') await apiInstance.put(`/Directions`, { soccod, dircod: form.code, dirlib: form.libelle, dirloc: form.location, diremail: form.email });
        else if (dialogMode === 'service') await apiInstance.put(`/Services/${soccod}/${form.code}`, { soccod, sercod: form.code, serlib: form.libelle, serloc: form.location });
        else await apiInstance.put(`/Sections/${soccod}/${form.code}`, { soccod, seccod: form.code, seclib: form.libelle });
        setSnack({ open: true, msg: 'Unité mise à jour.', sev: 'success' });
      } else {
        if (dialogMode === 'direction') await apiInstance.post(`/Directions`, { soccod, dircod: form.code, dirlib: form.libelle, dirloc: form.location, diremail: form.email });
        // Service & Section : on n'envoie pas de code si vide → serveur génère le suivant.
        else if (dialogMode === 'service') await apiInstance.post(`/Services`, { soccod, sercod: form.code || undefined, serlib: form.libelle, serloc: form.location, effectif: 0 });
        else await apiInstance.post(`/Sections`, { soccod, seccod: form.code || undefined, seclib: form.libelle, effectif: 0 });
        setSnack({ open: true, msg: 'Unité ajoutée.', sev: 'success' });
      }
      setDialogOpen(false); fetchData();
    } catch (err: any) { setSnack({ open: true, msg: err?.response?.data?.message || 'Erreur.', sev: 'error' }); }
  };

  const handleDelete = async (unit: OrgUnit) => {
    if (!window.confirm(`Supprimer ${unit.libelle} ?`)) return;
    try {
      if (unit.type === 'direction') await apiInstance.delete(`/Directions/${unit.soccod}/${unit.code}`);
      else if (unit.type === 'service') await apiInstance.delete(`/Services/${unit.soccod}/${unit.code}`);
      else await apiInstance.delete(`/Sections/${unit.soccod}/${unit.code}`);
      setSnack({ open: true, msg: 'Supprimé.', sev: 'success' }); fetchData();
    } catch { setSnack({ open: true, msg: 'Erreur de suppression.', sev: 'error' }); }
  };

  const iconForType = (type: string) => type === 'direction' ? <DomainIcon sx={{ fontSize: 16 }} /> : type === 'service' ? <BadgeIcon sx={{ fontSize: 16 }} /> : <LocationCityIcon sx={{ fontSize: 16 }} />;
  const iconClass = (type: string) => type === 'direction' ? 'org-unit-icon--dir' : type === 'service' ? 'org-unit-icon--srv' : 'org-unit-icon--sec';
  const total = directions.length + services.length + sections.length;

  return (
    <Box className="org-container">
      {/* Header */}
      <Box className="org-header">
        <Box>
          <span className="org-label">Administration Centrale</span>
          <Typography className="org-title">Structure Organisationnelle</Typography>
        </Box>
        {canAdd && (
          <>
            <Button
              ref={addMenuAnchor}
              className="org-add-btn"
              startIcon={<AddIcon />}
              endIcon={<ArrowDropDownIcon />}
              onClick={() => setAddMenuOpen(true)}
            >
              Ajouter une Unité
            </Button>
            <Menu
              anchorEl={addMenuAnchor.current}
              open={addMenuOpen}
              onClose={() => setAddMenuOpen(false)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem onClick={() => { setAddMenuOpen(false); openAddDialog('direction'); }}>
                <DomainIcon sx={{ fontSize: 18, mr: 1, color: '#0040a1' }} /> Direction
              </MenuItem>
              <MenuItem onClick={() => { setAddMenuOpen(false); openAddDialog('service'); }}>
                <BadgeIcon sx={{ fontSize: 18, mr: 1, color: '#0066ff' }} /> Service
              </MenuItem>
              <MenuItem onClick={() => { setAddMenuOpen(false); openAddDialog('section'); }}>
                <LocationCityIcon sx={{ fontSize: 18, mr: 1, color: '#4edea3' }} /> Section
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {/* Excel imports */}
      {canAdd && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, px: { xs: 1.5, sm: 0 }, mb: 2 }}>
          <ExcelImportButton
            label="Importer Directions (Excel)"
            endpoint="/BulkImport/directions"
            extraBody={{ Soccod: soccod }}
            columnMap={{
              Dircod: ['dircod', 'code', 'code direction'],
              Dirlib: ['dirlib', 'libelle', 'libellé', 'libelle direction', 'libellé direction', 'direction', 'nom'],
              Dirloc: ['dirloc', 'localisation', 'lieu'],
              Diremail: ['diremail', 'email', 'mail'],
              Dirresp: ['dirresp', 'responsable'],
            }}
            onImported={fetchData}
          />
          <ExcelImportButton
            label="Importer Services (Excel)"
            endpoint="/BulkImport/services"
            extraBody={{ Soccod: soccod }}
            columnMap={{
              Serlib: ['serlib', 'libelle', 'libellé', 'libelle service', 'libellé service', 'service', 'nom'],
              Serloc: ['serloc', 'localisation', 'lieu'],
            }}
            onImported={fetchData}
          />
          <ExcelImportButton
            label="Importer Sections (Excel)"
            endpoint="/BulkImport/sections"
            extraBody={{ Soccod: soccod }}
            columnMap={{
              Seccod: ['seccod', 'code', 'code section'],
              Seclib: ['seclib', 'libelle', 'libellé', 'libelle section', 'libellé section', 'section', 'nom'],
              Sectype: ['sectype', 'type'],
            }}
            onImported={fetchData}
          />
        </Box>
      )}

      {/* Metrics */}
      <Box className="org-metrics">
        <Box className="org-metric-card">
          <p className="org-metric-label">Total Directions</p>
          <h3 className="org-metric-value">{String(directions.length).padStart(2,'0')}</h3>
          <div className="org-metric-sub"><TrendingUpIcon sx={{ fontSize: 14, mr: 0.5 }} /> Active(s)</div>
          <DomainIcon className="org-metric-icon-bg" />
        </Box>
        <Box className="org-metric-card">
          <p className="org-metric-label">Total Services</p>
          <h3 className="org-metric-value">{String(services.length).padStart(2,'0')}</h3>
          <div className="org-metric-sub"><CheckCircleIcon sx={{ fontSize: 14, mr: 0.5 }} /> Opérationnels</div>
          <HubIcon className="org-metric-icon-bg" />
        </Box>
        <Box className="org-metric-card">
          <p className="org-metric-label">Total Sections</p>
          <h3 className="org-metric-value">{String(sections.length).padStart(2,'0')}</h3>
          <div className="org-metric-sub" style={{ color: '#0040a1' }}>{total} unités au total</div>
          <MapIcon className="org-metric-icon-bg" />
        </Box>
      </Box>

      {/* Filter Bar */}
      <Box className="org-filters">
        <Box className="org-filter-pills">
          {(['all','direction','service','section'] as const).map(f => (
            <button key={f} className={`org-pill ${filter===f?'org-pill--active':'org-pill--inactive'}`}
              onClick={() => { setFilter(f); setPage(1); }}>
              {f==='all'?'Tous':f==='direction'?'Directions':f==='service'?'Services':'Sections'}
            </button>
          ))}
        </Box>
        <Box className="org-actions-bar">
          <button className="org-action-btn"><FilterListIcon sx={{ fontSize: 14 }} /> Filtres Avancés</button>
          <button className="org-action-btn"><FileDownloadIcon sx={{ fontSize: 14 }} /> Exporter le Ledger</button>
        </Box>
      </Box>

      {/* Table */}
      <Box className="org-table-wrap">
        <table className="org-table">
          <thead><tr>
            <th>Code</th><th>Libellé de l'Unité</th><th>Type</th><th>Localisation</th><th>Contact Email</th><th style={{textAlign:'right'}}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'#94a3b8'}}>Chargement...</td></tr>
            ) : paginated.length===0 ? (
              <tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'#94a3b8'}}>Aucune unité trouvée.</td></tr>
            ) : paginated.map(unit => (
              <tr key={`${unit.type}-${unit.code}`}>
                <td><span className="org-table-code">{unit.code}</span></td>
                <td><Box className="org-unit-cell">
                  <Box className={`org-unit-icon ${iconClass(unit.type)}`}>{iconForType(unit.type)}</Box>
                  <Box><p className="org-unit-name">{unit.libelle}</p>
                    {unit.responsable && <p className="org-unit-resp">Resp: {unit.responsable}</p>}</Box>
                </Box></td>
                <td><span className={`org-type-badge org-type-badge--${unit.type}`}>
                  {unit.type==='direction'?'Direction':unit.type==='service'?'Service':'Section'}
                </span></td>
                <td><Box className="org-location"><ApartmentIcon sx={{fontSize:14,mr:0.5}} />{unit.location||'—'}</Box></td>
                <td style={{fontSize:12,color:'#515f74'}}>{unit.email||'—'}</td>
                <td><Box className="org-row-actions">
                  {canModify && (
                    <button className="org-row-btn org-row-btn--edit" onClick={()=>openEditDialog(unit)}><EditIcon sx={{fontSize:18}}/></button>
                  )}
                  {canDelete && (
                    <button className="org-row-btn org-row-btn--delete" onClick={()=>handleDelete(unit)}><DeleteOutlineIcon sx={{fontSize:18}}/></button>
                  )}
                  {!canModify && !canDelete && <Typography variant="caption">—</Typography>}
                </Box></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Box className="org-table-footer">
          <span className="org-table-info">Affichage de {filtered.length>0?(page-1)*PER_PAGE+1:0} à {Math.min(page*PER_PAGE,filtered.length)} sur {filtered.length} unités</span>
          <Box className="org-pagination">
            <button className="org-page-btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeftIcon sx={{fontSize:16}}/></button>
            {Array.from({length:totalPages},(_,i)=>(
              <button key={i} className={`org-page-btn ${page===i+1?'org-page-btn--active':''}`} onClick={()=>setPage(i+1)}>{i+1}</button>
            ))}
            <button className="org-page-btn" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}><ChevronRightIcon sx={{fontSize:16}}/></button>
          </Box>
        </Box>
      </Box>

      {/* Bottom Cards */}
      <Box className="org-bottom-cards">
        <Box className="org-focus-card">
          <Box>
            <span className="org-focus-label">Focus Organisationnel</span>
            <h4 className="org-focus-title">Optimisation des<br/>Unités de Service 2024</h4>
            <p className="org-focus-text">La restructuration vise à centraliser les fonctions de support pour améliorer l'agilité opérationnelle de 15%.</p>
          </Box>
          <Box><button className="org-focus-btn">Consulter le Plan</button></Box>
        </Box>
        <Box className="org-side-cards">
          <Box className="org-stat-card org-stat-card--tertiary">
            <p className="org-stat-label">Taux d'Occupation</p>
            <Box className="org-stat-row"><span className="org-stat-value">88%</span><TrendingUpIcon sx={{fontSize:24,color:'#4edea3'}}/></Box>
          </Box>
          <Box className="org-stat-card org-stat-card--secondary">
            <p className="org-stat-label">Unités en Création</p>
            <Box className="org-stat-row"><span className="org-stat-value">{String(total).padStart(2,'0')}</span></Box>
          </Box>
        </Box>
      </Box>

      {/* Dialog */}
      {dialogOpen && (
        <Box className="org-dialog-overlay" onClick={()=>setDialogOpen(false)}>
          <Box className="org-dialog" onClick={(e:any)=>e.stopPropagation()}>
            <h3 className="org-dialog-title">{editUnit?'Modifier':'Ajouter'} {dialogMode==='direction'?'une Direction':dialogMode==='service'?'un Service':'une Section'}</h3>
            <Box sx={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <Box className="soc-field">
                <label>
                  Code
                  {!editUnit && (dialogMode === 'service' || dialogMode === 'section') && (
                    <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>
                      (laisser vide pour auto-générer)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e=>setForm({...form,code:e.target.value})}
                  readOnly={!!editUnit}
                  placeholder={!editUnit && (dialogMode === 'service' || dialogMode === 'section') ? 'Auto' : ''}
                />
              </Box>
              <Box className="soc-field"><label>Libellé</label><input type="text" value={form.libelle} onChange={e=>setForm({...form,libelle:e.target.value})}/></Box>
              {dialogMode==='direction' && <>
                <Box className="soc-field"><label>Localisation</label><input type="text" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Box>
                <Box className="soc-field"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Box>
              </>}
              {dialogMode==='service' && (
                <Box className="soc-field"><label>Localisation</label><input type="text" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Box>
              )}
            </Box>
            <Box className="org-dialog-actions">
              <button className="org-dialog-cancel" onClick={()=>setDialogOpen(false)}>Annuler</button>
              <button className="org-dialog-save" onClick={handleSave}>{editUnit?'Mettre à jour':'Enregistrer'}</button>
            </Box>
          </Box>
        </Box>
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={()=>setSnack(s=>({...s,open:false}))}>
        <Alert severity={snack.sev} onClose={()=>setSnack(s=>({...s,open:false}))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

const queryClient = new QueryClient();
export default function OrgStructureModern() {
  return (
    <QueryClientProvider client={queryClient}>
      <OrgStructureContent />
    </QueryClientProvider>
  );
}