import { useEffect, useRef } from 'react';

/**
 * Confetti micro-burst : ~60 particules colorées tombent depuis le centre
 * de l'écran avec gravité + vitesse aléatoire, puis disparaissent en ~1.4 s.
 * Implémentation Canvas pure : pas de dépendance, ~3 ko de code.
 *
 * Usage :
 *   const [showConfetti, setShowConfetti] = useState(false);
 *   ...
 *   {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
 *
 * Réservé aux jalons réels (onboarding 5/5, premier contrat créé, premier
 * paie validé). Surutiliser tue l'effet — c'est un signal de réussite, pas
 * une décoration permanente.
 */

interface ConfettiProps {
  /** Callback déclenché à la fin de l'animation. */
  onDone?: () => void;
  /** Nombre de particules. Défaut 60. */
  count?: number;
  /** Durée approximative en ms. Défaut 1400. */
  durationMs?: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
}

const COLORS = ['#0040a1', '#1a6eff', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function Confetti({ onDone, count = 60, durationMs = 1400 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Origine : centre haut de l'écran (les particules tombent vers le bas).
    const originX = w / 2;
    const originY = h * 0.25;

    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: originX,
      y: originY,
      // Émission radiale + biais vers le haut → effet « explosion » naturelle.
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.85) * 14,
      size: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
    }));

    const startTs = performance.now();

    const draw = (now: number) => {
      const elapsed = now - startTs;
      const t = Math.min(1, elapsed / durationMs);
      ctx.clearRect(0, 0, w, h);

      particles.forEach(p => {
        // Physique simple : gravité 0.35 px/frame², friction air 0.985.
        p.vy += 0.35;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Fade out sur le dernier 30 % de l'animation.
        const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        // Particule rectangulaire (allongée → ressemble plus à un confetti
        // qu'à une bille).
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });

      if (t < 1) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        rafRef.current = null;
        onDoneRef.current?.();
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [count, durationMs]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
      aria-hidden
    />
  );
}
