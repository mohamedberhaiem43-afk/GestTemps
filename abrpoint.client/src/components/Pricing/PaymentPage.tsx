import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreditCard, ShieldCheck, Lock, ChevronLeft, CheckCircle2 } from 'lucide-react';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';
import './PricingPage.css';

const PaymentPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { uticod } = useAuth();
  const isAuthenticated = Boolean(uticod);
  const state = (location.state ?? {}) as {
    plan?: string;
    price?: number;
    cycle?: 'monthly' | 'annual';
    userCount?: number;
    packageType?: 'self' | 'success' | 'partner';
  };
  const plan = state.plan ?? 'Standard';
  const price = state.price ?? 7.5;
  const cycle = state.cycle ?? 'monthly';
  const userCount = state.userCount ?? 1;
  const packageType = state.packageType ?? 'success';
  const totalAmount = price * (userCount || 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setError(null);
    if (!isAuthenticated) {
      navigate('/signup', { state: { plan, price, cycle, userCount, packageType } });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await apiInstance.post('/billing/checkout', {
        planCode: plan,
        billingCycle: cycle,
        userCount,
        packageType,
        successUrl: `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/dashboard/plan-configuration?checkout=cancelled`,
      });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError('Réponse Stripe invalide.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Échec de la redirection vers Stripe.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pricing-container min-h-screen bg-surface font-body selection:bg-primary-fixed">
      {/* Mini Nav */}
      <nav className="w-full bg-white/60 backdrop-blur-xl sticky top-0 z-50 border-b border-surface-container">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-bold text-sm"
          >
            <ChevronLeft size={20} />
            Retour aux tarifs
          </button>
          <div className="text-xl font-black tracking-tighter text-primary font-headline">CONCORDE</div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Left Column: Form */}
          <div className="lg:col-span-7 space-y-8">
            <section>
              <h1 className="text-3xl font-extrabold font-headline mb-2 text-on-surface">Finalisez votre abonnement</h1>
              <p className="text-on-surface-variant">Activez votre espace Concorde Workforce et digitalisez le pointage, les congés et la paie de vos collaborateurs.</p>
            </section>

            {/* Payment Form Card */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-surface-container-high ambient-shadow">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <CreditCard className="text-primary" size={22} />
                  Informations de paiement
                </h3>
                <div className="flex gap-2 opacity-60">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" className="h-4" alt="Visa" />
                  <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-6" alt="Mastercard" />
                </div>
              </div>

              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline">Nom sur la carte</label>
                  <input
                    type="text"
                    placeholder="Jean Dupont"
                    className="w-full px-4 py-3.5 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline">Numéro de carte</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      className="w-full px-4 py-3.5 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface font-medium"
                    />
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-outline" size={18} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-outline">Expiration</label>
                    <input
                      type="text"
                      placeholder="MM / YY"
                      className="w-full px-4 py-3.5 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-outline">CVC</label>
                    <input
                      type="text"
                      placeholder="123"
                      className="w-full px-4 py-3.5 bg-surface-container-low border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all outline-none text-on-surface font-medium"
                    />
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 font-bold">
                      {error}
                    </div>
                  )}
                  <button
                    onClick={handlePay}
                    disabled={submitting}
                    className="w-full py-4 bg-primary text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {submitting ? 'Redirection vers Stripe…' : `Payer ${totalAmount.toFixed(2)} €`}
                  </button>
                </div>

                <p className="text-[10px] text-center text-outline leading-relaxed px-8">
                  En cliquant sur "Payer", vous acceptez les Conditions Générales d'Utilisation de Concorde Workforce. Votre abonnement sera renouvelé automatiquement chaque {cycle === 'monthly' ? 'mois' : 'an'} et résiliable à tout moment.
                </p>
              </form>
            </div>

            {/* Security Badges */}
            <div className="flex flex-wrap items-center justify-center gap-8 pt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-tertiary">
                <ShieldCheck size={18} />
                Paiement Sécurisé SSL
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant">
                <CheckCircle2 size={18} />
                Conforme PCI-DSS
              </div>
            </div>
          </div>

          {/* Right Column: Summary */}
          <div className="lg:col-span-5">
            <div className="bg-surface-container rounded-3xl p-8 space-y-8 sticky top-28">
              <h3 className="text-xl font-extrabold font-headline">Récapitulatif</h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-surface-container-high">
                  <div>
                    <div className="text-xs font-black text-primary uppercase tracking-widest mb-1">Plan Choisi</div>
                    <div className="text-lg font-bold text-on-surface">{plan}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-on-surface">{price.toFixed(2)} €</div>
                    <div className="text-[10px] font-bold text-outline uppercase">/ utilisateur • {cycle === 'monthly' ? 'Mensuel' : 'Annuel'}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-outline-variant/30">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-on-surface-variant">Prix par utilisateur</span>
                  <span className="text-on-surface">{price.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-on-surface-variant">Nombre d'utilisateurs</span>
                  <span className="text-on-surface">{userCount}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-on-surface-variant">Sous-total HT</span>
                  <span className="text-on-surface">{totalAmount.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-on-surface-variant">TVA (0%)</span>
                  <span className="text-on-surface">0,00 €</span>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <span className="text-lg font-black font-headline">Total à payer</span>
                  <span className="text-2xl font-black text-primary font-headline">{totalAmount.toFixed(2)} €</span>
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Inclus dans votre abonnement
                </h4>
                <ul className="text-xs space-y-2 text-on-surface-variant font-medium">
                  <li className="flex items-center gap-2">• Pointage temps réel & badgeuse</li>
                  <li className="flex items-center gap-2">• Gestion des congés, absences & autorisations</li>
                  <li className="flex items-center gap-2">• Préparation paie & exports comptables</li>
                  <li className="flex items-center gap-2">• Support client 7j/7 & mises à jour incluses</li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default PaymentPage;
