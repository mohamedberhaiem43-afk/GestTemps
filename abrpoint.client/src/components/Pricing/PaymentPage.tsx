import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreditCard, ShieldCheck, Lock, ChevronLeft, CheckCircle2 } from 'lucide-react';
import './PricingPage.css';

const PaymentPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { plan, price, cycle } = location.state || { plan: 'Standard', price: 7.5, cycle: 'monthly' };

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
              <p className="text-on-surface-variant">Rejoignez Concorde et transformez votre gestion RH dès aujourd'hui.</p>
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

                <div className="pt-4">
                  <button 
                    onClick={() => navigate('/dashboard/plan-configuration')}
                    className="w-full py-4 bg-primary text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all"
                  >
                    Payer ${price.toFixed(2)}
                  </button>
                </div>

                <p className="text-[10px] text-center text-outline leading-relaxed px-8">
                  En cliquant sur "Payer", vous acceptez nos Conditions Générales de Vente. Votre abonnement sera renouvelé automatiquement chaque {cycle === 'monthly' ? 'mois' : 'an'}.
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
                    <div className="text-xl font-black text-on-surface">${price.toFixed(2)}</div>
                    <div className="text-[10px] font-bold text-outline uppercase">{cycle === 'monthly' ? 'Mensuel' : 'Annuel'}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-outline-variant/30">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-on-surface-variant">Sous-total</span>
                  <span className="text-on-surface">${price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-on-surface-variant">TVA (0%)</span>
                  <span className="text-on-surface">$0.00</span>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <span className="text-lg font-black font-headline">Total à payer</span>
                  <span className="text-2xl font-black text-primary font-headline">${price.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Inclus dans votre plan
                </h4>
                <ul className="text-xs space-y-2 text-on-surface-variant font-medium">
                  <li className="flex items-center gap-2">• Support client 24/7</li>
                  <li className="flex items-center gap-2">• Accès illimité aux modules</li>
                  <li className="flex items-center gap-2">• Mises à jour gratuites</li>
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
