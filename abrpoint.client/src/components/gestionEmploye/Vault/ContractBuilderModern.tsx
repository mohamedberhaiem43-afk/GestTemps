import { useState, useEffect, useMemo, useRef } from 'react';
import { CircularProgress, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box,
  Snackbar, Alert, Autocomplete, Select, MenuItem, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import apiInstance from '../../API/apiInstance';
import { useAuth } from '../../helper/AuthProvider';
import { sanitizeRichHtml } from '../../helper/sanitizeHtml';
import useGetEmployee from '../../../hooks/employeHooks/useGetEmployee';
import './ContractBuilder.css';

type VarCategory = 'Employer' | 'Employee' | 'Job' | 'Dates' | 'Congé' | 'Signature';
type VarLabelKey =
  | 'companyName' | 'headOfficeAddress' | 'companyPhone' | 'companyFax' | 'companyEmail' | 'manager' | 'logo'
  | 'employeeName' | 'matricule' | 'cin' | 'birthDate' | 'birthPlace' | 'address' | 'phone' | 'email' | 'gender'
  | 'function' | 'functionLabel' | 'qualification' | 'hireDate' | 'exitDate' | 'baseSalary' | 'grossSalary' | 'contractType' | 'site' | 'direction'
  | 'currentDate' | 'todayDate' | 'city'
  | 'leaveDays' | 'leaveStart' | 'leaveEnd' | 'referencePeriod'
  | 'employeeSignature' | 'companySignature';

interface TemplateFile {
  name: string;
  size: number;
  lastModified: string;
  /**
   * Catégorie canonique fournie par /api/Templates (cf. TemplatesController.InferCategory).
   * Permet à la fiche collaborateur de regrouper les modèles par type (Contrat,
   * Attestation, Demande de congé...). Optional pour les templates legacy.
   */
  category?: string;
}

/**
 * Catalogue figé miroir du backend (TemplatesController.TemplateCategories).
 * Source de vérité : l'endpoint /api/Templates/categories — on copie ici la liste
 * pour pouvoir afficher le sélecteur sans round-trip, mais on doit garder les deux
 * synchronisés à chaque ajout de catégorie.
 */
const TEMPLATE_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'Contrat',            label: 'Contrat de travail' },
  { key: 'AttestationTravail', label: 'Attestation de travail' },
  { key: 'AttestationSalaire', label: 'Attestation de salaire' },
  { key: 'DemandeConge',       label: 'Demande de congé' },
  { key: 'TitreConge',         label: 'Titre de congé' },
  { key: 'AutorisationSortie', label: 'Autorisation de sortie' },
  { key: 'VisiteMedicale',     label: 'Visite médicale' },
  { key: 'Allaitement',        label: 'Allaitement' },
  { key: 'Autre',              label: 'Autre' },
];

