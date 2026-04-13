import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { WeekViewScreen } from '../screens/WeekViewScreen';
import { ProgramEditorScreen } from '../screens/ProgramEditorScreen';
import { PrSummaryScreen } from '../screens/PrSummaryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { fonts, tokens } from '../theme/tokens';

export type MainTabParamList = {
  Today: undefined;
  Template: undefined;
  PRs: undefined;
  Profile: undefined;
};

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
    card: 'transparent',
    primary: tokens.accent,
    text: tokens.text,
    border: tokens.border,
  },
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function tabIcon(name: keyof MainTabParamList, focused: boolean) {
  switch (name) {
    case 'Today':
      return focused ? 'calendar' : 'calendar-outline';
    case 'Template':
      return focused ? 'layers' : 'layers-outline';
    case 'PRs':
      return focused ? 'trophy' : 'trophy-outline';
    case 'Profile':
      return focused ? 'person-circle' : 'person-circle-outline';
    default:
      return 'ellipse-outline' as const;
  }
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, focused, size }) => (
          <Ionicons name={tabIcon(route.name, focused)} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="Today"
        component={WeekViewScreen}
        options={{ tabBarLabel: 'Today' }}
      />
      <Tab.Screen
        name="Template"
        component={ProgramEditorScreen}
        options={{ tabBarLabel: 'Template' }}
      />
      <Tab.Screen name="PRs" component={PrSummaryScreen} options={{ tabBarLabel: 'PRs' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: tokens.surface,
    borderTopColor: tokens.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tabLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
});

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user } = useAuth();

  if (user === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.bgDeep }}>
        <ActivityIndicator color={tokens.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {user === null ? (
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bgDeep } }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      ) : (
        <MainTabs />
      )}
    </NavigationContainer>
  );
}
