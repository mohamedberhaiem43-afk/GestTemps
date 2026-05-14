import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, View, Text, Image } from 'react-native';
import { COLORS } from '../config/env';

/**
 * Recouvre l'écran d'un splash quand l'app passe en background ou en état
 * "inactive" (multi-tâches). Indispensable sur iOS où le snapshot du dernier
 * écran est conservé par l'OS pour la preview du switcher d'apps — sans ce
 * shield, un bulletin de paie / signature reste visible quand l'utilisateur
 * passe sur autre chose.
 *
 * Sur Android, FLAG_SECURE (via useSecureScreen) couvre déjà ce cas mais
 * uniquement sur les écrans marqués sensibles. Ici, on protège toute l'app
 * de manière uniforme.
 */
export default function BackgroundShield({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      // 'inactive' = transition ou multi-tâches sur iOS (l'OS a déjà capturé un
      //              snapshot — on doit cacher le contenu AVANT que ça arrive,
      //              donc on réagit à 'inactive' pas seulement 'background').
      // 'background' = app vraiment en arrière-plan.
      // 'active' = retour en avant-plan, on enlève le shield.
      setHidden(state !== 'active');
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      {children}
      {hidden && (
        <View style={styles.shield} pointerEvents="none">
          <Image
            source={require('../../assets/concorde-workly-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.label}>Concorde Workforce</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  shield: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999, // Android — au-dessus de tout, même les modals natifs.
  },
  logo: {
    width: 120,
    height: 120,
    opacity: 0.9,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    letterSpacing: 1,
  },
});
