import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Chip, Stack, MenuItem, TextField, Button, Alert, ToggleButtonGroup, ToggleButton } from '@mui/material';
import RoomIcon from '@mui/icons-material/Room';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
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

// Factory pour les icônes colorées du repo public leaflet-color-markers.
// On mémoïse les instances pour éviter de re-créer une L.Icon à chaque render
// (Leaflet construit alors un <img> neuf → flicker visuel).
const buildColoredIcon = (color: 'red' | 'green' | 'orange' | 'grey') =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    iconRetinaUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

const redIcon = buildColoredIcon('red');
const greenIcon = buildColoredIcon('green');
const orangeIcon = buildColoredIcon('orange');
const greyIcon = buildColoredIcon('grey');

/**
 * Mode d'affichage de la carte. Toggle entre :
 *  - 'historical' : positions des pointages passés sur une plage de dates (existant)
 *  - 'live'       : positions GPS heartbeat « live » envoyées par le mobile en
 *                   continu pendant qu'un salarié est pointé. Auto-refresh 15 s.
 */
type TrackingMode = 'historical' | 'live';

interface LivePositionRow {
  empcod: string;
  emplib: string | null;
  sitcod: string | null;
  lat: number;
  lon: number;
  acc: number | null;
  updatedAt: string;
  ageSeconds: number;
  sessionId: string | null;
  batteryLevel: number | null;
}

// Seuils de fraîcheur (en secondes) — pilotent la couleur du marqueur live.
// < FRESH_THRESHOLD : marqueur vert → position toute fraîche, le salarié envoie bien.
// < STALE_THRESHOLD : marqueur orange → heartbeat manqué récent (réseau intermittent).
// au-delà : la ligne n'est plus retournée par /live-positions (filtrage maxAgeMinutes).
const FRESH_THRESHOLD = 120;
const STALE_THRESHOLD = 300;
const LIVE_REFRESH_MS = 15_000;

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

/**
 * FitBounds spécifique au mode live — recadre uniquement lors du premier
 * chargement (passage de 0 à N positions) pour ne pas dé-zoomer l'utilisateur
 * qui aurait zoomé sur un quartier précis. Sans cette garde, chaque tick de
 * polling (15 s) re-centrerait la vue → expérience désagréable.
 */
function FitBoundsToLivePositions({ positions }: { positions: LivePositionRow[] }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (positions.length === 0) {
      fittedRef.current = false;
      return;
    }
    if (fittedRef.current) return;
    const bounds = L.latLngBounds(positions.map(p => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    fittedRef.current = true;
  }, [positions, map]);
  return null;
}

