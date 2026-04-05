import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, MenuItem, FormControl } from '@mui/material';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    // For Arabic, change document direction
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
  };

  useEffect(() => {
    // Set initial direction based on current language
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <FormControl size="small" sx={{ minWidth: 100 }}>
      <Select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        displayEmpty
        sx={{ fontSize: '0.875rem' }}
      >
        <MenuItem value="en">EN</MenuItem>
        <MenuItem value="fr">FR</MenuItem>
        <MenuItem value="ar">العربية</MenuItem>
      </Select>
    </FormControl>
  );
}

export default LanguageSwitcher;