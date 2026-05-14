import { useState, useMemo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SearchIcon from '@mui/icons-material/Search';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import { useTranslation } from 'react-i18next';
import useAddSite from '../../../hooks/siteHooks/useAddSite';
import useUpdateSite from '../../../hooks/siteHooks/useUpdateSite';
import useGetSites from '../../../hooks/siteHooks/useGetSites';
import useDeleteSite from '../../../hooks/siteHooks/useDeleteSite';
import { Filiale as FilialeModel } from '../../../models/Filiale';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import '../shared/RefModern.css';

const emptyForm: FilialeModel = {
  sitcod: '', soccod: '', sitlib: '', sitadr: '', sittel: '', sitfax: '',
  sitemail: '', sitmois: 0, sitconge: 0, sitcongem: 0, sitsoc: '',
  sitpaie: '', sitsanch: '0', sitsancm: '0',
  sitlat: null, sitlon: null, sitrad: null,
};

function FilialeModernContent() {
  const { t } = useTranslation();
  const { soccod, hasPermission } = useAuth();
  const [form, setForm] = useState<FilialeModel>({ ...emptyForm, soccod: soccod || '' });
  const feedback = useFeedbackSnackbar();
  const [search, setSearch] = useState('');

  const { mutate: addSite, isPending: isAdding } = useAddSite();
  const { mutate: updateSite, isPending: isUpdating } = useUpdateSite();
  const { data: rawData, refetch } = useGetSites();
  const { mutate: deleteSite } = useDeleteSite();

  const sites: FilialeModel[] = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];
  const isEditMode = form.sitcod !== '' && sites.some((s: FilialeModel) => s.sitcod === form.sitcod);
  const isSaving = isAdding || isUpdating;

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  const filtered = useMemo(() => {
    if (!search) return sites;
    const q = search.toLowerCase();
    return sites.filter((s: FilialeModel) => s.sitcod.toLowerCase().includes(q) || s.sitlib.toLowerCase().includes(q));
  }, [sites, search]);

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message={t('donneeBase.filiale.noConsultRight')} />;
  }

  const set = (field: keyof FilialeModel) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    const numericIntFields: Array<keyof FilialeModel> = ['sitmois', 'sitconge', 'sitcongem'];
    const geoFloatFields: Array<keyof FilialeModel> = ['sitlat', 'sitlon'];
    const geoIntFields: Array<keyof FilialeModel> = ['sitrad'];
    setForm(prev => {
      if (numericIntFields.includes(field)) return { ...prev, [field]: Number(val) || 0 };
      if (geoFloatFields.includes(field)) return { ...prev, [field]: val === '' ? null : Number(val) };
      if (geoIntFields.includes(field)) return { ...prev, [field]: val === '' ? null : parseInt(val, 10) || 0 };
      return { ...prev, [field]: val };
    });
  };

  const handleUseMyPosition = () => {
    if (!navigator.geolocation) {
      feedback.showError(t('donneeBase.filiale.geo.unsupported'));
      return;
    }
    feedback.showInfo(t('donneeBase.filiale.geo.locating'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(prev => ({
          ...prev,
          sitlat: Number(pos.coords.latitude.toFixed(7)),
          sitlon: Number(pos.coords.longitude.toFixed(7)),
          sitrad: prev.sitrad ?? 200,
        }));
        feedback.showSuccess(t('donneeBase.filiale.geo.captured'));
      },
      (err) => {
        const msg = err.code === err.PERMISSION_DENIED
          ? t('donneeBase.filiale.geo.denied')
          : err.code === err.POSITION_UNAVAILABLE
          ? t('donneeBase.filiale.geo.unavailable')
          : t('donneeBase.filiale.geo.error');
        feedback.showError(msg);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const clearGeofence = () => {
    setForm(prev => ({ ...prev, sitlat: null, sitlon: null, sitrad: null }));
  };

  const handleSubmit = () => {
    if (!form.sitcod || !form.sitlib) {
      feedback.showError(t('donneeBase.filiale.codeRequired'));
      return;
    }
    const payload = { ...form, soccod: soccod || '' };
    const onSuccess = () => {
      feedback.showSuccess(isEditMode ? t('donneeBase.filiale.msgUpdated') : t('donneeBase.filiale.msgAdded'));
      setForm({ ...emptyForm, soccod: soccod || '' });
      refetch();
    };
    const onError = (err: any) => feedback.showError(err, t('donneeBase.common.saveError'));
    if (isEditMode) { updateSite(payload, { onSuccess, onError }); } else { addSite(payload, { onSuccess, onError }); }
  };

  const handleEdit = (row: FilialeModel) => { setForm(row); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDelete = (row: FilialeModel) => {
    if (window.confirm(t('donneeBase.filiale.deleteConfirm'))) {
      deleteSite({ sitcod: row.sitcod }, { onSuccess: () => refetch() });
    }
  };

  return (
    <Box className="ref-container">
      <Box className="ref-header">
        <Box>
          <Typography className="ref-header-title">{t('donneeBase.breadcrumb')}</Typography>
          <Typography className="ref-header-heading">{t('donneeBase.filiale.heading')}</Typography>
          <Typography className="ref-header-sub">{t('donneeBase.filiale.subtitle')}</Typography>
        </Box>
        <Box className="ref-header-actions">
          {isEditMode && <Button className="ref-cancel-btn" variant="outlined" onClick={() => setForm({ ...emptyForm, soccod: soccod || '' })}>{t('donneeBase.common.cancel')}</Button>}
          {((isEditMode && canModify) || (!isEditMode && canAdd)) && (
            <Button className="ref-save-btn" variant="contained" startIcon={<SaveIcon />} onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? t('donneeBase.filiale.saving') : isEditMode ? t('donneeBase.common.update') : t('donneeBase.common.save')}
            </Button>
          )}
        </Box>
      </Box>

      <Box className="ref-body">
        {/* PRIMARY: Table at top (Portefeuille des filiales) */}
        <Box className="ref-table-section">
          <Box className="ref-table-header">
            <Typography className="ref-table-title">{t('donneeBase.filiale.tableTitle', { count: filtered.length })}</Typography>
            <Box className="ref-table-search">
              <SearchIcon sx={{ fontSize: 16, color: '#8896a8' }} />
              <input type="text" placeholder={t('donneeBase.common.search')} value={search} onChange={e => setSearch(e.target.value)} />
            </Box>
          </Box>
          <Box className="ref-table-container">
            <table className="ref-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>{t('donneeBase.common.actions')}</th>
                  <th>{t('donneeBase.common.code')}</th>
                  <th>{t('donneeBase.filiale.headers.name')}</th>
                  <th>{t('donneeBase.filiale.headers.phone')}</th>
                  <th>{t('donneeBase.filiale.headers.email')}</th>
                  <th>{t('donneeBase.filiale.headers.hoursMonth')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="ref-empty">{t('donneeBase.filiale.noResults')}</td></tr>
                ) : filtered.map(s => {
                  const isSelected = isEditMode && form.sitcod === s.sitcod;
                  return (
                  <tr key={s.sitcod} className={isSelected ? 'ref-row--selected' : ''}>
                    <td>
                      <Box sx={{ display: 'flex', gap: '4px' }}>
                        {canModify && (
                          <button className="ref-action-btn ref-action-btn--edit" onClick={() => handleEdit(s)}><EditIcon sx={{ fontSize: 16 }} /></button>
                        )}
                        {canDelete && (
                          <button className="ref-action-btn ref-action-btn--delete" onClick={() => handleDelete(s)}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button>
                        )}
                        {!canModify && !canDelete && <Typography variant="caption">—</Typography>}
                      </Box>
                    </td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{s.sitcod}</td>
                    <td>{s.sitlib}</td>
                    <td>{s.sittel || '—'}</td>
                    <td style={{ color: '#64748b' }}>{s.sitemail || '—'}</td>
                    <td><span className="ref-badge ref-badge--blue">{s.sitmois || '—'}</span></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
          <Box className="ref-table-footer"><span>{t('donneeBase.filiale.footerCount', { count: filtered.length })}</span></Box>
        </Box>

        {/* SECONDARY: Contextual sub-header */}
        <Box className="ref-details-header">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box className="ref-details-icon"><BusinessIcon fontSize="small" /></Box>
            <Box>
              <Typography className="ref-details-title">
                {isEditMode ? <>{t('donneeBase.filiale.details.titleEdit')} <span className="ref-details-code">{form.sitcod}</span></> : t('donneeBase.filiale.details.titleNew')}
              </Typography>
              <Typography className="ref-details-sub">
                {isEditMode ? t('donneeBase.filiale.details.subEdit') : t('donneeBase.filiale.details.subNew')}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Card: Identification */}
        <Box className="ref-card">
          <Box className="ref-card-header">
            <Box className="ref-card-icon"><BusinessIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{t('donneeBase.filiale.card.identification')}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field">
              <label>{t('donneeBase.filiale.field.code')}</label>
              <input type="text" value={form.sitcod} onChange={set('sitcod')} readOnly={isEditMode} placeholder={t('donneeBase.filiale.placeholder.code')} />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.filiale.field.name')}</label>
              <input type="text" value={form.sitlib} onChange={set('sitlib')} placeholder={t('donneeBase.filiale.placeholder.name')} />
            </Box>
          </Box>
        </Box>

        {/* Card: Coordonnées */}
        <Box className="ref-card">
          <Box className="ref-card-header">
            <Box className="ref-card-icon"><LocationOnIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{t('donneeBase.filiale.card.contact')}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field" style={{ gridColumn: 'span 2' }}>
              <label>{t('donneeBase.filiale.field.address')}</label>
              <input type="text" value={form.sitadr} onChange={set('sitadr')} placeholder={t('donneeBase.filiale.placeholder.address')} />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.filiale.field.phone')}</label>
              <input type="tel" value={form.sittel} onChange={set('sittel')} placeholder={t('donneeBase.filiale.placeholder.phone')} />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.filiale.field.fax')}</label>
              <input type="tel" value={form.sitfax} onChange={set('sitfax')} />
            </Box>
            <Box className="ref-field" style={{ gridColumn: 'span 2' }}>
              <label>{t('donneeBase.filiale.field.email')}</label>
              <input type="email" value={form.sitemail} onChange={set('sitemail')} placeholder={t('donneeBase.filiale.placeholder.email')} />
            </Box>
          </Box>
        </Box>

        {/* Card: Paramètres Travail */}
        <Box className="ref-card">
          <Box className="ref-card-header">
            <Box className="ref-card-icon"><ScheduleIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{t('donneeBase.filiale.card.workParams')}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--3">
            <Box className="ref-field">
              <label>{t('donneeBase.filiale.field.hoursMonth')}</label>
              <input type="number" value={form.sitmois} onChange={set('sitmois')} placeholder="191" />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.filiale.field.leavesYear')}</label>
              <input type="number" value={form.sitconge} onChange={set('sitconge')} placeholder="18" />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.filiale.field.leavesMonth')}</label>
              <input type="number" value={form.sitcongem} onChange={set('sitcongem')} placeholder="1.5" />
            </Box>
          </Box>
        </Box>

        {/* Card: Pointage géolocalisé */}
        <Box className="ref-card">
          <Box className="ref-card-header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box className="ref-card-icon"><GpsFixedIcon fontSize="small" /></Box>
              <Box>
                <Typography className="ref-card-title">{t('donneeBase.filiale.card.geofence')}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>{t('donneeBase.filiale.geo.help')}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<MyLocationIcon />}
                onClick={handleUseMyPosition}
                sx={{ textTransform: 'none', borderRadius: '8px' }}
              >
                {t('donneeBase.filiale.geo.useMyPosition')}
              </Button>
              {(form.sitlat || form.sitlon || form.sitrad) && (
                <Button
                  variant="text"
                  size="small"
                  color="error"
                  onClick={clearGeofence}
                  sx={{ textTransform: 'none' }}
                >
                  {t('donneeBase.filiale.geo.clear')}
                </Button>
              )}
            </Box>
          </Box>
          <Box className="ref-form-grid ref-form-grid--3">
            <Box className="ref-field">
              <label>{t('donneeBase.filiale.field.latitude')}</label>
              <input
                type="number"
                step="0.0000001"
                value={form.sitlat ?? ''}
                onChange={set('sitlat')}
                placeholder="48.8566"
              />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.filiale.field.longitude')}</label>
              <input
                type="number"
                step="0.0000001"
                value={form.sitlon ?? ''}
                onChange={set('sitlon')}
                placeholder="2.3522"
              />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.filiale.field.radius')}</label>
              <input
                type="number"
                min="10"
                max="100000"
                value={form.sitrad ?? ''}
                onChange={set('sitrad')}
                placeholder="200"
              />
            </Box>
          </Box>
          {form.sitlat && form.sitlon && (
            <Box sx={{ mt: 1.5, fontSize: 12, color: '#0040a1' }}>
              <a
                href={`https://www.openstreetmap.org/?mlat=${form.sitlat}&mlon=${form.sitlon}#map=17/${form.sitlat}/${form.sitlon}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0040a1', textDecoration: 'underline' }}
              >
                {t('donneeBase.filiale.geo.viewOnMap')}
              </a>
            </Box>
          )}
        </Box>

      </Box>

      {feedback.element}
    </Box>
  );
}

export default function FilialeModern() {
  return <FilialeModernContent />;
}