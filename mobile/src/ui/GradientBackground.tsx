import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { tokens } from '../theme/tokens';

/**
 * Approximates `body::before` in Angular global styles — deep bg + soft teal/indigo glows.
 * Pads the top for the status bar / notch when there is no stack header (e.g. tab screens).
 */
export function GradientBackground({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['rgba(45, 212, 191, 0.08)', 'transparent']}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
      />
      <LinearGradient
        colors={['rgba(99, 102, 241, 0.05)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 1, y: 0.5 }}
        end={{ x: 0.35, y: 0.5 }}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bgDeep },
});
