// helpers/generateNumeroOrdre.ts
//
// Génère un « numéro d'ordre » utilisé comme clé (concod) pour congés, absences,
// autorisations de sortie, demandes… Ces codes sont la PK (Soccod + code) côté
// PostgreSQL (colonnes CHAR(10)).
//
// ⚠ ANCIENNE VERSION BUGGÉE : un compteur en mémoire `let counter = 1` produisait
// "00" + année + compteur (ex "002501"). Le compteur étant remis à 1 à CHAQUE
// rechargement de page, deux sessions / deux utilisateurs régénéraient le même
// code → violation de contrainte unique (PostgreSQL 23505) à l'insert.
//
// Nouvelle version : code numérique de 10 chiffres, résistant aux collisions et
// indépendant de l'état mémoire — 6 chiffres dérivés de l'horodatage (ms) + 4
// chiffres aléatoires. Le risque de collision sur une même société devient
// négligeable. NB : le backend reste l'autorité (il régénère un code séquentiel
// et réessaie en cas de collision résiduelle), ceci n'est qu'une 1re ligne de défense.
export default function generateNumeroOrdre() {
  const msTail = (Date.now() % 1_000_000).toString().padStart(6, "0"); // 6 chiffres
  const rand = Math.floor(Math.random() * 10_000).toString().padStart(4, "0"); // 4 chiffres
  return `${msTail}${rand}`; // 10 chiffres, ex "4831720537"
}