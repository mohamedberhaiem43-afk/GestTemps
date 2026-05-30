import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Box, Button, Typography, Menu, MenuItem } from '@mui/material';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';
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
import FileDownloadIcon from '@mui/icons-material/FileUpload';
import ApartmentIcon from '@mui/icons-material/Apartment';
import BadgeIcon from '@mui/icons-material/Badge';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [directions, setDirections] = useState<DirectionModel[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'direction' | 'service' | 'section'>('all');
  const [page, setPage] = useState(1);
  const feedback = useFeedbackSnackbar();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'direction' | 'service' | 'section'>('direction');
  const [editUnit, setEditUnit] = useState<OrgUnit | null>(null);
  const [form, setForm] = useState({ code: '', libelle: '', location: '', email: '' });
  const addMenuAnchor = useRef<HTMLButtonElement | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  // Filtre avancé (recherche plein texte sur code / libellé / localisation / email).
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [search, setSearch] = useState('');

  const soccod = sessionStorage.getItem('soccod') || '01';

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message={t('donneeBase.orgStructure.noConsultRight')} />;
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

  // Préremplissage du code auto-généré à l'ouverture du dialogue d'AJOUT pour les
  // TROIS types (direction / service / section) : le code est séquentiel côté serveur
  // et n'est plus saisi manuellement. Sans cet appel, le champ resterait vide ; le
  // backend auto-génère aussi au POST (filet de sécurité si l'appel échoue).
  useEffect(() => {
    if (!dialogOpen || editUnit) return;
    let cancelled = false;
    const url = dialogMode === 'direction'
      ? `/Directions/next-code/${soccod}`
      : dialogMode === 'service'
        ? `/Services/next-code/${soccod}`
        : `/Sections/get-next-seccod/${soccod}`;
    apiInstance.get(url)
      .then(res => {
        if (cancelled) return;
        const code = dialogMode === 'section' ? res.data?.seccod : res.data?.code;
        if (code) setForm(p => (p.code ? p : { ...p, code }));
      })
      .catch(() => { /* silencieux : le backend auto-génère aussi au POST */ });
    return () => { cancelled = true; };
  }, [dialogOpen, editUnit, dialogMode, soccod]);

  const allUnits: OrgUnit[] = useMemo(() => {
    const dirs: OrgUnit[] = directions.map(d => ({
      code: d.dircod, libelle: d.dirlib, type: 'direction' as const,
      location: d.dirloc || '', email: d.diremail || '', responsable: d.dirresp || '', soccod: d.soccod,
    }));
    const srvs: OrgUnit[] = services.map((s: any) => ({
      code: s.sercod, libelle: s.serlib, type: 'service' as const,
      location: s.serlieu || '', email: s.seremail || s.sermail || s.email || '', responsable: '', soccod: s.soccod,
    }));
    const secs: OrgUnit[] = sections.map((s: any) => ({
      code: s.seccod, libelle: s.seclib || '', type: 'section' as const,
      location: s.seclieu || s.secloc || '', email: s.secemail || s.secmail || s.email || '', responsable: '', soccod: s.soccod,
    }));
    return [...dirs, ...srvs, ...secs];
  }, [directions, services, sections]);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? allUnits : allUnits.filter(u => u.type === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(u =>
      [u.code, u.libelle, u.location, u.email].some(v => (v || '').toLowerCase().includes(q)));
    return list;
  }, [allUnits, filter, search]);
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
    if (!form.libelle) { feedback.showError(t('donneeBase.orgStructure.msg.labelRequired')); return; }
    // Le code est auto-généré (serveur) pour les trois types : aucune saisie manuelle
    // requise. À l'édition, form.code provient de l'unité éditée.
    try {
      if (editUnit) {
        if (dialogMode === 'direction') await apiInstance.put(`/Directions`, { soccod, dircod: form.code, dirlib: form.libelle, dirloc: form.location, diremail: form.email });
        else if (dialogMode === 'service') await apiInstance.put(`/Services/${soccod}/${form.code}`, { soccod, sercod: form.code, serlib: form.libelle, serlieu: form.location, seremail: form.email });
        else await apiInstance.put(`/Sections/${soccod}/${form.code}`, { soccod, seccod: form.code, seclib: form.libelle, seclieu: form.location, secemail: form.email });
        feedback.showSuccess(t('donneeBase.orgStructure.msg.updated'));
      } else {
        if (dialogMode === 'direction') await apiInstance.post(`/Directions`, { soccod, dircod: form.code || undefined, dirlib: form.libelle, dirloc: form.location, diremail: form.email });
        else if (dialogMode === 'service') await apiInstance.post(`/Services`, { soccod, sercod: form.code || undefined, serlib: form.libelle, serlieu: form.location, effectif: 0, seremail: form.email });
        else await apiInstance.post(`/Sections`, { soccod, seccod: form.code || undefined, seclib: form.libelle, seclieu: form.location, effectif: 0, secemail: form.email });
        feedback.showSuccess(t('donneeBase.orgStructure.msg.added'));
      }
      setDialogOpen(false); fetchData();
    } catch (err) { feedback.showError(err, t('donneeBase.orgStructure.msg.error')); }
  };

  // Export « ledger » : génère un classeur Excel des unités actuellement filtrées
  // (respecte le filtre par type + la recherche avancée).
  const handleExportLedger = () => {
    if (filtered.length === 0) { feedback.showError(t('donneeBase.orgStructure.noResults')); return; }
    const typeLabel = (ty: string) => ty === 'direction'
      ? t('donneeBase.orgStructure.type.direction')
      : ty === 'service' ? t('donneeBase.orgStructure.type.service') : t('donneeBase.orgStructure.type.section');
    const rows = filtered.map(u => ({
      [t('donneeBase.orgStructure.headers.code')]: u.code,
      [t('donneeBase.orgStructure.headers.label')]: u.libelle,
      [t('donneeBase.orgStructure.headers.type')]: typeLabel(u.type),
      [t('donneeBase.orgStructure.headers.location')]: u.location || '',
      [t('donneeBase.orgStructure.headers.email')]: u.email || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Structure');
    XLSX.writeFile(wb, 'structure_organisationnelle.xlsx');
  };

  const handleDelete = async (unit: OrgUnit) => {
    if (!window.confirm(t('donneeBase.orgStructure.msg.deleteConfirm', { name: unit.libelle }))) return;
    try {
      if (unit.type === 'direction') await apiInstance.delete(`/Directions/${unit.soccod}/${unit.code}`);
      else if (unit.type === 'service') await apiInstance.delete(`/Services/${unit.soccod}/${unit.code}`);
      else await apiInstance.delete(`/Sections/${unit.soccod}/${unit.code}`);
      feedback.showSuccess(t('donneeBase.orgStructure.msg.deleted'));
      fetchData();
    } catch (err) { feedback.showError(err, t('donneeBase.orgStructure.msg.deleteError')); }
  };

  const iconForType = (type: string) => type === 'direction' ? <DomainIcon sx={{ fontSize: 16 }} /> : type === 'service' ? <BadgeIcon sx={{ fontSize: 16 }} /> : <LocationCityIcon sx={{ fontSize: 16 }} />;
  const iconClass = (type: string) => type === 'direction' ? 'org-unit-icon--dir' : type === 'service' ? 'org-unit-icon--srv' : 'org-unit-icon--sec';
  const total = directions.length + services.length + sections.length;

  return (
    <Box className="org-container">
      {/* Header */}
      <Box className="org-header">
        <Box>
          <span className="org-label">{t('donneeBase.orgStructure.label')}</span>
          <Typography className="org-title">{t('donneeBase.orgStructure.title')}</Typography>
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
              {t('donneeBase.orgStructure.addUnit')}
            </Button>
            <Menu
              anchorEl={addMenuAnchor.current}
              open={addMenuOpen}
              onClose={() => setAddMenuOpen(false)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem onClick={() => { setAddMenuOpen(false); openAddDialog('direction'); }}>
                <DomainIcon sx={{ fontSize: 18, mr: 1, color: '#0040a1' }} /> {t('donneeBase.orgStructure.menu.direction')}
              </MenuItem>
              <MenuItem onClick={() => { setAddMenuOpen(false); openAddDialog('service'); }}>
                <BadgeIcon sx={{ fontSize: 18, mr: 1, color: '#0066ff' }} /> {t('donneeBase.orgStructure.menu.service')}
              </MenuItem>
              <MenuItem onClick={() => { setAddMenuOpen(false); openAddDialog('section'); }}>
                <LocationCityIcon sx={{ fontSize: 18, mr: 1, color: '#4edea3' }} /> {t('donneeBase.orgStructure.menu.section')}
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {/* Excel imports */}
      {canAdd && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, px: { xs: 1.5, sm: 0 }, mb: 2 }}>
          <ExcelImportButton
            label={t('donneeBase.orgStructure.import.directions')}
            endpoint="/BulkImport/directions"
            extraBody={{ Soccod: soccod }}
            columnMap={{
              Dircod: ['code direction', 'dircod', 'code'],
              Dirlib: ['libellé direction', 'dirlib', 'libelle', 'libellé', 'libelle direction', 'direction', 'nom'],
              Dirloc: ['localisation', 'dirloc', 'lieu'],
              Diremail: ['email', 'diremail', 'mail'],
              Dirresp: ['responsable', 'dirresp'],
            }}
            labelMap={{ Dircod: 'Code direction', Dirlib: 'Libellé direction', Dirloc: 'Localisation', Diremail: 'Email', Dirresp: 'Responsable' }}
            templateExample={{ Dircod: '', Dirlib: 'Direction Générale', Dirloc: 'Siège', Diremail: 'dg@exemple.fr', Dirresp: 'Jean Dupont' }}
            onImported={fetchData}
          />
          <ExcelImportButton
            label={t('donneeBase.orgStructure.import.services')}
            endpoint="/BulkImport/services"
            extraBody={{ Soccod: soccod }}
            columnMap={{
              Serlib: ['libellé service', 'serlib', 'libelle', 'libellé', 'libelle service', 'service', 'nom'],
              Serlieu: ['localisation', 'serlieu', 'lieu', 'emplacement'],
              Seremail: ['email', 'seremail', 'mail', 'e-mail'],
              Serloc: ['service externe', 'serloc', 'externe', 'externalisé'],
            }}
            labelMap={{ Serlib: 'Libellé service', Serlieu: 'Localisation', Seremail: 'Email', Serloc: 'Service externe' }}
            templateExample={{ Serlib: 'Comptabilité', Serlieu: 'Siège', Seremail: 'compta@exemple.fr', Serloc: 'Non' }}
            onImported={fetchData}
          />
          <ExcelImportButton
            label={t('donneeBase.orgStructure.import.sections')}
            endpoint="/BulkImport/sections"
            extraBody={{ Soccod: soccod }}
            columnMap={{
              Seccod: ['code section', 'seccod', 'code'],
              Seclib: ['libellé section', 'seclib', 'libelle', 'libellé', 'libelle section', 'section', 'nom'],
              Sectype: ['type', 'sectype'],
              Secemail: ['email', 'secemail', 'mail', 'e-mail'],
              Seclieu: ['localisation', 'seclieu', 'lieu', 'emplacement'],
            }}
            labelMap={{ Seccod: 'Code section', Seclib: 'Libellé section', Sectype: 'Type', Secemail: 'Email', Seclieu: 'Localisation' }}
            templateExample={{ Seccod: '', Seclib: 'Section Nord', Sectype: '', Secemail: 'nord@exemple.fr', Seclieu: 'Siège' }}
            onImported={fetchData}
          />
        </Box>
      )}

      {/* Metrics */}
      <Box className="org-metrics">
        <Box className="org-metric-card">
          <p className="org-metric-label">{t('donneeBase.orgStructure.metric.totalDirections')}</p>
          <h3 className="org-metric-value">{String(directions.length).padStart(2,'0')}</h3>
          <div className="org-metric-sub"><TrendingUpIcon sx={{ fontSize: 14, mr: 0.5 }} /> {t('donneeBase.orgStructure.metric.active')}</div>
          <DomainIcon className="org-metric-icon-bg" />
        </Box>
        <Box className="org-metric-card">
          <p className="org-metric-label">{t('donneeBase.orgStructure.metric.totalServices')}</p>
          <h3 className="org-metric-value">{String(services.length).padStart(2,'0')}</h3>
          <div className="org-metric-sub"><CheckCircleIcon sx={{ fontSize: 14, mr: 0.5 }} /> {t('donneeBase.orgStructure.metric.operational')}</div>
          <HubIcon className="org-metric-icon-bg" />
        </Box>
        <Box className="org-metric-card">
          <p className="org-metric-label">{t('donneeBase.orgStructure.metric.totalSections')}</p>
          <h3 className="org-metric-value">{String(sections.length).padStart(2,'0')}</h3>
          <div className="org-metric-sub" style={{ color: '#0040a1' }}>{t('donneeBase.orgStructure.metric.totalUnits', { count: total })}</div>
          <MapIcon className="org-metric-icon-bg" />
        </Box>
      </Box>

      {/* Filter Bar */}
      <Box className="org-filters">
        <Box className="org-filter-pills">
          {(['all','direction','service','section'] as const).map(f => (
            <button key={f} className={`org-pill ${filter===f?'org-pill--active':'org-pill--inactive'}`}
              onClick={() => { setFilter(f); setPage(1); }}>
              {f==='all'?t('donneeBase.orgStructure.filter.all'):f==='direction'?t('donneeBase.orgStructure.filter.directions'):f==='service'?t('donneeBase.orgStructure.filter.services'):t('donneeBase.orgStructure.filter.sections')}
            </button>
          ))}
        </Box>
        <Box className="org-actions-bar">
          <button
            className={`org-action-btn ${advancedOpen ? 'org-action-btn--active' : ''}`}
            onClick={() => setAdvancedOpen(o => !o)}
          >
            <FilterListIcon sx={{ fontSize: 14 }} /> {t('donneeBase.orgStructure.filter.advanced')}
          </button>
          <button className="org-action-btn" onClick={handleExportLedger}>
            <FileDownloadIcon sx={{ fontSize: 14 }} /> {t('donneeBase.orgStructure.filter.exportLedger')}
          </button>
        </Box>
      </Box>

      {/* Panneau de recherche avancée (basculé par « Filtres Avancés ») */}
      {advancedOpen && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: { xs: 1.5, sm: 0 }, mb: 2 }}>
          <input
            className="org-search-input"
            type="text"
            value={search}
            autoFocus
            placeholder={t('donneeBase.orgStructure.filter.searchPlaceholder')}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1, maxWidth: 420, padding: '8px 12px', border: '1px solid #d8dee9', borderRadius: 8, fontSize: 14 }}
          />
          {search && (
            <button className="org-action-btn" onClick={() => { setSearch(''); setPage(1); }}>
              {t('donneeBase.orgStructure.filter.clear')}
            </button>
          )}
        </Box>
      )}

      {/* Table */}
      <Box className="org-table-wrap">
        <table className="org-table">
          <thead><tr>
            <th>{t('donneeBase.orgStructure.headers.code')}</th><th>{t('donneeBase.orgStructure.headers.label')}</th><th>{t('donneeBase.orgStructure.headers.type')}</th><th>{t('donneeBase.orgStructure.headers.location')}</th><th>{t('donneeBase.orgStructure.headers.email')}</th><th style={{textAlign:'right'}}>{t('donneeBase.orgStructure.headers.actions')}</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'#94a3b8'}}>{t('donneeBase.orgStructure.loading')}</td></tr>
            ) : paginated.length===0 ? (
              <tr><td colSpan={6} style={{textAlign:'center',padding:40,color:'#94a3b8'}}>{t('donneeBase.orgStructure.noResults')}</td></tr>
            ) : paginated.map(unit => (
              <tr key={`${unit.type}-${unit.code}`}>
                <td><span className="org-table-code">{unit.code}</span></td>
                <td><Box className="org-unit-cell">
                  <Box className={`org-unit-icon ${iconClass(unit.type)}`}>{iconForType(unit.type)}</Box>
                  <Box><p className="org-unit-name">{unit.libelle}</p>
                    {unit.responsable && <p className="org-unit-resp">{t('donneeBase.orgStructure.responsable')} {unit.responsable}</p>}</Box>
                </Box></td>
                <td><span className={`org-type-badge org-type-badge--${unit.type}`}>
                  {unit.type==='direction'?t('donneeBase.orgStructure.type.direction'):unit.type==='service'?t('donneeBase.orgStructure.type.service'):t('donneeBase.orgStructure.type.section')}
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
          <span className="org-table-info">{t('donneeBase.orgStructure.showing', { from: filtered.length>0?(page-1)*PER_PAGE+1:0, to: Math.min(page*PER_PAGE,filtered.length), total: filtered.length })}</span>
          <Box className="org-pagination">
            <button className="org-page-btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeftIcon sx={{fontSize:16}}/></button>
            {Array.from({length:totalPages},(_,i)=>(
              <button key={i} className={`org-page-btn ${page===i+1?'org-page-btn--active':''}`} onClick={()=>setPage(i+1)}>{i+1}</button>
            ))}
            <button className="org-page-btn" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}><ChevronRightIcon sx={{fontSize:16}}/></button>
          </Box>
        </Box>
      </Box>

      {/* Bottom Cards — seul "Unités en Création" reste (les 2 autres cartes étaient
          des chiffres placeholder non branchés à de la donnée réelle). */}
      <Box className="org-bottom-cards">
        <Box className="org-side-cards">
          <Box className="org-stat-card org-stat-card--secondary">
            <p className="org-stat-label">{t('donneeBase.orgStructure.creating')}</p>
            <Box className="org-stat-row"><span className="org-stat-value">{String(total).padStart(2,'0')}</span></Box>
          </Box>
        </Box>
      </Box>

      {/* Dialog */}
      {dialogOpen && (
        <Box className="org-dialog-overlay" onClick={()=>setDialogOpen(false)}>
          <Box className="org-dialog" onClick={(e:any)=>e.stopPropagation()}>
            <h3 className="org-dialog-title">{editUnit?t('donneeBase.orgStructure.dialog.edit'):t('donneeBase.orgStructure.dialog.add')} {dialogMode==='direction'?t('donneeBase.orgStructure.dialog.directionUnit'):dialogMode==='service'?t('donneeBase.orgStructure.dialog.serviceUnit'):t('donneeBase.orgStructure.dialog.sectionUnit')}</h3>
            <Box sx={{display:'flex',flexDirection:'column',gap:'16px'}}>
              <Box className="soc-field">
                <label>
                  {t('donneeBase.orgStructure.dialog.code')}
                  {!editUnit && (
                    <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>
                      {t('donneeBase.orgStructure.dialog.autoGen')}
                    </span>
                  )}
                </label>
                {/* Code toujours auto-généré (serveur) : champ en lecture seule, jamais saisi à la main. */}
                <input
                  type="text"
                  value={form.code}
                  readOnly
                  placeholder={!editUnit ? t('donneeBase.orgStructure.dialog.autoPlaceholder') : ''}
                />
              </Box>
              <Box className="soc-field"><label>{t('donneeBase.orgStructure.dialog.label')}</label><input type="text" value={form.libelle} onChange={e=>setForm({...form,libelle:e.target.value})}/></Box>
              {dialogMode==='direction' && <>
                <Box className="soc-field"><label>{t('donneeBase.orgStructure.dialog.location')}</label><input type="text" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Box>
                <Box className="soc-field"><label>{t('donneeBase.orgStructure.dialog.email')}</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Box>
              </>}
              {dialogMode==='service' && (
                <>
                  <Box className="soc-field"><label>{t('donneeBase.orgStructure.dialog.location')}</label><input type="text" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Box>
                  <Box className="soc-field"><label>{t('donneeBase.orgStructure.dialog.email')}</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Box>
                </>
              )}
              {dialogMode==='section' && (
                <>
                  <Box className="soc-field"><label>{t('donneeBase.orgStructure.dialog.location')}</label><input type="text" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Box>
                  <Box className="soc-field"><label>{t('donneeBase.orgStructure.dialog.email')}</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Box>
                </>
              )}
            </Box>
            <Box className="org-dialog-actions">
              <button className="org-dialog-cancel" onClick={()=>setDialogOpen(false)}>{t('donneeBase.orgStructure.dialog.cancel')}</button>
              <button className="org-dialog-save" onClick={handleSave}>{editUnit?t('donneeBase.orgStructure.dialog.update'):t('donneeBase.orgStructure.dialog.save')}</button>
            </Box>
          </Box>
        </Box>
      )}

      {feedback.element}
    </Box>
  );
}
export default function OrgStructureModern() {
  return (
    <OrgStructureContent />
  );
}
