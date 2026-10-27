import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { AppHeader, Body, EmptyText, ScreenFrame, colors } from '../../components/ui';
import { errorText, formatDisplayDate, formatINR, related } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { OwnerStackParamList } from '../../navigation/types';

type Stats = {
  total_customers: number;
  total_quotations: number;
  active_quotations: number;
  completed_jobs: number;
  total_collected: number;
  total_material_spend: number;
  total_outstanding: number;
};

type Recent = { id: string; title: string; meta: string; quotationId: string | null };

export function DashboardScreen() {
  const { profile, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const [stats, setStats] = useState<Stats | null>(null);
  const [payments, setPayments] = useState<Recent[]>([]);
  const [jobs, setJobs] = useState<Recent[]>([]);
  const [quotes, setQuotes] = useState<Recent[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [statsResult, paymentResult, jobResult, quoteResult] = await Promise.all([
      supabase.rpc('owner_dashboard'),
      supabase.from('payments').select('id, payment_number, amount, payment_date, payment_mode, quotation_id, quotations(quotation_number, customers(name))').order('payment_date', { ascending: false }).limit(5),
      supabase.from('jobs').select('id, job_number, job_date, status, quotation_id, quotations(quotation_number, customers(name))').order('job_date', { ascending: false }).limit(5),
      supabase.from('quotations').select('id, quotation_number, quotation_date, quoted_amount, status, customers(name)').order('quotation_date', { ascending: false }).limit(5),
    ]);
    if (statsResult.error || paymentResult.error || jobResult.error || quoteResult.error) {
      setError(errorText(statsResult.error || paymentResult.error || jobResult.error || quoteResult.error));
      return;
    }
    setError('');
    setStats(statsResult.data as Stats);
    setPayments((paymentResult.data ?? []).map((row) => {
      const quote = related(row.quotations as unknown as { quotation_number: string; customers: { name: string } | { name: string }[] | null } | null);
      const customer = quote ? related(quote.customers) : null;
      return {
        id: row.id,
        title: `${formatINR(row.amount)} · ${row.payment_mode}`,
        meta: `${customer?.name || 'Customer'} · ${quote?.quotation_number || row.payment_number} · ${formatDisplayDate(row.payment_date)}`,
        quotationId: row.quotation_id,
      };
    }));
    setJobs((jobResult.data ?? []).map((row) => {
      const quote = related(row.quotations as unknown as { quotation_number: string; customers: { name: string } | { name: string }[] | null } | null);
      const customer = quote ? related(quote.customers) : null;
      return {
        id: row.id,
        title: `${row.job_number} · ${row.status}`,
        meta: `${customer?.name || 'Customer'} · ${formatDisplayDate(row.job_date)}`,
        quotationId: row.quotation_id,
      };
    }));
    setQuotes((quoteResult.data ?? []).map((row) => {
      const customer = related(row.customers as unknown as { name: string } | { name: string }[] | null);
      return {
        id: row.id,
        title: `${row.quotation_number} · ${row.status}`,
        meta: `${customer?.name || 'Customer'} · ${formatINR(row.quoted_amount)} · ${formatDisplayDate(row.quotation_date)}`,
        quotationId: row.id,
      };
    }));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cards = stats ? [
    ['Customers', String(stats.total_customers)],
    ['Quotations', String(stats.total_quotations)],
    ['Active quotes', String(stats.active_quotations)],
    ['Jobs done', String(stats.completed_jobs)],
    ['Collected', formatINR(stats.total_collected)],
    ['Outstanding', formatINR(stats.total_outstanding)],
    ['Materials', formatINR(stats.total_material_spend)],
  ] : [];

  return (
    <ScreenFrame>
      <AppHeader showLogo subtitle={profile?.display_name || 'Owner'} action={{ label: 'Sign out', onPress: signOut }} />
      <Body>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.pageTitle}>Dashboard</Text>
          <Text style={styles.pageSub}>Today at a glance</Text>
          <View style={styles.grid}>
            {cards.map(([label, value], index) => (
              <View key={label} style={[styles.stat, { borderLeftColor: ['#22c55e', '#f59e0b', '#3b82f6'][index % 3] }]}>
                <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <Section title="Recent payments" icon="💰" rows={payments} onOpen={(id) => id && navigation.navigate('QuotationDetail', { quotationId: id })} />
          <Section title="Recent jobs" icon="🔧" rows={jobs} onOpen={(id) => id && navigation.navigate('QuotationDetail', { quotationId: id })} />
          <Section title="Recent quotations" icon="📋" rows={quotes} onOpen={(id) => id && navigation.navigate('QuotationDetail', { quotationId: id })} />
        </ScrollView>
      </Body>
    </ScreenFrame>
  );
}

function Section({ title, icon, rows, onOpen }: { title: string; icon: string; rows: Recent[]; onOpen: (quotationId: string | null) => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{icon}  {title}</Text>
      </View>
      {rows.length === 0 ? <EmptyText text="Nothing yet" /> : rows.map((row) => (
        <Pressable key={row.id} style={styles.row} onPress={() => onOpen(row.quotationId)}>
          <Text style={styles.rowTitle} numberOfLines={1}>{row.title}</Text>
          <Text style={styles.rowMeta} numberOfLines={2}>{row.meta}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  pageTitle: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  pageSub: { color: colors.muted, marginTop: 2, marginBottom: 14, fontSize: 13 },
  error: { color: colors.danger, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#1a2740',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.muted, marginTop: 4, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  section: { marginTop: 18, backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden', shadowColor: '#1a2740', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  sectionHead: { backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 11 },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  row: { paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f0f4f8' },
  rowTitle: { color: colors.ink, fontWeight: '800' },
  rowMeta: { color: colors.muted, marginTop: 3, fontSize: 12 },
});
