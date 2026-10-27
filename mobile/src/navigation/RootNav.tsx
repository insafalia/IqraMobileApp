import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { LoadingBlock, colors } from '../components/ui';
import { LoginScreen } from '../screens/LoginScreen';
import { StaffHomeScreen } from '../screens/staff/StaffHomeScreen';
import { DashboardScreen } from '../screens/owner/DashboardScreen';
import { CustomersScreen } from '../screens/owner/CustomersScreen';
import { QuotationsScreen } from '../screens/owner/QuotationsScreen';
import { QuotationDetailScreen } from '../screens/owner/QuotationDetailScreen';
import { WagesScreen } from '../screens/owner/WagesScreen';
import { StaffScreen } from '../screens/owner/StaffScreen';
import type { OwnerStackParamList, OwnerTabParamList } from './types';

const OwnerStack = createNativeStackNavigator<OwnerStackParamList>();
const OwnerTabs = createBottomTabNavigator<OwnerTabParamList>();

const ownerIcons: Record<keyof OwnerTabParamList, string> = {
  Dashboard: '📊',
  Customers: '👥',
  Quotations: '📋',
  Wages: '📅',
  Staff: '⚙️',
};

function OwnerTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[tabStyles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = descriptors[route.key].options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            style={tabStyles.item}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
            }}
          >
            <Text style={tabStyles.icon}>{ownerIcons[route.name as keyof OwnerTabParamList]}</Text>
            <Text style={[tabStyles.label, focused && tabStyles.labelOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OwnerTabNav() {
  return (
    <OwnerTabs.Navigator tabBar={(props) => <OwnerTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <OwnerTabs.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Home' }} />
      <OwnerTabs.Screen name="Customers" component={CustomersScreen} />
      <OwnerTabs.Screen name="Quotations" component={QuotationsScreen} options={{ title: 'Quotes' }} />
      <OwnerTabs.Screen name="Wages" component={WagesScreen} />
      <OwnerTabs.Screen name="Staff" component={StaffScreen} />
    </OwnerTabs.Navigator>
  );
}

function OwnerNav() {
  return (
    <OwnerStack.Navigator screenOptions={{ headerShown: false }}>
      <OwnerStack.Screen name="OwnerTabs" component={OwnerTabNav} />
      <OwnerStack.Screen name="QuotationDetail" component={QuotationDetailScreen} />
    </OwnerStack.Navigator>
  );
}

export function RootNav() {
  const { loading, session, profile } = useAuth();
  if (loading) return <LoadingBlock />;
  if (!session || !profile) return <LoginScreen />;
  if (profile.role !== 'owner') return <StaffHomeScreen />;
  return (
    <NavigationContainer>
      <OwnerNav />
    </NavigationContainer>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.ink,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  icon: { fontSize: 18 },
  label: { color: '#7a95b0', fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  labelOn: { color: colors.amber },
});
