import React, { useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';

/**
 * Composant de signature au doigt — implémentation native sans dépendance externe.
 *
 * Pourquoi pas `react-native-signature-canvas` ou `@shopify/react-native-skia` ?
 *   - WebView : ajoute ~5 Mo au bundle pour 1 écran et ne fonctionne pas hors-ligne.
 *   - Skia : excellent mais double la taille du natif et impose un rebuild EAS.
 *
 * Trade-off accepté : le rendu est volontairement basique (lignes 2 px noires reliant
 * les points de touch). Pour un usage signature contrat / attestation c'est suffisant —
 * la valeur juridique d'une signature électronique est portée par la *traçabilité*
 * (qui a signé, quand, depuis quel device — cf. SignDocument backend), pas par
 * l'élégance graphique du trait.
 *
 * Format de sortie : SVG inline. C'est lisible par tous les rendus (DinkToPdf,
 * navigateur, viewer PDF) et scalable sans perte. Sérialisé en base64 dans une data URI
 * `data:image/svg+xml;base64,...` que `FileHelper.SaveBase64Image` détecte pour
 * choisir l'extension `.svg` côté serveur.
 */

type Point = { x: number; y: number };
type Stroke = Point[];

export type SignaturePadHandle = {
  /** Vide le canvas (annule la signature en cours). */
  clear: () => void;
  /** True si au moins un trait a été tracé. */
  isEmpty: () => boolean;
  /** Construit la data URI SVG (base64) prête à envoyer au backend. */
  toDataUri: () => string | null;
};

interface Props {
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  onChange?: (hasContent: boolean) => void;
}

const SignaturePad = forwardRef<SignaturePadHandle, Props>((props, ref) => {
  const { height = 200, strokeColor = '#0f172a', strokeWidth = 2, onChange } = props;
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke>([]);
  const layout = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    layout.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
  }, []);

  // PanResponder capture chaque mouvement tactile. On garde le tracé courant dans une
  // ref pour éviter un re-render à chaque pixel (couteux), puis on commit la stroke
  // entière à la fin du geste — le rendu se met à jour une fois par trait, pas par point.
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        currentStroke.current = [{ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }];
      },
      onPanResponderMove: (e) => {
        const pt = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
        currentStroke.current.push(pt);
        // Re-render à chaque ~5 points pour fluidité visuelle sans flooding React.
        if (currentStroke.current.length % 4 === 0) {
          setStrokes((prev) => {
            const head = prev.slice(0, -1);
            const tail = prev.length > 0 && prev[prev.length - 1] === currentStroke.current
              ? prev[prev.length - 1]
              : null;
            return tail ? [...head, [...currentStroke.current]] : [...prev, [...currentStroke.current]];
          });
        }
      },
      onPanResponderRelease: () => {
        if (currentStroke.current.length > 0) {
          setStrokes((prev) => {
            // Si on a déjà inséré un placeholder pendant Move, on remplace, sinon on append.
            const isContinuation = prev.length > 0 && prev[prev.length - 1].length > 0
              && prev[prev.length - 1] === currentStroke.current;
            const next = isContinuation
              ? [...prev.slice(0, -1), [...currentStroke.current]]
              : [...prev, [...currentStroke.current]];
            onChange?.(next.length > 0);
            return next;
          });
          currentStroke.current = [];
        }
      },
    }),
  ).current;

  useImperativeHandle(ref, () => ({
    clear: () => {
      setStrokes([]);
      currentStroke.current = [];
      onChange?.(false);
    },
    isEmpty: () => strokes.length === 0,
    toDataUri: () => {
      if (strokes.length === 0) return null;
      const w = Math.max(1, Math.round(layout.current.width));
      const h = Math.max(1, Math.round(layout.current.height));
      // Conversion stroke → "M x y L x y L x y …" — un seul Path par trait, beaucoup
      // plus léger que des dizaines de <circle> et permet à wkhtmltopdf de bien rendre.
      const paths = strokes
        .filter((s) => s.length > 0)
        .map((s) => {
          const segs = s
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(' ');
          return `<path d="${segs}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
        })
        .join('');
      const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paths}</svg>`;
      // btoa n'existe pas en RN, mais Buffer non plus — on encode avec une fonction inline.
      const base64 = encodeBase64Utf8(svg);
      return `data:image/svg+xml;base64,${base64}`;
    },
  }), [strokes, strokeColor, strokeWidth, onChange]);

  return (
    <View
      style={[styles.canvas, { height }]}
      onLayout={onLayout}
      {...responder.panHandlers}
      collapsable={false}
    >
      {strokes.map((stroke, i) => (
        <StrokeRenderer key={i} points={stroke} color={strokeColor} width={strokeWidth} />
      ))}
    </View>
  );
});

/**
 * Rendu d'un trait : on relie chaque paire de points consécutifs par un View rectangulaire
 * pivoté (segment de droite). C'est ce que font la plupart des libs naïves de canvas RN.
 * Coût : O(N) Views par trait, acceptable jusqu'à ~500 points par stroke.
 */
function StrokeRenderer({ points, color, width }: { points: Point[]; color: string; width: number }) {
  if (points.length < 2) return null;
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 0.5) continue; // skip micro-mouvements
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    segments.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: a.x,
          top: a.y - width / 2,
          width: length,
          height: width,
          backgroundColor: color,
          borderRadius: width / 2,
          transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: `${angle}deg` }],
          transformOrigin: '0 50%',
        }}
      />,
    );
  }
  return <>{segments}</>;
}

/**
 * Encodage base64 UTF-8 portable RN. global.btoa n'existe pas, Buffer non plus —
 * on implémente avec l'algo standard (table 64 caractères) sur les bytes UTF-8.
 */
function encodeBase64Utf8(str: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6));
      bytes.push(0x80 | (code & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12));
      bytes.push(0x80 | ((code >> 6) & 0x3f));
      bytes.push(0x80 | (code & 0x3f));
    }
  }
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1] ?? 0;
    const b3 = bytes[i + 2] ?? 0;
    out += table[b1 >> 2];
    out += table[((b1 & 0x03) << 4) | (b2 >> 4)];
    out += i + 1 < bytes.length ? table[((b2 & 0x0f) << 2) | (b3 >> 6)] : '=';
    out += i + 2 < bytes.length ? table[b3 & 0x3f] : '=';
  }
  return out;
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    backgroundColor: '#fcfcfc',
    overflow: 'hidden',
    position: 'relative',
  },
});

export default SignaturePad;
