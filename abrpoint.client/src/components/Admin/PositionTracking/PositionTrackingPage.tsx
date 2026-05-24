import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Chip, Stack, MenuItem, TextField, Button, Alert } from '@mui/material';
import RoomIcon from '@mui/icons-material/Room';
import RefreshIcon from '@mui/icons-material/Refresh';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import apiInstance from '../../API/apiInstance';
import { useAuth } from '../../helper/AuthProvider';
import useGetEmployeesLibs from '../../../hooks/employeHooks/useGetEmployeesLibs';
import AccessDenied from '../../helper/AccessDenied';

/**
 * Page Suivi positions — admin/manager uniquement, plan Geolocation requis
 * (Standard + Business). Affiche sur une carte Leaflet les positions GPS
 * persistées par PresencesController.MarkPresence (colonnes prelat/prelon/preacc
 * de la table presence).
 *
 * Données : GET /api/Presences/positions?soccod&dateDebut&dateFin&empcods=…
 * Marker bleu = pointage dans le geofence (ou pas de geofence configuré).
 * Marker rouge = pointage hors zone (distance > sitrad mètres).
 * Cercle bleu transparent = geofence du site rattaché (centre sitlat/sitlon, rayon sitrad).
 */

// ── Fix des icônes Leaflet pour Webpack/Vite ──
// react-leaflet n'embarque pas les images des markers par défaut ; sans cette
// init manuelle, les markers sont invisibles (404 sur marker-icon.png). On
// pointe vers le CDN officiel — léger, déjà mis en cache par les utilisateurs.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface PositionRow {
  empcod: string;
  emplib: string | null;
  sitcod: string | null;
  sitlib: string | null;
  sitlat: number | null;
  sitlon: number | null;
  sitrad: number | null;
  predat: string;
  prelat: number;
  prelon: number;
  preacc: number | null;
  preentmatup: string | null;
  presortmatup: string | null;
  preentamidiup: string | null;
  presortamidiup: string | null;
}

// Distance haversine en mètres entre 2 points lat/lon — copie volontaire
// (1 fonction) plutôt qu'une dépendance npm pour 8 lignes de math.
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function isOutOfZone(row: PositionRow): boolean {
  if (row.sitlat == null || row.sitlon == null || !row.sitrad) return false;
  const d = haversineMeters(row.prelat, row.prelon, row.sitlat, row.sitlon);
  return d > row.sitrad;
}

