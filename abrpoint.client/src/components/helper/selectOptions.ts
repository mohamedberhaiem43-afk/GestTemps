// Normalisation des listes d'options de <Select>. L'API .NET peut renvoyer selon les
// endpoints : un dictionnaire { code: libellé }, un dictionnaire avec $id
// (ReferenceHandler.Preserve), une enveloppe { $values: [...] }, ou un tableau d'objets
// [{ abscod, abslib }, ...]. Sans normalisation, un Select recevant un tableau d'objets
// affiche « [object Object] » et la valeur pré-sélectionnée (édition) ne matche aucune
// option → le champ paraît vide.

const usableKeys = (o: any) =>
  Object.keys(o).filter((k) => k !== '$id' && k !== '$ref' && k !== '$values');

const pickCode = (o: any): string => {
  const keys = usableKeys(o);
  const k = keys.find((x) => /(^code$|cod$|^id$|code$)/i.test(x)) ?? keys[0];
  return String(o[k] ?? '');
};

const pickLabel = (o: any): string => {
  const keys = usableKeys(o);
  const k =
    keys.find((x) => /(lib$|libelle|libell|label|^nom$|^name$|designation|intitul|description)/i.test(x)) ??
    keys[1] ??
    keys[0];
  return String(o[k] ?? '');
};

/** Renvoie les options sous forme de paires [valeur, libellé], quelle que soit la forme reçue. */
export function normalizeOptions(maplist: any): Array<[string, string]> {
  if (!maplist) return [];
  let m = maplist;
  if (m && typeof m === 'object' && !Array.isArray(m) && Array.isArray(m.$values)) m = m.$values;

  if (Array.isArray(m)) {
    return m.map((item) =>
      item && typeof item === 'object'
        ? ([pickCode(item), pickLabel(item)] as [string, string])
        : ([String(item), String(item)] as [string, string])
    );
  }
  return Object.entries(m)
    .filter(([k]) => k !== '$id' && k !== '$ref' && k !== '$values')
    .map(([k, v]) =>
      v && typeof v === 'object'
        ? ([k, pickLabel(v)] as [string, string])
        : ([k, String(v)] as [string, string])
    );
}

/** Renvoie un dictionnaire { valeur: libellé } — pratique pour du code qui itère déjà via Object.entries. */
export function toOptionMap(maplist: any): Record<string, string> {
  return Object.fromEntries(normalizeOptions(maplist));
}
