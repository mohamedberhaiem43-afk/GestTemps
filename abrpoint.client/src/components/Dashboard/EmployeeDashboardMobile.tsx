import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../helper/AuthProvider';
import useGetProfile from '../../hooks/profileHooks/useGetProfile';
import useGetMyKPIs from '../../hooks/useGetMyKPIs';
import useGetDemConges from '../../hooks/congeHooks/useGetDemConges';
import useAddPointage from '../../hooks/pointeuseHooks/useAddPointage';
import { CircularProgress, Snackbar, Alert } from '@mui/material';

dayjs.locale('fr');

export default function EmployeeDashboardMobile() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userName, soccod, uticod, isAdmin } = useAuth();
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
          setSnackbar({ open: true, message: t('employeeDashboard.attendanceMarked'), severity: 'success' });
        },
        onError: (err: any) => {
          setSnackbar({ open: true, message: err?.response?.data?.message || t('employeeDashboard.attendanceError'), severity: 'error' });
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
  const firstName = userName?.split(' ')[0] || profile?.emplib?.split(' ')[0] || t('employeeDashboard.defaultName');

  return (
    <div className="bg-[#f7f9fb] min-h-screen font-['Inter'] text-[#191c1e] pb-24">
      <main className="pt-2 px-6 max-w-lg mx-auto">
        {/* Greeting */}
        <section className="mb-8">
          <p className="font-['Inter'] uppercase tracking-wider text-slate-500 text-[10px] font-bold mb-1">{today}</p>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-['Manrope'] font-extrabold text-[#191c1e] tracking-tight">{t('employeeDashboard.greeting', { firstName }).replace('.', '')}</h1>
            {loadingKPIs && <CircularProgress size={20} sx={{ color: '#0040a1' }} />}
          </div>
        </section>

        {/* Pointage Card */}
        <section className="mb-10">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0040a1] to-[#0056d2] p-6 shadow-xl shadow-[#0040a1]/20">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <span className="font-['Inter'] text-[10px] font-semibold uppercase tracking-widest text-white/70">{t('employeeDashboard.serverTime')}</span>
                  <div className="text-4xl font-['Manrope'] font-extrabold text-white mt-1">{serverTime}</div>
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
                  <span className="material-symbols-outlined text-[14px] text-white">location_on</span>
                  <span className="text-[10px] font-['Inter'] font-bold text-white tracking-wide uppercase">{t('employeeDashboard.gpsActive')}</span>
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
                    {t('employeeDashboard.punchIn')}
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
            <h2 className="font-['Manrope'] font-bold text-lg">{t('employeeDashboard.activitySummary')}</h2>
            <button
              type="button"
              onClick={() => navigate('/dashboard/gestion-de-conge')}
              className="font-['Inter'] text-[10px] uppercase font-bold text-[#0040a1] tracking-tighter active:opacity-70"
            >
              {t('employeeDashboard.viewAll')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Worked Hours (Full width) */}
            <div className="col-span-2 bg-white p-5 rounded-2xl flex items-center justify-between border border-slate-100 shadow-sm">
              <div>
                <span className="font-['Inter'] text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('employeeDashboard.workTimeMobile')}</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-['Manrope'] font-extrabold">{kpis.worked.toFixed(1)}h</span>
                  <span className="text-sm font-['Inter'] text-slate-400">{t('employeeDashboard.workTimeOf')}</span>
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
              <span className="font-['Inter'] text-[10px] uppercase font-bold text-slate-400 tracking-wider block">{t('employeeDashboard.leavesShort')}</span>
              <div className="text-xl font-['Manrope'] font-extrabold mt-1">{kpis.solde.toFixed(1)} {t('employeeDashboard.daysShort')}</div>
            </div>

            {/* Pending Requests */}
            <div
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm cursor-pointer active:scale-[0.98] transition-all"
              onClick={() => navigate('/dashboard/gestion-de-conge')}
            >
              <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-3">
                <span className="material-symbols-outlined">pending_actions</span>
              </div>
              <span className="font-['Inter'] text-[10px] uppercase font-bold text-slate-400 tracking-wider block">{t('employeeDashboard.requestsLabel')}</span>
              <div className="text-xl font-['Manrope'] font-extrabold mt-1">
                {loadingLeaves ? '...' : (leaveRequests?.length || 0).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        </section>

        {/* Weekly Chart */}
        <section className="mb-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-['Manrope'] font-bold text-md">{t('employeeDashboard.punchTrackingMobile')}</h2>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase rounded-full">
                {kpis.workedPercent >= 100 ? t('employeeDashboard.goalReached') : t('employeeDashboard.inProgress')}
              </span>
            </div>
            {/* Bar chart area */}
            <div className="flex items-end justify-between h-36 gap-2">
              {chartData.map((day, idx) => {
                const todayIdx = (dayjs().day() + 6) % 7; // Mon=0 … Sun=6
                const isToday = idx === todayIdx;
                const pct = Math.max(Math.min((day.hours / 8) * 100, 100), day.hours > 0 ? 6 : 2);
                return (
                  <div key={idx} className="flex flex-col items-center flex-1 gap-2 min-w-0">
                    {/* Bar wrapper – grows to fill space, aligns bar to bottom */}
                    <div className="relative w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${isToday ? 'bg-[#0040a1]' : 'bg-[#0040a1]/20'}`}
                        style={{ height: `${pct}%`, minHeight: 3 }}
                      ></div>
                    </div>
                    {/* Day label */}
                    <span className={`text-[10px] font-bold font-['Inter'] truncate ${isToday ? 'text-[#0040a1]' : 'text-slate-400'}`}>
                      {day.name}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Hours legend */}
            <div className="flex justify-between mt-3 px-1">
              <span className="text-[9px] text-slate-400 font-['Inter']">{t('employeeDashboard.legendStart')}</span>
              <span className="text-[9px] text-slate-400 font-['Inter']">{t('employeeDashboard.legendTarget')}</span>
            </div>
          </div>
        </section>

        {/* Quick Access Section */}
        <section className="mb-10">
          <h2 className="font-['Manrope'] font-bold text-lg mb-4">{t('employeeDashboard.quickAccess')}</h2>
          <div className="grid grid-cols-1 gap-4">
            {isAdmin && (
              <button
                onClick={() => navigate('/dashboard/etat-periodique')}
                className="flex items-center gap-4 p-4 bg-purple-50 text-purple-700 rounded-2xl hover:bg-purple-100 transition-all active:scale-[0.98]"
              >
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <span className="material-symbols-outlined text-2xl">analytics</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold">{t('employeeDashboard.periodicReport')}</p>
                  <p className="text-xs text-purple-600/70">{t('employeeDashboard.periodicReportSubtitle')}</p>
                </div>
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard/coffre-fort#payslips')}
              className="flex items-center gap-4 p-4 bg-blue-50 text-[#0040a1] rounded-2xl hover:bg-blue-100 transition-all active:scale-[0.98]"
            >
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <span className="material-symbols-outlined text-2xl">receipt_long</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">{t('employeeDashboard.paySlips')}</p>
                <p className="text-xs opacity-70">{t('employeeDashboard.paySlipsSubtitle')}</p>
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
                <p className="text-sm font-bold">{t('employeeDashboard.vault')}</p>
                <p className="text-xs text-slate-500">{t('employeeDashboard.vaultSubtitle')}</p>
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
                <p className="text-sm font-bold">{t('employeeDashboard.expenseNotes')}</p>
                <p className="text-xs text-orange-600/70">{t('employeeDashboard.expenseSubtitle')}</p>
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
                <p className="text-sm font-bold">{t('employeeDashboard.hrSupport')}</p>
                <p className="text-xs text-emerald-600/70">{t('employeeDashboard.hrSubtitle')}</p>
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
