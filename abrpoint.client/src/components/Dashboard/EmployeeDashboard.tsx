import { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import useGetDemConges from '../../hooks/congeHooks/useGetDemConges';
import useGetPresence from '../../hooks/presenceHooks/useGetPresence';
import useGetProfile from '../../hooks/profileHooks/useGetProfile';

export default function EmployeeDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [view, setView] = useState<'dashboard' | 'leaves' | 'pending' | 'presence'>('dashboard');

  // Get current user profile to get empcod
  const { data: profileData, isLoading: loadingProfile } = useGetProfile();

  // Get user's leave requests
  const { data: leaveRequests, isLoading: loadingLeaves } = useGetDemConges();

  // Get date range for presence data
  const dateRange = useMemo(() => {
    const now = dayjs();
    switch (selectedPeriod) {
      case 'today':
        return {
          start: now.startOf('day'),
          end: now.endOf('day'),
        };
      case 'week':
        return {
          start: now.startOf('week').add(1, 'day'),
          end: now.endOf('week').add(1, 'day'),
        };
      case 'month':
        return {
          start: now.startOf('month'),
          end: now.endOf('month'),
        };
      default:
        return {
          start: now.startOf('day'),
          end: now.endOf('day'),
        };
    }
  }, [selectedPeriod]);

  // Get user's presence data if we have empcod
  const { data: presenceData, isLoading: loadingPresence } = useGetPresence(
    dateRange.start.toDate(),
    dateRange.end.toDate(),
    'H', // Assuming 'H' for hourly regime
    profileData?.empcod ? [profileData.empcod] : null
  );

  const isLoading = loadingProfile || loadingPresence || loadingLeaves;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR');

  const chipHtml = (etat: string) => {
    const map: { [key: string]: string } = { 'Accepté': 'success', 'En attente': 'warning', 'Refusé': 'danger' };
    const className = `chip chip-${map[etat] || 'info'}`;
    return <span className={className}>{etat}</span>;
  };

  const leaveRows = (rows: any[]) => {
    if (!rows.length) return <p className="empty">Aucune demande de congé</p>;
    return (
      <table>
        <thead><tr><th>N°Ordre</th><th>Date</th><th>Date Départ</th><th>Date Retour</th>
        <th>Jours</th><th>Statut</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.concod}</td>
              <td>{fmt(r.condat)}</td>
              <td>{fmt(r.condep)}</td>
              <td>{fmt(r.conret)}</td>
              <td>{r.connbjour}</td>
              <td>{chipHtml(r.etat)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const presenceRows = (rows: any[]) => {
    if (!rows.length) return <p className="empty">Aucune donnée de présence</p>;
    return (
      <table>
        <thead><tr><th>Date</th>
        <th>Arrivée Matin</th><th>Départ Matin</th>
        <th>Arrivée Après-midi</th><th>Départ Après-midi</th>
        <th>Heures</th><th>Statut</th></tr></thead>
        <tbody>
          {rows.map((p, i) => {
            const present = parseFloat(p.tothre || 0) > 0;
            return (
              <tr key={i}>
                <td>{fmt(p.predat)}</td>
                <td>{p.entree1 || '-'}</td>
                <td>{p.sortie1 || '-'}</td>
                <td>{p.entree2 || '-'}</td>
                <td>{p.sortie2 || '-'}</td>
                <td>{present ? parseFloat(p.totalHeure || 0).toFixed(1) + ' h' : '-'}</td>
                <td><span className={`chip chip-${present ? 'success' : 'info'}`}>{present ? 'Présent' : 'Absent'}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const kpiCards = () => {
    const pending = (leaveRequests || []).filter((l: any) => l.etat === 'En attente');
    const totalH = (presenceData || []).reduce((s: number, p: any) => s + (parseFloat(p.tothre || 0) || 0), 0);
    const cards = [
      { label: 'Ma Présence', value: (presenceData || []).length, color: '#1976d2', bg: '#e3f2fd', view: 'presence', icon: '👤' },
      { label: 'Mes Congés', value: (leaveRequests || []).length, color: '#388e3c', bg: '#e8f5e9', view: 'leaves', icon: '📅' },
      { label: 'Heures Travaillées', value: totalH.toFixed(1) + 'h', color: '#f57c00', bg: '#fff3e0', view: null, icon: '⏱' },
      { label: 'Demandes en Attente', value: pending.length, color: '#9c27b0', bg: '#f3e5f5', view: 'pending', icon: '🕐' },
    ];
    return (
      <div className="kpi-grid">
        {cards.map((c, i) => (
          <div key={i} className={`kpi-card${c.view ? '' : ' no-click'}`} onClick={c.view ? () => setView(c.view as any) : undefined} style={{ borderTop: `3px solid ${c.color}` }}>
            <div className="kpi-icon" style={{ background: c.bg, fontSize: '16px' }}>{c.icon}</div>
            <div className="kpi-value" style={{ color: c.color }}>{c.value}</div>
            <div className="kpi-label">{c.label}</div>
            {c.view && <div className="kpi-hint" style={{ color: c.color }}>Voir détails →</div>}
          </div>
        ))}
      </div>
    );
  };

  const renderDashboard = () => {
    const periods = [
      { k: 'today', l: "Aujourd'hui" },
      { k: 'week', l: 'Cette semaine' },
      { k: 'month', l: 'Ce mois' }
    ];
    return (
      <>
        <div className="period-bar">
          {periods.map(p => (
            <button key={p.k} className={`period-btn${selectedPeriod === p.k ? ' active' : ''}`} onClick={() => setSelectedPeriod(p.k as any)}>{p.l}</button>
          ))}
        </div>
        {kpiCards()}
        <div className="tables-grid">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Mes dernières demandes de congé</span>
              {(leaveRequests || []).length > 5 && <button className="see-all" onClick={() => setView('leaves')}>Voir tout</button>}
            </div>
            {leaveRows((leaveRequests || []).slice(0, 5))}
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Ma présence récente</span>
              {(presenceData || []).length > 5 && <button className="see-all" onClick={() => setView('presence')}>Voir tout</button>}
            </div>
            {presenceRows((presenceData || []).slice(0, 5))}
          </div>
        </div>
      </>
    );
  };

  const renderDetail = () => {
    const titles: { [key: string]: string } = { leaves: 'Mes Congés', pending: 'Demandes en Attente', presence: 'Ma Présence' };
    const rows = view === 'leaves' ? leaveRequests :
                 view === 'pending' ? (leaveRequests || []).filter((l: any) => l.etat === 'En attente') :
                 null;
    const content = view === 'presence' ? presenceRows(presenceData || []) : leaveRows(rows || []);
    return (
      <>
        <button className="back-btn" onClick={() => setView('dashboard')}>← Retour</button>
        <div className="detail-card">
          <div className="card-header"><span className="card-title">{titles[view]}</span></div>
          {content}
        </div>
      </>
    );
  };

  return (
    <div className="dash" style={{ width: '90vw', height: '90vh', overflow: 'auto' }}>
      {view === 'dashboard' ? renderDashboard() : renderDetail()}
    </div>
  );
}