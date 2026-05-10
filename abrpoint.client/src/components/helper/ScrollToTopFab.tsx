import { useEffect, useState } from 'react';
import { Fab, Zoom } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

/**
 * FAB flottant qui apparaît dès que la page est défilée plus bas que `threshold` px,
 * et fait remonter en haut au clic. Mounted une fois globalement dans App.tsx — pas
 * besoin de l'ajouter écran par écran.
 *
 * Détecte aussi le scroll d'un éventuel <main> scrollable à la place de window
 * (cas de certains layouts shell-style avec hauteur fixe).
 */
export default function ScrollToTopFab({ threshold = 280 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const findScrollable = (): (Window | HTMLElement) => {
      // Si le body / document scrolle naturellement, on s'accroche à window.
      if (document.documentElement.scrollHeight > window.innerHeight) return window;
      // Sinon on cherche un container interne scrollable (premier élément avec overflow auto/scroll).
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('main, [data-scroll-root]'));
      const scrollable = candidates.find(el => {
        const style = window.getComputedStyle(el);
        return (style.overflowY === 'auto' || style.overflowY === 'scroll')
          && el.scrollHeight > el.clientHeight;
      });
      return scrollable ?? window;
    };

    let target: Window | HTMLElement = findScrollable();

    const getScrollTop = () => target === window
      ? window.scrollY || document.documentElement.scrollTop
      : (target as HTMLElement).scrollTop;

    const onScroll = () => setVisible(getScrollTop() > threshold);

    target.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Re-évalue sur changement de route : le DOM peut basculer entre layout scrollable
    // window vs container interne selon l'écran.
    const reevaluate = () => {
      target.removeEventListener('scroll', onScroll);
      target = findScrollable();
      target.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    };
    window.addEventListener('popstate', reevaluate);
    const ro = new ResizeObserver(reevaluate);
    ro.observe(document.body);

    return () => {
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('popstate', reevaluate);
      ro.disconnect();
    };
  }, [threshold]);

  const handleClick = () => {
    const main = document.querySelector<HTMLElement>('main, [data-scroll-root]');
    if (main && main.scrollHeight > main.clientHeight) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <Zoom in={visible} unmountOnExit>
      <Fab
        size="medium"
        onClick={handleClick}
        aria-label="Remonter en haut"
        sx={{
          position: 'fixed',
          right: { xs: 16, md: 24 },
          bottom: { xs: 88, md: 32 }, // au-dessus de la tabbar mobile éventuelle
          bgcolor: '#0040a1',
          color: '#fff',
          boxShadow: '0 8px 24px rgba(0, 64, 161, 0.35)',
          zIndex: 1300,
          '&:hover': { bgcolor: '#003080' },
        }}
      >
        <KeyboardArrowUpIcon />
      </Fab>
    </Zoom>
  );
}
