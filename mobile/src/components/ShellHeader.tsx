import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DrawerHeaderProps } from '@react-navigation/drawer';

import { useAuth } from '../context/AuthContext';
import { useProfile } from '../services/profileData';
import { brandLabel } from '../utils/brandLabel';
import { fonts, tokens } from '../theme/tokens';

export function ShellHeader({ navigation }: DrawerHeaderProps) {
  const { user } = useAuth();
  const profile = useProfile(user ?? null);
  const label = brandLabel(user ?? null, profile);

  return (
    <BlurView intensity={48} tint="dark" style={styles.blur}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.row}>
          <Pressable
            style={styles.brand}
            onPress={() => navigation.navigate('Today')}
            hitSlop={8}
          >
            <View style={styles.brandDot} />
            <Text style={styles.brandText} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Open menu"
            onPress={() => navigation.openDrawer()}
            style={styles.menuBtn}
          >
            <View style={styles.hamburger}>
              <View style={styles.hamburgerLine} />
              <View style={styles.hamburgerLine} />
              <View style={styles.hamburgerLine} />
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  safe: { backgroundColor: 'rgba(12, 12, 14, 0.72)' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  brand: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.accent,
    shadowColor: tokens.accent,
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  brandText: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 18,
    letterSpacing: -0.5,
    color: tokens.text,
  },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    backgroundColor: tokens.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburger: { gap: 5, alignItems: 'center' },
  hamburgerLine: { width: 18, height: 2, backgroundColor: tokens.text, borderRadius: 1 },
});
