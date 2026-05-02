import { useState, useMemo, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import useGetDemConges from '../../hooks/congeHooks/useGetDemConges';
import useGetProfile from '../../hooks/profileHooks/useGetProfile';
import useGetMyKPIs from '../../hooks/useGetMyKPIs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../helper/AuthProvider';
import './DashboardModern.css';
import EmployeeDashboardMobile from './EmployeeDashboardMobile';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('week');
  const { userName, soccod, uticod } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Responsive check
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Data fetching
  const { data: profile, isLoading: loadingProfile } = useGetProfile();
  const { data: kpiData, isLoading: loadingKPIs } = useGetMyKPIs(soccod ?? undefined, uticod ?? undefined);
  const { data: leaveRequests } = useGetDemConges();

  // Helper to normalize leave status
  const getStatus = (req: any): 'Accepté' | 'Refusé' | 'En attente' => {
    const n = req.etat?.trim().toLowerCase() ?? '';
    if (n.includes('refus') || req.conrefus === '1') return 'Refusé';
    if (n.includes('accept') || n.includes('approuv')) return 'Accepté';
    return 'En attente';
  };

  // KPIs from the dedicated endpoint
  const kpis = useMemo(() => ({
    solde: kpiData?.soldeConge ?? 0,
    acquired: kpiData?.congeAcquis ?? 0,
    worked: kpiData?.heuresTravailleesSemaine ?? 0,
    // Objectif hebdo recalculé côté backend selon le poste de l'employé pour la semaine
    // courante, déduction faite des jours fériés et congés validés.
    objective: kpiData?.objectifHebdomadaire ?? 0,
    pending: kpiData?.demandesEnAttente ?? 0,
    workedPercent: kpiData?.pourcentageObjectif ?? 0,
  }), [kpiData]);

  // Chart data from KPI endpoint's weekly tracking
  const chartData = useMemo(() => {
    const days = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    const data = days.map(day => ({ name: day, hours: 0, isToday: false }));

    const todayIndex = (dayjs().day() + 6) % 7;
    if (data[todayIndex]) data[todayIndex].isToday = true;

    if (kpiData?.suiviPointageSemaine) {
      days.forEach((day, idx) => {
        const hours = kpiData.suiviPointageSemaine[day] || 0;
        data[idx].hours = Math.min(hours, 12);
      });
    }
    return data;
  }, [kpiData]);

  // Heures cibles par jour ouvré pour la ligne pointillée. Calculé à partir de l'objectif
  // hebdo réel et du nombre de jours planifiés (jours sans repos/férié/congé). Fallback 7h.
  const dailyTargetHours = useMemo(() => {
    if (!kpiData?.objectifHebdomadaire) return 7;
    const plannedDays = chartData.filter(d => d.hours > 0).length;
    const days = plannedDays > 0 ? plannedDays : 5;
    return Math.max(1, Math.round((kpiData.objectifHebdomadaire / days) * 10) / 10);
  }, [kpiData?.objectifHebdomadaire, chartData]);

  // Monthly chart data
  const monthChartData = useMemo(() => {
    if (!kpiData?.suiviPointageMois) return [];
    return Object.entries(kpiData.suiviPointageMois).map(([name, hours]) => ({
      name,
      hours: Math.min(Number(hours), 48),
      isToday: false
    }));
  }, [kpiData]);

  if (loadingProfile || loadingKPIs) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f7f9fb]">
        <div className="animate-pulse text-xl font-['Manrope'] font-bold text-[#0040a1]">Chargement...</div>
      </div>
    );
  }

  if (isMobile) {
    return <EmployeeDashboardMobile />;
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] font-['Inter'] text-[#191c1e] p-8">
      {/* Welcome Header */}
      <section className="mb-10">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div>
            <h2 className="text-4xl font-['Manrope'] font-extrabold tracking-tight text-[#191c1e] mb-2">
              Bonjour, {userName?.split(' ')[0] || profile?.emplib?.split(' ')[0] || 'Employé'}.
            </h2>
            <p className="text-slate-500 font-medium">Voici un résumé de votre activité pour la semaine du {dayjs().startOf('week').add(1, 'day').format('DD MMMM')}.</p>
          </div>
          <button 
            onClick={() => navigate('/dashboard/gestion-de-conge')}
            className="bg-gradient-to-br from-[#0040a1] to-[#0056d2] text-white px-6 py-3.5 rounded-xl font-['Manrope'] font-bold flex items-center gap-2 shadow-lg shadow-[#0040a1]/20 hover:-translate-y-0.5 transition-transform"
          >
            <span className="material-symbols-outlined">add</span>
            Nouvelle Demande
          </button>
        </div>
      </section>

      {/* KPI Bento Row */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl border border-transparent shadow-sm hover:border-slate-200 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-[#0040a1] rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">event_available</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Congés Restants</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-['Manrope'] font-black text-[#191c1e]">{kpis.solde.toFixed(1)}</span>
            <span className="text-slate-400 font-medium">/ {kpis.acquired.toFixed(1) || '—'} jours acquis</span>
          </div>
          <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#0040a1] rounded-full transition-all duration-700" style={{ width: `${kpis.acquired > 0 ? Math.min((kpis.solde / kpis.acquired) * 100, 100) : 0}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-transparent shadow-sm hover:border-slate-200 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">timer</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Temps de travail</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-['Manrope'] font-black text-[#191c1e]">{kpis.worked.toFixed(1)}</span>
            <span className="text-slate-400 font-medium">h / {kpis.objective ? `${kpis.objective.toFixed(1)}h` : '—'}</span>
          </div>
          <p className="mt-4 text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            {kpis.workedPercent}% de l'objectif hebdomadaire
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-transparent shadow-sm hover:border-slate-200 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En Attente</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-['Manrope'] font-black text-[#191c1e]">{kpis.pending.toString().padStart(2, '0')}</span>
            <span className="text-slate-400 font-medium">demandes</span>
          </div>
          <p className="mt-4 text-xs text-slate-400 font-medium italic">Prochaine revue prévue demain</p>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Pointage Analysis */}
        <section className="lg:col-span-8 bg-white rounded-xl p-8 shadow-sm border border-transparent">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-['Manrope'] font-bold text-[#0d1c2e]">Suivi des Pointages</h3>
            <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
              <button 
                onClick={() => setActiveTab('week')}
                className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'week' ? 'bg-white text-[#0040a1] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Semaine
              </button>
              <button 
                onClick={() => setActiveTab('month')}
                className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'month' ? 'bg-white text-[#0040a1] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Mois
              </button>
            </div>
          </div>
          
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeTab === 'week' ? chartData : monthChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                  dy={12}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc', radius: 8 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">{payload[0].payload.name}</p>
                          <p className="text-lg font-['Manrope'] font-black text-[#0040a1]">{payload[0].value} <span className="text-[11px] font-bold opacity-60">HEURES</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="hours" radius={[6, 6, 6, 6]} barSize={40}>
                  {(activeTab === 'week' ? chartData : monthChartData).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isToday ? '#0040a1' : '#e2e8f0'} className="hover:fill-[#0056d2] transition-colors duration-300" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            
            {/* Goal Line Overlay — libellé tiré de l'objectif réel du poste */}
            <div className="absolute top-[35%] left-0 w-full border-t border-dashed border-slate-200 pointer-events-none">
              <span className="absolute right-0 -top-5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-white px-2">
                Objectif {dailyTargetHours}h/jour
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: Recent Requests */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-['Manrope'] font-bold text-[#0d1c2e]">Dernières Demandes</h3>
              <button 
                onClick={() => navigate('/dashboard/gestion-de-conge')}
                className="text-[10px] font-bold text-[#0040a1] hover:underline uppercase tracking-wider"
              >
                Voir tout
              </button>
            </div>
            <div className="space-y-4">
              {(leaveRequests || []).slice(0, 3).map((req: any) => {
                const status = getStatus(req);
                return (
                  <div key={req.concod} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0040a1] flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">beach_access</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#191c1e]">Congés Payés</p>
                        <p className="text-[10px] text-slate-400">{dayjs(req.condep).format('DD MMM')} - {dayjs(req.conret).format('DD MMM')}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      status === 'Accepté' ? 'bg-emerald-100 text-emerald-700' : 
                      status === 'En attente' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {status === 'Accepté' ? 'Validé' : status === 'En attente' ? 'Attente' : 'Refusé'}
                    </span>
                  </div>
                );
              })}
              {(!leaveRequests || leaveRequests.length === 0) && (
                <div className="py-6 text-center text-slate-400 text-xs italic">Aucune demande récente</div>
              )}
            </div>
          </div>

          {/* Fast Actions */}
          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => navigate('/dashboard/pointage-du-mois')}
              className="flex items-center gap-4 p-4 bg-blue-50 text-[#0040a1] rounded-xl hover:bg-blue-100 transition-all group"
            >
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">request_quote</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Bulletins de paie</p>
                <p className="text-xs opacity-70">Consulter mes derniers bulletins</p>
              </div>
            </button>
            <button 
              onClick={() => navigate('/dashboard/coffre-fort')}
              className="flex items-center gap-4 p-4 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all group"
            >
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">shield</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Coffre-fort Numérique</p>
                <p className="text-xs text-slate-500">Documents et signatures</p>
              </div>
            </button>
            <button 
              onClick={() => navigate('/dashboard/support')}
              className="flex items-center gap-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-all group"
            >
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">contact_support</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Support Interne</p>
                <p className="text-xs text-emerald-600/70">Besoin d'aide administrative ?</p>
              </div>
            </button>
          </div>
        </section>
      </div>

      {/* Lower Section: Document Spotlight */}
      <section className="mt-10 bg-slate-900 rounded-2xl p-8 overflow-hidden relative group">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="max-w-md">
            <span className="inline-block px-3 py-1 rounded-full bg-[#0040a1] text-white text-[10px] font-bold uppercase tracking-widest mb-4">Nouveauté RH</span>
            <h4 className="text-2xl font-['Manrope'] font-bold text-white mb-2">Guide de la Politique de Télétravail 2024</h4>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">Découvrez les nouvelles modalités de flexibilité applicables à partir du 1er Novembre pour tous les cadres seniors.</p>
            <button className="flex items-center gap-2 text-[#0040a1] font-bold group-hover:gap-3 transition-all">
              <span>Lire le document</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
          <div className="hidden md:block w-72 h-44 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-4 transform rotate-3 hover:rotate-0 transition-all duration-500 shadow-2xl">
            <div className="w-full h-full bg-white/5 rounded-lg border border-dashed border-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-white/20">description</span>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>
      </section>
    </div>
  );
}
