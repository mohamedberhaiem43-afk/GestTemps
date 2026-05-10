import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { useInactivity } from '../contexts/InactivityContext';

/**
 * Wrapper qui notifie l'InactivityContext à chaque touch utilisateur.
 *
 * On utilise les props `onTouchStart` / `onTouchMove` plutôt qu'un PanResponder
 * pour ne pas intercepter les gestes (les enfants reçoivent normalement les
 * événements touch). React Native propage les events depuis la racine donc
 * cette View capture toutes les interactions sans bloquer.
 */
export default function ActivityTracker({ children }: { children: ReactNode }) {
  const { bumpActivity } = useInactivity();
  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={bumpActivity}
      onTouchMove={bumpActivity}
    >
      {children}
    </View>
  );
}
