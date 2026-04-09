import { ActivityIndicator, Dimensions, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { ShellHeader } from '../components/ShellHeader';
import { LoginScreen } from '../screens/LoginScreen';
import { WeekViewScreen } from '../screens/WeekViewScreen';
import { ProgramEditorScreen } from '../screens/ProgramEditorScreen';
import { PrSummaryScreen } from '../screens/PrSummaryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { DrawerContent } from './DrawerContent';
import { tokens } from '../theme/tokens';

export type DrawerParamList = {
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

const Drawer = createDrawerNavigator<DrawerParamList>();
const drawerWidth = Math.min(304, Dimensions.get('window').width * 0.88);

function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        drawerPosition: 'right',
        headerShown: true,
        header: (props) => <ShellHeader {...props} />,
        drawerStyle: {
          width: drawerWidth,
          backgroundColor: tokens.surface,
          borderLeftWidth: 1,
          borderLeftColor: tokens.border,
        },
        overlayColor: 'rgba(0, 0, 0, 0.55)',
        drawerType: 'front',
      }}
    >
      <Drawer.Screen name="Today" component={WeekViewScreen} options={{ title: 'Today' }} />
      <Drawer.Screen name="Template" component={ProgramEditorScreen} options={{ title: 'Week template' }} />
      <Drawer.Screen name="PRs" component={PrSummaryScreen} options={{ title: 'PRs' }} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
    </Drawer.Navigator>
  );
}

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
        <MainDrawer />
      )}
    </NavigationContainer>
  );
}
