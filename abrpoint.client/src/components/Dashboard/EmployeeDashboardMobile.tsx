import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../helper/AuthProvider';
import useGetProfile from '../../hooks/profileHooks/useGetProfile';
import useGetMyKPIs from '../../hooks/useGetMyKPIs';
import useGetDemConges from '../../hooks/congeHooks/useGetDemConges';
import useAddPointage from '../../hooks/pointeuseHooks/useAddPointage';
import { CircularProgress, Snackbar, Alert } from '@mui/material';

dayjs.locale('fr');

export default function EmployeeDashboardMobile() {
  const navigate = useNavigate();
  const { userName, soccod, uticod } = useAuth();
  const [serverTime, setServerTime] = useState(dayjs().format('HH:mm'));

  // Data fetching
  const { data: profile } = useGetProfile();
  const { data: kpiData, isLoading: loadingKPIs } = useGetMyKPIs(soccod ?? undefined, uticod ?? undefined);
  const { data: leaveRequests, isLoading: loadingLeaves } = useGetDemConges();
  const { mutate: addPointage, isLoading: isPointing } = useAddPointage();

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setServerTime(dayjs().format('HH:mm'));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handlePointer = () => {
    if (!uticod) return;
    addPointage(
      {
        employe_code: uticod,
        time: ''
      },
      {
        onSuccess: () => {
          setSnackbar({ open: true, message: 'Présence marquée avec succès !', severity: 'success' });
        },
        onError: (err: any) => {
          setSnackbar({ open: true, message: err?.response?.data?.message || 'Erreur lors du pointage', severity: 'error' });
        }
      }
    );
  };

  const kpis = useMemo(() => ({
    solde: kpiData?.soldeConge ?? 0,
    worked: kpiData?.heuresTravailleesSemaine ?? 0,
    pending: kpiData?.demandesEnAttente ?? 0,
    workedPercent: kpiData?.pourcentageObjectif ?? 0
  }), [kpiData]);

  const chartData = useMemo(() => {
    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    if (!kpiData?.suiviPointageSemaine) return days.map(d => ({ name: d, hours: 0 }));

    const mapping: Record<string, string> = { 'L': 'LUN', 'M': 'MAR', 'M2': 'MER', 'J': 'JEU', 'V': 'VEN', 'S': 'SAM', 'D': 'DIM' };
    return ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => {
      const key = i === 2 ? 'MER' : mapping[d]; // Handle duplicate 'M'
      return {
        name: d,
        hours: kpiData.suiviPointageSemaine[key] || 0
      };
    });
  }, [kpiData]);

  const today = dayjs().format('dddd, D MMMM');
  const firstName = userName?.split(' ')[0] || profile?.emplib?.split(' ')[0] || 'Employé';

  return (
    <div className="bg-[#f7f9fb] min-h-screen font-['Inter'] text-[#191c1e] pb-24">
      <main className="pt-2 px-6 max-w-lg mx-auto">
        {/* Greeting */}
        <section className="mb-8">
          <p className="font-['Inter'] uppercase tracking-wider text-slate-500 text-[10px] font-bold mb-1">{today}</p>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-['Manrope'] font-extrabold text-[#191c1e] tracking-tight">Bonjour, {firstName}</h1>
            {loadingKPIs && <CircularProgress size={20} sx={{ color: '#0040a1' }} />}
          </div>
        </section>

        {/* Pointage Card */}
        <section className="mb-10">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0040a1] to-[#0056d2] p-6 shadow-xl shadow-[#0040a1]/20">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <span className="font-['Inter'] text-[10px] font-semibold uppercase tracking-widest text-white/70">Heure Serveur</span>
                  <div className="text-4xl font-['Manrope'] font-extrabold text-white mt-1">{serverTime}</div>
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
                  <span className="material-symbols-outlined text-[14px] text-white">location_on</span>
                  <span className="text-[10px] font-['Inter'] font-bold text-white tracking-wide uppercase">GPS Actif</span>
                </div>
              </div>
              <button
                onClick={handlePointer}
                disabled={isPointing}
                className="w-full bg-white text-[#0040a1] font-['Manrope'] font-bold py-4 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-lg disabled:opacity-70"
              >
                {isPointing ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <>
                    <span className="material-symbols-outlined">login</span>
                    Pointer l'entrée
                  </>
                )}
              </button>
            </div>
            {/* Decorative Shapes */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-[#0056d2]/40 rounded-full blur-3xl"></div>
          </div>
        </section>

        {/* Summary Grid */}
        <section className="mb-10">
          <div className="flex items-end justify-between mb-4">
            <h2 className="font-['Manrope'] font-bold text-lg">Résumé d'activité</h2>
            <span className="font-['Inter'] text-[10px] uppercase font-bold text-[#0040a1] tracking-tighter">Voir tout</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Worked Hours (Full width) */}
            <div className="col-span-2 bg-white p-5 rounded-2xl flex items-center justify-between border border-slate-100 shadow-sm">
              <div>
                <span className="font-['Inter'] text-[10px] uppercase font-bold text-slate-400 tracking-wider">Temps de Travail</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-['Manrope'] font-extrabold">{kpis.worked.toFixed(1)}h</span>
                  <span className="text-sm font-['Inter'] text-slate-400">/ 35h</span>
                </div>
              </div>
              <div className="w-14 h-14 relative flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90 overflow-visible">
                  <circle className="text-slate-100" cx="28" cy="28" fill="transparent" r="24" stroke="currentColor" strokeWidth="5"></circle>
                  <circle
                    className="text-[#0040a1]"
                    cx="28" cy="28" fill="transparent" r="24" stroke="currentColor" strokeWidth="5"
                    strokeDasharray={150.8}
                    strokeDashoffset={150.8 * (1 - Math.min(kpis.worked / 35, 1))}
                    strokeLinecap="round"
                  ></circle>
                </svg>
                <span className="absolute text-[10px] font-bold text-[#0040a1]">{Math.round(Math.min(kpis.worked / 35 * 100, 100))}%</span>
              </div>
            </div>

            {/* Leave Balance */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-10 h-10 bg-blue-50 text-[#0040a1] rounded-xl flex items-center justify-center mb-3">
                <span className="material-symbols-outlined">event_available</span>
              </div>
              <span className="font-['Inter'] text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Congés</span>
              <div className="text-xl font-['Manrope'] font-extrabold mt-1">{kpis.solde.toFixed(1)} j.</div>
            </div>

            {/* Pending Requests */}
            <div
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm cursor-pointer active:scale-[0.98] transition-all"
              onClick={() => navigate('/dashboard/gestion-de-conge')}
            >
              <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-3">
                <span className="material-symbols-outlined">pending_actions</span>
              </div>
              <span className="font-['Inter'] text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Demandes</span>
              <div className="text-xl font-['Manrope'] font-extrabold mt-1">
                {loadingLeaves ? '...' : (leaveRequests?.length || 0).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        </section>

        {/* Weekly Chart */}
        <section className="mb-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-['Manrope'] font-bold text-md">Suivi Semainier</h2>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase rounded-full">
                {kpis.workedPercent >= 100 ? 'Objectif Atteint' : 'En progression'}
              </span>
            </div>
            <div className="flex items-end justify-between h-32 gap-3">
              {chartData.map((day, idx) => (
                <div key={idx} className="flex flex-col items-center flex-1 gap-3 group">
                  <div className="relative w-full h-full flex flex-end">
                    <div
                      className={`w-full rounded-t-full transition-all duration-500 ${idx === dayjs().day() - 1 ? 'bg-[#0040a1]' : 'bg-[#0040a1]/20'}`}
                      style={{ height: `${Math.min((day.hours / 8) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className={`text-[10px] font-bold font-['Inter'] ${idx === dayjs().day() - 1 ? 'text-[#0040a1]' : 'text-slate-400'}`}>
                    {day.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Access Section */}
        <section className="mb-10">
          <h2 className="font-['Manrope'] font-bold text-lg mb-4">Accès Rapide</h2>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => navigate('/dashboard/pointage-du-mois')}
              className="flex items-center gap-4 p-4 bg-blue-50 text-[#0040a1] rounded-2xl hover:bg-blue-100 transition-all active:scale-[0.98]"
            >
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <span className="material-symbols-outlined text-2xl">receipt_long</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Bulletins de paie</p>
                <p className="text-xs opacity-70">Consulter mes derniers bulletins</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/dashboard/coffre-fort')}
              className="flex items-center gap-4 p-4 bg-slate-100 text-slate-700 rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
            >
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <span className="material-symbols-outlined text-2xl">shield</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Coffre-fort Numérique</p>
                <p className="text-xs text-slate-500">Documents et signatures</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/dashboard/remboursement')}
              className="flex items-center gap-4 p-4 bg-orange-50 text-orange-700 rounded-2xl hover:bg-orange-100 transition-all active:scale-[0.98]"
            >
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <span className="material-symbols-outlined text-2xl">receipt</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Notes de Frais</p>
                <p className="text-xs text-orange-600/70">Saisir un remboursement</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/dashboard/support')}
              className="flex items-center gap-4 p-4 bg-emerald-50 text-emerald-700 rounded-2xl hover:bg-emerald-100 transition-all active:scale-[0.98]"
            >
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <span className="material-symbols-outlined text-2xl">support_agent</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Support RH</p>
                <p className="text-xs text-emerald-600/70">Aide et assistance</p>
              </div>
            </button>
          </div>
        </section>
      </main>


      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: '12px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
