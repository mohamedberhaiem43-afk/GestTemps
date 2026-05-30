import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { InactivityProvider } from './src/contexts/InactivityContext';
import { COLORS } from './src/config/env';
import { configureNotificationHandler, registerForPushAsync } from './src/services/push';
import BackgroundShield from './src/components/BackgroundShield';
import ActivityTracker from './src/components/ActivityTracker';
import LockScreen from './src/components/LockScreen';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PresenceHistoryScreen from './src/screens/PresenceHistoryScreen';
import LeaveRequestScreen from './src/screens/LeaveRequestScreen';
import ExpenseScreen from './src/screens/ExpenseScreen';
import BalanceScreen from './src/screens/BalanceScreen';
import AlimenterCetScreen from './src/screens/AlimenterCetScreen';
import DigitalVaultScreen from './src/screens/DigitalVaultScreen';
import AuthorizationScreen from './src/screens/AuthorizationScreen';
import DemandeAutorisationScreen from './src/screens/DemandeAutorisationScreen';
import TeletravailScreen from './src/screens/TeletravailScreen';
import DemandeAbsenceScreen from './src/screens/DemandeAbsenceScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SignatureScreen from './src/screens/SignatureScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import NotificationPreferencesScreen from './src/screens/NotificationPreferencesScreen';
import HolidaysScreen from './src/screens/HolidaysScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import ChatRagScreen from './src/screens/ChatRagScreen';
import MissionsScreen from './src/screens/MissionsScreen';
import AddRequestScreen from './src/screens/AddRequestScreen';

// Manager Screens
import EmployeeListScreen from './src/screens/manager/EmployeeListScreen';
import AddEmployeeScreen from './src/screens/manager/AddEmployeeScreen';
import LeaveApprovalScreen from './src/screens/manager/LeaveApprovalScreen';
import ExpenseApprovalScreen from './src/screens/manager/ExpenseApprovalScreen';
import DailyPointageScreen from './src/screens/manager/DailyPointageScreen';
import MissionApprovalScreen from './src/screens/manager/MissionApprovalScreen';
import ManagerDashboardScreen from './src/screens/manager/ManagerDashboardScreen';
import ContractRenewalScreen from './src/screens/manager/ContractRenewalScreen';
import AuthorizationApprovalScreen from './src/screens/manager/AuthorizationApprovalScreen';

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="PresenceHistory" component={PresenceHistoryScreen} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen name="Expense" component={ExpenseScreen} />
      <Stack.Screen name="Balance" component={BalanceScreen} />
      <Stack.Screen name="AlimenterCet" component={AlimenterCetScreen} />
      <Stack.Screen name="DigitalVault" component={DigitalVaultScreen} />
      <Stack.Screen name="Authorization" component={AuthorizationScreen} />
      <Stack.Screen name="DemandeAutorisation" component={DemandeAutorisationScreen} />
      <Stack.Screen name="Teletravail" component={TeletravailScreen} />
      <Stack.Screen name="DemandeAbsence" component={DemandeAbsenceScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Signature" component={SignatureScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
      <Stack.Screen name="Holidays" component={HolidaysScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="ChatRag" component={ChatRagScreen} />
      <Stack.Screen name="Missions" component={MissionsScreen} />
      <Stack.Screen name="AddRequest" component={AddRequestScreen} />
      {/* Manager Screens - always registered, access controlled by UI */}
      <Stack.Screen name="EmployeeList" component={EmployeeListScreen} />
      <Stack.Screen name="AddEmployee" component={AddEmployeeScreen} />
      <Stack.Screen name="EmployeeDetail" component={ProfileScreen} />
      <Stack.Screen name="LeaveApproval" component={LeaveApprovalScreen} />
      <Stack.Screen name="ExpenseApproval" component={ExpenseApprovalScreen} />
      <Stack.Screen name="DailyPointage" component={DailyPointageScreen} />
      <Stack.Screen name="MissionApproval" component={MissionApprovalScreen} />
      <Stack.Screen name="ManagerDashboard" component={ManagerDashboardScreen} />
      <Stack.Screen name="ContractRenewal" component={ContractRenewalScreen} />
      <Stack.Screen name="AuthorizationApproval" component={AuthorizationApprovalScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Une fois l'utilisateur authentifié, on enregistre son token push pour que le backend
  // puisse lui envoyer des rappels (entrée/sortie oubliée, validations, etc.).
  useEffect(() => {
    if (isAuthenticated && user?.soccod) {
      registerForPushAsync(user.soccod).catch(() => { /* best-effort */ });
    }
  }, [isAuthenticated, user?.soccod]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return isAuthenticated ? <AppStack /> : <AuthStack />;
}

// Configure le handler global des notifications une seule fois au chargement du module.
// Doit être appelé en dehors d'un composant React pour s'exécuter avant le 1er render.
configureNotificationHandler();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* SEC-G5 : auto-lock après inactivité — InactivityProvider doit être
            sous AuthProvider (LockScreen consomme useAuth) ; ActivityTracker
            wrap toute la nav pour capter les touches partout sans bloquer.
            SEC-G4 : BackgroundShield couvre l'app quand elle passe en
            background pour cacher le contenu sensible dans la preview iOS. */}
        <InactivityProvider>
          <BackgroundShield>
            <ActivityTracker>
              <NavigationContainer>
                <StatusBar style="light" />
                <RootNavigator />
              </NavigationContainer>
            </ActivityTracker>
            <LockScreen />
          </BackgroundShield>
        </InactivityProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});