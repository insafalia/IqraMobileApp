import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader, Badge, Body, EmptyText, ScreenFrame, TextField, colors } from '../../components/ui';
import { formatDisplayDate, formatINR, related } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { QUOTE_STATUSES } from '../../lib/types';
import type { OwnerStackParamList } from '../../navigation/types';

type Row = {
  id: string;
  quotation_number: string;
  quotation_date: string;
  quoted_amount: number;
  balance_due: number;
  status: string;
  customerName: string;
};

export function QuotationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('All');
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('quotations')
      .select('id, quotation_number, quotation_date, quoted_amount, balance_due, status, customers(name)')
      .order('updated_at', { ascending: false })
      .limit(100);
    setRows((data ?? []).map((row) => ({
      id: row.id,
      quotation_number: row.quotation_number,
      quotation_date: row.quotation_date,
      quoted_amount: Number(row.quoted_amount),
      balance_due: Number(row.balance_due),
      status: row.status,
      customerName: related(row.customers as { name: string } | { name: string }[] | null)?.name || '',
    })));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = rows.filter((row) => {
    const matchesStatus = status === 'All' || row.status === status;
    const matchesName = row.customerName.toLowerCase().includes(term.trim().toLowerCase());
    return matchesStatus && matchesName;
  });

  return (
    <ScreenFrame>
      <AppHeader title="Quotations" subtitle="Owner portal" />
      <Body>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextField value={term} onChangeText={setTerm} placeholder="Search by customer" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
            {['All', ...QUOTE_STATUSES].map((item) => (
              <Pressable key={item} onPress={() => setStatus(item)} style={[styles.chip, status === item && styles.chipOn]}>
                <Text style={[styles.chipText, status === item && styles.chipTextOn]}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {visible.length === 0 ? <EmptyText text="No quotations" /> : visible.map((row) => (
            <Pressable key={row.id} style={styles.card} onPress={() => navigation.navigate('QuotationDetail', { quotationId: row.id })}>
              <View style={styles.row}>
                <Text style={styles.name}>{row.customerName}</Text>
                <Badge label={row.status} />
              </View>
              <Text style={styles.meta}>{row.quotation_number} · {formatDisplayDate(row.quotation_date)}</Text>
              <Text style={styles.meta}>Quoted {formatINR(row.quoted_amount)} · Balance {formatINR(row.balance_due)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Body>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  filters: { marginVertical: 12 },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  chipOn: { backgroundColor: '#fffbeb', borderColor: colors.amber },
  chipText: { color: colors.inkSoft, fontWeight: '700' },
  chipTextOn: { color: '#92400e' },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#1a2740', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  name: { color: colors.ink, fontWeight: '800', fontSize: 16, flex: 1 },
  meta: { color: colors.muted, marginTop: 4 },
});
