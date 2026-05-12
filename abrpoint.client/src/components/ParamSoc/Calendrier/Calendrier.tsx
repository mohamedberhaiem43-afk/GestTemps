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
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const queryClient = new QueryClient();

interface CalendarEntry {
  soccod: string;
  caltype?: string;
  calAn: string;
  calTrav: number;
  calNbh: number;
  calHouv: number;
  calHjour: number;
  calMois: string;
  calSem: string;
  calDate: string;
}

const MONTH_KEYS = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre"
];

function CalendrierContent() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('en') ? enUS : fr;
  const MONTHS = MONTH_KEYS.map(k => t(`paramSoc.calendrier.monthsLong.${k}`));
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
  // cumulData garde sa raison d'être pour les écrans qui consomment encore l'agrégat
  // côté backend (ex. CumulHeuresMensuelle), mais le tableau ci-dessous se base
  // désormais directement sur `data` (entrées journalières) pour rester réactif.
  const { refetch: refetchCumul } = useGetCummulMensuelle(selectedYear);

  // Caltype actif pour la société/année courante. Avant, on passait `soccod`
  // par erreur en tant que caltype au PUT — le backend filtrait alors sur
  // `Caltype == soccod` et n'affectait aucune ligne (silencieusement). On le
  // résout maintenant à partir des données chargées (premier `caltype` non vide).
  const activeCaltype = useMemo(() => {
    if (!Array.isArray(data)) return '';
    const first = (data as CalendarEntry[]).find(e => !!e.caltype);
    return first?.caltype || '';
  }, [data]);

  // Form State — initialisé avec les valeurs par défaut, mais synchronisé avec
  // les données du serveur via le useEffect plus bas dès qu'elles arrivent.
  const [allDay, setAllDay] = useState(8);
  const [samedi, setSamedi] = useState(5);
  const [jourRepos, setJourRepos] = useState("0");
  const [tousLesMois, setTousLesMois] = useState(false);

  // Synchronise les champs du panneau Configuration avec ce que la base contient
  // pour le mois affiché. Sans ça, après chaque navigation/rechargement on retombait
  // sur 8h/5h/dimanche au lieu d'afficher la config réelle (bug : toujours mêmes
  // valeurs même après modification).
  useEffect(() => {
    if (!Array.isArray(data) || data.length === 0) return;
    const monthEntries = (data as CalendarEntry[]).filter(e => e.calMois === selectedMonth);
    if (monthEntries.length === 0) return;

    // Quel(s) jour(s) sont à 0h sur le mois → c'est le jour de repos paramétré.
    const restDays = new Set<number>();
    monthEntries.forEach(e => {
      if (!e.calDate) return;
      if ((e.calNbh ?? 0) === 0) restDays.add(new Date(e.calDate).getDay());
    });

    let detectedRest = '0';
    if (restDays.has(6) && restDays.has(0)) detectedRest = 'samdim';
    else if (restDays.size > 0) detectedRest = String([...restDays][0]);

    // Heures du samedi : prend la 1re entrée samedi non-marquée repos.
    const satEntry = monthEntries.find(e => e.calDate && new Date(e.calDate).getDay() === 6 && (e.calNbh ?? 0) > 0);

    // Heures par jour ouvré (Lun-Ven) : prend la valeur la plus fréquente.
    const weekHours: Record<number, number> = {};
    monthEntries.forEach(e => {
      if (!e.calDate) return;
      const dow = new Date(e.calDate).getDay();
      if (dow >= 1 && dow <= 5 && (e.calNbh ?? 0) > 0) {
        weekHours[e.calNbh] = (weekHours[e.calNbh] || 0) + 1;
      }
    });
    const dominantWeekHours = Object.entries(weekHours).sort((a, b) => b[1] - a[1])[0]?.[0];

    if (dominantWeekHours) setAllDay(Number(dominantWeekHours));
    if (satEntry) setSamedi(satEntry.calNbh);
    else if (restDays.has(6)) setSamedi(0);
    setJourRepos(detectedRest);
  }, [data, selectedMonth]);

  // Heures hebdomadaires recalculées automatiquement à partir des champs édités
  // (5 jours ouvrés × heures/jour + heures samedi, déduites du jour de repos).
  const weeklyHours = useMemo(() => {
    const restSet = new Set<number>();
    if (jourRepos === 'samdim') { restSet.add(6); restSet.add(0); }
    else restSet.add(Number(jourRepos));

    let total = 0;
    for (let dow = 1; dow <= 5; dow++) {
      if (!restSet.has(dow)) total += allDay;
    }
    if (!restSet.has(6)) total += samedi;
    // Le dimanche n'est jamais payé par défaut, on n'ajoute rien si 0 (jourRepos par défaut).
    return total;
  }, [allDay, samedi, jourRepos]);

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
    activeCaltype,
    selectedYear,
    selectedMonth,
    Number(allDay),
    Number(samedi),
    tousLesMois ? 1 : 0,
    jourRepos
  );

  const cloneCalendrier = useCloneCalendrier();
  const addCalendrier = useAddCalendrier();

  // ── Auto-clonage à l'ouverture de l'année courante ──────────────────────
  // Si l'utilisateur ouvre la page calendrier après le 1er janvier d'une
  // nouvelle année sans qu'aucune donnée n'ait été initialisée, on clone
  // automatiquement le paramétrage de l'année précédente. Ce comportement
  // évite à l'admin la corvée annuelle d'aller dans "Initialiser l'année"
  // → "Cloner". Le bouton manuel reste disponible pour cloner depuis une
  // autre source que N-1.
  //
  // Pré-conditions strictes pour ne pas déclencher abusivement :
  //   1) la requête initiale a bien chargé (data est défini, pas en cours)
  //   2) l'année affichée est l'année calendaire courante (System now)
  //   3) cette année n'a aucune entrée
  //   4) une mutation clone n'est pas déjà en cours (anti-double-trigger
  //      en cas de re-render rapide)
  //   5) on n'a pas déjà déclenché le clone dans cette session (idempotence)
  const [autoCloneTried, setAutoCloneTried] = useState(false);
  useEffect(() => {
    const currentYear = new Date().getFullYear().toString();
    if (selectedYear !== currentYear) return;
    if (autoCloneTried) return;
    if (cloneCalendrier.isLoading) return;
    if (!Array.isArray(data)) return;
    if ((data as CalendarEntry[]).length > 0) return;

    setAutoCloneTried(true);
    cloneCalendrier.mutate(Number(currentYear), {
      onSuccess: () => {
        refetch();
        showFeedback(t('paramSoc.calendrier.autoCloneSuccess', {
          year: currentYear,
          source: (Number(currentYear) - 1).toString(),
          defaultValue: `Calendrier ${currentYear} initialisé à partir de ${Number(currentYear) - 1}.`,
        }));
      },
      // Échec silencieux : si l'année N-1 n'existe pas non plus, on laisse
      // l'utilisateur passer par "Initialiser l'année" manuellement.
      onError: () => { /* no-op */ },
    });
  }, [data, selectedYear, autoCloneTried, cloneCalendrier, refetch, t]);

  // Handlers
  const handleSave = () => {
    if (!activeCaltype) {
      showFeedback(t('paramSoc.calendrier.noCaltype'), 'error');
      return;
    }
    updateCalendrier.mutate(undefined, {
      onSuccess: () => {
        refetch();
        refetchCumul();
        const period = format(currentDate, 'MMMM yyyy', { locale: dateLocale });
        showFeedback(
          tousLesMois
            ? t('paramSoc.calendrier.settingsSavedAll', { year: selectedYear })
            : t('paramSoc.calendrier.settingsSavedFor', { period })
        );
      },
      onError: () => showFeedback(t('paramSoc.calendrier.settingsSaveError'), 'error'),
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
        showFeedback(t('paramSoc.calendrier.yearCreatedSuccess', { year: newYear }));
      },
      onError: () => showFeedback(t('paramSoc.calendrier.yearCreateError', { year: newYear }), 'error'),
    });
  };

  // Génération PDF côté client : on imprime le tableau annuel + la config courante.
  // Pas d'aller-retour serveur — jsPDF + autotable suffisent pour ce volume.
  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const title = t('paramSoc.calendrier.heading');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${title} — ${selectedYear}`, 40, 50);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const configLine = [
      `${t('paramSoc.calendrier.config.hoursPerDay')}: ${allDay}h`,
      `${t('paramSoc.calendrier.config.saturdayHours')}: ${samedi}h`,
      `${t('paramSoc.calendrier.config.weeklyHours')}: ${weeklyHours}h`,
    ].join('   |   ');
    doc.text(configLine, 40, 72);

    autoTable(doc, {
      startY: 95,
      head: [[
        t('paramSoc.calendrier.headers.month'),
        t('paramSoc.calendrier.headers.daysPerMonth'),
        t('paramSoc.calendrier.headers.hoursPerMonth'),
        t('paramSoc.calendrier.headers.openHours'),
        t('paramSoc.calendrier.headers.hoursPerDay'),
      ]],
      body: annualStats.map(m => [m.name, String(m.jm), String(m.hm), String(m.ho), String(m.hj)]),
      headStyles: { fillColor: [0, 64, 161], halign: 'center' },
      bodyStyles: { halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      styles: { fontSize: 9, cellPadding: 6 },
    });

    doc.save(`calendrier-${soccod}-${selectedYear}.pdf`);
  };

  const handleCloneYear = () => {
    cloneCalendrier.mutate(Number(sourceYear), {
      onSuccess: () => {
        setShowAddModal(false);
        refetch();
        showFeedback(t('paramSoc.calendrier.yearClonedSuccess', { year: sourceYear }));
      },
      onError: () => showFeedback(t('paramSoc.calendrier.yearCloneError', { year: sourceYear }), 'error'),
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

  // Statistiques annuelles agrégées DIRECTEMENT depuis les entrées journalières
  // (Lcalendsoc) au lieu de la table de cumul backend qui n'est jamais mise à jour
  // par le PUT update-calendrier — c'était la cause du tableau "toujours statique".
  const annualStats = useMemo(() => {
    const dailyEntries = Array.isArray(data) ? (data as CalendarEntry[]) : [];

    return MONTHS.map((name, i) => {
      const monthNum = (i + 1).toString().padStart(2, '0');
      const monthEntries = dailyEntries.filter(e => e.calMois === monthNum);

      // jm = jours travaillés (calNbh > 0), hm = total heures, ho = jours calendaires
      // ouverts (jours non-repos), hj = moyenne heures/jour ouvré.
      const jm = monthEntries.filter(e => (e.calNbh ?? 0) > 0).length;
      const hm = monthEntries.reduce((s, e) => s + (e.calNbh ?? 0), 0);
      const ho = monthEntries.length;
      const hj = jm > 0 ? Math.round((hm / jm) * 10) / 10 : 0;

      return {
        name,
        jm: monthEntries.length === 0 ? '-' : jm,
        hm: monthEntries.length === 0 ? '-' : Math.round(hm * 10) / 10,
        ho: monthEntries.length === 0 ? '-' : ho,
        hj: jm === 0 ? '-' : hj,
      };
    });
  }, [data, MONTHS]);

  return (
    <div className="bg-surface text-on-surface min-h-screen flex font-body w-full">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row gap-8 p-4 bg-surface w-full overflow-x-hidden">
        <div className="flex-1 flex flex-col gap-8 w-full min-w-0">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <p className="text-xs font-label font-bold text-primary uppercase tracking-[0.2em] mb-2">{t('paramSoc.calendrier.tag')}</p>
              <h2 className="text-2xl sm:text-4xl font-extrabold font-headline text-on-surface tracking-tight">{t('paramSoc.calendrier.heading')}</h2>
            </div>
            <div className="flex items-center gap-3 bg-surface-container-low p-1.5 rounded-xl self-center sm:self-auto">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-surface-container-lowest rounded-lg transition-all text-on-surface-variant">
                <ChevronLeft size={20} />
              </button>
              <div className="flex flex-col items-center px-4 sm:px-6">
                <span className="font-headline font-black text-sm uppercase text-primary tracking-tighter">
                  {format(currentDate, 'MMMM', { locale: dateLocale })}
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

          {/* Calendar Grid Wrapper for horizontal scroll on small devices */}
          <div className="w-full overflow-x-auto rounded-2xl shadow-sm border border-outline-variant/10">
            <div className="grid grid-cols-7 gap-px overflow-hidden bg-outline-variant/20 min-w-[700px]">
              {/* Day Headers */}
              {['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map(dayKey => (
                <div key={dayKey} className="bg-surface-container-high py-4 text-center">
                  <span className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">{t(`paramSoc.calendrier.days.${dayKey}`)}</span>
                </div>
              ))}

              {/* Day Cells */}
              {(() => {
                const cells = [];
                const firstDayOfMonth = getDay(monthStart);
                const startOffset = (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1);

                for (let i = 0; i < startOffset; i++) {
                  cells.push(<div key={`offset-${i}`} className="min-h-[100px] sm:min-h-[120px] p-2 sm:p-4 bg-surface-container text-outline opacity-40" />);
                }

                calendarDays.forEach(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const entry = entriesByDate[dateStr];

                  cells.push(
                    <div key={dateStr} className="min-h-[100px] sm:min-h-[120px] p-2 sm:p-4 flex flex-col justify-between bg-surface-container-lowest text-on-surface hover:bg-primary/5 transition-colors group cursor-pointer border-t border-outline-variant/10">
                      <span className="text-xs font-label font-bold">{format(day, 'd MMM', { locale: dateLocale })}</span>
                      {entry ? (
                        entry.calNbh > 0 ? (
                          <div className="bg-primary/10 text-primary px-2 sm:px-3 py-1 sm:py-2 rounded-lg border-l-4 border-primary">
                            <p className="text-[9px] sm:text-[10px] font-bold leading-tight">08:30 - 17:30</p>
                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-tighter mt-1">({entry.calNbh}h)</p>
                          </div>
                        ) : (
                          <span className="text-[9px] sm:text-[10px] font-label font-semibold italic text-outline">{t('paramSoc.calendrier.rest')}</span>
                        )
                      ) : null}
                    </div>
                  );
                });

                const totalCells = cells.length;
                const remaining = (7 - (totalCells % 7)) % 7;
                for (let i = 0; i < remaining; i++) {
                  cells.push(<div key={`empty-${i}`} className="min-h-[100px] sm:min-h-[120px] p-2 sm:p-4 bg-surface-container text-outline opacity-40" />);
                }

                return cells;
              })()}
            </div>
          </div>

          {/* Summary Line */}
          <div className="bg-primary/5 p-4 sm:p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between border-l-8 border-primary shadow-sm gap-6">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="text-primary hidden sm:block" size={32} />
              <div>
                <h3 className="text-xl sm:text-2xl font-black font-headline text-primary">{t('paramSoc.calendrier.monthTotal', { hours: stats.totalHours })}</h3>
                <p className="text-xs sm:text-sm font-label font-semibold text-on-surface-variant">{t('paramSoc.calendrier.basedOn')} <span className="text-on-surface font-bold">{t('paramSoc.calendrier.workedDays', { count: stats.workedDays })}</span></p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <button onClick={handleDownloadPdf} className="flex-1 md:flex-none px-4 sm:px-6 py-2.5 bg-surface-container-lowest text-on-surface text-xs sm:text-sm font-bold font-headline rounded-xl shadow-sm hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2">
                <Download size={16} /> <span className="hidden sm:inline">{t('paramSoc.calendrier.downloadPdf')}</span> PDF
              </button>
              <button onClick={handleSave} className="flex-1 md:flex-none px-4 sm:px-6 py-2.5 bg-primary text-on-primary text-xs sm:text-sm font-bold font-headline rounded-xl shadow-sm hover:translate-y-[-1px] transition-all flex items-center justify-center gap-2">
                <Save size={16} /> {t('paramSoc.calendrier.validate')} <span className="hidden sm:inline">{t('paramSoc.calendrier.validateHours')}</span>
              </button>
            </div>
          </div>

          {/* Annual Statistics */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg sm:text-xl font-extrabold font-headline tracking-tight">{t('paramSoc.calendrier.annualStats', { year: selectedYear })}</h3>
              <div className="hidden sm:flex items-center gap-2 text-outline">
                <Info size={14} />
                <span className="text-xs font-label font-medium italic">{t('paramSoc.calendrier.calculatedAuto')}</span>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl bg-surface-container-low shadow-sm border border-outline-variant/10">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-surface-container-high">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">{t('paramSoc.calendrier.headers.month')}</th>
                    <th className="px-6 py-4 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant text-center">{t('paramSoc.calendrier.headers.daysPerMonth')}</th>
                    <th className="px-6 py-4 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant text-center">{t('paramSoc.calendrier.headers.hoursPerMonth')}</th>
                    <th className="px-6 py-4 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant text-center">{t('paramSoc.calendrier.headers.openHours')}</th>
                    <th className="px-6 py-4 text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant text-center">{t('paramSoc.calendrier.headers.hoursPerDay')}</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Configuration Sidebar (Right) */}
        <aside className="w-full lg:w-80 flex flex-col gap-8">
          <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl shadow-lg flex flex-col gap-6 sticky top-28 border border-outline-variant/20">
            <div>
              <h3 className="text-xl font-extrabold font-headline tracking-tight text-primary mb-1">{t('paramSoc.calendrier.config.title')}</h3>
              <p className="text-xs font-label font-medium text-outline">{t('paramSoc.calendrier.config.adjust')}</p>
            </div>
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('paramSoc.calendrier.config.hoursPerDay')}</label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-low rounded-xl py-3 pl-4 pr-12 border-none focus:ring-2 focus:ring-primary/20 text-sm font-headline font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    type="number"
                    value={allDay}
                    onChange={(e) => setAllDay(Number(e.target.value))}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-outline text-xs font-bold uppercase">h/j</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('paramSoc.calendrier.config.saturdayHours')}</label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-low rounded-xl py-3 pl-4 pr-12 border-none focus:ring-2 focus:ring-primary/20 text-sm font-headline font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    type="number"
                    value={samedi}
                    onChange={(e) => setSamedi(Number(e.target.value))}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-outline text-xs font-bold uppercase">h</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('paramSoc.calendrier.config.restDay')}</label>
                <select
                  className="w-full bg-surface-container-low rounded-xl py-3 px-4 border-none focus:ring-2 focus:ring-primary/20 text-sm font-headline font-bold appearance-none cursor-pointer"
                  value={jourRepos}
                  onChange={(e) => setJourRepos(e.target.value)}
                >
                  <option value="0">{t('paramSoc.calendrier.days.dimanche')}</option>
                  <option value="1">{t('paramSoc.calendrier.days.lundi')}</option>
                  <option value="2">{t('paramSoc.calendrier.days.mardi')}</option>
                  <option value="3">{t('paramSoc.calendrier.days.mercredi')}</option>
                  <option value="4">{t('paramSoc.calendrier.days.jeudi')}</option>
                  <option value="5">{t('paramSoc.calendrier.days.vendredi')}</option>
                  <option value="6">{t('paramSoc.calendrier.days.samedi')}</option>
                  <option value="samdim">{t('paramSoc.calendrier.days.samdim')}</option>
                </select>
              </div>

              {/* Heures hebdomadaires recalculées automatiquement à partir des
                  champs ci-dessus — affichage informatif, non éditable. */}
              <div className="bg-primary/5 rounded-xl px-4 py-3 flex items-center justify-between border border-primary/10">
                <span className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant">{t('paramSoc.calendrier.config.weeklyHours')}</span>
                <span className="text-lg font-headline font-black text-primary">{weeklyHours}h</span>
              </div>

              <div className="pt-4 border-t border-outline-variant/20">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-label font-bold text-on-surface-variant">{t('paramSoc.calendrier.config.applyAllMonths')}</span>
                  <div
                    onClick={() => setTousLesMois(!tousLesMois)}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-all duration-300 ${tousLesMois ? 'bg-primary' : 'bg-outline-variant'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${tousLesMois ? 'right-1' : 'left-1'}`}></div>
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  className="w-full py-4 bg-primary text-on-primary text-sm font-bold font-headline rounded-xl shadow-md hover:translate-y-[-1px] transition-all active:scale-95 mb-3"
                >
                  {t('paramSoc.calendrier.config.saveSettings')}
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full py-4 bg-surface-container-high text-primary text-sm font-bold font-headline rounded-xl border border-primary/10 flex items-center justify-center gap-2 hover:translate-y-[-1px] transition-all active:scale-95"
                >
                  <Plus size={18} /> {t('paramSoc.calendrier.config.initYear')}
                </button>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-secondary-container/20 flex gap-4">
              <Lightbulb className="text-secondary flex-shrink-0" size={20} />
              <p className="text-[10px] font-label leading-relaxed text-on-secondary-fixed-variant">
                <strong>{t('paramSoc.calendrier.config.tipBold')}</strong> {t('paramSoc.calendrier.config.tip')}
              </p>
            </div>
          </div>

          {/* Carte "Solde de congés restants" retirée — info doublon avec
              le tableau de bord employé, et hors-sujet pour la page calendrier
              société (qui ne pilote pas les soldes individuels). */}
        </aside>
      </main>

      {/* New Planning Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20 scale-in-center animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black font-headline text-primary tracking-tight">{t('paramSoc.calendrier.newPlanning.title')}</h3>
                <p className="text-xs font-label font-medium text-outline">{t('paramSoc.calendrier.newPlanning.subtitle')}</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('paramSoc.calendrier.newPlanning.sourceYear')}</label>
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
                  <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('paramSoc.calendrier.newPlanning.newYear')}</label>
                  <input
                    className="w-full bg-surface-container-low rounded-xl py-3 px-4 border-none focus:ring-2 focus:ring-primary/20 text-sm font-headline font-bold"
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('paramSoc.calendrier.newPlanning.baseHours')}</label>
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">{t('paramSoc.calendrier.newPlanning.clone', { year: selectedYear })}</span>
                </button>
                <button
                  onClick={handleAddNewYear}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-primary text-on-primary shadow-lg hover:translate-y-[-2px] transition-all"
                >
                  <Plus size={24} className="animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t('paramSoc.calendrier.newPlanning.createNew')}</span>
                </button>
              </div>
            </div>

            <div className="p-6 bg-surface-container-high/30 text-center">
              <p className="text-[10px] font-label font-medium text-outline italic">
                {t('paramSoc.calendrier.newPlanning.footer')}
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