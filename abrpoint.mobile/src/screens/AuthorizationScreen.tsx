// L'ancienne « Autorisation de sortie » est remplacée par la « Demande
// d'autorisation de sortie » alignée sur la maquette web. On garde la route
// `Authorization` pour ne pas casser les écrans qui pointent vers elle
// (Dashboard, DigitalVault, Expense), mais elle rend désormais l'écran de
// demande qui utilise l'API /DemandeAutorisations comme côté web.
export { default } from './DemandeAutorisationScreen';
