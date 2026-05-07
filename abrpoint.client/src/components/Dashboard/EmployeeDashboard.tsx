import { useState, useMemo, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useTranslation } from 'react-i18next';
import useGetDemConges from '../../hooks/congeHooks/useGetDemConges';
import useGetProfile from '../../hooks/profileHooks/useGetProfile';
import useGetMyKPIs from '../../hooks/useGetMyKPIs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../helper/AuthProvider';
import { useCountUp } from '../helper/animations/useCountUp';
import './DashboardModern.css';
import EmployeeDashboardMobile from './EmployeeDashboardMobile';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  // Sentinel interne pour le statut d'une demande. On garde des codes ASCII stables
  // ('approved' / 'refused' / 'pending') au lieu des libellés français pour que la
  // comparaison ci-dessous fonctionne quelle que soit la langue active.
  const getStatus = (req: any): 'approved' | 'refused' | 'pending' => {
    const n = req.etat?.trim().toLowerCase() ?? '';
    if (n.includes('refus') || req.conrefus === '1') return 'refused';
    if (n.includes('accept') || n.includes('approuv')) return 'approved';
    return 'pending';
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
    // null si l'employé n'est pas éligible RTT côté fiche (méthode 'N' ou non définie).
    rtt: (kpiData as any)?.rtt ?? null as null | { methode: string; droitAnnuel: number; pris: number; solde: number },
  }), [kpiData]);

  // Chart data from KPI endpoint's weekly tracking. Les clés (LUN, MAR…) restent
  // les sentinels du backend ; le label affiché passe par i18n via `weekdaysShort`.
  const chartData = useMemo(() => {
    const dayKeys = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    const labels = [
      t('employeeDashboard.weekdaysShort.mon'),
      t('employeeDashboard.weekdaysShort.tue'),
      t('employeeDashboard.weekdaysShort.wed'),
      t('employeeDashboard.weekdaysShort.thu'),
      t('employeeDashboard.weekdaysShort.fri'),
      t('employeeDashboard.weekdaysShort.sat'),
      t('employeeDashboard.weekdaysShort.sun'),
    ];
    const data = dayKeys.map((_, idx) => ({ name: labels[idx], hours: 0, isToday: false }));

    const todayIndex = (dayjs().day() + 6) % 7;
    if (data[todayIndex]) data[todayIndex].isToday = true;

    if (kpiData?.suiviPointageSemaine) {
      dayKeys.forEach((key, idx) => {
        const hours = kpiData.suiviPointageSemaine[key] || 0;
        data[idx].hours = Math.min(hours, 12);
      });
    }
    return data;
  }, [kpiData, t]);

  // Compteurs animés sur les KPI principaux — interpole de 0 vers la cible en 700 ms,
  // ease-out cubic. Donne au tableau de bord un sentiment « en direct » au lieu d'un
  // saut de 0 à la valeur. Le solde et l'objectif gardent une décimale (jours, heures),
  // les demandes pending sont entières.
  const animatedSolde = useCountUp(kpis.solde, { decimals: 1 });
  const animatedAcquired = useCountUp(kpis.acquired, { decimals: 1 });
  const animatedWorked = useCountUp(kpis.worked, { decimals: 1 });
  const animatedObjective = useCountUp(kpis.objective ?? 0, { decimals: 1 });
  const animatedPending = useCountUp(kpis.pending, { decimals: 0 });
  const animatedPercent = useCountUp(kpis.workedPercent ?? 0, { decimals: 0 });
  const animatedRttSolde = useCountUp(kpis.rtt?.solde ?? 0, { decimals: 1 });

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
    // Skeleton du dashboard : on reproduit la silhouette des cartes pour que la
    // mise en page n'apparaisse pas brutalement quand la donnée arrive. Mieux qu'un
    // spinner centré (qui donnait l'impression d'un écran cassé pendant 1-2 s).
    return (
      <div className="min-h-screen bg-[#f7f9fb] font-['Inter'] text-[#191c1e] p-8">
        <section className="mb-10">
          <div className="h-9 w-72 bg-slate-200 rounded-md mb-3 animate-pulse" />
          <div className="h-4 w-56 bg-slate-100 rounded-md animate-pulse" />
        </section>
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white p-6 rounded-xl border border-transparent shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="w-11 h-11 bg-slate-100 rounded-xl animate-pulse" />
                <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-9 w-20 bg-slate-200 rounded-md mb-2 animate-pulse" />
              <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
              <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full animate-pulse" />
            </div>
          ))}
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-white rounded-xl p-8 shadow-sm">
            <div className="flex justify-between items-center mb-10">
              <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
              <div className="h-7 w-32 bg-slate-100 rounded-lg animate-pulse" />
            </div>
            <div className="h-64 bg-slate-50 rounded-lg animate-pulse" />
          </div>
          <div className="lg:col-span-4 bg-white rounded-xl p-6 shadow-sm">
            <div className="h-5 w-40 bg-slate-200 rounded mb-6 animate-pulse" />
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1">
                  <div className="h-3 w-3/4 bg-slate-200 rounded mb-2 animate-pulse" />
                  <div className="h-2 w-1/2 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
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
              {t('employeeDashboard.greeting', { firstName: userName?.split(' ')[0] || profile?.emplib?.split(' ')[0] || t('employeeDashboard.defaultName') })}
            </h2>
            <p className="text-slate-500 font-medium">{t('employeeDashboard.weekSummary', { date: dayjs().startOf('week').add(1, 'day').format('DD MMMM') })}</p>
          </div>
          <button
            onClick={() => navigate('/dashboard/gestion-de-conge')}
            className="bg-gradient-to-br from-[#0040a1] to-[#0056d2] text-white px-6 py-3.5 rounded-xl font-['Manrope'] font-bold flex items-center gap-2 shadow-lg shadow-[#0040a1]/20 hover:-translate-y-0.5 transition-transform"
          >
            <span className="material-symbols-outlined">add</span>
            {t('employeeDashboard.newRequest')}
          </button>
        </div>
      </section>

      {/* KPI Bento Row — passe à 4 colonnes si l'employé a un solde RTT à afficher. */}
      <section className={`grid grid-cols-1 ${kpis.rtt ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6 mb-10`}>
        <div className="bg-white p-6 rounded-xl border border-transparent shadow-sm hover:border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-[#0040a1] rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">event_available</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('employeeDashboard.remainingLeave')}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-['Manrope'] font-black text-[#191c1e]">{animatedSolde}</span>
            <span className="text-slate-400 font-medium">{kpis.acquired > 0 ? t('employeeDashboard.daysAcquired', { count: Number(animatedAcquired) }) : t('employeeDashboard.daysAcquiredEmpty')}</span>
          </div>
          <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#0040a1] rounded-full transition-all duration-700" style={{ width: `${kpis.acquired > 0 ? Math.min((kpis.solde / kpis.acquired) * 100, 100) : 0}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-transparent shadow-sm hover:border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">timer</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('employeeDashboard.workTime')}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-['Manrope'] font-black text-[#191c1e]">{animatedWorked}</span>
            <span className="text-slate-400 font-medium">{kpis.objective ? t('employeeDashboard.workTarget', { target: animatedObjective }) : t('employeeDashboard.workTargetEmpty')}</span>
          </div>
          <p className="mt-4 text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            {t('employeeDashboard.weekObjective', { percent: animatedPercent })}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-transparent shadow-sm hover:border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('employeeDashboard.pending')}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-['Manrope'] font-black text-[#191c1e]">{Number(animatedPending).toString().padStart(2, '0')}</span>
            <span className="text-slate-400 font-medium">{t('employeeDashboard.pendingRequests')}</span>
          </div>
          <p className="mt-4 text-xs text-slate-400 font-medium italic">{t('employeeDashboard.nextReview')}</p>
        </div>

        {/* Carte RTT — affichée seulement si la méthode RTT n'est pas 'N'. */}
        {kpis.rtt && (
          <div className="bg-white p-6 rounded-xl border border-transparent shadow-sm hover:border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined">work_history</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('conge.rtt.card.label')}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-['Manrope'] font-black text-[#191c1e]">{animatedRttSolde}</span>
              <span className="text-slate-400 font-medium">
                {kpis.rtt.droitAnnuel > 0
                  ? `sur ${kpis.rtt.droitAnnuel.toFixed(1)} ${t('conge.rtt.card.unit')}`
                  : t('conge.rtt.card.unit')}
              </span>
            </div>
            <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${kpis.rtt.droitAnnuel > 0 ? Math.min((kpis.rtt.solde / kpis.rtt.droitAnnuel) * 100, 100) : 0}%` }} />
            </div>
          </div>
        )}
      </section>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Pointage Analysis */}
        <section className="lg:col-span-8 bg-white rounded-xl p-8 shadow-sm border border-transparent">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-['Manrope'] font-bold text-[#0d1c2e]">{t('employeeDashboard.punchTracking')}</h3>
            <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
              <button
                onClick={() => setActiveTab('week')}
                className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'week' ? 'bg-white text-[#0040a1] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {t('employeeDashboard.week')}
              </button>
              <button
                onClick={() => setActiveTab('month')}
                className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'month' ? 'bg-white text-[#0040a1] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {t('employeeDashboard.month')}
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
                          <p className="text-lg font-['Manrope'] font-black text-[#0040a1]">{payload[0].value} <span className="text-[11px] font-bold opacity-60">{t('employeeDashboard.hoursLabel')}</span></p>
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
                {t('employeeDashboard.dailyTarget', { hours: dailyTargetHours })}
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: Recent Requests */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-['Manrope'] font-bold text-[#0d1c2e]">{t('employeeDashboard.recentRequests')}</h3>
              <button
                onClick={() => navigate('/dashboard/gestion-de-conge')}
                className="text-[10px] font-bold text-[#0040a1] hover:underline uppercase tracking-wider"
              >
                {t('employeeDashboard.viewAll')}
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
                        <p className="text-sm font-bold text-[#191c1e]">{t('employeeDashboard.paidLeave')}</p>
                        <p className="text-[10px] text-slate-400">{dayjs(req.condep).format('DD MMM')} - {dayjs(req.conret).format('DD MMM')}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {status === 'approved' ? t('employeeDashboard.validated') : status === 'pending' ? t('employeeDashboard.pendingShort') : t('employeeDashboard.refused')}
                    </span>
                  </div>
                );
              })}
              {(!leaveRequests || leaveRequests.length === 0) && (
                <div className="py-6 text-center text-slate-400 text-xs italic">{t('employeeDashboard.noRecentRequest')}</div>
              )}
            </div>
          </div>

          {/* Fast Actions */}
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => navigate('/dashboard/coffre-fort#payslips')}
              className="flex items-center gap-4 p-4 bg-blue-50 text-[#0040a1] rounded-xl hover:bg-blue-100 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 group"
            >
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">request_quote</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">{t('employeeDashboard.paySlips')}</p>
                <p className="text-xs opacity-70">{t('employeeDashboard.paySlipsSubtitle')}</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/dashboard/coffre-fort')}
              className="flex items-center gap-4 p-4 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 group"
            >
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">shield</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">{t('employeeDashboard.vault')}</p>
                <p className="text-xs text-slate-500">{t('employeeDashboard.vaultSubtitle')}</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/dashboard/support')}
              className="flex items-center gap-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 group"
            >
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">contact_support</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">{t('employeeDashboard.internalSupport')}</p>
                <p className="text-xs text-emerald-600/70">{t('employeeDashboard.internalSupportSubtitle')}</p>
              </div>
            </button>
          </div>
        </section>
      </div>

      {/* Lower Section: Document Spotlight */}
      <section className="mt-10 bg-slate-900 rounded-2xl p-8 overflow-hidden relative group">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="max-w-md">
            <span className="inline-block px-3 py-1 rounded-full bg-[#0040a1] text-white text-[10px] font-bold uppercase tracking-widest mb-4">{t('employeeDashboard.hrNews')}</span>
            <h4 className="text-2xl font-['Manrope'] font-bold text-white mb-2">{t('employeeDashboard.remoteGuideTitle')}</h4>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">{t('employeeDashboard.remoteGuideText')}</p>
            <button className="flex items-center gap-2 text-[#0040a1] font-bold group-hover:gap-3 transition-all">
              <span>{t('employeeDashboard.readDocument')}</span>
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
