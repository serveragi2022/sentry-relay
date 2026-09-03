import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors, typography } from '@/theme';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { EventsScreen } from '@/screens/EventsScreen';
import { EventDetailScreen } from '@/screens/EventDetailScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const EventsStack = createNativeStackNavigator();

function EventsStackNavigator() {
  return (
    <EventsStack.Navigator screenOptions={{ headerShown: false }}>
      <EventsStack.Screen name="EventsList" component={EventsScreen} />
      <EventsStack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ headerShown: true, title: 'Event Detail' }}
      />
    </EventsStack.Navigator>
  );
}

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>{symbol}</Text>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer
      theme={{
        dark: false,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surfaceLowest,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.critical,
        },
        fonts: {
          regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
          medium: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
          bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
          heavy: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
        },
      }}
    >
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.secondary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { borderTopColor: colors.border, height: 58, paddingBottom: 6, paddingTop: 6 },
          tabBarLabelStyle: [typography.labelSm, { textTransform: 'none' }],
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon symbol="◧" focused={focused} /> }}
        />
        <Tab.Screen
          name="Events"
          component={EventsStackNavigator}
          options={{ tabBarIcon: ({ focused }) => <TabIcon symbol="≡" focused={focused} /> }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon symbol="⚙" focused={focused} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
