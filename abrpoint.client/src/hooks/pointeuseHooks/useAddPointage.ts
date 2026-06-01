import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiInstance from "../../components/API/apiInstance";
import { useAuth } from "../../components/helper/AuthProvider";

export interface AddPointageParams {
  employe_code: string;
  time: string; // ISO string or format expected by backend
}

interface GeoCoords { latitude: number; longitude: number; accuracy?: number; }

// Capture la position courante via navigator.geolocation. Best-effort : si l'utilisateur
// refuse ou si le navigateur n'a pas l'API, on retourne null et c'est le backend qui
// décidera (refus 422 si un geofence est configuré pour le tenant).
const captureGeo = (timeoutMs = 5000): Promise<GeoCoords | null> => {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => { if (!settled) { settled = true; clearTimeout(timer); resolve(null); } },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
};

const useAddPointage = () => {
  const queryClient = useQueryClient();
  const { soccod, planAllows } = useAuth();

  return useMutation({
    mutationFn: async (params: AddPointageParams) => {
      // Pointage géolocalisé réservé aux plans incluant la feature Geolocation
      // (Standard +). Sur Starter, on pointe SANS GPS : on n'appelle même pas
      // navigator.geolocation (pas de prompt de permission inutile) et on n'envoie
      // pas lat/lon — sinon le backend renvoie 402 plan_feature_locked.
      const gps = planAllows('geolocation') ? await captureGeo(5000) : null;
      const qs = new URLSearchParams();
      if (gps) {
        qs.set('lat', String(gps.latitude));
        qs.set('lon', String(gps.longitude));
        if (gps.accuracy != null) qs.set('acc', String(gps.accuracy));
      }
      // Horodatage local navigateur — même logique que le mobile, le serveur le bind
      // en DateTimeKind.Unspecified et le compare à DateTime.Now (tolérance ±10min).
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const localStamp =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
        `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      qs.set('clientTime', localStamp);

      const queryString = qs.toString();
      const path = `/Presences/mark-presence/${soccod}/${params.employe_code}${queryString ? `?${queryString}` : ''}`;
      const response = await apiInstance.post(path);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pointages"] });
      queryClient.invalidateQueries({ queryKey: ["kpis", soccod] });
    },
  });
};

export default useAddPointage;
