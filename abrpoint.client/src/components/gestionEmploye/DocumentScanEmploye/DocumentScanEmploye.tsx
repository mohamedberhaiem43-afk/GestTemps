import React, { useState, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, IconButton, CircularProgress,
  Chip, Divider, Alert, TextField, Tooltip, Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WorkIcon from '@mui/icons-material/Work';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import PaymentsIcon from '@mui/icons-material/Payments';
import apiInstance from '../../API/apiInstance';
import Employe from '../../../models/Employe';
import './DocumentScanEmploye.css';

interface ExtractedData {
  empcod: string; emplib: string; empmat: string; empsexe: string;
  empcin: string; empdnais: string; emplnais: string; empsitfam: string;
  empnbp: number; empadr: string; emptel: string; empmob: string;
  empemail: string; empemb: string; empcontrat: string; foncod: string;
  empfonc: string; quacod: string; dircod: string; sercod: string;
  seccod: string; empsbase: string; empsbrut: string; catcod: string;
  natcod: string; vilcod: string; empfoncar: string; emplibar: string; empadrar: string;
}

interface ScanResult {
  success: boolean; message: string; documentType?: string;
  confidence?: number; extractedData?: ExtractedData; suggestions?: string[];
}

interface DocumentScanEmployeProps {
  open: boolean; onClose: () => void; onApplyData: (data: Partial<Employe>) => void;
}

const FIELD_GROUPS = [
  { title: 'Identité', icon: <PersonIcon sx={{ fontSize: 16 }} />, color: '#0040a1',
    fields: [
      { key: 'emplib', label: 'Nom complet' }, { key: 'empcod', label: 'Matricule' },
      { key: 'empsexe', label: 'Sexe' }, { key: 'empcin', label: 'CIN / ID' },
      { key: 'empdnais', label: 'Date de naissance' }, { key: 'emplnais', label: 'Lieu de naissance' },
      { key: 'empsitfam', label: 'Situation familiale' }, { key: 'empnbp', label: 'Personnes à charge' },
    ],
  },
  { title: 'Contact', icon: <PhoneIcon sx={{ fontSize: 16 }} />, color: '#0891b2',
    fields: [
      { key: 'empadr', label: 'Adresse' }, { key: 'emptel', label: 'Téléphone' },
      { key: 'empmob', label: 'Mobile' }, { key: 'empemail', label: 'Email' },
    ],
  },
  { title: 'Travail', icon: <WorkIcon sx={{ fontSize: 16 }} />, color: '#7c3aed',
    fields: [
      { key: 'empemb', label: "Date d'embauche" }, { key: 'empcontrat', label: 'Type de contrat' },
      { key: 'empfonc', label: 'Fonction' }, { key: 'sercod', label: 'Service' },
      { key: 'dircod', label: 'Direction' }, { key: 'seccod', label: 'Section' },
      { key: 'quacod', label: 'Qualification' }, { key: 'catcod', label: 'Catégorie' },
    ],
  },
  { title: 'Rémunération', icon: <PaymentsIcon sx={{ fontSize: 16 }} />, color: '#059669',
    fields: [
      { key: 'empsbase', label: 'Salaire de base' }, { key: 'empsbrut', label: 'Salaire brut' },
    ],
  },
];

const DOC_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  contrat: { label: 'Contrat de travail', color: '#7c3aed' },
  cin: { label: "Carte d'identité", color: '#0891b2' },
  cv: { label: 'CV / Resume', color: '#059669' },
  attestation: { label: 'Attestation', color: '#d97706' },
  autre: { label: 'Autre document', color: '#64748b' },
};