const ContractBuilderModern = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [selectedTpl, setSelectedTpl] = useState<string | null>(null);
  const [content, setContent] = useState<string>('<h1>CONTRAT DE TRAVAIL</h1><p>Entre les soussignés...</p>');
  const [_loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [openNewTpl, setOpenNewTpl] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  // Catégorie sélectionnée lors de la création (la « nomenclature » imposée :
  // chaque template est obligatoirement préfixé par une catégorie canonique).
  const [newTplCategory, setNewTplCategory] = useState<string>('Contrat');
  const [newTplError, setNewTplError] = useState<string | null>(null);
  const [openRenameTpl, setOpenRenameTpl] = useState(false);
  const [renameTplName, setRenameTplName] = useState('');
  const [renameTplOriginal, setRenameTplOriginal] = useState('');
  const [_contextMenu, setContextMenu] = useState<{name: string, x: number, y: number} | null>(null);
  const [importing, setImporting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  /* ── AI Assistant States ── */
  const [openAi, setOpenAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiExampleFile, setAiExampleFile] = useState<File | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  /* ── Snackbar (remplace les alert() bruts) ── */
  const [snackbar, setSnackbar] = useState<{ open: boolean; severity: 'success' | 'error' | 'info'; message: string }>({
    open: false, severity: 'info', message: ''
  });
  const showSnack = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnackbar({ open: true, severity, message });

  /* ── Recherche dans la liste de modèles ── */
  const [searchQuery, setSearchQuery] = useState('');

  /* ── Insertion tableau (remplace les prompt() bruts) ── */
  const [openInsertTable, setOpenInsertTable] = useState(false);
  const [tableRows, setTableRows] = useState<number>(3);
  const [tableCols, setTableCols] = useState<number>(3);

  /* ── Export pour un employé spécifique ── */
  const { soccod, uticod } = useAuth();
  const { data: empMap } = useGetEmployee();
  const employeeOptions = useMemo(() => {
    if (!empMap || typeof empMap !== 'object') return [] as Array<{ code: string; lib: string }>;
    return Object.entries(empMap as Record<string, string>).map(([code, lib]) => ({ code, lib }));
  }, [empMap]);
  const [openExport, setOpenExport] = useState(false);
  const [exportEmpcod, setExportEmpcod] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);

  /* ── Fullscreen App Sidebar Hide ── */
  useEffect(() => {
    document.body.classList.add('hide-app-sidebar');
    return () => { document.body.classList.remove('hide-app-sidebar'); };
  }, []);

  const VARS: { labelKey: VarLabelKey; tag: string; cat: VarCategory }[] = [
    { labelKey: 'companyName', tag: '[Table.soclib]', cat: 'Employer' },
    { labelKey: 'headOfficeAddress', tag: '[Table.socadr]', cat: 'Employer' },
    { labelKey: 'companyPhone', tag: '[Table.soctel]', cat: 'Employer' },
    { labelKey: 'companyFax', tag: '[Table.socfax]', cat: 'Employer' },
    { labelKey: 'companyEmail', tag: '[Table.socemail]', cat: 'Employer' },
    { labelKey: 'manager', tag: '[Table.socresp]', cat: 'Employer' },
    { labelKey: 'logo', tag: '[Logo_Entreprise]', cat: 'Employer' },
    { labelKey: 'employeeName', tag: '[Table.emplib]', cat: 'Employee' },
    { labelKey: 'matricule', tag: '[Table.empmat]', cat: 'Employee' },
    { labelKey: 'cin', tag: '[Table.empcin]', cat: 'Employee' },
    { labelKey: 'birthDate', tag: '[Table.empdnais]', cat: 'Employee' },
    { labelKey: 'birthPlace', tag: '[Table.emplnais]', cat: 'Employee' },
    { labelKey: 'address', tag: '[Table.empadr]', cat: 'Employee' },
    { labelKey: 'phone', tag: '[Table.emptel]', cat: 'Employee' },
    { labelKey: 'email', tag: '[Table.empemail]', cat: 'Employee' },
    { labelKey: 'gender', tag: '[Table.empsexe]', cat: 'Employee' },
    { labelKey: 'function', tag: '[Table.empfonc]', cat: 'Job' },
    { labelKey: 'functionLabel', tag: '[Table.fonclib]', cat: 'Job' },
    { labelKey: 'qualification', tag: '[Table.quallib]', cat: 'Job' },
    { labelKey: 'hireDate', tag: '[Table.empemb]', cat: 'Job' },
    { labelKey: 'exitDate', tag: '[Table.empsort]', cat: 'Job' },
    { labelKey: 'baseSalary', tag: '[Table.empsbase]', cat: 'Job' },
    { labelKey: 'grossSalary', tag: '[Table.empsbrut]', cat: 'Job' },
    { labelKey: 'contractType', tag: '[Table.empcontrat]', cat: 'Job' },
    { labelKey: 'site', tag: '[Table.sitlib]', cat: 'Job' },
    { labelKey: 'direction', tag: '[Table.dirlib]', cat: 'Job' },
    { labelKey: 'currentDate', tag: '[Date_Actuelle]', cat: 'Dates' },
    { labelKey: 'todayDate', tag: '[Date_du_jour]', cat: 'Dates' },
    { labelKey: 'city', tag: '[Ville]', cat: 'Dates' },
    { labelKey: 'leaveDays', tag: '[Nombre_de_jours]', cat: 'Congé' },
    { labelKey: 'leaveStart', tag: '[Date_debut_conge]', cat: 'Congé' },
    { labelKey: 'leaveEnd', tag: '[Date_fin_conge]', cat: 'Congé' },
    { labelKey: 'referencePeriod', tag: '[Periode_de_reference]', cat: 'Congé' },
    { labelKey: 'employeeSignature', tag: '{{Signature_Employe}}', cat: 'Signature' },
    { labelKey: 'companySignature', tag: '{{Signature_Entreprise}}', cat: 'Signature' },
  ];

  /* ── Fetch ── */
  const fetchTemplates = async () => {
    try {
      const res = await apiInstance.get('/Templates');
      setTemplates(res.data);
      if (res.data.length > 0 && !selectedTpl) {
        handleSelect(res.data[0].name);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleSelect = async (name: string) => {
    setSelectedTpl(name);
    setLoading(true);
    try {
      // Bug fix : les noms de modèles peuvent contenir espaces / accents / parenthèses.
      // Sans encodeURIComponent, la requête échoue avec 404 ou 400.
      const res = await apiInstance.get(`/Templates/${encodeURIComponent(name)}`);
      const safe = sanitizeRichHtml(res.data.content);
      setContent(safe);
      if (editorRef.current) editorRef.current.innerHTML = safe;
    } catch (err) {
      setContent('<h1>Error</h1>');
      showSnack(t('contractBuilder.snack.loadTemplateError', { name }), 'error');
    }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!selectedTpl) return;
    setSaving(true);
    const htmlContent = editorRef.current ? editorRef.current.innerHTML : content;
    try {
      await apiInstance.put(`/Templates/${encodeURIComponent(selectedTpl)}`, { content: htmlContent });
      showSnack(t('contractBuilder.snack.savedSuccess'), 'success');
      fetchTemplates();
    } catch (err: any) {
      showSnack(err?.response?.data?.message || t('contractBuilder.snack.saveError'), 'error');
    }
    finally { setSaving(false); }
  };

  const exec = (cmd: string, val: string | undefined = undefined) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  const insertVariable = (tag: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const isSignature = tag.includes('Signature');
    const colorClass = isSignature ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200';
    const html = `<span class="${colorClass} px-2 py-0.5 rounded font-bold text-xs inline-flex items-center gap-1 mx-1 shadow-sm" contenteditable="false" data-tag="${tag}">${tag}</span>&nbsp;`;
    document.execCommand('insertHTML', false, html);
    setContent(editorRef.current.innerHTML);
  };

  const insertTable = () => setOpenInsertTable(true);
  const confirmInsertTable = () => {
    const r = Math.max(1, Math.min(20, Math.floor(tableRows)));
    const c = Math.max(1, Math.min(20, Math.floor(tableCols)));
    let tableHtml = '<table style="width:100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e2e8f0;">';
    for (let i = 0; i < r; i++) {
      tableHtml += '<tr>';
      for (let j = 0; j < c; j++) {
        tableHtml += `<td style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">${t('contractBuilder.table.cellContent')}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</table><p><br></p>';
    exec('insertHTML', tableHtml);
    setOpenInsertTable(false);
  };

  const onDragStart = (e: React.DragEvent, tag: string) => {
    e.dataTransfer.setData("text/plain", tag);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const tag = e.dataTransfer.getData("text/plain");
    if (tag && editorRef.current) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) {
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            insertVariable(tag);
        }
    }
  };

  /**
   * Aperçu rapide : génère le PDF avec l'utilisateur courant comme employé cible
   * (utile pour un manager qui veut juste voir la mise en page). Pour un export
   * destiné à un autre employé, voir handleExportForEmployee ci-dessous.
   *
   * Bug fixé : les anciennes versions hardcodaient `soccod=01&empcod=001091`,
   * ce qui plantait sur tout tenant qui n'avait pas exactement cet empcod.
   */
  const handlePreview = async () => {
    if (!selectedTpl) {
      // Avant : return silencieux → l'utilisateur cliquait sur « Aperçu PDF »
      // et rien ne se passait visuellement, ce qui faisait croire que le bouton
      // était cassé. On notifie maintenant qu'un modèle doit être sélectionné.
      showSnack(t('contractBuilder.snack.selectTemplateExport') || 'Sélectionnez un modèle dans la liste avant de lancer l\'aperçu.', 'error');
      return;
    }
    if (!soccod || !uticod) {
      showSnack(t('contractBuilder.snack.sessionExpiredPreview'), 'error');
      return;
    }
    try {
      const res = await apiInstance.get(
        `/Templates/preview/${encodeURIComponent(selectedTpl)}`,
        { params: { soccod, empcod: uticod }, responseType: 'blob' }
      );
      setPreviewUrl(URL.createObjectURL(res.data));
    } catch (err: any) {
      showSnack(err?.response?.data?.message || t('contractBuilder.snack.previewError'), 'error');
    }
  };

  /**
   * Export PDF d'un modèle pour un EMPLOYÉ spécifique (sélectionné via l'autocomplete
   * du dialog) — déclenche un téléchargement direct en plus d'afficher l'aperçu.
   */
  const handleExportForEmployee = async () => {
    if (!selectedTpl) { showSnack(t('contractBuilder.snack.selectTemplateExport'), 'error'); return; }
    if (!exportEmpcod) { showSnack(t('contractBuilder.snack.selectEmployeeExport'), 'error'); return; }
    if (!soccod) { showSnack(t('contractBuilder.snack.sessionExpired'), 'error'); return; }
    setExporting(true);
    try {
      const res = await apiInstance.get(
        `/Templates/preview/${encodeURIComponent(selectedTpl)}`,
        { params: { soccod, empcod: exportEmpcod }, responseType: 'blob' }
      );
      // Télécharger le PDF directement.
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanTpl = selectedTpl.replace(/\.(html|frx)$/i, '');
      const empLib = (employeeOptions.find(o => o.code === exportEmpcod)?.lib || exportEmpcod).replace(/[^a-zA-Z0-9_-]+/g, '_');
      link.download = `${cleanTpl}_${empLib}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showSnack(t('contractBuilder.snack.exported'), 'success');
      setOpenExport(false);
    } catch (err: any) {
      // L'API renvoie le message dans le blob — on le décode pour afficher la cause.
      let msg = t('contractBuilder.snack.exportError');
      if (err?.response?.data instanceof Blob) {
        try { msg = JSON.parse(await err.response.data.text())?.message || msg; } catch { /* ignore */ }
      }
      showSnack(msg, 'error');
    } finally {
      setExporting(false);
    }
  };

  /* ── AI Assistant Function ── */
  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setAiLoading(true);
    const formData = new FormData();
    formData.append('prompt', aiPrompt);
    if (aiExampleFile) formData.append('exampleFile', aiExampleFile);

    try {
      const res = await apiInstance.post('/Ai/generate-template', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAiResult(res.data.html);
    } catch (err: any) {
      showSnack(t('contractBuilder.ai.generationFailed', { error: err.response?.data || err.message }), 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiResult = () => {
    if (!aiResult) return;
    const safe = sanitizeRichHtml(aiResult);
    if (editorRef.current) {
        editorRef.current.innerHTML = safe;
        setContent(safe);
    }
    setOpenAi(false);
    setAiResult(null);
    setAiPrompt('');
    setAiExampleFile(null);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(t('contractBuilder.snack.deleteConfirm', { name }))) return;
    try {
      await apiInstance.delete(`/Templates/${encodeURIComponent(name)}`);
      if (selectedTpl === name) { setSelectedTpl(null); setContent(''); }
      fetchTemplates();
      showSnack(t('contractBuilder.snack.deleted'), 'success');
    } catch (err: any) {
      showSnack(err?.response?.data?.message || t('contractBuilder.snack.deleteError'), 'error');
    }
  };

  const handleRename = async () => {
    if (!renameTplName.trim()) return;
    try {
      const res = await apiInstance.put(`/Templates/rename/${encodeURIComponent(renameTplOriginal)}`, { newName: renameTplName });
      if (selectedTpl === renameTplOriginal) setSelectedTpl(res.data.newName);
      setOpenRenameTpl(false);
      fetchTemplates();
    } catch (err: any) { showSnack(err.response?.data?.message || t('contractBuilder.rename.error'), 'error'); }
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiInstance.post('/Templates/import-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (editorRef.current) {
        // Comportement « import = remplacer » (et non plus « append »). L'ancien
        // `innerHTML +=` fusionnait l'import avec le contenu existant — quand on
        // importait un PDF par-dessus un modèle déjà rédigé on obtenait deux
        // contrats empilés sans séparateur. Si l'éditeur n'est pas vide on
        // demande confirmation avant d'écraser. Pas de wrapping <div> autour de
        // l'import : le sélecteur Tailwind .prose ne stylise QUE ses enfants
        // directs (> p, > h1…) — entourer les <p> dans un <div> perdrait les
        // marges entre paragraphes et donnerait un bloc compact illisible.
        const imported = sanitizeRichHtml(res.data.text || '');
        const existing = editorRef.current.innerHTML.replace(/<br\s*\/?>(\s|&nbsp;)*/gi, '').trim();
        const editorHasContent = existing.length > 0 && existing !== '<p><br></p>';
        if (editorHasContent && !window.confirm(t('contractBuilder.import.confirmReplace') || 'Le modèle actuel sera remplacé par le contenu du PDF. Continuer ?')) {
          return;
        }
        editorRef.current.innerHTML = imported;
        setContent(editorRef.current.innerHTML);
      }
    } catch (err: any) {
       showSnack(err.response?.data || t('contractBuilder.snack.importFailed'), 'error');
    } finally {
      setImporting(false);
      // Reset l'input pour que ré-importer le MÊME fichier déclenche bien
      // l'onChange (sinon le navigateur le considère inchangé).
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="cb-shell flex flex-col h-screen bg-slate-50 overflow-hidden font-inter text-slate-900 border-l border-slate-200">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 flex justify-between items-center px-6 py-3 z-50 shrink-0 shadow-sm">
        <div className="flex items-center gap-6">
          <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} size="small" className="text-slate-600">
             <span className="material-symbols-outlined">{isSidebarOpen ? 'menu_open' : 'menu'}</span>
          </IconButton>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-sm">contract</span>
             </div>
             <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t('contractBuilder.header.title')}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <Button 
             variant="outlined" 
             onClick={() => setOpenAi(true)}
             startIcon={<span className="material-symbols-outlined text-[16px]">auto_awesome</span>}
             className="rounded-xl font-bold border-purple-200 text-purple-700 hover:bg-purple-50"
             size="small"
           >
             {t('contractBuilder.header.aiAssistant')}
           </Button>

           <div className="w-px h-6 bg-slate-200 mx-2" />

           {importing ? <CircularProgress size={20} className="mr-8" /> : (
              <Button onClick={() => fileInputRef.current?.click()} size="small" color="inherit" className="font-bold text-slate-600">
                <span className="material-symbols-outlined mr-2 text-sm">upload_file</span> {t('contractBuilder.header.import')}
              </Button>
           )}
           <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handlePdfImport} />
           
           <Button variant="outlined" color="primary" onClick={() => setOpenNewTpl(true)} size="small" className="rounded-xl font-bold border-slate-200 text-slate-700">
              <span className="material-symbols-outlined mr-2 text-sm">add</span> {t('contractBuilder.header.new')}
           </Button>

           <Button
             variant="outlined"
             onClick={() => {
               if (!selectedTpl) { showSnack(t('contractBuilder.snack.selectBeforeExport'), 'error'); return; }
               setExportEmpcod('');
               setOpenExport(true);
             }}
             startIcon={<span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>}
             className="rounded-xl font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50"
             size="small"
           >
             {t('contractBuilder.header.exportForEmployee')}
           </Button>

           <Button variant="contained" onClick={handleSave} disabled={saving} size="small" className="rounded-xl px-6 font-bold shadow-lg shadow-blue-100 bg-blue-700">
             {saving ? t('contractBuilder.header.saving') : t('contractBuilder.header.save')}
           </Button>
        </div>
      </header>

      <div className="cb-body flex flex-1 overflow-hidden">
        {/* ── Left Sidebar (List) ── */}
        {isSidebarOpen && (
          <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-100">
               <div className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-4">{t('contractBuilder.sidebar.library')}</div>
               <TextField
                 placeholder={t('contractBuilder.sidebar.searchPlaceholder')}
                 size="small" fullWidth
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 InputProps={{
                   startAdornment: <span className="material-symbols-outlined text-slate-400 text-sm mr-2">search</span>,
                   className: 'text-sm bg-slate-50 rounded-xl border-none outline-none'
                 }}
               />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {templates
                .filter(tpl => !searchQuery || tpl.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(tpl => (
                 <div
                   key={tpl.name}
                   onClick={() => handleSelect(tpl.name)}
                   onContextMenu={(e) => { e.preventDefault(); setContextMenu({name: tpl.name, x: e.clientX, y: e.clientY}); }}
                   className={`group px-4 py-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${selectedTpl === tpl.name ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                 >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`material-symbols-outlined ${selectedTpl === tpl.name ? 'text-white' : 'text-slate-300'}`}>description</span>
                      <span className="text-sm truncate flex-1">{tpl.name}</span>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setRenameTplOriginal(tpl.name); setRenameTplName(tpl.name.replace('.html','')); setOpenRenameTpl(true); }} className={selectedTpl === tpl.name ? 'text-white hover:text-blue-200' : 'text-slate-400 hover:text-blue-600'}>
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </IconButton>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(tpl.name); }} className={selectedTpl === tpl.name ? 'text-white hover:text-red-200' : 'text-slate-400 hover:text-red-600'}>
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </IconButton>
                    </div>
                 </div>
               ))}
            </div>
          </aside>
        )}

        {/* ── Main Canvas ── */}
        <main className="flex-1 bg-slate-50 overflow-y-auto p-12 flex flex-col items-center">
           {/* Floating Toolbar
               flex-wrap : les 6 groupes de boutons + le CTA « Aperçu PDF » dépassent
               max-w-4xl dès que la sidebar Variables est ouverte → sans wrap le bouton
               le plus à droite (Aperçu) sortait du conteneur et était inaccessible.
               shrink-0 sur chaque groupe garantit qu'aucun ne se compresse en dessous
               de sa taille naturelle (Material IconButtons n'ont pas de min-width). */}
           <div className="w-full max-w-4xl bg-white p-2.5 rounded-2xl shadow-xl border border-slate-200 mb-8 flex flex-wrap items-center gap-y-2 gap-x-2 sticky top-0 z-40">
              <div className="flex shrink-0 gap-0.5 border-r border-slate-100 pr-2">
                 <IconButton size="small" onClick={() => exec('bold')}><span className="material-symbols-outlined text-sm">format_bold</span></IconButton>
                 <IconButton size="small" onClick={() => exec('italic')}><span className="material-symbols-outlined text-sm">format_italic</span></IconButton>
                 <IconButton size="small" onClick={() => exec('underline')}><span className="material-symbols-outlined text-sm">format_underlined</span></IconButton>
              </div>
              <div className="flex shrink-0 gap-0.5 border-r border-slate-100 pr-2">
                 <IconButton size="small" onClick={() => exec('justifyLeft')}><span className="material-symbols-outlined text-sm">format_align_left</span></IconButton>
                 <IconButton size="small" onClick={() => exec('justifyCenter')}><span className="material-symbols-outlined text-sm">format_align_center</span></IconButton>
                 <IconButton size="small" onClick={() => exec('justifyRight')}><span className="material-symbols-outlined text-sm">format_align_right</span></IconButton>
              </div>
              <div className="flex shrink-0 gap-0.5 border-r border-slate-100 pr-2">
                 <IconButton size="small" onClick={() => exec('insertHorizontalRule')}><span className="material-symbols-outlined text-sm">horizontal_rule</span></IconButton>
                 <IconButton size="small" onClick={insertTable}><span className="material-symbols-outlined text-sm">table_chart</span></IconButton>
              </div>
              <div className="flex shrink-0 gap-0.5 border-r border-slate-100 pr-2">
                 <IconButton size="small" onClick={() => exec('insertHTML', '<header><p>[Logo_Entreprise]</p><p><b>[Table.soclib]</b></p><p>[Table.socadr]</p></header><br>')} title={t('contractBuilder.toolbar.insertHeader')}><span className="material-symbols-outlined text-sm">vertical_align_top</span></IconButton>
                 <IconButton size="small" onClick={() => exec('insertHTML', '<br><footer><p><i>[Table.soclib] — [Table.socadr]</i></p></footer>')} title={t('contractBuilder.toolbar.insertFooter')}><span className="material-symbols-outlined text-sm">vertical_align_bottom</span></IconButton>
              </div>
              <div className="flex shrink-0 gap-1 border-r border-slate-100 pr-2 items-center">
                 <select className="text-[11px] font-bold bg-slate-50 rounded-lg px-2 py-1 border-none outline-none" onChange={(e) => exec('fontSize', e.target.value)}>
                    <option value="3">{t('contractBuilder.toolbar.fontNormal')}</option>
                    <option value="5">{t('contractBuilder.toolbar.fontLarge')}</option>
                    <option value="1">{t('contractBuilder.toolbar.fontSmall')}</option>
                 </select>
              </div>
              {/* ml-auto pousse à droite quand il reste de la place sur la ligne ;
                  sinon (cas wrap) le bouton retombe sur la 2e ligne, toujours visible
                  et cliquable. variant="contained" pour le rendre plus repérable
                  visuellement vs les icônes de formatage. */}
              <div className="ml-auto shrink-0">
                 <Button
                   size="small"
                   variant="contained"
                   onClick={handlePreview}
                   startIcon={<span className="material-symbols-outlined text-[16px]">visibility</span>}
                   className="font-bold normal-case whitespace-nowrap bg-blue-700 hover:bg-blue-800 shadow-sm"
                 >
                   {t('contractBuilder.toolbar.previewPdf')}
                 </Button>
              </div>
           </div>

           {/* Paper Canvas */}
           <div className="w-full max-w-4xl bg-white shadow-2xl min-h-[1200px] p-24 relative rounded-sm border border-slate-200 transition-all">
              <div 
                ref={editorRef}
                className="cb-visual-editor-canvas outline-none prose prose-slate max-w-none text-slate-800"
                contentEditable
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content) }}
                onBlur={(e) => setContent(e.currentTarget.innerHTML)}
              />
           </div>
        </main>

        {/* ── Variables Sidebar (Right) ── */}
        <aside className="w-72 bg-white border-l border-slate-200 p-6 flex flex-col shrink-0">
           <div className="text-[10px] font-black text-slate-900 mb-6 uppercase tracking-widest flex items-center justify-between">
              {t('contractBuilder.variables.title')}
              <span className="material-symbols-outlined text-slate-300 text-sm">help_outline</span>
           </div>

           <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
              {(['Employer', 'Employee', 'Job', 'Dates', 'Congé', 'Signature'] as VarCategory[]).map(cat => (
                <div key={cat} className="space-y-2">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{t(`contractBuilder.variables.categories.${cat}`)}</div>
                   {VARS.filter(v => v.cat === cat).map(v => (
                     <div
                       key={v.tag}
                       draggable
                       onDragStart={(e) => onDragStart(e, v.tag)}
                       onClick={() => insertVariable(v.tag)}
                       className={`group flex items-center justify-between p-3.5 rounded-2xl border border-transparent shadow-sm cursor-grab ${cat === 'Signature' ? 'bg-amber-50 hover:border-amber-200' : 'bg-slate-50 hover:border-blue-200'}`}
                     >
                        <div className="flex flex-col">
                           <span className={`text-xs font-black ${cat === 'Signature' ? 'text-amber-800' : 'text-slate-700'}`}>{t(`contractBuilder.variables.labels.${v.labelKey}`)}</span>
                           <span className="text-[9px] font-mono text-slate-400 mt-0.5">{v.tag}</span>
                        </div>
                        <span className="material-symbols-outlined text-slate-300 group-hover:text-blue-600 transition-colors scale-75 group-hover:scale-100">drag_indicator</span>
                     </div>
                   ))}
                </div>
              ))}
           </div>
        </aside>
      </div>

      {/* ── AI Assistant Dialog ── */}
      <Dialog open={openAi} onClose={() => !aiLoading && setOpenAi(false)} PaperProps={{ className: 'rounded-3xl p-4 max-w-2xl w-full' }}>
         <DialogTitle className="flex items-center gap-3">
             <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-purple-700">auto_awesome</span>
             </div>
             <div>
                <div className="text-lg font-black text-slate-900">{t('contractBuilder.ai.title')}</div>
                <div className="text-xs text-slate-400 font-medium">{t('contractBuilder.ai.subtitle')}</div>
             </div>
         </DialogTitle>
         <DialogContent className="space-y-6 mt-4">
            <TextField
              label={t('contractBuilder.ai.describeLabel')}
              multiline rows={4} fullWidth variant="outlined"
              value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              placeholder={t('contractBuilder.ai.describePlaceholder')}
              InputProps={{ className: 'rounded-2xl bg-slate-50' }}
            />

            <Box className="p-4 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <span className="material-symbols-outlined text-slate-400">upload_file</span>
                   <div>
                      <div className="text-sm font-bold text-slate-700">{aiExampleFile ? aiExampleFile.name : t('contractBuilder.ai.exampleFile')}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{t('contractBuilder.ai.exampleHint')}</div>
                   </div>
                </div>
                <Button size="small" onClick={() => aiFileRef.current?.click()} className="text-blue-600 font-black">
                   {aiExampleFile ? t('contractBuilder.ai.change') : t('contractBuilder.ai.browsePdf')}
                </Button>
                <input type="file" ref={aiFileRef} className="hidden" accept=".pdf" onChange={e => setAiExampleFile(e.target.files?.[0] || null)} />
            </Box>

            {aiResult && (
                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl">
                   <div className="text-xs font-black text-green-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <span className="material-symbols-outlined text-sm">check_circle</span>
                       {t('contractBuilder.ai.draftSuccess')}
                   </div>
                   <div className="text-[10px] text-green-600 font-medium">{t('contractBuilder.ai.draftSuccessHint')}</div>
                </div>
            )}
         </DialogContent>
         <DialogActions className="p-4">
            <Button onClick={() => setOpenAi(false)} disabled={aiLoading} color="inherit">{t('contractBuilder.ai.cancel')}</Button>
            {aiResult ? (
                <Button onClick={applyAiResult} variant="contained" className="bg-green-700 rounded-xl px-6 font-bold">{t('contractBuilder.ai.applyToEditor')}</Button>
            ) : (
                <Button
                    onClick={handleAiGenerate}
                    disabled={aiLoading || !aiPrompt}
                    variant="contained"
                    className="bg-purple-700 rounded-xl px-6 font-bold"
                    startIcon={aiLoading ? <CircularProgress size={16} color="inherit" /> : <span className="material-symbols-outlined text-sm">magic_button</span>}
                >
                    {aiLoading ? t('contractBuilder.ai.generating') : t('contractBuilder.ai.magicBuild')}
                </Button>
            )}
         </DialogActions>
      </Dialog>

      <Dialog open={openNewTpl} onClose={() => setOpenNewTpl(false)} PaperProps={{ className: 'rounded-3xl p-4', sx: { minWidth: 420 } }}>
        <DialogTitle className="font-black text-slate-900">{t('contractBuilder.newTemplate.title')}</DialogTitle>
        <DialogContent>
          {/* Nomenclature imposée : l'utilisateur doit d'abord choisir une catégorie
              (Contrat / Attestation / Demande de congé / ...). Le backend rejette
              toute création hors catalogue → le nom final est `<Catégorie>_<suffixe>.html`,
              ce qui permet à la fiche collaborateur d'identifier le type instantanément. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Type de document
              </Typography>
              <Select
                fullWidth size="small"
                value={newTplCategory}
                onChange={(e) => setNewTplCategory(e.target.value)}
                sx={{ mt: 0.5, borderRadius: '10px', bgcolor: '#fff' }}
              >
                {TEMPLATE_CATEGORIES.map(c => (
                  <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>
                ))}
              </Select>
            </Box>
            <TextField
              label="Suffixe (optionnel)"
              helperText={`Le fichier sera nommé "${newTplCategory}${newTplName.trim() ? '_' + newTplName.trim().replace(/[^\p{L}\p{N}_\- ]/gu, '').trim() : ''}.html". Laissez vide si vous n'avez qu'un seul modèle pour cette catégorie.`}
              fullWidth variant="standard"
              value={newTplName}
              onChange={(e) => { setNewTplName(e.target.value); setNewTplError(null); }}
              placeholder="ex: CDI, CDD, Cadre…"
            />
            {newTplError && (
              <Alert severity="error" sx={{ borderRadius: '10px' }}>{newTplError}</Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenNewTpl(false); setNewTplError(null); }} color="inherit">{t('contractBuilder.newTemplate.cancel')}</Button>
          <Button onClick={async () => {
            try {
              setNewTplError(null);
              await apiInstance.post('/Templates', { category: newTplCategory, name: newTplName });
              setOpenNewTpl(false);
              setNewTplName('');
              setNewTplCategory('Contrat');
              fetchTemplates();
            } catch(e: any) {
              setNewTplError(e?.response?.data?.message || 'Erreur lors de la création du modèle.');
            }
          }} variant="contained" className="bg-blue-700">{t('contractBuilder.newTemplate.create')}</Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={openRenameTpl} onClose={() => setOpenRenameTpl(false)} PaperProps={{ className: 'rounded-3xl p-4' }}>
        <DialogTitle className="font-black text-slate-900">{t('contractBuilder.rename.title')}</DialogTitle>
        <DialogContent>
           <TextField label={t('contractBuilder.rename.newName')} fullWidth variant="standard" value={renameTplName} onChange={(e) => setRenameTplName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRenameTpl(false)} color="inherit">{t('contractBuilder.rename.cancel')}</Button>
          <Button onClick={handleRename} variant="contained" className="bg-blue-700">{t('contractBuilder.rename.confirm')}</Button>
        </DialogActions>
      </Dialog>

      {/* Insert Table Dialog (remplace les prompt() bruts) */}
      <Dialog open={openInsertTable} onClose={() => setOpenInsertTable(false)} PaperProps={{ className: 'rounded-3xl p-4' }}>
        <DialogTitle className="font-black text-slate-900">{t('contractBuilder.insertTable.title')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField
              label={t('contractBuilder.insertTable.rows')} type="number" size="small"
              inputProps={{ min: 1, max: 20 }}
              value={tableRows}
              onChange={(e) => setTableRows(parseInt(e.target.value || '1', 10))}
            />
            <TextField
              label={t('contractBuilder.insertTable.cols')} type="number" size="small"
              inputProps={{ min: 1, max: 20 }}
              value={tableCols}
              onChange={(e) => setTableCols(parseInt(e.target.value || '1', 10))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInsertTable(false)} color="inherit">{t('contractBuilder.insertTable.cancel')}</Button>
          <Button onClick={confirmInsertTable} variant="contained" className="bg-blue-700">{t('contractBuilder.insertTable.confirm')}</Button>
        </DialogActions>
      </Dialog>

      {/* Export pour un employé spécifique */}
      <Dialog open={openExport} onClose={() => !exporting && setOpenExport(false)} PaperProps={{ className: 'rounded-3xl p-4 max-w-md w-full' }}>
        <DialogTitle className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-700">picture_as_pdf</span>
          </div>
          <div>
            <div className="text-lg font-black text-slate-900">{t('contractBuilder.export.title')}</div>
            <div className="text-xs text-slate-400 font-medium">
              {selectedTpl ? t('contractBuilder.export.templateLabel', { name: selectedTpl }) : t('contractBuilder.export.noTemplate')}
            </div>
          </div>
        </DialogTitle>
        <DialogContent className="space-y-4 mt-2">
          <Autocomplete
            size="small"
            options={employeeOptions}
            getOptionLabel={(o) => `${o.lib} (${o.code})`}
            isOptionEqualToValue={(a, b) => a.code === b.code}
            value={employeeOptions.find(o => o.code === exportEmpcod) || null}
            onChange={(_, val) => setExportEmpcod(val?.code || '')}
            renderInput={(params) => <TextField {...params} label={t('contractBuilder.export.targetEmployee')} placeholder={t('contractBuilder.export.searchPlaceholder')} />}
          />
          <Box className="text-[12px] text-slate-500 leading-relaxed">
            {t('contractBuilder.export.description')}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenExport(false)} color="inherit" disabled={exporting}>{t('contractBuilder.export.cancel')}</Button>
          <Button
            onClick={handleExportForEmployee}
            variant="contained"
            disabled={exporting || !exportEmpcod}
            startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <span className="material-symbols-outlined text-sm">download</span>}
            className="bg-emerald-700"
          >
            {exporting ? t('contractBuilder.export.exporting') : t('contractBuilder.export.exportPdf')}
          </Button>
        </DialogActions>
      </Dialog>

      {previewUrl && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-8 backdrop-blur-md" onClick={() => setPreviewUrl(null)}>
           <div className="bg-white w-full h-full max-w-6xl rounded-3xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <iframe src={previewUrl} className="flex-1 border-none" />
           </div>
        </div>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={4500} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default ContractBuilderModern;