// FitBounds — recadre automatiquement la carte sur l'ensemble des markers
// chargés. Sans ça, la carte s'ouvre sur Paris (default) même si toutes les
// positions sont à Tunis — utilisateur doit dézoomer manuellement.
function FitBoundsToMarkers({ rows }: { rows: PositionRow[] }) {
  const map = useMap();
  useEffect(() => {
    if (rows.length === 0) return;
    const bounds = L.latLngBounds(rows.map(r => [r.prelat, r.prelon]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [rows, map]);
  return null;
}

export default function PositionTrackingPage() {
  const { soccod, hasPermission, planAllows } = useAuth();
  const canConsult = hasPermission('Pointage et Temps', 'consult');

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const [dateDebut, setDateDebut] = useState(sevenDaysAgo);
  const [dateFin, setDateFin] = useState(today);
  const [selectedEmp, setSelectedEmp] = useState<string>('');
  const [rows, setRows] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: employeesLibsRaw } = useGetEmployeesLibs(undefined, undefined, undefined, undefined);
  const employeesLibs: Record<string, string> = (employeesLibsRaw as unknown as Record<string, string>) ?? {};

  // Gating commercial — masque la page si le plan ne couvre pas la géoloc.
  // Le backend renvoie déjà 402 grâce à RequirePlanFeature, mais on évite un
  // appel inutile + on affiche un message clair à l'utilisateur.
  if (!planAllows('geolocation')) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Le suivi des positions GPS est inclus dans les packs Standard et Business.
          Votre pack actuel ne couvre pas cette fonctionnalité.
        </Alert>
      </Box>
    );
  }

  if (!canConsult) return <AccessDenied message="Vous n'avez pas le droit de consulter le suivi des positions." />;

  const reload = async () => {
    if (!soccod) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        soccod,
        dateDebut,
        dateFin,
      });
      if (selectedEmp) params.append('empcods', selectedEmp);
      const { data } = await apiInstance.get<PositionRow[]>(`/Presences/positions?${params}`);
      setRows(data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les positions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Centre par défaut : 1ère ligne, sinon Tunis (proxy raisonnable vu la cible
  // commerciale Maghreb/France). Le composant FitBoundsToMarkers recadre
  // automatiquement dès que les données sont chargées.
  const defaultCenter: [number, number] = useMemo(() => {
    if (rows.length > 0) return [rows[0].prelat, rows[0].prelon];
    return [36.8065, 10.1815];
  }, [rows]);

  const outOfZoneCount = useMemo(() => rows.filter(isOutOfZone).length, [rows]);

  // Geofences uniques à dessiner (un site peut apparaître sur plusieurs lignes).
  const geofences = useMemo(() => {
    const seen = new Map<string, { lat: number; lon: number; rad: number; label: string }>();
    for (const r of rows) {
      if (r.sitcod && r.sitlat != null && r.sitlon != null && r.sitrad) {
        if (!seen.has(r.sitcod)) {
          seen.set(r.sitcod, { lat: r.sitlat, lon: r.sitlon, rad: r.sitrad, label: r.sitlib ?? r.sitcod });
        }
      }
    }
    return Array.from(seen.values());
  }, [rows]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2, height: 'calc(100vh - 100px)' }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <RoomIcon sx={{ color: '#0040a1', fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a' }}>
          Suivi des positions
        </Typography>
      </Stack>
      <Typography sx={{ color: '#64748b', fontSize: 14 }}>
        Positions GPS capturées lors des pointages depuis l'application mobile.
        Les markers rouges indiquent les pointages effectués hors du périmètre
        autorisé pour le site rattaché.
      </Typography>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
          <TextField
            label="Date début"
            type="date"
            size="small"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Date fin"
            type="date"
            size="small"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="Employé"
            size="small"
            value={selectedEmp}
            onChange={(e) => setSelectedEmp(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(employeesLibs).map(([cod, lib]) => (
              <MenuItem key={cod} value={cod}>{lib}</MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={reload}
            startIcon={<RefreshIcon />}
            disabled={loading}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            Actualiser
          </Button>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1}>
            <Chip
              label={`${rows.length} pointage${rows.length > 1 ? 's' : ''}`}
              sx={{ bgcolor: '#e0e7ff', color: '#1e3a8a', fontWeight: 700 }}
            />
            {outOfZoneCount > 0 && (
              <Chip
                label={`${outOfZoneCount} hors zone`}
                sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 700 }}
              />
            )}
          </Stack>
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2, borderRadius: 1 }}>{error}</Alert>}
      </Paper>

      <Paper elevation={0} sx={{ flex: 1, borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.7)', zIndex: 1000 }}>
            <CircularProgress />
          </Box>
        )}
        <MapContainer center={defaultCenter} zoom={12} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Cercles de geofence par site rattaché (transparent bleu clair) */}
          {geofences.map((g, i) => (
            <Circle
              key={`fence-${i}`}
              center={[g.lat, g.lon]}
              radius={g.rad}
              pathOptions={{ color: '#0040a1', fillColor: '#0040a1', fillOpacity: 0.08, weight: 1.5 }}
            >
              <Popup>
                <strong>Périmètre site « {g.label} »</strong><br />
                Rayon : {g.rad} m
              </Popup>
            </Circle>
          ))}

          {/* Markers pointages */}
          {rows.map((r, i) => {
            const outside = isOutOfZone(r);
            return (
              <Marker
                key={`p-${i}`}
                position={[r.prelat, r.prelon]}
                icon={outside ? redIcon : new L.Icon.Default()}
              >
                <Popup>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <strong>{r.emplib ?? r.empcod}</strong><br />
                    <span style={{ color: '#64748b' }}>{r.empcod}</span><br />
                    <span>{new Date(r.predat).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span><br />
                    {r.sitlib && <><span>Site : {r.sitlib}</span><br /></>}
                    {r.preacc && <span style={{ color: '#64748b' }}>Précision : ±{r.preacc} m</span>}
                    {outside && (
                      <div style={{ marginTop: 6, padding: '4px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontWeight: 700 }}>
                        ⚠ Hors du périmètre du site
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          <FitBoundsToMarkers rows={rows} />
        </MapContainer>
      </Paper>
    </Box>
  );
}
