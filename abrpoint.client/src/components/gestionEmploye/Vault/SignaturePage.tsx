import { useState, useEffect, useRef, useCallback } from 'react';
import { CircularProgress } from '@mui/material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../helper/AuthProvider';
import apiInstance from '../../API/apiInstance';
import { signatureWorkflowApi, SignatureRequestView } from '../../API/signatureWorkflow';
import SignatureTimeline from './SignatureTimeline';
import { DocumentVault } from '../../../models/DocumentVault';
import './Signature.css';

type SignMethod = 'type' | 'draw';
type Step = 1 | 2 | 3;

/* ─── Canvas Drawing Hook ─── */
function useDrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    drawing.current = true;
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#0040a1';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    hasDrawn.current = true;
  }, []);

  const stopDraw = useCallback(() => { drawing.current = false; }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
  }, []);

  const getDataURL = useCallback(() => canvasRef.current?.toDataURL('image/png') ?? null, []);
  const getHasDrawn = useCallback(() => hasDrawn.current, []);

  return { canvasRef, startDraw, draw, stopDraw, clearCanvas, getDataURL, getHasDrawn };
}

/* ══════════════════════════════════════════════════════ */
const SignaturePage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const docId = searchParams.get('id');
  // Mode workflow (Phase 4) : on arrive depuis la boîte de signature / un deep-link
  // avec requestId + stepId. La signature passe alors par api/Signatures (circuit
  // multi-étapes, OTP, scellement) au lieu de l'ancien /Vault/sign mono-signataire.
  const requestId = searchParams.get('requestId');
  const stepId = searchParams.get('stepId');
  const isWorkflow = !!requestId && !!stepId;
  const navigate = useNavigate();
  // uticod === empcod (claim NameIdentifier côté serveur) — sert à surligner « Vous »
  // dans la timeline et à choisir la méthode OTP par défaut.
  const { userName, soclib, isEmp, authReady, uticod } = useAuth();
  // Représentant Société : on utilise le libellé de la société (Soclib) plutôt
  // qu'un nom hardcodé. Initiales calculées à partir des deux premiers mots.
  const companyName = soclib?.trim() || 'Société';
  const companyInitials = companyName.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'S';

  const [doc, setDoc] = useState<DocumentVault | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // workflow
  const [step, setStep] = useState<Step>(1);
  const [reviewed, setReviewed] = useState(false);

  // step 2
  const [signMethod, setSignMethod] = useState<SignMethod>('draw');
  const [signerName, setSignerName] = useState('');
  const [mention, setMention] = useState('Lu et approuvé');
  const [location, setLocation] = useState('Paris');
  const [consent, setConsent] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  // step 3
  const [certId, setCertId] = useState('');
  const [copied, setCopied] = useState(false);
  const [signedImageData, setSignedImageData] = useState<string | null>(null);

  // workflow (Phase 4)
  const [request, setRequest] = useState<SignatureRequestView | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  // true = c'était la dernière étape (document scellé) ; false = étape signée, circuit en cours.
  const [signCompleted, setSignCompleted] = useState<boolean | null>(null);
  // OTP optionnel : renforce la signature ('avancé'). Désactivé par défaut.
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [otpMethod, setOtpMethod] = useState<'email' | 'totp'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  // refus (réservé au mode workflow — approbateur ou employé qui refuse)
  const [rejecting, setRejecting] = useState(false);
  const [rejectMotif, setRejectMotif] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejected, setRejected] = useState(false);

  // drawing
  const drawing = useDrawingCanvas();

  // Revoke blob URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /* ─── Load ─── */
  useEffect(() => {
    if (!authReady) return;
    if (userName) setSignerName(prev => prev || userName);
    if (isWorkflow) fetchRequest();
    if (!docId) { setLoading(false); return; }
    fetchDocument();
  }, [authReady, docId, requestId, stepId]);

  // Vue d'état du parcours (timeline + statut). N'altère pas l'aperçu du document,
  // qui reste chargé via le documentVaultId (param `id`).
  const fetchRequest = async () => {
    if (!requestId) return;
    try {
      const view = await signatureWorkflowApi.get(Number(requestId));
      setRequest(view);
    } catch {
      /* best-effort : la timeline est un complément, la signature reste possible */
    }
  };

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const res = await apiInstance.get(`/Vault/doc/${docId}`);
      const fetchedDoc: DocumentVault = res.data;
      setDoc(fetchedDoc ?? null);
      if (fetchedDoc) loadPreviewBlob(fetchedDoc);
    } catch (err: any) {
      if (err?.response?.status !== 404) console.error(err);
      // En mode workflow, un approbateur peut ne pas avoir d'accès Vault au document
      // de l'employé (hors de son service). On ne bloque pas la signature pour autant :
      // on synthétise un document minimal (libellé via docName passé par l'inbox) et
      // l'aperçu retombe sur le panneau statique « non prévisualisable ».
      if (isWorkflow) {
        setDoc(buildFallbackDoc());
        setPreviewError("Aperçu indisponible (accès restreint). Vous pouvez tout de même signer l'étape qui vous est assignée.");
      } else {
        setDoc(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Document de repli (workflow) quand l'aperçu Vault est inaccessible au signataire.
  const buildFallbackDoc = (): DocumentVault => ({
    id: docId ? Number(docId) : 0,
    soccod: '',
    empcod: '',
    docName: searchParams.get('docName') || 'Document à signer',
    docType: searchParams.get('sourceType') || 'Document',
    docPath: '',
    docSize: 0,
    docDate: new Date().toISOString(),
    isSigned: false,
    signatureDate: null,
    signaturePath: null,
    status: 'Pending Signature',
  });

  // Fetch file as blob (sends proper auth headers), then make an object URL for the iframe
  const loadPreviewBlob = async (document: DocumentVault) => {
    const ext = document.docName?.split('.').pop()?.toLowerCase() ?? '';
    const viewable = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'frx'];
    if (!viewable.includes(ext)) {
      setPreviewError(`Aperçu non disponible pour le format .${ext}. Téléchargez le fichier pour le consulter.`);
      return;
    }
    try {
      const res = await apiInstance.get(`/Vault/preview/${document.id}`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      setPreviewUrl(blobUrl);
    } catch {
      setPreviewError('Impossible de charger l\'aperçu. Vérifiez que le fichier est accessible sur le serveur.');
    }
  };

  /* ─── OTP (mode workflow) ─── */
  const handleSendOtp = async () => {
    if (!isWorkflow) return;
    try {
      setOtpSending(true);
      setSignError(null);
      const res = await signatureWorkflowApi.sendOtp(Number(requestId), Number(stepId));
      setOtpSentTo(res.email);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      setSignError(code === 'no_email'
        ? "Aucune adresse e-mail n'est associée à votre compte pour recevoir le code."
        : "Impossible d'envoyer le code. Réessayez.");
    } finally { setOtpSending(false); }
  };

  /* ─── Sign ─── */
  const handleSign = async () => {
    if (!consent || !docId) return;
    const hasHandwriting = signMethod === 'draw' && drawing.getHasDrawn();
    const hasTyped = signMethod === 'type' && mention.trim().length > 3;
    if (!hasTyped && !hasHandwriting) return;
    // En mode workflow avec OTP activé, le code est obligatoire avant de signer.
    if (isWorkflow && otpEnabled && otpCode.trim().length < 4) {
      setSignError('Saisissez le code de vérification reçu avant de signer.');
      return;
    }

    try {
      setIsSigning(true);
      setSignError(null);
      const drawnData = drawing.getDataURL();
      const signatureData = signMethod === 'draw'
        ? `drawn:${drawnData}`
        : `phrase:${mention}`;

      let certificateId: string | null = null;

      if (isWorkflow) {
        // Nouveau circuit multi-étapes : signe l'étape courante. Le serveur tamponne,
        // journalise (avec la méthode OTP si fournie), fait avancer le circuit et scelle
        // le PDF à la dernière étape.
        const res = await signatureWorkflowApi.sign(Number(requestId), Number(stepId), {
          signatureData,
          signerName: signerName || doc?.empcod,
          mention,
          location,
          otpCode: otpEnabled ? otpCode.trim() : undefined,
          otpMethod: otpEnabled ? otpMethod : undefined,
        });
        certificateId = res.certificateId;
        setSignCompleted(res.completed);
        fetchRequest(); // rafraîchit la timeline (étape signée, étape suivante notifiée)
      } else {
        // Legacy : signature mono-signataire directe sur le document du coffre.
        const res = await apiInstance.post(`/Vault/sign/${docId}`, {
          signatureData,
          signerName: signerName || doc?.empcod,
          mention,
          location,
          date: new Date().toISOString(),
        });
        certificateId = res.data?.certificateId ?? null;
      }

      if (signMethod === 'draw') setSignedImageData(drawnData);
      setCertId(certificateId ?? `CERT-LEDG-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
      setStep(3);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const status = err?.response?.status;
      if (code === 'otp_invalid' || status === 401) {
        setSignError('Code de vérification invalide ou expiré. Demandez un nouveau code.');
      } else if (status === 409) {
        setSignError(err?.response?.data?.error ?? "Cette étape n'est plus celle en cours (déjà signée ou circuit clos).");
      } else {
        setSignError('Échec de la signature. Réessayez.');
      }
      console.error(err);
    }
    finally { setIsSigning(false); }
  };

  /* ─── Reject (mode workflow) ─── */
  const handleReject = async () => {
    if (!isWorkflow || rejectMotif.trim().length < 3) return;
    try {
      setRejecting(true);
      setSignError(null);
      await signatureWorkflowApi.reject(Number(requestId), Number(stepId), rejectMotif.trim());
      setRejected(true);
      setRejectOpen(false);
      fetchRequest();
    } catch (err: any) {
      setSignError(err?.response?.data?.error ?? 'Échec du refus. Réessayez.');
    } finally { setRejecting(false); }
  };

  const copyCert = () => {
    navigator.clipboard.writeText(certId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canSign = consent && (
    (signMethod === 'type' && mention.trim().length > 3) ||
    (signMethod === 'draw' && drawing.getHasDrawn())
  ) && signerName.trim().length > 0;

  /* ═══════════════ EMPTY / ERROR STATES ═══════════════ */
  if (loading) return (
    <div className="sig-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <CircularProgress />
    </div>
  );

  if (!docId) return (
    <div className="sig-shell sig-empty">
      <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#cbd5e1' }}>draw</span>
      <p style={{ fontWeight: 700, color: '#334155', margin: '0.75rem 0 0.25rem' }}>Aucun document sélectionné</p>
      <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
        Sélectionnez un document à signer depuis votre coffre-fort.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="sig-btn-primary" onClick={() => navigate('/dashboard/coffre-fort')}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>shield</span>
          Mon Coffre-fort
        </button>
        {!isEmp && (
          <button className="sig-btn-secondary" onClick={() => navigate('/dashboard/admin-vault')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>admin_panel_settings</span>
            Vue Globale Vault
          </button>
        )}
      </div>
    </div>
  );

  if (!doc) return (
    <div className="sig-shell sig-empty">
      <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#fca5a5' }}>error_outline</span>
      <p style={{ fontWeight: 700, color: '#334155', margin: '0.75rem 0 0.25rem' }}>Document introuvable</p>
      <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
        Le document ID={docId} n'existe pas ou vous n'y avez pas accès.
      </p>
      <button className="sig-btn-primary" onClick={() => navigate(-1)}>← Retour</button>
    </div>
  );

  // Confirmation de refus (mode workflow) : le circuit est clos, le demandeur notifié.
  if (rejected) return (
    <div className="sig-shell sig-empty">
      <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#ba1a1a' }}>block</span>
      <p style={{ fontWeight: 700, color: '#334155', margin: '0.75rem 0 0.25rem' }}>Document refusé</p>
      <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem', maxWidth: 420, textAlign: 'center' }}>
        Votre refus a été enregistré et le demandeur en a été informé avec votre motif. Le document n'a pas été scellé.
      </p>
      <button className="sig-btn-primary" onClick={() => navigate('/dashboard/signature-inbox')}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>drafts</span>
        Retour à mes demandes
      </button>
    </div>
  );

  const formattedDate = new Date(doc.docDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const displayName = signerName || doc.empcod;
  const initials = displayName.slice(0, 2).toUpperCase();

  /* ═══════════════ MAIN RENDER ═══════════════ */
  return (
    <div className="sig-shell">

      {/* ── Stepper ── */}
      <div className="sig-stepper-bar">
        <div className="sig-stepper">
          {([['Révision', 1], ['Signature', 2], ['Terminé', 3]] as [string, number][]).map(([label, n], i) => (
            <>
              {i > 0 && <div key={`line-${n}`} className={`sig-step-line ${step > n - 1 ? 'sig-step-line--active' : ''}`} />}
              <div key={`step-${n}`} className={`sig-step ${step >= n ? 'sig-step--active' : ''} ${step > n ? 'sig-step--done' : ''}`}>
                <div className="sig-step-circle">
                  {step > n
                    ? <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                    : n}
                </div>
                <span className="sig-step-label">{label}</span>
              </div>
            </>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="sig-body">

        {/* ══ DOCUMENT VIEWER (left) ══ */}
        <section className="sig-doc-section">
          <div className="sig-doc-topbar">
            <div className="sig-doc-topbar-left">
              <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '1.5rem' }}>picture_as_pdf</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#191c1e' }}>{doc.docType} : {doc.docName}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  {step === 3 ? 'Statut: Signé & Certifié ✓' : `Dernière mise à jour: ${formattedDate}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button className="sig-icon-btn" onClick={() => window.open(previewUrl ?? '', '_blank')} title="Ouvrir dans un onglet">
                <span className="material-symbols-outlined">open_in_new</span>
              </button>
              <button className="sig-icon-btn" onClick={async () => {
                const res = await apiInstance.get(`/Vault/download/${doc.id}`, { responseType: 'blob' });
                const url = URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a'); a.href = url; a.download = doc.docName; a.click();
              }} title="Télécharger">
                <span className="material-symbols-outlined">download</span>
              </button>
            </div>
          </div>

          {/* ── Real file viewer ── */}
          <div className={`sig-doc-paper-wrap ${previewUrl ? 'is-iframe' : ''}`}>
            {previewUrl ? (
              <div className="sig-file-viewer-wrap">
                {step === 3 && (
                  <>
                    <div className="sig-watermark">{t('signaturePage.watermarkSigned')}</div>
                    {signedImageData && (
                      <div className="sig-floating-stamp">
                        <div className="sig-stamp-label">Signé par {signerName}</div>
                        <img src={signedImageData} alt="Signature" className="sig-stamp-img" />
                        <div className="sig-stamp-date">{new Date().toLocaleDateString('fr-FR')}</div>
                      </div>
                    )}
                    {signMethod === 'type' && (
                      <div className="sig-floating-stamp">
                        <div className="sig-stamp-label">Signé par {signerName}</div>
                        <div className="sig-stamp-phrase">"{mention}"</div>
                        <div className="sig-stamp-date">{new Date().toLocaleDateString('fr-FR')}</div>
                      </div>
                    )}
                  </>
                )}
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  className="sig-iframe"
                  title={doc.docName}
                />
              </div>
            ) : (
              /* Fallback: simulated paper when real preview not available */
              <div className="sig-white-paper">
                {step === 3 && <div className="sig-watermark">{t('signaturePage.watermarkSigned')}</div>}
                <div className="sig-secure-badge">
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#005136' }}>verified_user</span>
                  <span>{step === 3 ? 'Certifié Conforme' : 'Secure Signature'}</span>
                </div>
                {previewError && (
                  <div className="sig-preview-error">
                    <span className="material-symbols-outlined">info</span>
                    <span>{previewError}</span>
                  </div>
                )}
                <div className="sig-paper-header">
                  <div style={{ fontSize: '1.75rem', fontFamily: 'Manrope, sans-serif', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
                    ARCHITECTURAL<br />LEDGER HR
                  </div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.12em' }}>
                    Document Officiel
                  </div>
                </div>
                <div className="sig-paper-body">
                  <h2>{doc.docName}</h2>
                  <p>{t('signaturePage.employeeLabel')} : <strong>{doc.empcod}</strong> · {t('signaturePage.typeLabel')} : <strong>{doc.docType}</strong></p>
                  <h3>Aperçu du document</h3>
                  <p>Le contenu de ce document n'est pas prévisualisable dans le navigateur. Téléchargez-le pour le consulter intégralement.</p>
                  <div className="sig-paper-sig-bloc">
                    <div className="sig-paper-sig">
                      <div className="sig-paper-sig-label">Signataire : Société</div>
                      <div className="sig-paper-sig-line sig-paper-sig-line--signed">{companyName}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, marginTop: '0.5rem' }}>{companyName} · Représentant légal</div>
                    </div>
                    <div className="sig-paper-sig">
                      <div className="sig-paper-sig-label">Signataire : Collaborateur</div>
                      {step === 3
                        ? (
                          <>
                            <div className="sig-paper-sig-line sig-paper-sig-line--signed">
                              {signedImageData ? (
                                <img src={signedImageData} alt="Signature" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
                              ) : (
                                displayName
                              )}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: '#64748b', textAlign: 'center', marginTop: '0.25rem', fontStyle: 'italic' }}>
                              "{mention}"
                            </div>
                            <div style={{ fontSize: '0.55rem', color: '#94a3b8', textAlign: 'center' }}>
                              Fait à {location}, le {new Date().toLocaleDateString('fr-FR')}
                            </div>
                          </>
                        )
                        : <div className="sig-paper-sig-line sig-paper-sig-line--pending">En attente de votre signature…</div>}
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, marginTop: '0.5rem' }}>{displayName}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ══ SIDEBAR (right) ══ */}
        <aside className="sig-sidebar">

          {/* ── STEP 1: Review ── */}
          {step === 1 && (
            <>
              <div className="sig-panel">
                <div className="sig-panel-section-label">Détails du Document</div>
                <div className="sig-doc-meta-card">
                  <span className="material-symbols-outlined" style={{ color: '#0040a1', fontSize: '1.5rem' }}>picture_as_pdf</span>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#191c1e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doc.docType}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                      {doc.docName}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                      {formattedDate} · {doc.docSize ? `${(doc.docSize / 1024 / 1024).toFixed(1)} MB` : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="sig-panel">
                <div className="sig-panel-section-label">Points Clés</div>
                <ul className="sig-highlights">
                  {[
                    ['check_circle', 'Rémunération', 'Niveau conforme à la grille salariale avec indexation trimestrielle.'],
                    ['check_circle', 'Date d\'effet', 'Prise de poste prévue au 1er du mois fiscal suivant.'],
                    ['check_circle', 'Non-divulgation', 'Clause de confidentialité étendue sur 24 mois post-rupture.'],
                  ].map(([icon, title, text]) => (
                    <li key={title}>
                      <span className="material-symbols-outlined sig-highlight-icon">{icon}</span>
                      <p><strong>{title} :</strong> {text}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sig-panel-footer">
                <label className="sig-consent-label">
                  <input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} className="sig-checkbox" />
                  <span>Je confirme avoir lu et compris le contenu de ce document dans son intégralité.</span>
                </label>
                <div className="sig-security-chip">
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#005136' }}>security</span>
                  <span>Chiffrement AES 256-bit actif.</span>
                </div>
                <button className="sig-btn-primary sig-btn-primary--full" disabled={!reviewed} onClick={() => setStep(2)}>
                  Suivant : Apposer la Signature
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                </button>
                <p className="sig-step-hint">Étape 1 sur 3 · Consentement requis</p>
              </div>
            </>
          )}

          {/* ── STEP 2: Sign ── */}
          {step === 2 && (
            <>
              <div className="sig-panel">
                <h3 className="sig-panel-title">Finaliser votre Signature</h3>

                <div className="sig-method-tabs">
                  <button className={`sig-method-tab ${signMethod === 'draw' ? 'active' : ''}`} onClick={() => setSignMethod('draw')}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>gesture</span> Signature Graphique
                  </button>
                  <button className={`sig-method-tab ${signMethod === 'type' ? 'active' : ''}`} onClick={() => setSignMethod('type')}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>keyboard</span> Mention Manuscrite
                  </button>
                </div>

                {/* Nom du signataire (Obligatoire dans les deux cas) */}
                <div className="sig-input-group">
                  <label>{t('signaturePage.fullLegalName')}</label>
                  <input className="sig-name-input" type="text" value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Ex: Jean Dupont" />
                </div>

                {signMethod === 'type' ? (
                  <>
                    <div className="sig-input-group">
                      <label>{t('signaturePage.typePhrasePrompt')}</label>
                      <input
                        className="sig-name-input"
                        type="text"
                        value={mention}
                        onChange={e => setMention(e.target.value)}
                        placeholder="Mention manuscrite"
                        style={{ fontFamily: "'Dancing Script', cursive", fontSize: '1.2rem' }}
                      />
                    </div>
                    <div className="sig-preview-box">
                      <div className="sig-preview-name" style={{ fontSize: '1.4rem' }}>{mention || '…'}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Fait à {location}, le {new Date().toLocaleDateString('fr-FR')}</div>
                    </div>
                  </>
                ) : (
                  <div className="sig-canvas-wrap">
                    <div className="sig-canvas-label">
                      <span>Signez dans la zone ci-dessous</span>
                      <button className="sig-change-font-btn" onClick={drawing.clearCanvas}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>restart_alt</span> Effacer
                      </button>
                    </div>
                    <canvas
                      ref={drawing.canvasRef}
                      className="sig-canvas"
                      width={310}
                      height={140}
                      onMouseDown={drawing.startDraw}
                      onMouseMove={drawing.draw}
                      onMouseUp={drawing.stopDraw}
                      onMouseLeave={drawing.stopDraw}
                      onTouchStart={drawing.startDraw}
                      onTouchMove={drawing.draw}
                      onTouchEnd={drawing.stopDraw}
                    />
                    <p className="sig-canvas-hint">Utilisez votre souris ou votre doigt (tablette)</p>

                    <div className="sig-input-group" style={{ marginTop: '1rem' }}>
                      <label>Mention manuscrite (Recommandé)</label>
                      <input className="sig-name-input" type="text" value={mention} onChange={e => setMention(e.target.value)} placeholder="Lu et approuvé" />
                    </div>
                  </div>
                )}

                <div className="sig-input-group">
                  <label>Lieu de Signature</label>
                  <input className="sig-name-input" type="text" value={location} onChange={e => setLocation(e.target.value)} />
                </div>

                <label className="sig-consent-label" style={{ marginTop: '0.75rem' }}>
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="sig-checkbox" />
                  <span>J'accepte que cette signature numérique soit l'équivalent légal de ma signature manuscrite, conformément aux lois en vigueur.</span>
                </label>

                {/* ── OTP optionnel (mode workflow) : renforce le niveau de garantie ── */}
                {isWorkflow && (
                  <div className="sig-otp-box">
                    <label className="sig-consent-label" style={{ margin: 0 }}>
                      <input type="checkbox" checked={otpEnabled} onChange={e => { setOtpEnabled(e.target.checked); setSignError(null); }} className="sig-checkbox" />
                      <div className="sig-otp-head">
                        <div>
                          <div className="sig-otp-title">Renforcer avec un code à usage unique (OTP)</div>
                          <div className="sig-otp-sub">Ajoute une vérification d'identité à votre signature (recommandé).</div>
                        </div>
                      </div>
                    </label>

                    {otpEnabled && (
                      <>
                        <div className="sig-otp-method-tabs">
                          <button type="button" className={`sig-otp-method-tab ${otpMethod === 'email' ? 'active' : ''}`} onClick={() => setOtpMethod('email')}>
                            Code par e-mail
                          </button>
                          <button type="button" className={`sig-otp-method-tab ${otpMethod === 'totp' ? 'active' : ''}`} onClick={() => { setOtpMethod('totp'); setOtpSentTo(null); }}>
                            Authentificateur (TOTP)
                          </button>
                        </div>

                        <div className="sig-otp-row">
                          <input
                            className="sig-otp-input"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={8}
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="••••••"
                          />
                          {otpMethod === 'email' && (
                            <button type="button" className="sig-btn-secondary" disabled={otpSending} onClick={handleSendOtp}>
                              {otpSending
                                ? <CircularProgress size={14} />
                                : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>mail</span> {otpSentTo ? 'Renvoyer' : 'Recevoir un code'}</>}
                            </button>
                          )}
                        </div>
                        {otpMethod === 'email' && otpSentTo && (
                          <div className="sig-otp-sent">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                            Code envoyé à {otpSentTo} (valable 10 min)
                          </div>
                        )}
                        {otpMethod === 'totp' && (
                          <div className="sig-otp-sub" style={{ marginTop: 6 }}>Saisissez le code à 6 chiffres de votre application d'authentification.</div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {signError && (
                  <div className="sig-otp-sent" style={{ color: '#ba1a1a', marginTop: '0.75rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
                    {signError}
                  </div>
                )}

                <button className="sig-btn-primary sig-btn-primary--full" style={{ marginTop: '1rem' }} disabled={!canSign || isSigning} onClick={handleSign}>
                  {isSigning
                    ? <><CircularProgress size={14} style={{ color: '#fff' }} /> Signature…</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>draw</span> Valider la Signature</>}
                </button>

                {/* ── Refus (mode workflow) — un signataire/approbateur peut renvoyer au demandeur ── */}
                {isWorkflow && !rejectOpen && (
                  <button className="sig-btn-secondary sig-btn-secondary--full" style={{ marginTop: '0.625rem' }} onClick={() => { setRejectOpen(true); setSignError(null); }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ba1a1a' }}>block</span>
                    Refuser ce document
                  </button>
                )}
                {isWorkflow && rejectOpen && (
                  <div className="sig-otp-box" style={{ borderColor: '#fca5a5', background: '#fdf2f2' }}>
                    <div className="sig-otp-title">Motif du refus</div>
                    <div className="sig-input-group" style={{ marginTop: '0.5rem' }}>
                      <textarea
                        className="sig-name-input"
                        rows={3}
                        value={rejectMotif}
                        onChange={e => setRejectMotif(e.target.value)}
                        placeholder="Expliquez pourquoi vous refusez de signer ce document…"
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button className="sig-btn-secondary" style={{ flex: 1 }} onClick={() => { setRejectOpen(false); setRejectMotif(''); }} disabled={rejecting}>
                        Annuler
                      </button>
                      <button className="sig-btn-primary" style={{ flex: 1, background: '#ba1a1a' }} disabled={rejectMotif.trim().length < 3 || rejecting} onClick={handleReject}>
                        {rejecting ? <CircularProgress size={14} style={{ color: '#fff' }} /> : 'Confirmer le refus'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mode workflow : timeline réelle du circuit (étapes + registre). */}
              {isWorkflow && request && (
                <div className="sig-panel">
                  <SignatureTimeline request={request} currentEmpcod={uticod} />
                </div>
              )}

              {/* Mode legacy : aperçu statique des deux signataires. */}
              {!isWorkflow && (
                <div className="sig-panel">
                  <div className="sig-panel-section-label">Signataires du Document</div>
                  <div className="sig-signatories">
                    <div className="sig-signatory-row">
                      <div className="sig-signatory-info">
                        <div className="sig-avatar">{companyInitials}</div>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{companyName}</div>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Représentant Société</div>
                        </div>
                      </div>
                      <span className="sig-badge sig-badge--signed"><span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>Signé</span>
                    </div>
                    <div className="sig-signatory-row">
                      <div className="sig-signatory-info">
                        <div className="sig-avatar" style={{ background: '#0040a1', color: '#fff' }}>{initials}</div>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{displayName} (Vous)</div>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Collaborateur</div>
                        </div>
                      </div>
                      <span className="sig-badge sig-badge--pending"><span className="material-symbols-outlined" style={{ fontSize: 12 }}>pending</span>En attente</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="sig-security-card">
                <span className="material-symbols-outlined" style={{ color: '#0040a1', fontSize: '1.25rem' }}>lock</span>
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0040a1', margin: 0 }}>Chiffrement bancaire SSL 256-bit</p>
                  <p style={{ fontSize: '0.65rem', color: '#3b82f6', margin: '0.25rem 0 0' }}>
                    Un journal d'audit complet sera généré et horodaté à la finalisation.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 3: Complete ── */}
          {step === 3 && (
            <>
              <div className="sig-panel sig-success-panel">
                <div className="sig-success-icon-wrap">
                  <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: '#005136' }}>check_circle</span>
                </div>
                <h3 className="sig-success-title">
                  {isWorkflow && signCompleted === false ? 'Votre signature est enregistrée !' : 'Signature validée avec succès !'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  {isWorkflow && signCompleted === false
                    ? "Le document a été transmis au prochain approbateur du circuit, qui a été notifié. Il sera scellé une fois toutes les signatures recueillies."
                    : 'Le document a été signé électroniquement et archivé de manière sécurisée dans votre coffre-fort.'}
                </p>
                <div className="sig-cert-box">
                  <div className="sig-cert-label">ID du Certificat</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <code style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0040a1', fontFamily: 'monospace' }}>{certId}</code>
                    <button className="sig-icon-btn" onClick={copyCert} title={copied ? 'Copié !' : 'Copier'}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: copied ? '#059669' : undefined }}>
                        {copied ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button className="sig-btn-primary sig-btn-primary--full" onClick={() => navigate('/dashboard/coffre-fort')}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_balance_wallet</span>
                    Retourner au Coffre-fort
                  </button>
                  <button className="sig-btn-secondary sig-btn-secondary--full" onClick={async () => {
                    const res = await apiInstance.get(`/Vault/download/${doc.id}`, { responseType: 'blob' });
                    const url = URL.createObjectURL(new Blob([res.data]));
                    const a = document.createElement('a'); a.href = url; a.download = doc.docName; a.click();
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>
                    Télécharger la preuve signée
                  </button>
                </div>
              </div>

              {isWorkflow && request ? (
                <div className="sig-panel">
                  <SignatureTimeline request={request} currentEmpcod={uticod} />
                </div>
              ) : (
                <div className="sig-panel">
                  <div className="sig-panel-section-label">Statut des Signataires</div>
                  <div className="sig-signatories">
                    {[[companyInitials, companyName, 'Représentant Société'], [initials, displayName, 'Collaborateur']].map(([ini, name, role]) => (
                      <div key={name} className="sig-signatory-row">
                        <div className="sig-signatory-info">
                          <div className="sig-avatar" style={{ background: '#0040a1', color: '#fff' }}>{ini}</div>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{name}</div>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{role}</div>
                          </div>
                        </div>
                        <span className="sig-badge sig-badge--signed"><span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>Signé</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="sig-security-card">
                <span className="material-symbols-outlined" style={{ color: '#0040a1', fontSize: '1.25rem' }}>verified</span>
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0040a1', margin: 0 }}>{t('signaturePage.depositProofEidas')}</p>
                  <p style={{ fontSize: '0.65rem', color: '#3b82f6', margin: '0.25rem 0 0' }}>
                    Ce document bénéficie d'une présomption de fiabilité conforme au règlement européen eIDAS.
                  </p>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default SignaturePage;
