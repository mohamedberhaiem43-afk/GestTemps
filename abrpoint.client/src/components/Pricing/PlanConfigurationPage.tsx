import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Users, Rocket, CheckCircle2, FileText, LayoutGrid, Headset } from 'lucide-react';
import apiInstance from '../API/apiInstance';
import './PricingPage.css';

const PlanConfigurationPage: React.FC = () => {
  const location = useLocation();
  // Plan + cycle viennent en général de PricingPage via location.state ; valeurs par défaut
  // si l'utilisateur arrive directement sur l'URL.
  const initialState = (location.state ?? {}) as { plan?: string; cycle?: 'monthly' | 'annual' };
  const planCode = (initialState.plan ?? 'Standard');
  const [userCount, setUserCount] = useState(50);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(initialState.cycle ?? 'annual');
  const [packageType, setPackageType] = useState<'self' | 'success' | 'partner'>('success');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleConfirmCheckout = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await apiInstance.post('/billing/checkout', {
        planCode,
        billingCycle,
        userCount,
        packageType,
        successUrl: `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/dashboard/plan-configuration?checkout=cancelled`,
      });
      if (data?.url) {
        // Redirection vers Stripe Checkout (page hostée Stripe → encaisse + crée subscription).
        window.location.href = data.url;
        return;
      }
      setError('Réponse Stripe invalide.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Échec de la création de la session de paiement.');
    } finally {
      setSubmitting(false);
    }
  };

  const pricePerUser = 8.00;
  const subtotal = userCount * pricePerUser;
  const annualDiscount = billingCycle === 'annual' ? subtotal * 12 * 0.2 : 0;
  const monthlyTotal = billingCycle === 'annual' ? (subtotal * 12 - annualDiscount) / 12 : subtotal;

  return (
    <div className="pricing-container min-h-screen bg-surface font-body selection:bg-primary-fixed">
      {/* TopNavBar */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-surface-container">
        <div className="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
          <div className="text-2xl font-bold tracking-tight text-primary font-headline">Architect Ledger</div>
          <nav className="hidden md:flex items-center gap-8">
            <a className="text-on-surface-variant hover:text-primary transition-colors text-xs font-bold uppercase tracking-widest" href="#">Platform</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors text-xs font-bold uppercase tracking-widest" href="#">Solutions</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors text-xs font-bold uppercase tracking-widest" href="#">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <button className="text-on-surface-variant hover:text-primary font-bold text-xs uppercase tracking-widest px-4 py-2 transition-all">Sign In</button>
            <button className="bg-primary text-white px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:-translate-y-0.5 transition-all shadow-md">Contact Sales</button>
          </div>
        </div>
      </header>

      <div className="flex min-h-screen max-w-screen-2xl mx-auto">
        {/* SideNavBar */}
        <aside className="hidden lg:flex flex-col h-screen sticky left-0 w-72 border-r border-surface-container bg-surface-container-low overflow-y-auto">
          <div className="p-8">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg">
                <span className="material-symbols-outlined fill-icon">architecture</span>
              </div>
              <div>
                <div className="text-lg font-black text-primary font-headline">Standard Plan</div>
                <div className="text-[10px] font-bold text-outline uppercase tracking-widest">HR Digital Curation</div>
              </div>
            </div>
            <nav className="space-y-2">
              <div className="flex items-center gap-4 text-outline py-3 px-6 hover:text-primary hover:bg-white rounded-xl transition-all cursor-pointer">
                <span className="material-symbols-outlined">edit_document</span>
                <span className="font-label uppercase tracking-widest text-[10px] font-black">Plan Selection</span>
              </div>
              <div className="flex items-center gap-4 text-primary font-black bg-white shadow-sm py-3 px-6 rounded-xl transition-all cursor-pointer border-r-4 border-primary">
                <span className="material-symbols-outlined">group_add</span>
                <span className="font-label uppercase tracking-widest text-[10px]">Configuration</span>
              </div>
              <div className="flex items-center gap-4 text-outline py-3 px-6 hover:text-primary hover:bg-white rounded-xl transition-all cursor-pointer">
                <span className="material-symbols-outlined">handshake</span>
                <span className="font-label uppercase tracking-widest text-[10px] font-black">Implementation</span>
              </div>
              <div className="flex items-center gap-4 text-outline py-3 px-6 hover:text-primary hover:bg-white rounded-xl transition-all cursor-pointer">
                <span className="material-symbols-outlined">fact_check</span>
                <span className="font-label uppercase tracking-widest text-[10px] font-black">Review</span>
              </div>
            </nav>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <main className="flex-1 p-8 lg:p-12 bg-surface">
          {/* Breadcrumbs & Header */}
          <div className="mb-12">
            <nav className="flex items-center gap-2 text-xs text-outline mb-6 font-bold uppercase tracking-widest">
              <span>Abonnement</span>
              <ChevronRight size={14} />
              <span>Plans</span>
              <ChevronRight size={14} />
              <span className="text-primary">Plan Standard</span>
            </nav>
            <h1 className="text-4xl lg:text-5xl font-black text-on-surface tracking-tight mb-4 font-headline">Configuration du plan</h1>
            <p className="text-on-surface-variant max-w-2xl text-lg leading-relaxed">
              Personnalisez votre infrastructure RH pour correspondre exactement aux besoins de votre organisation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Column */}
            <div className="lg:col-span-8 space-y-16">
              {/* Section: Compte */}
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Users size={20} />
                  </div>
                  <h2 className="text-xl font-black tracking-tight font-headline uppercase">Configuration du compte</h2>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-surface-container-high shadow-sm">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-outline mb-6">Nombre d'utilisateurs</label>
                  <div className="flex items-center gap-6 max-w-md">
                    <div className="relative flex-1">
                      <input
                        className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-primary/20 text-3xl font-black p-6 rounded-2xl transition-all outline-none"
                        type="number"
                        value={userCount}
                        onChange={(e) => setUserCount(parseInt(e.target.value) || 0)}
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-outline material-symbols-outlined text-3xl">groups</span>
                    </div>
                    <div className="text-on-surface font-black text-lg">Collaborateurs</div>
                  </div>
                  <p className="mt-6 text-sm text-outline italic flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-tertiary" />
                    Le prix par utilisateur diminue à mesure que vous augmentez la taille de votre équipe.
                  </p>
                </div>
              </section>

              {/* Section: Accompagnement */}
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Rocket size={20} />
                  </div>
                  <h2 className="text-xl font-black tracking-tight font-headline uppercase">Accompagnement</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1 */}
                  <div
                    onClick={() => setPackageType('self')}
                    className={`group relative bg-white p-8 rounded-3xl border-2 transition-all cursor-pointer hover:shadow-xl ${
                      packageType === 'self' ? 'border-primary shadow-lg ring-4 ring-primary/5' : 'border-surface-container-high hover:border-primary/50'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
                      packageType === 'self' ? 'bg-primary text-white' : 'bg-surface-container-low text-outline group-hover:bg-primary/10 group-hover:text-primary'
                    }`}>
                      <span className="material-symbols-outlined text-2xl">person_play</span>
                    </div>
                    <h3 className="font-black text-lg mb-2 font-headline">Self-service</h3>
                    <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">Documentation complète et tutoriels vidéo pour une mise en place autonome.</p>
                    <div className={`text-sm font-black uppercase tracking-widest ${packageType === 'self' ? 'text-primary' : 'text-outline'}`}>Inclus</div>
                  </div>

                  {/* Card 2 (Active) */}
                  <div
                    onClick={() => setPackageType('success')}
                    className={`group relative bg-white p-8 rounded-3xl border-2 transition-all cursor-pointer hover:shadow-xl ${
                      packageType === 'success' ? 'border-primary shadow-lg ring-4 ring-primary/5' : 'border-surface-container-high hover:border-primary/50'
                    }`}
                  >
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest shadow-lg">Conseillé</div>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
                      packageType === 'success' ? 'bg-primary text-white' : 'bg-surface-container-low text-outline group-hover:bg-primary/10 group-hover:text-primary'
                    }`}>
                      <span className="material-symbols-outlined text-2xl fill-icon">verified</span>
                    </div>
                    <h3 className="font-black text-lg mb-2 font-headline">Success Pack</h3>
                    <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">Un expert dédié vous accompagne pendant 3 mois pour le déploiement.</p>
                    <div className={`text-sm font-black uppercase tracking-widest ${packageType === 'success' ? 'text-primary' : 'text-outline'}`}>+ 1 200 € <span className="text-[10px] font-normal text-outline">HT</span></div>
                  </div>

                  {/* Card 3 */}
                  <div
                    onClick={() => setPackageType('partner')}
                    className={`group relative bg-white p-8 rounded-3xl border-2 transition-all cursor-pointer hover:shadow-xl ${
                      packageType === 'partner' ? 'border-primary shadow-lg ring-4 ring-primary/5' : 'border-surface-container-high hover:border-primary/50'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
                      packageType === 'partner' ? 'bg-primary text-white' : 'bg-surface-container-low text-outline group-hover:bg-primary/10 group-hover:text-primary'
                    }`}>
                      <span className="material-symbols-outlined text-2xl">handshake</span>
                    </div>
                    <h3 className="font-black text-lg mb-2 font-headline">Partner</h3>
                    <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">Externalisez l'implémentation complète à l'un de nos partenaires certifiés.</p>
                    <div className={`text-sm font-black uppercase tracking-widest ${packageType === 'partner' ? 'text-primary' : 'text-outline'}`}>Sur devis</div>
                  </div>
                </div>
              </section>

              {/* Feature Preview Bento */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface-container-low rounded-3xl p-8 flex flex-col justify-between aspect-video relative overflow-hidden group">
                  <div className="z-10">
                    <h4 className="font-black text-xl font-headline mb-2">Apps Illimitées</h4>
                    <p className="text-sm text-on-surface-variant font-medium">Accédez à l'ensemble du catalogue Concorde.</p>
                  </div>
                  <LayoutGrid className="text-surface-container-highest absolute -right-6 -bottom-6 w-32 h-32 group-hover:scale-110 transition-transform" />
                  <div className="z-10 pt-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">12 modules actifs</span>
                  </div>
                </div>
                <div className="bg-primary text-white rounded-3xl p-8 flex flex-col justify-between aspect-video relative overflow-hidden group">
                  <div className="z-10">
                    <h4 className="font-black text-xl font-headline mb-2">Support Premium</h4>
                    <p className="text-sm text-blue-100/80 font-medium">Temps de réponse &lt; 2h garanti par SLA.</p>
                  </div>
                  <Headset className="text-primary-container absolute -right-6 -bottom-6 w-32 h-32 opacity-20 group-hover:scale-110 transition-transform" />
                  <div className="z-10 pt-4">
                    <button className="text-[10px] font-black uppercase tracking-widest bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full transition-colors">Consulter les SLA</button>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column (Sticky Summary) */}
            <div className="lg:col-span-4 lg:sticky lg:top-28">
              <div className="glass-card bg-white/80 p-8 rounded-[2.5rem] shadow-2xl border border-white/20 ambient-shadow">
                <h2 className="text-2xl font-black tracking-tight mb-8 font-headline uppercase">Récapitulatif</h2>

                {/* Toggle Monthly/Yearly */}
                <div className="bg-surface-container-low p-1.5 rounded-2xl flex mb-10 border border-surface-container-high">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all ${
                      billingCycle === 'monthly' ? 'bg-white shadow-md text-primary' : 'text-outline hover:text-on-surface'
                    }`}
                  >
                    Mensuel
                  </button>
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all ${
                      billingCycle === 'annual' ? 'bg-white shadow-md text-primary' : 'text-outline hover:text-on-surface'
                    }`}
                  >
                    Annuel <span className="text-[10px] text-tertiary ml-1">(-20%)</span>
                  </button>
                </div>

                {/* Breakdown */}
                <div className="space-y-5 mb-10">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-outline font-bold">Prix par utilisateur</span>
                    <span className="font-black text-on-surface">{pricePerUser.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-outline font-bold">Nombre d'utilisateurs</span>
                    <span className="font-black text-on-surface">{userCount}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-outline font-bold">Modules inclus</span>
                    <span className="font-black text-on-surface">Tous (12)</span>
                  </div>
                  {billingCycle === 'annual' && (
                    <div className="flex justify-between items-center text-sm text-tertiary p-3 bg-tertiary/5 rounded-xl border border-tertiary/10">
                      <span className="font-bold">Remise annuelle</span>
                      <span className="font-black">- {(annualDiscount/12).toFixed(2)} € / mois</span>
                    </div>
                  )}
                  <div className="pt-6 border-t border-surface-container-high flex justify-between items-baseline">
                    <span className="font-black text-on-surface uppercase text-xs tracking-widest">Total / mois</span>
                    <div className="text-right">
                      <div className="text-4xl font-black text-primary font-headline tracking-tighter">{monthlyTotal.toFixed(2)} €</div>
                      <div className="text-[9px] text-outline uppercase font-black tracking-widest mt-1">HT / mois facturé {billingCycle === 'annual' ? 'annuellement' : 'mensuellement'}</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 font-bold">
                      {error}
                    </div>
                  )}
                  <button
                    onClick={handleConfirmCheckout}
                    disabled={submitting}
                    className="w-full py-5 bg-primary text-white rounded-2xl font-black text-lg hover:-translate-y-1 transition-all shadow-xl shadow-primary/20 uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {submitting ? 'Redirection vers Stripe…' : "Confirmer l'achat"}
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full bg-surface-container-high text-on-surface py-5 rounded-2xl font-black hover:bg-surface-container-highest transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                  >
                    <FileText size={18} />
                    Plus tard, retour au tableau de bord
                  </button>
                </div>

                <p className="mt-8 text-[10px] text-center text-outline leading-relaxed font-bold">
                  En cliquant sur Confirmer, vous acceptez nos <a className="underline text-primary" href="#">Conditions Générales de Vente</a> et notre politique de confidentialité.
                </p>
              </div>

              {/* Trust Badges */}
              <div className="mt-8 px-6 flex justify-between opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                <img alt="Trusted Brand" className="h-5 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzHI7rJE9lM192_u1-djE-N7oBY9kMDK8ZNKL171MBqA-OrPKuV1dtKlGld8_Ub63JocDa8Gn08xHBnVmE0Hd6WJq8q0CICts4X3p7NJJ6ViLAzlCmXY7nWGwLvmC4LhqHBRgcBEm-re2sniowr4ylJCvdwcdwk_YmzYJgtGzI5dOA4q-J-is7dsSNXB1-cN6uehplxOhtZp6bH2-Aiv9_8bXXlIlvFkHdmCApOhbb_movUPhDcZP2vjpkBzWKG21q7JQoFi4K5Aw"/>
                <img alt="Trusted Brand" className="h-5 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC056riMX4pWFeg9_09wcynGo94apT8y7ffAWXgnd9T4fjsaj9188x1GMVY1PKp6Qua_vs3hnVIl9AUJWS-ngmIx-Lv-zUN89-3UCjdoCSVFHKR4ceUYSYofb-6NppfNcm9FvU3UdC-6Y82W6ovnc6-ggC2sRhrEFFbjeH1nT831rgLJkhDtVr4cVKofF6dr0wY_avCXCkVG87QCMjYpC6Z5Nh0-PCFKNAT7NzeFTGd3Jxf-XStoB5oXhovnGPYT5vZCjZ5_RbGqLI"/>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Background Decorative Elements */}
      <div className="fixed top-0 right-0 -z-10 w-1/3 h-1/2 opacity-20 pointer-events-none">
        <div className="w-full h-full bg-primary-fixed-dim blur-[120px] rounded-full"></div>
      </div>
      <div className="fixed bottom-0 left-0 -z-10 w-1/4 h-1/3 opacity-10 pointer-events-none">
        <div className="w-full h-full bg-tertiary-fixed blur-[100px] rounded-full"></div>
      </div>
    </div>
  );
};

export default PlanConfigurationPage;
