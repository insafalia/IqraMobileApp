import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Body, BrandLogo, ScreenFrame, colors } from '../../components/ui';
import { AttendanceScreen } from './AttendanceScreen';
import { JobScreen } from './JobScreen';
import { MaterialScreen } from './MaterialScreen';
import { PaymentScreen } from './PaymentScreen';

const TABS = [
  { key: 'Payment', label: 'Payment', icon: '💳', enabled: 'can_add_payment' },
  { key: 'Job', label: 'Job Done', icon: '✅', enabled: 'can_add_job' },
  { key: 'Material', label: 'Materials', icon: '🛒', enabled: 'can_add_material' },
  { key: 'Attendance', label: 'Attendance', icon: '📅', enabled: 'can_add_attendance' },
] as const;

export function StaffHomeScreen() {
  const { profile, signOut } = useAuth();
  const tabs = TABS.filter((tab) => Boolean(profile?.[tab.enabled]));
  const [active, setActive] = useState<(typeof TABS)[number]['key']>(tabs[0]?.key ?? 'Payment');
  const current = tabs.some((tab) => tab.key === active) ? active : tabs[0]?.key;

  return (
    <ScreenFrame>
      <LinearGradient colors={['#1a2740', '#243b55']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.brand}>
          <BrandLogo height={48} />
          {profile?.display_name ? <Text style={styles.name} numberOfLines={1}>{profile.display_name}</Text> : null}
        </View>
        <Pressable onPress={signOut} hitSlop={8} style={styles.outBtn}>
          <Text style={styles.out}>Sign out</Text>
        </Pressable>
      </LinearGradient>
      {tabs.length === 0 ? (
        <Body>
          <Text style={styles.empty}>No actions are enabled for this login. Ask the owner to turn them on.</Text>
        </Body>
      ) : (
        <>
          <View style={styles.tabs}>
            {tabs.map((tab) => {
              const on = tab.key === current;
              return (
                <Pressable key={tab.key} style={styles.tab} onPress={() => setActive(tab.key)}>
                  <Text style={styles.tabIcon}>{tab.icon}</Text>
                  <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{tab.label}</Text>
                  <View style={[styles.indicator, on && styles.indicatorOn]} />
                </Pressable>
              );
            })}
          </View>
          <Body>
            {current === 'Payment' ? <PaymentScreen /> : null}
            {current === 'Job' ? <JobScreen /> : null}
            {current === 'Material' ? <MaterialScreen /> : null}
            {current === 'Attendance' ? <AttendanceScreen /> : null}
          </Body>
        </>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flex: 1, marginRight: 12 },
  name: { color: '#a3b8cc', fontSize: 12, marginTop: 4, letterSpacing: 0.3 },
  outBtn: { backgroundColor: colors.amber, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  out: { color: '#fff', fontWeight: '800' },
  tabs: { flexDirection: 'row', backgroundColor: colors.ink, paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 8, gap: 4 },
  tabIcon: { fontSize: 18 },
  tabLabel: { color: '#7a95b0', fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  tabLabelOn: { color: colors.amber },
  indicator: { height: 3, width: '70%', borderTopLeftRadius: 2, borderTopRightRadius: 2, marginTop: 8, backgroundColor: 'transparent' },
  indicatorOn: { backgroundColor: colors.amber },
  empty: { color: colors.muted, fontSize: 16, lineHeight: 22, margin: 24 },
});
