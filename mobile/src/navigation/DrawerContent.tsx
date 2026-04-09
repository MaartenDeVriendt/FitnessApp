import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { fonts, tokens } from '../theme/tokens';

const ROUTE_LABEL: Record<string, string> = {
  Today: 'Today',
  Template: 'Week template',
  PRs: 'PRs',
  Profile: 'Profile',
};

export function DrawerContent(props: DrawerContentComponentProps) {
  const { navigation, state } = props;
  const { signOut } = useAuth();
  const active = state.routes[state.index]?.name ?? 'Today';
  const currentLabel = ROUTE_LABEL[active] ?? active;

  function go(name: keyof typeof ROUTE_LABEL) {
    navigation.navigate(name);
    navigation.closeDrawer();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.drawerTop}>
        <Text style={styles.drawerLabel}>Menu</Text>
        <Pressable
          accessibilityLabel="Close menu"
          onPress={() => navigation.closeDrawer()}
          style={styles.drawerClose}
        >
          <Text style={styles.drawerCloseText}>×</Text>
        </Pressable>
      </View>
      <Text style={styles.drawerCurrent}>
        Now: <Text style={styles.drawerCurrentStrong}>{currentLabel}</Text>
      </Text>
      <ScrollView contentContainerStyle={styles.nav}>
        <DrawerLink label="Today" active={active === 'Today'} onPress={() => go('Today')} />
        <DrawerLink label="Week template" active={active === 'Template'} onPress={() => go('Template')} />
        <DrawerLink label="PRs" active={active === 'PRs'} onPress={() => go('PRs')} />
        <DrawerLink label="Profile" active={active === 'Profile'} onPress={() => go('Profile')} />
      </ScrollView>
      <Pressable style={styles.signOut} onPress={() => void signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function DrawerLink({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.link, active && styles.linkActive]}
    >
      <Text style={[styles.linkText, active && styles.linkTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: tokens.surface,
    paddingHorizontal: 16,
  },
  drawerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  drawerLabel: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: tokens.text,
  },
  drawerClose: {
    width: 40,
    height: 40,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerCloseText: {
    fontSize: 26,
    color: tokens.textSecondary,
    lineHeight: 28,
  },
  drawerCurrent: {
    marginTop: 12,
    fontSize: 13,
    color: tokens.textMuted,
    lineHeight: 20,
  },
  drawerCurrentStrong: {
    color: tokens.accent,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
  nav: { paddingVertical: 12, gap: 6 },
  link: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  linkActive: {
    backgroundColor: tokens.accent,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  linkText: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    color: tokens.textSecondary,
    fontWeight: '600',
  },
  linkTextActive: {
    color: tokens.bgDeep,
  },
  signOut: {
    marginTop: 'auto',
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.textSecondary,
  },
});
