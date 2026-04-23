import { useState, useEffect, useMemo } from 'react';
import { useCalendrierContext, CalendrierProvider } from "../../helper/CalendrierContext";
import useGetCalendrierSociete from "../../../hooks/calendrierHooks/useGetCalendrierSociete";
// import useGetCalendrier from "../../../hooks/calendrierHooks/useGetCalendriers";
import useUpdateCalendrier from "../../../hooks/calendrierHooks/useUpdateCalendrier";
import useCloneCalendrier from "../../../hooks/calendrierHooks/useCloneCalendrier";
import useAddCalendrier from "../../../hooks/calendrierHooks/useAddCalendrier";
import useGetCummulMensuelle from "../../../hooks/calendrierHooks/useGetCummulMensuelle";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Download,
  CheckCircle2,
  Info,
  Lightbulb,
  Plus,
  Copy,
  X,
  AlertCircle
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from "react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';

const queryClient = new QueryClient();

interface CalendarEntry {
  soccod: string;
  calAn: string;
  calTrav: number;
  calNbh: number;
  calHouv: number;
  calHjour: number;
  calMois: string;
  calSem: string;
  calDate: string;
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

function CalendrierContent() {
  const { selectedCalendrier, setSelectedCalendrier } = useCalendrierContext();
  const soccod = localStorage.getItem("soccod") || "01";

  // State
  const [currentDate, setCurrentDate] = useState(new Date(2026, 9, 1));
  const selectedMonth = format(currentDate, 'MM');
  const selectedYear = format(currentDate, 'yyyy');

  // Hooks data
  const { data = [], refetch } = useGetCalendrierSociete(selectedYear);
  // const { data: availableYears = [], isLoading: loadingYears } = useGetCalendrier();
  const availableYears = ["2023", "2024", "2025", "2026", "2027", "2028", "2029", "2030", "2031", "2032", "2035", "2036", "2037"];
  const { data: cumulData = [] } = useGetCummulMensuelle(selectedYear);

  // Form State
  const [allDay, setAllDay] = useState(8);
  const [samedi, setSamedi] = useState(5);
  const [jourRepos, setJourRepos] = useState("0");
  const [tousLesMois, setTousLesMois] = useState(false);

  // Feedback Message
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // New Planning Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newYear, setNewYear] = useState(Number(selectedYear) + 1);
  const [newBaseHours, setNewBaseHours] = useState(8);
  const [sourceYear, setSourceYear] = useState(selectedYear);

  useEffect(() => {
    setNewYear(Number(selectedYear) + 1);
    setSourceYear(selectedYear);
  }, [selectedYear, showAddModal]);

  useEffect(() => {
    if (!selectedCalendrier) {
      setSelectedCalendrier(selectedYear);
    }
  }, [selectedYear, selectedCalendrier, setSelectedCalendrier]);

  const updateCalendrier = useUpdateCalendrier(
    soccod,
    selectedYear,
    selectedMonth,
    Number(allDay),
    Number(samedi),
    tousLesMois ? 1 : 0,
    jourRepos
  );

  const cloneCalendrier = useCloneCalendrier();
  const addCalendrier = useAddCalendrier();

  // Handlers
  const handleSave = () => {
    updateCalendrier.mutate(undefined, {
      onSuccess: () => {
        refetch();
        showFeedback(`Réglages enregistrés pour ${format(currentDate, 'MMMM yyyy', { locale: fr })}`);
      },
      onError: () => showFeedback('Erreur lors de l\'enregistrement des réglages.', 'error'),
    });
  };

  const handlePrevMonth = () => {
    const currentMonthNum = parseInt(selectedMonth);
    if (currentMonthNum > 1) {
      const newDate = new Date(currentDate);
      newDate.setMonth(currentMonthNum - 2);
      setCurrentDate(newDate);
    }
  };

  const handleNextMonth = () => {
    const currentMonthNum = parseInt(selectedMonth);
    if (currentMonthNum < 12) {
      const newDate = new Date(currentDate);
      newDate.setMonth(currentMonthNum);
      setCurrentDate(newDate);
    }
  };

  const handleAddNewYear = () => {
    addCalendrier.mutate({
      soccod,
      annee: newYear.toString(),
      caltype: newBaseHours.toString()
    }, {
      onSuccess: () => {
        setShowAddModal(false);
        refetch();
        showFeedback(`Planification ${newYear} créée avec succès !`);
      },
      onError: () => showFeedback(`Erreur lors de la création de l'année ${newYear}.`, 'error'),
    });
  };

  const handleCloneYear = () => {
    cloneCalendrier.mutate(Number(sourceYear), {
      onSuccess: () => {
        setShowAddModal(false);
        refetch();
        showFeedback(`Année ${sourceYear} clonée avec succès !`);
      },
      onError: () => showFeedback(`Erreur lors du clonage de l'année ${sourceYear}.`, 'error'),
    });
  };

  // Calendar Logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group data by date for easy access
  const entriesByDate = useMemo(() => {
    const map: Record<string, CalendarEntry> = {};
    if (Array.isArray(data)) {
      data.forEach((entry: CalendarEntry) => {
        const dateStr = entry.calDate.split('T')[0];
        map[dateStr] = entry;
      });
    }
    return map;
  }, [data]);

  const filteredData = useMemo<CalendarEntry[]>(() => {
    return Array.isArray(data) ? data.filter((entry: CalendarEntry) => entry.calMois === selectedMonth) : [];
  }, [data, selectedMonth]);

  const stats = useMemo(() => {
    let totalHours = 0;
    let workedDays = 0;
    filteredData.forEach((entry: CalendarEntry) => {
      totalHours += entry.calNbh;
      if (entry.calNbh > 0) workedDays += 1;
    });
    return { totalHours, workedDays };
  }, [filteredData]);

  // Annual Stats Formatting
  const annualStats = useMemo(() => {
    const monthsData = MONTHS.map((name, i) => {
      const monthNum = (i + 1).toString().padStart(2, '0');
      const entry = (Array.isArray(cumulData) ? cumulData : []).find((c: any) => c.calMois === monthNum);
      return {
        name,
        jm: entry?.calTrav ?? "-",
        hm: entry?.calNbh ?? "-",
        ho: entry?.calHouv ?? "-",
        hj: entry?.calHjour ?? "-",
        perf: entry?.calNbh ? 100 : 0
      };
    });
    return monthsData;
  }, [cumulData]);

  return (
    <div className="bg-surface text-on-surface min-h-screen flex font-body w-full">
      {/* Main Content Area */}
      <main className="flex-1 flex gap-8 p-4 bg-surface w-full">
        <div className="flex-1 flex flex-col gap-8">
          {/* Header Section */}
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs font-label font-bold text-primary uppercase tracking-[0.2em] mb-2">Suivi des temps</p>
              <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tight">Planification & Pointage Mensuel</h2>
            </div>
            <div className="flex items-center gap-3 bg-surface-container-low p-1.5 rounded-xl">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-surface-container-lowest rounded-lg transition-all text-on-surface-variant">
                <ChevronLeft size={20} />
              </button>
              <div className="flex flex-col items-center px-6">
                <span className="font-headline font-black text-sm uppercase text-primary tracking-tighter">
                  {format(currentDate, 'MMMM', { locale: fr })}
                </span>
                <select
                  value={selectedCalendrier || selectedYear}
                  onChange={(e) => {
                    const newYearNum = Number(e.target.value);
                    const newDate = new Date(currentDate);
                    newDate.setFullYear(newYearNum);
                    setCurrentDate(newDate);
                    setSelectedCalendrier(e.target.value);
                  }}
                  className="bg-transparent border-none text-xs font-bold text-outline p-0 focus:ring-0 cursor-pointer hover:text-primary transition-colors text-center"
                >
                  {/* Liste unique des années disponibles */}
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}

                  {/* Ajouter l'année sélectionnée si elle n'est pas dans la liste */}
                  {Array.isArray(availableYears) && !availableYears.some((c: any) => c.calAn === selectedYear) && (
                    <option value={selectedYear}>{selectedYear}</option>
                  )}

                </select>
              </div>
              <button onClick={handleNextMonth} className="p-2 hover:bg-surface-container-lowest rounded-lg transition-all text-on-surface-variant">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px overflow-hidden bg-outline-variant/20 rounded-2xl shadow-sm border border-outline-variant/10">
            {/* Day Headers */}
            {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(day => (
              <div key={day} className="bg-surface-container-high py-4 text-center">
                <span className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">{day}</span>
              </div>
            ))}

            {/* Day Cells */}
            {(() => {
              const cells = [];
              const firstDayOfMonth = getDay(monthStart);
              const startOffset = (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1);

              for (let i = 0; i < startOffset; i++) {
                cells.push(<div key={`offset-${i}`} className="min-h-[120px] p-4 bg-surface-container text-outline opacity-40" />);
              }

              calendarDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const entry = entriesByDate[dateStr];

                cells.push(
                  <div key={dateStr} className="min-h-[120px] p-4 flex flex-col justify-between bg-surface-container-lowest text-on-surface hover:bg-primary/5 transition-colors group cursor-pointer border-t border-outline-variant/10">
                    <span className="text-xs font-label font-bold">{format(day, 'd MMM')}</span>
                    {entry ? (
                      entry.calNbh > 0 ? (
                        <div className="bg-primary/10 text-primary px-3 py-2 rounded-lg border-l-4 border-primary">
                          <p className="text-[10px] font-bold leading-tight">08:30 - 17:30</p>
                          <p className="text-[10px] font-black uppercase tracking-tighter mt-1">({entry.calNbh}h)</p>
                        </div>
                      ) : (
                        <span className="text-[10px] font-label font-semibold italic text-outline">Repos hebdomadaire</span>
                      )
                    ) : null}
                  </div>
                );
              });

              const totalCells = cells.length;
              const remaining = (7 - (totalCells % 7)) % 7;
              for (let i = 0; i < remaining; i++) {
                cells.push(<div key={`empty-${i}`} className="min-h-[120px] p-4 bg-surface-container text-outline opacity-40" />);
              }

              return cells;
            })()}
          </div>

          {/* Summary Line */}
          <div className="bg-primary/5 p-6 rounded-2xl flex items-center justify-between border-l-8 border-primary shadow-sm">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="text-primary" size={32} />
              <div>
                <h3 className="text-2xl font-black font-headline text-primary">Total du mois : {stats.totalHours} heures</h3>
                <p className="text-sm font-label font-semibold text-on-surface-variant">Basé sur <span className="text-on-surface font-bold">{stats.workedDays} jours travaillés</span></p>
              </div>
            </div>
            <div className="flex gap-4">
              <button className="px-6 py-2 bg-surface-container-lowest text-on-surface text-sm font-bold font-headline rounded-xl shadow-sm hover:translate-y-[-1px] transition-all flex items-center gap-2">
                <Download size={16} /> Télécharger PDF
              </button>
              <button onClick={handleSave} className="px-6 py-2 bg-primary text-on-primary text-sm font-bold font-headline rounded-xl shadow-sm hover:translate-y-[-1px] transition-all flex items-center gap-2">
                <Save size={16} /> Valider les heures
              </button>
            </div>
          </div>

          {/* Annual Statistics */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-extrabold font-headline tracking-tight">Statistiques Annuelles {selectedYear}</h3>
              <div className="flex items-center gap-2 text-outline">
                <Info size={14} />
                <span className="text-xs font-label font-medium italic">Calculé automatiquement par Architect Ledger</span>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl bg-surface-container-low shadow-sm border border-outline-variant/10">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-high">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">Mois</th>
                    <th className="px-6 py-4 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant text-center">Jours/Mois</th>
                    <th className="px-6 py-4 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant text-center">Heures/Mois</th>
                    <th className="px-6 py-4 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant text-center">Heures Ouvrées</th>
                    <th className="px-6 py-4 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant text-center">Heures/Jour</th>
                    <th className="px-6 py-4 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant text-right">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {annualStats.map((month, i) => (
                    <tr key={i} className="hover:bg-surface-container-lowest transition-colors group">
                      <td className="px-6 py-4 font-headline font-bold text-sm text-on-surface">{month.name}</td>
                      <td className="px-6 py-4 font-label font-medium text-sm text-center">{month.jm}</td>
                      <td className="px-6 py-4 font-headline font-bold text-sm text-center text-primary">{month.hm}</td>
                      <td className="px-6 py-4 font-label font-medium text-sm text-center text-on-surface-variant">{month.ho}</td>
                      <td className="px-6 py-4 font-label font-medium text-sm text-center">{month.hj}</td>
                      <td className="px-6 py-4 text-right">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase ${month.perf > 0 ? 'bg-tertiary-container/10 text-tertiary' : 'bg-surface-container-high text-outline'}`}>
                          <span className={`w-2 h-2 rounded-full ${month.perf > 0 ? 'bg-tertiary' : 'bg-outline'}`}></span>
                          {month.perf}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Configuration Sidebar (Right) */}
        <aside className="w-80 flex flex-col gap-8">
          <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-lg flex flex-col gap-6 sticky top-28 border border-outline-variant/20">
            <div>
              <h3 className="text-xl font-extrabold font-headline tracking-tight text-primary mb-1">Configuration</h3>
              <p className="text-xs font-label font-medium text-outline">Ajustez vos paramètres mensuels</p>
            </div>
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">Heures par jour</label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-low rounded-xl py-3 px-4 border-none focus:ring-2 focus:ring-primary/20 text-sm font-headline font-bold"
                    type="number"
                    value={allDay}
                    onChange={(e) => setAllDay(Number(e.target.value))}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-outline text-xs font-bold uppercase">h/j</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">Samedi (Heures)</label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-low rounded-xl py-3 px-4 border-none focus:ring-2 focus:ring-primary/20 text-sm font-headline font-bold"
                    type="number"
                    value={samedi}
                    onChange={(e) => setSamedi(Number(e.target.value))}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-outline text-xs font-bold uppercase">h</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">Jour de repos</label>
                <select
                  className="w-full bg-surface-container-low rounded-xl py-3 px-4 border-none focus:ring-2 focus:ring-primary/20 text-sm font-headline font-bold appearance-none cursor-pointer"
                  value={jourRepos}
                  onChange={(e) => setJourRepos(e.target.value)}
                >
                  <option value="0">Dimanche</option>
                  <option value="1">Lundi</option>
                  <option value="2">Mardi</option>
                  <option value="3">Mercredi</option>
                  <option value="4">Jeudi</option>
                  <option value="5">Vendredi</option>
                  <option value="6">Samedi</option>
                </select>
              </div>

              <div className="pt-4 border-t border-outline-variant/20">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-label font-bold text-on-surface-variant">Appliquer à tous les mois</span>
                  <div
                    onClick={() => setTousLesMois(!tousLesMois)}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-all duration-300 ${tousLesMois ? 'bg-primary' : 'bg-outline-variant'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${tousLesMois ? 'right-1' : 'left-1'}`}></div>
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  className="w-full py-4 bg-primary text-on-primary font-headline font-bold rounded-xl hover:translate-y-[-1px] transition-all active:scale-95 text-sm shadow-md mb-3"
                >
                  Enregistrer les réglages
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full py-4 bg-surface-container-high text-primary font-headline font-bold rounded-xl hover:translate-y-[-1px] transition-all active:scale-95 text-sm border border-primary/10 flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Initialiser une année
                </button>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-secondary-container/20 flex gap-4">
              <Lightbulb className="text-secondary flex-shrink-0" size={20} />
              <p className="text-[10px] font-label leading-relaxed text-on-secondary-fixed-variant">
                <strong>Astuce :</strong> Le pointage se synchronise automatiquement avec votre terminal physique chaque jour à 23h59.
              </p>
            </div>
          </div>

          {/* Bento Card: Employee Context */}
          <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <img alt="Team member" className="w-12 h-12 rounded-full object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
              <div>
                <p className="text-[10px] font-label font-bold text-outline uppercase tracking-wider">Affectation actuelle</p>
                <h4 className="text-sm font-extrabold font-headline">Architecture & Design Hub</h4>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-label text-on-surface-variant">Congés restants</span>
                <span className="text-xs font-headline font-bold">12 jours</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-primary w-2/3"></div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* New Planning Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20 scale-in-center animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black font-headline text-primary tracking-tight">Nouvelle Planification</h3>
                <p className="text-xs font-label font-medium text-outline">Configurez le calendrier pour une nouvelle année</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">Année Source</label>
                  <select
                    className="w-full bg-surface-container-low rounded-xl py-3 px-4 border-none focus:ring-2 focus:ring-primary/20 text-sm font-headline font-bold"
                    value={sourceYear}
                    onChange={(e) => setSourceYear(e.target.value)}
                  >
                    {availableYears.map((year: string) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">Nouvelle Année</label>
                  <input
                    className="w-full bg-surface-container-low rounded-xl py-3 px-4 border-none focus:ring-2 focus:ring-primary/20 text-sm font-headline font-bold"
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">Base heures par jour</label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-low rounded-xl py-4 px-5 border-none focus:ring-2 focus:ring-primary/20 text-lg font-headline font-black"
                    type="number"
                    value={newBaseHours}
                    onChange={(e) => setNewBaseHours(Number(e.target.value))}
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-outline font-bold">h/j</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button
                  onClick={handleCloneYear}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-secondary-container/10 border-2 border-dashed border-secondary/30 hover:bg-secondary-container/20 transition-all group"
                >
                  <Copy size={24} className="text-secondary group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Cloner {selectedYear}</span>
                </button>
                <button
                  onClick={handleAddNewYear}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-primary text-on-primary shadow-lg hover:translate-y-[-2px] transition-all"
                >
                  <Plus size={24} className="animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Créer Nouveau</span>
                </button>
              </div>
            </div>

            <div className="p-6 bg-surface-container-high/30 text-center">
              <p className="text-[10px] font-label font-medium text-outline italic">
                L'initialisation générera 12 mois de calendrier basés sur vos paramètres.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all duration-300 ${feedbackMsg.type === 'success'
            ? 'bg-primary text-on-primary border-primary/30'
            : 'bg-error text-on-error border-error/30'
          }`}>
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span className="text-sm font-headline font-bold">{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="ml-2 p-1 rounded-full hover:bg-white/20 transition-all">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Calendrier() {
  return (
    <QueryClientProvider client={queryClient}>
      <CalendrierProvider>
        <CalendrierContent />
      </CalendrierProvider>
    </QueryClientProvider>
  )
}

export default Calendrier;