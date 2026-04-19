import { useState, useEffect, useRef } from 'react';
import { CircularProgress, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box } from '@mui/material';
import apiInstance from '../../API/apiInstance';
import './ContractBuilder.css';

interface TemplateFile {
  name: string;
  size: number;
  lastModified: string;
}

const ContractBuilderModern = () => {
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [selectedTpl, setSelectedTpl] = useState<string | null>(null);
  const [content, setContent] = useState<string>('<h1>CONTRAT DE TRAVAIL</h1><p>Entre les soussignés...</p>');
  const [_loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [openNewTpl, setOpenNewTpl] = useState(false);
  const [newTplName, setNewTplName] = useState('');
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

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);

  /* ── Fullscreen App Sidebar Hide ── */
  useEffect(() => {
    document.body.classList.add('hide-app-sidebar');
    return () => { document.body.classList.remove('hide-app-sidebar'); };
  }, []);

  const VARS = [
    { label: 'Nom Entreprise', tag: '[Table.soclib]', cat: 'Employer' },
    { label: 'Adresse Siège', tag: '[Table.socadr]', cat: 'Employer' },
    { label: 'Téléphone Soc.', tag: '[Table.soctel]', cat: 'Employer' },
    { label: 'Fax Soc.', tag: '[Table.socfax]', cat: 'Employer' },
    { label: 'Email Soc.', tag: '[Table.socemail]', cat: 'Employer' },
    { label: 'Responsable', tag: '[Table.socresp]', cat: 'Employer' },
    { label: 'Logo', tag: '[Logo_Entreprise]', cat: 'Employer' },
    { label: 'Nom Employé', tag: '[Table.emplib]', cat: 'Employee' },
    { label: 'Matricule', tag: '[Table.empmat]', cat: 'Employee' },
    { label: 'CIN', tag: '[Table.empcin]', cat: 'Employee' },
    { label: 'Date Naissance', tag: '[Table.empdnais]', cat: 'Employee' },
    { label: 'Lieu Naissance', tag: '[Table.emplnais]', cat: 'Employee' },
    { label: 'Adresse', tag: '[Table.empadr]', cat: 'Employee' },
    { label: 'Téléphone', tag: '[Table.emptel]', cat: 'Employee' },
    { label: 'Email', tag: '[Table.empemail]', cat: 'Employee' },
    { label: 'Sexe', tag: '[Table.empsexe]', cat: 'Employee' },
    { label: 'Fonction', tag: '[Table.empfonc]', cat: 'Job' },
    { label: 'Libellé Fonction', tag: '[Table.fonclib]', cat: 'Job' },
    { label: 'Qualification', tag: '[Table.quallib]', cat: 'Job' },
    { label: 'Date Embauche', tag: '[Table.empemb]', cat: 'Job' },
    { label: 'Date Sortie', tag: '[Table.empsort]', cat: 'Job' },
    { label: 'Salaire Base', tag: '[Table.empsbase]', cat: 'Job' },
    { label: 'Salaire Brut', tag: '[Table.empsbrut]', cat: 'Job' },
    { label: 'Type Contrat', tag: '[Table.empcontrat]', cat: 'Job' },
    { label: 'Site', tag: '[Table.sitlib]', cat: 'Job' },
    { label: 'Direction', tag: '[Table.dirlib]', cat: 'Job' },
    { label: 'Date Actuelle', tag: '[Date_Actuelle]', cat: 'Dates' },
    { label: 'Date du Jour', tag: '[Date_du_jour]', cat: 'Dates' },
    { label: 'Ville', tag: '[Ville]', cat: 'Dates' },
    { label: 'Nb Jours Congé', tag: '[Nombre_de_jours]', cat: 'Congé' },
    { label: 'Date Début Congé', tag: '[Date_debut_conge]', cat: 'Congé' },
    { label: 'Date Fin Congé', tag: '[Date_fin_conge]', cat: 'Congé' },
    { label: 'Période Référence', tag: '[Periode_de_reference]', cat: 'Congé' },
    { label: 'Signature Employé', tag: '{{Signature_Employe}}', cat: 'Signature' },
    { label: 'Signature Entreprise', tag: '{{Signature_Entreprise}}', cat: 'Signature' },
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
      const res = await apiInstance.get(`/Templates/${name}`);
      setContent(res.data.content);
      if (editorRef.current) editorRef.current.innerHTML = res.data.content;
    } catch (err) { setContent('<h1>Error</h1>'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!selectedTpl) return;
    setSaving(true);
    const htmlContent = editorRef.current ? editorRef.current.innerHTML : content;
    try {
      await apiInstance.put(`/Templates/${selectedTpl}`, { content: htmlContent });
      alert("Modèle enregistré !");
      fetchTemplates();
    } catch (err) { console.error(err); }
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

  const insertTable = () => {
    const rows = prompt("Nombre de lignes?", "3");
    const cols = prompt("Nombre de colonnes?", "3");
    if (!rows || !cols) return;
    let tableHtml = '<table style="width:100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e2e8f0;">';
    for(let i=0; i<parseInt(rows); i++) {
        tableHtml += '<tr>';
        for(let j=0; j<parseInt(cols); j++) {
            tableHtml += '<td style="border: 1px solid #e2e8f0; padding: 12px; text-align: left;">Contenu</td>';
        }
        tableHtml += '</tr>';
    }
    tableHtml += '</table><p><br></p>';
    exec('insertHTML', tableHtml);
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

  const handlePreview = async () => {
    if (!selectedTpl) return;
    try {
      const res = await apiInstance.get(`/Templates/preview/${selectedTpl}?soccod=01&empcod=001091`, { responseType: 'blob' });
      setPreviewUrl(URL.createObjectURL(res.data));
    } catch (err) { alert("Error rendering PDF"); }
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
      alert("AI Generation failed: " + (err.response?.data || err.message));
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiResult = () => {
    if (!aiResult) return;
    if (editorRef.current) {
        editorRef.current.innerHTML = aiResult;
        setContent(aiResult);
    }
    setOpenAi(false);
    setAiResult(null);
    setAiPrompt('');
    setAiExampleFile(null);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Supprimer le modèle "${name}" ?`)) return;
    try {
      await apiInstance.delete(`/Templates/${encodeURIComponent(name)}`);
      if (selectedTpl === name) { setSelectedTpl(null); setContent(''); }
      fetchTemplates();
    } catch (err) { console.error(err); alert("Erreur lors de la suppression"); }
  };

  const handleRename = async () => {
    if (!renameTplName.trim()) return;
    try {
      const res = await apiInstance.put(`/Templates/rename/${encodeURIComponent(renameTplOriginal)}`, { newName: renameTplName });
      if (selectedTpl === renameTplOriginal) setSelectedTpl(res.data.newName);
      setOpenRenameTpl(false);
      fetchTemplates();
    } catch (err: any) { alert(err.response?.data?.message || "Erreur lors du renommage"); }
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
         editorRef.current.innerHTML += res.data.text;
         setContent(editorRef.current.innerHTML);
      }
    } catch (err: any) {
       alert(err.response?.data || "Import failed");
    } finally { setImporting(false); }
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
             <h1 className="text-lg font-bold text-slate-900 tracking-tight">Contract Builder Pro</h1>
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
             AI Assistant
           </Button>

           <div className="w-px h-6 bg-slate-200 mx-2" />

           {importing ? <CircularProgress size={20} className="mr-8" /> : (
              <Button onClick={() => fileInputRef.current?.click()} size="small" color="inherit" className="font-bold text-slate-600">
                <span className="material-symbols-outlined mr-2 text-sm">upload_file</span> Import
              </Button>
           )}
           <input type="file" ref={fileInputRef} className="hidden" accept=".pdf" onChange={handlePdfImport} />
           
           <Button variant="outlined" color="primary" onClick={() => setOpenNewTpl(true)} size="small" className="rounded-xl font-bold border-slate-200 text-slate-700">
              <span className="material-symbols-outlined mr-2 text-sm">add</span> New
           </Button>
           
           <Button variant="contained" onClick={handleSave} disabled={saving} size="small" className="rounded-xl px-6 font-bold shadow-lg shadow-blue-100 bg-blue-700">
             {saving ? "Publishing..." : "Save Template"}
           </Button>
        </div>
      </header>

      <div className="cb-body flex flex-1 overflow-hidden">
        {/* ── Left Sidebar (List) ── */}
        {isSidebarOpen && (
          <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-100">
               <div className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-4">Library</div>
               <TextField 
                 placeholder="Search templates..." 
                 size="small" fullWidth 
                 InputProps={{ 
                   startAdornment: <span className="material-symbols-outlined text-slate-400 text-sm mr-2">search</span>,
                   className: 'text-sm bg-slate-50 rounded-xl border-none outline-none'
                 }} 
               />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {templates.map(t => (
                 <div 
                   key={t.name}
                   onClick={() => handleSelect(t.name)}
                   onContextMenu={(e) => { e.preventDefault(); setContextMenu({name: t.name, x: e.clientX, y: e.clientY}); }}
                   className={`group px-4 py-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${selectedTpl === t.name ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                 >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`material-symbols-outlined ${selectedTpl === t.name ? 'text-white' : 'text-slate-300'}`}>description</span>
                      <span className="text-sm truncate flex-1">{t.name}</span>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setRenameTplOriginal(t.name); setRenameTplName(t.name.replace('.html','')); setOpenRenameTpl(true); }} className={selectedTpl === t.name ? 'text-white hover:text-blue-200' : 'text-slate-400 hover:text-blue-600'}>
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </IconButton>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(t.name); }} className={selectedTpl === t.name ? 'text-white hover:text-red-200' : 'text-slate-400 hover:text-red-600'}>
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
           {/* Floating Toolbar */}
           <div className="w-full max-w-4xl bg-white p-2.5 rounded-2xl shadow-xl border border-slate-200 mb-8 flex items-center gap-2 sticky top-0 z-40">
              <div className="flex gap-0.5 border-r border-slate-100 pr-2">
                 <IconButton size="small" onClick={() => exec('bold')}><span className="material-symbols-outlined text-sm">format_bold</span></IconButton>
                 <IconButton size="small" onClick={() => exec('italic')}><span className="material-symbols-outlined text-sm">format_italic</span></IconButton>
                 <IconButton size="small" onClick={() => exec('underline')}><span className="material-symbols-outlined text-sm">format_underlined</span></IconButton>
              </div>
              <div className="flex gap-0.5 border-r border-slate-100 pr-2">
                 <IconButton size="small" onClick={() => exec('justifyLeft')}><span className="material-symbols-outlined text-sm">format_align_left</span></IconButton>
                 <IconButton size="small" onClick={() => exec('justifyCenter')}><span className="material-symbols-outlined text-sm">format_align_center</span></IconButton>
                 <IconButton size="small" onClick={() => exec('justifyRight')}><span className="material-symbols-outlined text-sm">format_align_right</span></IconButton>
              </div>
              <div className="flex gap-0.5 border-r border-slate-100 pr-2">
                 <IconButton size="small" onClick={() => exec('insertHorizontalRule')}><span className="material-symbols-outlined text-sm">horizontal_rule</span></IconButton>
                 <IconButton size="small" onClick={insertTable}><span className="material-symbols-outlined text-sm">table_chart</span></IconButton>
              </div>
              <div className="flex gap-0.5 border-r border-slate-100 pr-2">
                 <IconButton size="small" onClick={() => exec('insertHTML', '<header><p>[Logo_Entreprise]</p><p><b>[Table.soclib]</b></p><p>[Table.socadr]</p></header><br>')} title="Insérer En-tête"><span className="material-symbols-outlined text-sm">vertical_align_top</span></IconButton>
                 <IconButton size="small" onClick={() => exec('insertHTML', '<br><footer><p><i>[Table.soclib] — [Table.socadr]</i></p></footer>')} title="Insérer Pied de page"><span className="material-symbols-outlined text-sm">vertical_align_bottom</span></IconButton>
              </div>
              <div className="flex gap-1 border-r border-slate-100 pr-2 items-center">
                 <select className="text-[11px] font-bold bg-slate-50 rounded-lg px-2 py-1 border-none outline-none" onChange={(e) => exec('fontSize', e.target.value)}>
                    <option value="3">Normal</option>
                    <option value="5">Large</option>
                    <option value="1">Small</option>
                 </select>
              </div>
              <div className="ml-auto">
                 <Button size="small" onClick={handlePreview} startIcon={<span className="material-symbols-outlined text-[16px]">visibility</span>} className="text-slate-500 font-bold normal-case">Preview PDF</Button>
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
                dangerouslySetInnerHTML={{ __html: content }}
                onBlur={(e) => setContent(e.currentTarget.innerHTML)}
              />
           </div>
        </main>

        {/* ── Variables Sidebar (Right) ── */}
        <aside className="w-72 bg-white border-l border-slate-200 p-6 flex flex-col shrink-0">
           <div className="text-[10px] font-black text-slate-900 mb-6 uppercase tracking-widest flex items-center justify-between">
              Variables & Meta
              <span className="material-symbols-outlined text-slate-300 text-sm">help_outline</span>
           </div>
           
           <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
              {['Employer', 'Employee', 'Job', 'Dates', 'Congé', 'Signature'].map(cat => (
                <div key={cat} className="space-y-2">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{cat}</div>
                   {VARS.filter(v => v.cat === cat).map(v => (
                     <div 
                       key={v.tag} 
                       draggable 
                       onDragStart={(e) => onDragStart(e, v.tag)}
                       onClick={() => insertVariable(v.tag)}
                       className={`group flex items-center justify-between p-3.5 rounded-2xl border border-transparent shadow-sm cursor-grab ${cat === 'Signature' ? 'bg-amber-50 hover:border-amber-200' : 'bg-slate-50 hover:border-blue-200'}`}
                     >
                        <div className="flex flex-col">
                           <span className={`text-xs font-black ${cat === 'Signature' ? 'text-amber-800' : 'text-slate-700'}`}>{v.label}</span>
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
                <div className="text-lg font-black text-slate-900">AI Template Assistant</div>
                <div className="text-xs text-slate-400 font-medium">Auto-generate dynamic contracts using AI</div>
             </div>
         </DialogTitle>
         <DialogContent className="space-y-6 mt-4">
            <TextField 
              label="Describe the document you want to create..."
              multiline rows={4} fullWidth variant="outlined"
              value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              placeholder="Ex: Un contrat de travail CDI pour un ingénieur avec une clause de confidentialité et 3 mois de période d'essai."
              InputProps={{ className: 'rounded-2xl bg-slate-50' }}
            />

            <Box className="p-4 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <span className="material-symbols-outlined text-slate-400">upload_file</span>
                   <div>
                      <div className="text-sm font-bold text-slate-700">{aiExampleFile ? aiExampleFile.name : "Example Document (Optional)"}</div>
                      <div className="text-[10px] text-slate-400 font-medium">Used as a structure reference</div>
                   </div>
                </div>
                <Button size="small" onClick={() => aiFileRef.current?.click()} className="text-blue-600 font-black">
                   {aiExampleFile ? "Change" : "Browse PDF"}
                </Button>
                <input type="file" ref={aiFileRef} className="hidden" accept=".pdf" onChange={e => setAiExampleFile(e.target.files?.[0] || null)} />
            </Box>

            {aiResult && (
                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl">
                   <div className="text-xs font-black text-green-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <span className="material-symbols-outlined text-sm">check_circle</span>
                       Draft Generated Successfully!
                   </div>
                   <div className="text-[10px] text-green-600 font-medium">Review the editor after applying to see the full document.</div>
                </div>
            )}
         </DialogContent>
         <DialogActions className="p-4">
            <Button onClick={() => setOpenAi(false)} disabled={aiLoading} color="inherit">Cancel</Button>
            {aiResult ? (
                <Button onClick={applyAiResult} variant="contained" className="bg-green-700 rounded-xl px-6 font-bold">Apply to Editor</Button>
            ) : (
                <Button 
                    onClick={handleAiGenerate} 
                    disabled={aiLoading || !aiPrompt} 
                    variant="contained" 
                    className="bg-purple-700 rounded-xl px-6 font-bold"
                    startIcon={aiLoading ? <CircularProgress size={16} color="inherit" /> : <span className="material-symbols-outlined text-sm">magic_button</span>}
                >
                    {aiLoading ? "Generating..." : "Magic Build"}
                </Button>
            )}
         </DialogActions>
      </Dialog>

      <Dialog open={openNewTpl} onClose={() => setOpenNewTpl(false)} PaperProps={{ className: 'rounded-3xl p-4' }}>
        <DialogTitle className="font-black text-slate-900">New Template</DialogTitle>
        <DialogContent>
           <TextField label="Name" fullWidth variant="standard" value={newTplName} onChange={(e) => setNewTplName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewTpl(false)} color="inherit">Cancel</Button>
          <Button onClick={async () => {
            try {
              await apiInstance.post('/Templates', { name: newTplName });
              setOpenNewTpl(false);
              fetchTemplates();
            } catch(e) { console.error(e); }
          }} variant="contained" className="bg-blue-700">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={openRenameTpl} onClose={() => setOpenRenameTpl(false)} PaperProps={{ className: 'rounded-3xl p-4' }}>
        <DialogTitle className="font-black text-slate-900">Renommer le modèle</DialogTitle>
        <DialogContent>
           <TextField label="Nouveau nom" fullWidth variant="standard" value={renameTplName} onChange={(e) => setRenameTplName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRenameTpl(false)} color="inherit">Annuler</Button>
          <Button onClick={handleRename} variant="contained" className="bg-blue-700">Renommer</Button>
        </DialogActions>
      </Dialog>

      {previewUrl && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-8 backdrop-blur-md" onClick={() => setPreviewUrl(null)}>
           <div className="bg-white w-full h-full max-w-6xl rounded-3xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <iframe src={previewUrl} className="flex-1 border-none" />
           </div>
        </div>
      )}
    </div>
  );
};

export default ContractBuilderModern;