export default function PositionTrackingPage() {
  const { soccod, hasPermission, planAllows } = useAuth();
  const canConsult = hasPermission('Pointage et Temps', 'consult');

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const [mode, setMode] = useState<TrackingMode>('historical');
  const [dateDebut, setDateDebut] = useState(sevenDaysAgo);
  const [dateFin, setDateFin] = useState(today);
  const [selectedEmp, setSelectedEmp] = useState<string>('');
  const [rows, setRows] = useState<PositionRow[]>([]);
  const [livePositions, setLivePositions] = useState<LivePositionRow[]>([]);
  const [liveLastFetch, setLiveLastFetch] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  /**
   * Charge les positions « live » via le nouvel endpoint GET /Presences/live-positions.
   * Le backend ne retourne que les salariés dont la dernière position a moins de
   * `maxAgeMinutes` (défaut 5 min) — au-delà, le salarié est considéré offline.
   * Silent ↔ pas de spinner ; utilisé pour les rafraîchissements automatiques toutes
   * les 15 s pour ne pas faire flasher l'UI à chaque tick.
   */
  const loadLivePositions = async (silent = false) => {
    if (!soccod) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ soccod, maxAgeMinutes: '5' });
      const { data } = await apiInstance.get<LivePositionRow[]>(`/Presences/live-positions?${params}`);
      setLivePositions(data ?? []);
      setLiveLastFetch(new Date());
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les positions temps réel.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  /**
   * Effet polling — démarre/arrête l'intervalle de rafraîchissement quand le mode
   * bascule en 'live'. Cleanup au démontage ou au changement de mode pour éviter
   * que plusieurs intervalles tournent en parallèle. Premier appel immédiat
   * (silent=false → spinner) puis ticks à LIVE_REFRESH_MS (silent=true).
   */
  useEffect(() => {
    if (mode !== 'live') {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      return;
    }
    loadLivePositions(false);
    liveIntervalRef.current = setInterval(() => loadLivePositions(true), LIVE_REFRESH_MS);
    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, soccod]);

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

  // Centre carte en mode live : moyenne des positions actives, sinon Tunis.
  // Permet d'afficher tous les salariés d'un coup au switch initial.
  const liveDefaultCenter: [number, number] = useMemo(() => {
    if (livePositions.length > 0) return [livePositions[0].lat, livePositions[0].lon];
    return [36.8065, 10.1815];
  }, [livePositions]);

  // Décompte fraîcheur des positions live pour l'affichage des chips de statut
  // en haut à droite (« 3 actifs · 1 retard »). Aligné sur la même grille de
  // seuils que les marqueurs (vert/orange).
  const liveFreshnessCounts = useMemo(() => {
    let fresh = 0, stale = 0;
    for (const p of livePositions) {
      if (p.ageSeconds < FRESH_THRESHOLD) fresh++;
      else if (p.ageSeconds < STALE_THRESHOLD) stale++;
    }
    return { fresh, stale };
  }, [livePositions]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2, height: 'calc(100vh - 100px)' }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <RoomIcon sx={{ color: '#0040a1', fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a' }}>
          Suivi des positions
        </Typography>
      </Stack>
      <Typography sx={{ color: '#64748b', fontSize: 14 }}>
        {mode === 'live'
          ? 'Positions GPS « live » des salariés actuellement pointés — mises à jour automatiques toutes les 15 secondes. Marqueurs verts : position fraîche (< 2 min). Orange : heartbeat manqué récent (2-5 min). Au-delà de 5 min sans heartbeat, le salarié est considéré offline et n\'apparaît plus sur la carte.'
          : 'Positions GPS capturées lors des pointages depuis l\'application mobile. Les markers rouges indiquent les pointages effectués hors du périmètre autorisé pour le site rattaché.'}
      </Typography>

      {/* Toggle Historique / Temps réel — pilote l'ensemble de la page. */}
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(_, v) => v && setMode(v as TrackingMode)}
        size="small"
        sx={{ alignSelf: 'flex-start' }}
      >
        <ToggleButton value="historical" sx={{ textTransform: 'none', fontWeight: 700, px: 2 }}>
          <HistoryIcon sx={{ fontSize: 18, mr: 0.5 }} /> Historique
        </ToggleButton>
        <ToggleButton value="live" sx={{ textTransform: 'none', fontWeight: 700, px: 2 }}>
          <GpsFixedIcon sx={{ fontSize: 18, mr: 0.5 }} /> Temps réel
        </ToggleButton>
      </ToggleButtonGroup>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0' }}>
        {mode === 'historical' ? (
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
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Salariés actifs sur la carte
              </Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                {livePositions.length}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                Dernier rafraîchissement
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                {liveLastFetch ? liveLastFetch.toLocaleTimeString('fr-FR') : '—'}
                <Typography component="span" sx={{ ml: 1, fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                  (auto : {LIVE_REFRESH_MS / 1000}s)
                </Typography>
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={() => loadLivePositions(false)}
              startIcon={<RefreshIcon />}
              disabled={loading}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Forcer
            </Button>
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" spacing={1}>
              <Chip
                label={`${liveFreshnessCounts.fresh} actif${liveFreshnessCounts.fresh > 1 ? 's' : ''}`}
                sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700 }}
              />
              {liveFreshnessCounts.stale > 0 && (
                <Chip
                  label={`${liveFreshnessCounts.stale} en retard`}
                  sx={{ bgcolor: '#ffedd5', color: '#9a3412', fontWeight: 700 }}
                />
              )}
            </Stack>
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mt: 2, borderRadius: 1 }}>{error}</Alert>}
      </Paper>

      <Paper elevation={0} sx={{ flex: 1, borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.7)', zIndex: 1000 }}>
            <CircularProgress />
          </Box>
        )}
        <MapContainer
          center={mode === 'live' ? liveDefaultCenter : defaultCenter}
          zoom={12}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Geofences uniquement en mode historique — pas pertinent en live
              (on suit des personnes en mouvement, pas leur conformité de zone
              au moment du pointage). */}
          {mode === 'historical' && geofences.map((g, i) => (
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

          {/* Markers pointages historiques (bleu / rouge selon zone). */}
          {mode === 'historical' && rows.map((r, i) => {
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

          {/* Markers live (vert / orange / gris selon fraîcheur). Cercle de
              précision GPS dessiné autour de chaque marqueur pour matérialiser
              l'incertitude de mesure (utile en intérieur où l'acc peut être 30-50 m). */}
          {mode === 'live' && livePositions.map((p, i) => {
            const icon = p.ageSeconds < FRESH_THRESHOLD ? greenIcon
                       : p.ageSeconds < STALE_THRESHOLD ? orangeIcon
                       : greyIcon;
            const ageLabel = p.ageSeconds < 60 ? `${p.ageSeconds}s`
                           : p.ageSeconds < 3600 ? `${Math.round(p.ageSeconds / 60)} min`
                           : `${Math.round(p.ageSeconds / 3600)} h`;
            return (
              <Marker key={`live-${p.empcod}-${i}`} position={[p.lat, p.lon]} icon={icon}>
                <Popup>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    <strong>{p.emplib ?? p.empcod}</strong><br />
                    <span style={{ color: '#64748b' }}>{p.empcod}</span><br />
                    <span>Position il y a <strong>{ageLabel}</strong></span><br />
                    <span style={{ color: '#64748b' }}>
                      {new Date(p.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })}
                    </span><br />
                    {p.acc != null && <span style={{ color: '#64748b' }}>Précision : ±{p.acc} m</span>}
                    {p.batteryLevel != null && (
                      <><br /><span style={{ color: '#64748b' }}>Batterie : {p.batteryLevel}%</span></>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {mode === 'live' && livePositions.map((p, i) => (
            p.acc != null && p.acc > 0 ? (
              <Circle
                key={`live-acc-${p.empcod}-${i}`}
                center={[p.lat, p.lon]}
                radius={p.acc}
                pathOptions={{ color: '#0040a1', fillColor: '#0040a1', fillOpacity: 0.05, weight: 0.8 }}
                interactive={false}
              />
            ) : null
          ))}

          {/* FitBounds : on recadre sur les markers du mode courant uniquement
              pour éviter qu'un switch live/historique laisse une vue Paris-default. */}
          {mode === 'historical' ? (
            <FitBoundsToMarkers rows={rows} />
          ) : (
            <FitBoundsToLivePositions positions={livePositions} />
          )}
        </MapContainer>
      </Paper>
    </Box>
  );
}
