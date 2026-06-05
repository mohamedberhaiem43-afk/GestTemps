import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Select, MenuItem, FormControl } from '@mui/material';

// Pages marketing bilingues : la langue est portée par l'URL (/ ↔ /en). Sur ces
// routes, changer de langue NAVIGUE vers l'URL correspondante — sinon l'effet de
// forçage de langue côté Navigation re-basculerait au render suivant.
const FR_TO_EN: Record<string, string> = {
  '/': '/en',
  '/suppression-compte': '/en/suppression-compte',
  '/download': '/en/download',
  '/contact-sales': '/en/contact-sales',
};
const EN_TO_FR: Record<string, string> = {
  '/en': '/',
  '/en/suppression-compte': '/suppression-compte',
  '/en/download': '/download',
  '/en/contact-sales': '/contact-sales',
};

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // 2026-05-27 — Arabe MASQUÉ : couverture de traduction trop faible (~3%),
  // l'UI tombait en mode bilingue cassé (titres FR, contenu AR). À réactiver
  // quand locales/ar/translation.json sera ≥95% complet. Le code RTL document.dir
  // est conservé en commentaire pour réintégration rapide.
  const changeLanguage = (lng: string) => {
    const path = location.pathname;
    // Sur une page bilingue, on bascule via l'URL (l'effet de Navigation pose la langue).
    if (lng === 'en' && FR_TO_EN[path]) { navigate(FR_TO_EN[path]); return; }
    if (lng === 'fr' && EN_TO_FR[path]) { navigate(EN_TO_FR[path]); return; }
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