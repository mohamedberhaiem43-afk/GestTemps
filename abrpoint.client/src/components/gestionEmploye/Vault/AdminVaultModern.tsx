import { useState, useEffect, useMemo } from 'react';
import { Box, CircularProgress, IconButton, FormControl, Select, MenuItem, InputLabel } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../helper/AuthProvider';
import { useNavigate } from 'react-router-dom';
import apiInstance from '../../API/apiInstance';
import { DocumentVault } from '../../../models/DocumentVault';
import './AdminVault.css';

type FilterKey = 'all' | 'pending' | 'signed' | 'validated';
type StatusKey = 'signed' | 'pending' | 'validated';

const AdminVaultModern = () => {
  const { t, i18n } = useTranslation();
  const { soccod, uticod, isEmp, authReady } = useAuth();
  const navigate = useNavigate();


  const [documents, setDocuments] = useState<DocumentVault[]>([]);
  const [employees, setEmployees] = useState<Record<string, string>>({});
  const [selectedEmpcod, setSelectedEmpcod] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    if (!authReady) return;
    // Employees have no access to this admin view
    if (isEmp) {
      navigate('/dashboard/coffre-fort', { replace: true });
      return;
    }
    if (!soccod || !uticod) {
      setIsLoading(false);
      return;
    }
    // Charge la liste des employés du périmètre de l'admin/manager pour alimenter le sélecteur.
    apiInstance.get(`/Employes/get-libs/${soccod}/${uticod}`)
      .then(r => setEmployees(r.data ?? {}))
      .catch(err => console.error('Erreur chargement liste employés', err));
  }, [soccod, uticod, isEmp, authReady, navigate]);

  useEffect(() => {
    if (!authReady || isEmp || !soccod) return;
    fetchDocuments();
  }, [soccod, selectedEmpcod, authReady, isEmp]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      // Si un employé est sélectionné → on consulte SON coffre-fort privé.
      // Sinon → vue globale (tous les employés du tenant).
      const url = selectedEmpcod
        ? `/Vault/${soccod}/${selectedEmpcod}`
        : `/Vault/admin/${soccod}`;
      const res = await apiInstance.get(url);
      setDocuments(res.data);
    } catch (err) {
      console.error('Erreur chargement vault admin', err);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (doc: DocumentVault) => {
    try {
      const response = await apiInstance.get(`/Vault/download/${doc.id}`, { responseType: 'blob' });
      // On conserve le Blob renvoyé par l'API (avec son Content-Type) — wrapper dans
      // `new Blob([...])` effacerait le type MIME et le navigateur sauverait en .txt.
      const blob: Blob = response.data;
      const url = window.URL.createObjectURL(blob);
      // docName est un libellé sans extension : on la rétablit via le type MIME, sinon
      // via l'extension du chemin stocké (docPath).
      let fileName = doc.docName || 'document';
      if (!/\.[a-z0-9]{2,5}$/i.test(fileName)) {
        const ext =
          blob.type === 'application/pdf' ? 'pdf'
          : blob.type === 'image/png' ? 'png'
          : blob.type === 'image/jpeg' ? 'jpg'
          : ((doc.docPath || '').split(/[\\/]/).pop() || '').split('.').slice(1).pop()?.toLowerCase() || '';
        if (ext) fileName = `${fileName}.${ext}`;
      }
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur téléchargement', err);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getDocIcon = (doc: DocumentVault) => {
    // L'extension vit dans docPath (« …/xxx.pdf »), pas dans docName qui est un libellé.
    const base = (doc.docPath || '').split(/[\\/]/).pop() || '';
    const dot = base.lastIndexOf('.');
    const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['doc', 'docx'].includes(ext)) return 'description';
    if (['xls', 'xlsx'].includes(ext)) return 'table_chart';
    return 'insert_drive_file';
  };

  const getStatusInfo = (doc: DocumentVault): { key: StatusKey; cls: string; icon: string } => {
    if (doc.isSigned) return { key: 'signed', cls: 'avlt-badge--signed', icon: 'verified' };
    if (doc.status === 'Pending Signature') return { key: 'pending', cls: 'avlt-badge--pending', icon: 'pending' };
    return { key: 'validated', cls: 'avlt-badge--validated', icon: 'check_circle' };
  };
  const statusLabel = (key: StatusKey) => t(`adminVault.status.${key}`);

  // Map docType to a stable category for chip styling.
  type DocCategory = 'pay' | 'contract' | 'cert' | 'other';
  const docCategoryClass = (docType: string): DocCategory => {
    const v = (docType || '').toLowerCase();
    if (v.includes('paie') || v.includes('fiche') || v.includes('salary') || v.includes('bulletin')) return 'pay';
    if (v.includes('contrat') || v.includes('contract')) return 'contract';
    if (v.includes('attestation') || v.includes('certificat') || v.includes('certificate') || v.includes('badge')) return 'cert';
    return 'other';
  };

  const filtered = useMemo(() => {
    return documents.filter(doc => {
      const matchFilter =
        filter === 'all' ? true :
        filter === 'signed' ? doc.isSigned :
        filter === 'pending' ? (!doc.isSigned && doc.status === 'Pending Signature') :
        (!doc.isSigned && doc.status !== 'Pending Signature');
      const matchSearch = search === '' ||
        doc.docName.toLowerCase().includes(search.toLowerCase()) ||
        doc.empcod.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [documents, filter, search]);

  // stats
  const totalDocs = documents.length;
  const signedDocs = documents.filter(d => d.isSigned).length;
  const pendingDocs = documents.filter(d => !d.isSigned && d.status === 'Pending Signature').length;
  const uniqueEmployees = new Set(documents.map(d => d.empcod)).size;

  // Group by employee for grid view
  const byEmployee = useMemo(() => {
    const map = new Map<string, DocumentVault[]>();
    filtered.forEach(doc => {
      if (!map.has(doc.empcod)) map.set(doc.empcod, []);
      map.get(doc.empcod)!.push(doc);
    });
    return map;
  }, [filtered]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const dateLocale = i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR';
  const filterKeys: FilterKey[] = ['all', 'pending', 'signed', 'validated'];

  return (
    <div className="avlt-container">
      {/* ── Header ── */}
      <section className="avlt-header">
        <div className="avlt-header-text">
          <label className="avlt-eyebrow">{t('adminVault.header.eyebrow')}</label>
          <h1 className="avlt-title">{t('adminVault.header.title')}</h1>
          <p className="avlt-subtitle">
            {t('adminVault.header.subtitle')}
          </p>
        </div>

        <div className="avlt-stats-bento">
          <div className="avlt-stat">
            <span className="material-symbols-outlined avlt-stat-icon">folder_shared</span>
            <div>
              <div className="avlt-stat-value">{totalDocs}</div>
              <div className="avlt-stat-label">{t('adminVault.stats.totalDocs')}</div>
            </div>
          </div>
          <div className="avlt-stat avlt-stat--pending">
            <span className="material-symbols-outlined avlt-stat-icon">pending_actions</span>
            <div>
              <div className="avlt-stat-value">{pendingDocs}</div>
              <div className="avlt-stat-label">{t('adminVault.stats.pendingSignature')}</div>
            </div>
          </div>
          <div className="avlt-stat avlt-stat--signed">
            <span className="material-symbols-outlined avlt-stat-icon">verified</span>
            <div>
              <div className="avlt-stat-value">{signedDocs}</div>
              <div className="avlt-stat-label">{t('adminVault.stats.signed')}</div>
            </div>
          </div>
          <div className="avlt-stat avlt-stat--emp">
            <span className="material-symbols-outlined avlt-stat-icon">groups</span>
            <div>
              <div className="avlt-stat-value">{uniqueEmployees}</div>
              <div className="avlt-stat-label">{t('adminVault.stats.employees')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Toolbar ── */}
      <div className="avlt-toolbar">
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel>{t('adminVault.toolbar.employee')}</InputLabel>
          <Select
            label={t('adminVault.toolbar.employee')}
            value={selectedEmpcod}
            onChange={e => setSelectedEmpcod(String(e.target.value))}
            displayEmpty
          >
            <MenuItem value=""><em>{t('adminVault.toolbar.allEmployees')}</em></MenuItem>
            {Object.entries(employees).map(([code, lib]) => (
              <MenuItem key={code} value={code}>{lib} ({code})</MenuItem>
            ))}
          </Select>
        </FormControl>

        <div className="avlt-search-wrap">
          <span className="material-symbols-outlined avlt-search-icon">search</span>
          <input
            className="avlt-search"
            placeholder={t('adminVault.toolbar.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="avlt-filter-chips">
          {filterKeys.map(f => (
            <button
              key={f}
              className={`avlt-chip ${filter === f ? 'avlt-chip--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {t(`adminVault.filter.${f}`)}
            </button>
          ))}
        </div>

        <div className="avlt-view-btns">
          <button className={`avlt-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
            <span className="material-symbols-outlined">grid_view</span>
          </button>
          <button className={`avlt-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
            <span className="material-symbols-outlined">list</span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <div className="avlt-empty">
          <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#cbd5e1' }}>folder_open</span>
          <p>{t('adminVault.empty')}</p>
        </div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="avlt-table-wrap">
          <table className="avlt-table">
            <thead>
              <tr>
                <th>{t('adminVault.table.document')}</th>
                <th>{t('adminVault.table.employee')}</th>
                <th>{t('adminVault.table.type')}</th>
                <th>{t('adminVault.table.date')}</th>
                <th>{t('adminVault.table.size')}</th>
                <th>{t('adminVault.table.status')}</th>
                <th style={{ textAlign: 'center' }}>{t('adminVault.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => {
                const st = getStatusInfo(doc);
                return (
                  <tr key={doc.id}>
                    <td>
                      <div className="avlt-doc-cell">
                        <div className={`avlt-doc-icon ${doc.docName.endsWith('.pdf') ? 'pdf' : 'other'}`}>
                          <span className="material-symbols-outlined">{getDocIcon(doc)}</span>
                        </div>
                        <div>
                          <div className="avlt-doc-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {doc.docName}
                            <span className="avlt-type-chip" style={{ fontSize: '0.6rem', padding: '2px 6px', opacity: 0.8 }}>{doc.docType}</span>
                          </div>
                          <div className={`avlt-doc-sub ${doc.isSigned ? 'signed' : 'pending'}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
                              {st.icon}
                            </span>
                            {statusLabel(st.key)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="avlt-emp-cell">
                        <div className="avlt-emp-avatar">{doc.empcod.charAt(0).toUpperCase()}</div>
                        <span className="avlt-emp-code">{doc.empcod}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`avlt-type-chip avlt-type-${docCategoryClass(doc.docType)}`}>
                        {doc.docType}
                      </span>
                    </td>
                    <td className="avlt-date">
                      {new Date(doc.docDate).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="avlt-size">{formatSize(doc.docSize)}</td>
                    <td>
                      <span className={`avlt-status-badge ${st.cls}`}>{statusLabel(st.key)}</span>
                    </td>
                    <td>
                      <div className="avlt-actions">
                        {!doc.isSigned && (
                          <button
                            className="avlt-btn-sign"
                            onClick={() => navigate(`/dashboard/sign-document?id=${doc.id}`)}
                            title={t('adminVault.tooltip.sign')}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>draw</span>
                            {t('adminVault.actions.sign')}
                          </button>
                        )}
                        <IconButton
                          size="small"
                          className="avlt-btn-dl"
                          onClick={() => handleDownload(doc)}
                          title={t('adminVault.tooltip.download')}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="avlt-table-footer">
            {t('adminVault.footer.showing', { count: filtered.length })}
            {filter !== 'all' && t('adminVault.footer.filterLabel', { label: t(`adminVault.filter.${filter}`) })}
          </div>
        </div>
      ) : (
        /* GRID VIEW — grouped by employee */
        <div className="avlt-employee-grid">
          {Array.from(byEmployee.entries()).map(([empcod, docs]) => {
            const empPending = docs.filter(d => !d.isSigned && d.status === 'Pending Signature').length;
            const empSigned = docs.filter(d => d.isSigned).length;
            return (
              <div key={empcod} className="avlt-emp-card">
                <div className="avlt-emp-card-header">
                  <div className="avlt-emp-card-avatar">{empcod.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="avlt-emp-card-name">{empcod}</div>
                    <div className="avlt-emp-card-meta">
                      {t('adminVault.grid.doc', { count: docs.length })}
                      {empPending > 0 && <span className="avlt-emp-pending-tag">{t('adminVault.grid.pendingTag', { count: empPending })}</span>}
                    </div>
                  </div>
                </div>

                <div className="avlt-emp-doc-list">
                  {docs.map(doc => {
                    const st = getStatusInfo(doc);
                    return (
                      <div key={doc.id} className="avlt-emp-doc-row">
                        <div className={`avlt-emp-doc-icon ${doc.docName.endsWith('.pdf') ? 'pdf' : 'other'}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{getDocIcon(doc)}</span>
                        </div>
                        <div className="avlt-emp-doc-info">
                          <div className="avlt-emp-doc-name">{doc.docName}</div>
                          <span className={`avlt-status-badge ${st.cls}`} style={{ fontSize: '0.6rem' }}>{statusLabel(st.key)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {!doc.isSigned && (
                            <button
                              className="avlt-btn-sign-sm"
                              onClick={() => navigate(`/dashboard/sign-document?id=${doc.id}`)}
                              title={t('adminVault.tooltip.signShort')}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>draw</span>
                            </button>
                          )}
                          <IconButton size="small" onClick={() => handleDownload(doc)}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0040a1' }}>download</span>
                          </IconButton>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="avlt-emp-card-footer">
                  <div className="avlt-emp-progress-bar">
                    <div
                      className="avlt-emp-progress-fill"
                      style={{ width: `${docs.length ? (empSigned / docs.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="avlt-emp-progress-label">{t('adminVault.grid.signedRatio', { signed: empSigned, total: docs.length })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default AdminVaultModern;
