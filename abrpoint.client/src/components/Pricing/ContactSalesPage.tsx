import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Building2, Users, Phone, Mail, CheckCircle2, Loader2 } from 'lucide-react';
import './PricingPage.css';
import { sendSalesRequest } from '../../services/ContactService';
import { useAuth } from '../helper/AuthProvider';
import apiInstance from '../API/apiInstance';
import PageSeo from '../helper/PageSeo';
import { trackEvent } from '../../analytics/ga';

const ContactSalesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { authReady, uticod, soclib, userName, utimail } = useAuth();
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [headcount, setHeadcount] = useState('200-500');
  const [needs, setNeeds] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Pré-remplissage pour un utilisateur déjà connecté : on hydrate société / nom / email
  // depuis le contexte d'auth (/me), et le téléphone en best-effort depuis sa fiche employé.
  // On ne le fait qu'une fois (prefilledRef) et sans écraser une saisie déjà en cours.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!authReady || prefilledRef.current || !uticod) return;
    prefilledRef.current = true;
    if (soclib) setCompany((prev) => prev || soclib);
    if (userName) setContactName((prev) => prev || userName);
    if (utimail) setEmail((prev) => prev || utimail);
    // Téléphone : la fiche employé peut ne pas exister (ex : admin sans fiche) → silencieux.
    apiInstance.get(`/Employes/${uticod}`)
      .then((res) => {
        const tel = res.data?.emptel || res.data?.empmob || '';
        if (tel) setPhone((prev) => prev || tel);
      })
      .catch(() => { /* pas de fiche employé : champ téléphone laissé vide */ });
  }, [authReady, uticod, soclib, userName, utimail]);

  const handleSubmit = async () => {
    setError(null);
    if (!company.trim() || !contactName.trim() || !email.trim()) {
      setError('Société, nom et email sont obligatoires.');
      return;
    }
    setSending(true);
    try {
      await sendSalesRequest({
        company: company.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        headcount,
        needs: needs.trim() || undefined,
      });
      setSubmitted(true);
      // Conversion : demande de démo / contact commercial envoyée.
      trackEvent('generate_lead', { form: 'contact-sales', headcount });
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Échec de l'envoi. Réessayez plus tard.";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pricing-container min-h-screen bg-surface font-body selection:bg-primary-fixed">
      <PageSeo
        title="Demander une démo – Concorde Workforce | Logiciel RH"
        description="Contactez l'équipe Concorde Workforce pour une démo gratuite de notre logiciel RH et découvrez comment digitaliser la gestion de votre PME. 1 mois offert."
      />
      <nav className="w-full bg-white/60 backdrop-blur-xl sticky top-0 z-50 border-b border-surface-container">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-bold text-sm"
          >
            <ChevronLeft size={20} />
            Retour aux tarifs
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 lg:py-20">
        <div className="text-center mb-12">
          <span className="inline-block text-[10px] font-black uppercase tracking-[0.3em] text-primary bg-primary/10 px-4 py-1.5 rounded-full mb-6">
            Plan Premium · Sur devis
          </span>
          <h1 className="text-4xl lg:text-5xl font-black text-on-surface tracking-tight mb-4 font-headline">Contactez les ventes</h1>
          <p className="text-on-surface-variant max-w-2xl mx-auto text-lg leading-relaxed">
            Le plan Premium est tarifé en fonction de votre périmètre. Notre équipe revient vers vous sous 24h ouvrées avec une proposition personnalisée.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: form */}
          <div className="lg:col-span-7">
            {submitted ? (
              <div className="bg-white rounded-3xl p-10 shadow-xl border border-surface-container-high text-center">
                <CheckCircle2 className="text-tertiary mx-auto mb-4" size={56} />
                <h3 className="text-2xl font-black mb-3 font-headline">Demande envoyée</h3>
                <p className="text-on-surface-variant mb-6 leading-relaxed">
                  Merci, notre équipe commerciale a bien reçu votre demande et revient vers vous sous 24h ouvrées. Pour toute question complémentaire : <strong className="text-primary">contact@concorde-tech.fr</strong>.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="bg-primary text-white px-6 py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all"
                >
                  Retour à l'accueil
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-8 shadow-xl border border-surface-container-high">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Building2 className="text-primary" size={22} />
                  Parlez-nous de vous
                </h3>

                {error && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 font-bold mb-4">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-1.5">{t('pricingExtras.company')}</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Ex: Acme SAS"
                      className="w-full px-4 py-3 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-on-surface font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-1.5">Votre nom</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-on-surface font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-1.5">Email professionnel</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@societe.fr"
                      className="w-full px-4 py-3 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-on-surface font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-1.5">Téléphone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+33 …"
                      className="w-full px-4 py-3 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-on-surface font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-1.5">Effectif</label>
                    <select
                      value={headcount}
                      onChange={(e) => setHeadcount(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-on-surface font-medium"
                    >
                      <option>50-200</option>
                      <option>200-500</option>
                      <option>500-1000</option>
                      <option>1000+</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-outline mb-1.5">Vos besoins (optionnel)</label>
                    <textarea
                      value={needs}
                      onChange={(e) => setNeeds(e.target.value)}
                      rows={5}
                      placeholder="Pointage multi-sites, intégration paie, SSO Azure AD, conformité, etc."
                      className="w-full px-4 py-3 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-on-surface font-medium resize-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={sending}
                  className="mt-6 w-full py-4 bg-primary text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                >
                  {sending && <Loader2 size={16} className="animate-spin" />}
                  {sending ? 'Envoi…' : 'Envoyer ma demande'}
                </button>
                <p className="text-[10px] text-center text-outline mt-4 font-bold leading-relaxed">
                  Vos données restent confidentielles et ne sont pas partagées avec des tiers.
                </p>
              </div>
            )}
          </div>

          {/* Right: Premium pitch */}
          <div className="lg:col-span-5">
            <div className="bg-surface-container rounded-3xl p-8 space-y-6 sticky top-28">
              <h3 className="text-xl font-extrabold font-headline">Inclus dans le plan Premium</h3>
              <ul className="space-y-3 text-sm">
                {[
                  'Tout le plan Standard',
                  'Tableaux de bord & KPI temps réel',
                  'Multi-filiales & multi-sites',
                  'SSO Azure AD / Google Workspace',
                  'Audit & sécurité avancée (RGPD, ISO 27001)',
                  'Account Manager dédié',
                  'SAV 2h garanti',
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-on-surface">
                    <CheckCircle2 className="text-tertiary flex-shrink-0 mt-0.5" size={18} />
                    <span className="font-medium">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-5 border-t border-outline-variant/30 space-y-3">
                <div className="flex items-center gap-2.5 text-sm text-on-surface-variant">
                  <Mail size={16} className="text-primary" />
                  <strong className="text-on-surface">contact@concorde-tech.fr</strong>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-on-surface-variant">
                  <Phone size={16} className="text-primary" />
                  <strong className="text-on-surface">+33 7 55 61 71 54</strong>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-on-surface-variant">
                  <Users size={16} className="text-primary" />
                  Dédié aux organisations 200+ collaborateurs
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContactSalesPage;
