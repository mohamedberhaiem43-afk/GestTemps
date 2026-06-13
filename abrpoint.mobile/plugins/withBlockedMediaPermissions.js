// Config plugin — retire READ_MEDIA_IMAGES / READ_MEDIA_VIDEO du manifeste Android.
//
// Pourquoi : Google Play (Photo & Video Permissions policy) refuse l'app si elle
// déclare ces permissions alors qu'elle n'accède aux médias que ponctuellement.
// Concorde Workly utilise le sélecteur photo système (expo-image-picker) pour les
// justificatifs (frais, absences, profil) → aucune de ces permissions n'est requise.
//
// Elles sont fusionnées dans le manifeste final par des libs tierces
// (expo-screen-capture, anciennes versions du picker). Le build production EAS lance
// `prebuild --clean`, qui régénère android/ depuis app.json — d'où ce plugin, qui
// réinjecte le retrait (`tools:node="remove"`) à chaque prebuild. Sans lui, l'édit
// manuel de AndroidManifest.xml serait écrasé à chaque build de prod.
const { AndroidConfig } = require('@expo/config-plugins');

module.exports = (config) =>
  AndroidConfig.Permissions.withBlockedPermissions(config, [
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
  ]);
