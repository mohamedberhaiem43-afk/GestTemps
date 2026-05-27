import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, MenuItem, FormControl } from '@mui/material';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  // 2026-05-27 — Arabe MASQUÉ : couverture de traduction trop faible (~3%),
  // l'UI tombait en mode bilingue cassé (titres FR, contenu AR). À réactiver
  // quand locales/ar/translation.json sera ≥95% complet. Le code RTL document.dir
  // est conservé en commentaire pour réintégration rapide.
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = lng;
  };

  useEffect(() => {
    // Force LTR tant que l'arabe est masqué. À restaurer en :
    //   document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    // lors de la réactivation.
    document.documentElement.dir = 'ltr';
    // Si un utilisateur a 'ar' en localStorage hérité, on bascule sur 'fr'
    // pour éviter un fallback partiel inesthétique.
    if (i18n.language === 'ar') {
      i18n.changeLanguage('fr');
    }
  }, [i18n.language]);

  // Locale courante affichée : si 'ar' traîne en localStorage (cas hérité), on
  // affiche 'fr' visuellement le temps que le useEffect ci-dessus migre.
  const displayedLng = i18n.language === 'ar' ? 'fr' : i18n.language;

  return (
    <FormControl size="small" sx={{ minWidth: 100 }}>
      <Select
        value={displayedLng}
        onChange={(e) => changeLanguage(e.target.value)}
        displayEmpty
        sx={{ fontSize: '0.875rem' }}
      >
        <MenuItem value="en">EN</MenuItem>
        <MenuItem value="fr">FR</MenuItem>
        {/* MenuItem 'ar' masqué — voir commentaire en tête de fichier. */}
      </Select>
    </FormControl>
  );
}

export default LanguageSwitcher;