const DocumentScanEmploye: React.FC<DocumentScanEmployeProps> = ({ open, onClose, onApplyData }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<ExtractedData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowed.includes(file.type)) { setError('Type de fichier non supporté.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Fichier trop volumineux (max 10 MB).'); return; }
    setError(null); setScanResult(null);
    if (file.type.startsWith('image/')) setPreviewUrl(URL.createObjectURL(file)); else setPreviewUrl(null);
    setIsProcessing(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const response = await apiInstance.post('/DocumentScan/scan-employe', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000,
      });
      const result = response.data as ScanResult;
      if (result.success && result.extractedData) { setScanResult(result); setEditedData(result.extractedData); }
      else setError(result.message || "Impossible d'extraire les données.");
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Erreur lors de l'analyse.");
    } finally { setIsProcessing(false); }
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream; if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { setError("Impossible d'accéder à la caméra."); setActiveTab('upload'); }
  };
  const stopCamera = () => { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } };
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    c.toBlob(blob => { if (blob) { stopCamera(); handleFile(new File([blob], 'capture.jpg', { type: 'image/jpeg' })); } }, 'image/jpeg', 0.92);
  };
  const handleTabChange = (_: any, v: 'upload' | 'camera') => { if (v === 'camera') startCamera(); else stopCamera(); setActiveTab(v); };

  const handleApply = () => {
    if (!editedData) return;
    const d = editedData;
    // ⚠ On ne propage PAS les codes de clés étrangères (foncod, quacod, dircod, sercod,
    // seccod, catcod, natcod, vilcod) extraits par l'IA : le scan retourne souvent un
    // libellé ("Comptable") au lieu d'un code valide en base, ce qui faisait échouer le
    // POST côté serveur avec une violation de contrainte FK ("FOREIGN KEY constraint
    // failed"). L'utilisateur sélectionne ces champs manuellement via les listes
    // déroulantes du formulaire après l'application du scan.
    onApplyData({
      empcod: d.empcod || '', emplib: d.emplib || '', empmat: d.empmat || null,
      empsexe: d.empsexe || null, empcin: d.empcin || '', empdnais: d.empdnais || null,
      emplnais: d.emplnais || null, empsitfam: d.empsitfam || null, empnbp: d.empnbp || 0,
      empadr: d.empadr || null, emptel: d.emptel || null, empmob: d.empmob || null,
      empemail: d.empemail || null, empemb: d.empemb ? new Date(d.empemb) : null,
      empcontrat: d.empcontrat || null, empfonc: d.empfonc || '',
      empsbase: d.empsbase || '', empsbrut: d.empsbrut || '',
      empfoncar: d.empfoncar || null, emplibar: d.emplibar || null, empadrar: d.empadrar || null,
    });
    handleClose();
  };

  const handleClose = () => {
    stopCamera(); setScanResult(null); setPreviewUrl(null); setError(null);
    setEditedData(null); setIsProcessing(false); setActiveTab('upload'); onClose();
  };

  const handleEditField = (key: string, value: string | number) => { if (editedData) setEditedData({ ...editedData, [key]: value }); };
  const getFilledCount = () => { if (!editedData) return 0; return Object.values(editedData).filter(v => v !== '' && v !== 0 && v != null).length; };
  const getTotalFields = () => Object.keys(editedData || {}).length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth className="scan-modal"
      PaperProps={{ sx: { borderRadius: '20px', overflow: 'hidden' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3.5, py: 2.5, background: 'linear-gradient(135deg, #0040a1 0%, #1a6eff 100%)', color: '#fff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AutoAwesomeIcon sx={{ fontSize: 22 }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '17px', fontFamily: 'Manrope, sans-serif' }}>Scan Intelligent de Document</Typography>
            <Typography sx={{ fontSize: '12px', opacity: 0.85 }}>Importez un contrat, CIN ou CV pour remplir la fiche employé</Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: '#fff' }}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, backgroundColor: '#f8fafc' }}>
        <Box sx={{ display: 'flex', gap: 1, px: 3, pt: 2.5, pb: 1 }}>
          <button className={`scan-tab ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => handleTabChange(null, 'upload')}>
            <CloudUploadIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Importer un fichier
          </button>
          <button className={`scan-tab ${activeTab === 'camera' ? 'active' : ''}`} onClick={() => handleTabChange(null, 'camera')}>
            <PhotoCameraIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Photographier
          </button>
        </Box>

        {activeTab === 'upload' && (
          <Box sx={{ px: 3, pt: 1, pb: 2 }}>
            {!scanResult ? (
              <div className={`scan-upload-zone ${isDragging ? 'dragging' : ''} ${isProcessing ? 'processing' : ''}`}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                onClick={() => !isProcessing && fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" hidden onChange={handleFileInput} />
                {isProcessing ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div className="scan-pulse-icon"><AutoAwesomeIcon sx={{ fontSize: 48, color: '#0040a1' }} /></div>
                    <Typography sx={{ fontWeight: 700, fontSize: '16px', color: '#0d1f3c' }}>Analyse en cours par IA...</Typography>
                    <Typography sx={{ fontSize: '13px', color: '#64748b' }}>Gemini Vision extrait les informations du document</Typography>
                    <div className="scan-progress-bar" style={{ width: '60%' }} />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                    <CloudUploadIcon sx={{ fontSize: 52, color: '#94a3b8' }} />
                    <Typography sx={{ fontWeight: 700, fontSize: '16px', color: '#0d1f3c' }}>Glissez-déposez votre document ici</Typography>
                    <Typography sx={{ fontSize: '13px', color: '#64748b' }}>ou cliquez pour parcourir vos fichiers</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      {['JPG', 'PNG', 'WebP', 'PDF'].map(fmt => (
                        <Chip key={fmt} label={fmt} size="small" sx={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#e8ecf2', color: '#475569' }} />
                      ))}
                    </Box>
                    <Typography sx={{ fontSize: '11px', color: '#94a3b8', mt: 0.5 }}>Contrat · CIN · CV · Attestation — Max 10 MB</Typography>
                  </Box>
                )}
              </div>
            ) : null}
          </Box>
        )}

        {activeTab === 'camera' && (
          <Box sx={{ px: 3, pt: 1, pb: 2 }}>
            <Box className="camera-container">
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: '12px' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <Box className="camera-overlay">
                <Tooltip title="Prendre une photo">
                  <IconButton onClick={capturePhoto} sx={{ backgroundColor: '#fff', width: 64, height: 64, '&:hover': { backgroundColor: '#f0f0f0' } }}>
                    <PhotoCameraIcon sx={{ fontSize: 32, color: '#0040a1' }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Typography sx={{ textAlign: 'center', mt: 1, fontSize: '12px', color: '#94a3b8' }}>Placez le document devant la caméra</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ px: 3, pb: 1 }}>
            <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: '10px' }}>{error}</Alert>
          </Box>
        )}

        {scanResult && editedData && (
          <Box sx={{ px: 3, pb: 3 }} className="scan-results-animate">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 22 }} />
                <Typography sx={{ fontWeight: 700, fontSize: '15px', color: '#0d1f3c' }}>{scanResult.message}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {scanResult.documentType && (
                  <Chip label={DOC_TYPE_LABELS[scanResult.documentType]?.label || scanResult.documentType} size="small"
                    sx={{ backgroundColor: `${DOC_TYPE_LABELS[scanResult.documentType]?.color || '#64748b'}15`, color: DOC_TYPE_LABELS[scanResult.documentType]?.color || '#64748b', fontWeight: 700, fontSize: '11px' }} />
                )}
                {scanResult.confidence != null && (
                  <span className={`confidence-badge ${scanResult.confidence >= 0.7 ? 'confidence-high' : scanResult.confidence >= 0.4 ? 'confidence-medium' : 'confidence-low'}`}>
                    {scanResult.confidence >= 0.7 ? <CheckCircleIcon sx={{ fontSize: 13 }} /> : <WarningAmberIcon sx={{ fontSize: 13 }} />}
                    {Math.round(scanResult.confidence * 100)}% confiance
                  </span>
                )}
                <Chip label={`${getFilledCount()}/${getTotalFields()} champs remplis`} size="small"
                  sx={{ fontWeight: 700, fontSize: '11px', backgroundColor: '#e8ecf2', color: '#475569' }} />
              </Box>
            </Box>

            {previewUrl && <Box sx={{ mb: 2 }}><img src={previewUrl} alt="Aperçu" className="scan-preview-thumb" /></Box>}
            <Divider sx={{ mb: 2 }} />

            {FIELD_GROUPS.map(group => {
              const filled = group.fields.filter(f => { const v = editedData[f.key as keyof ExtractedData]; return v !== '' && v !== 0 && v != null; }).length;
              return (
                <Paper key={group.title} elevation={0} sx={{ mb: 2, p: 2.5, borderRadius: '14px', border: '1px solid #edf0f5', backgroundColor: '#fff' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ backgroundColor: `${group.color}12`, p: '6px', borderRadius: '8px', display: 'flex', color: group.color }}>{group.icon}</Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#0d1f3c' }}>{group.title}</Typography>
                    </Box>
                    <Chip label={`${filled}/${group.fields.length}`} size="small" sx={{ fontSize: '10px', fontWeight: 700, backgroundColor: '#f1f5f9' }} />
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5 }}>
                    {group.fields.map(field => {
                      const value = editedData[field.key as keyof ExtractedData];
                      const hasValue = value !== '' && value !== 0 && value != null;
                      return (
                        <Box key={field.key} className={`extracted-field ${hasValue ? 'has-value' : ''}`}>
                          <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>{field.label}</Typography>
                          <TextField fullWidth size="small" value={value ?? ''} onChange={e => handleEditField(field.key, field.key === 'empnbp' ? Number(e.target.value) : e.target.value)}
                            placeholder="—" variant="standard" InputProps={{ disableUnderline: true, sx: { fontSize: '13px', fontWeight: 600, color: hasValue ? '#0d1f3c' : '#c0c8d4' } }} />
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              );
            })}

            {scanResult.suggestions && scanResult.suggestions.length > 0 && (
              <Box sx={{ mt: 2, p: 2, borderRadius: '12px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LightbulbIcon sx={{ fontSize: 18, color: '#d97706' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#92400e' }}>Suggestions</Typography>
                </Box>
                {scanResult.suggestions.map((s, i) => (
                  <Typography key={i} sx={{ fontSize: '12px', color: '#78350f', ml: 3.2, mb: 0.3 }}>• {s}</Typography>
                ))}
              </Box>
            )}

            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button variant="text" startIcon={<ContentPasteIcon sx={{ fontSize: 16 }} />}
                onClick={() => { setScanResult(null); setEditedData(null); setPreviewUrl(null); }}
                sx={{ textTransform: 'none', color: '#64748b', fontSize: '13px' }}>Scanner un autre document</Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3.5, py: 2.5, borderTop: '1px solid #edf0f5', backgroundColor: '#fff', justifyContent: 'space-between' }}>
        <Button onClick={handleClose} sx={{ borderRadius: '10px', textTransform: 'none', color: '#64748b', fontWeight: 600 }}>Annuler</Button>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {scanResult && editedData && (
            <Button variant="outlined" startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
              onClick={() => { setScanResult(null); setEditedData(null); setPreviewUrl(null); }}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, borderColor: '#dde3ea', color: '#64748b', '&:hover': { borderColor: '#ef4444', color: '#ef4444' } }}>
              Ignorer
            </Button>
          )}
          <Button variant="contained"
            startIcon={scanResult ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            onClick={scanResult && editedData ? handleApply : () => fileInputRef.current?.click()}
            disabled={isProcessing}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, fontSize: '13px', background: 'linear-gradient(135deg, #0040a1 0%, #1a6eff 100%)', boxShadow: '0 4px 14px rgba(0,64,161,0.3)', px: 3, '&:hover': { background: 'linear-gradient(135deg, #003080 0%, #0040a1 100%)' }, '&.Mui-disabled': { background: '#c0c8d4' } }}>
            {isProcessing ? (<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CircularProgress size={16} color="inherit" /> Analyse...</Box>)
              : scanResult ? `Appliquer les ${getFilledCount()} champs détectés` : 'Sélectionner un document'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default DocumentScanEmploye;