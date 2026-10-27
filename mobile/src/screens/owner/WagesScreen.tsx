import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader, Body, ChoiceRow, EmptyText, Field, FormScroll, Notice, PrimaryButton, ScreenFrame, TextField, colors } from '../../components/ui';
import { errorText, formatDisplayDate, formatINR } from '../../lib/format';
import { supabase } from '../../lib/supabase';

type Stats = { total_unpaid: number; total_paid: number; total_employees: number; this_month_days: number };
type Employee = { id: string; name: string; designation: string | null; phone: string | null; daily_wage: number; total_unpaid: number };
type Row = {
  id: string;
  attendance_number: string;
  employee_id: string;
  attendance_date: string;
  days: number;
  amount_due: number;
  status: string;
  employeeName: string;
  site: string;
};

export function WagesScreen() {
  const [tab, setTab] = useState<'records' | 'employees'>('records');
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filters, setFilters] = useState({ from: '', to: '', employee: '', status: 'All', site: '' });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', designation: '', phone: '', wage: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [statsResult, employeeResult, wageResult, attendanceResult] = await Promise.all([
      supabase.rpc('attendance_stats'),
      supabase.from('employees').select('id, name, designation, phone, daily_wage').order('name'),
      supabase.from('employee_wage_totals').select('employee_id, total_unpaid'),
      supabase.from('attendance').select('id, attendance_number, employee_id, attendance_date, days, amount_due, status, quotation_id, quotations(quotation_number, customers(name))').order('attendance_date', { ascending: false }).limit(200),
    ]);
    if (statsResult.error || employeeResult.error || attendanceResult.error) {
      setError(errorText(statsResult.error || employeeResult.error || attendanceResult.error));
      return;
    }
    const unpaid = new Map((wageResult.data ?? []).map((row) => [row.employee_id, Number(row.total_unpaid)]));
    const people = (employeeResult.data ?? []).map((employee) => ({
      ...employee,
      daily_wage: Number(employee.daily_wage),
      total_unpaid: unpaid.get(employee.id) ?? 0,
    }));
    setEmployees(people);
    setStats(statsResult.data as Stats);
    const names = new Map(people.map((employee) => [employee.id, employee.name]));
    setRows((attendanceResult.data ?? []).map((row) => {
      const quote = Array.isArray(row.quotations) ? row.quotations[0] : row.quotations;
      const customer = quote ? (Array.isArray(quote.customers) ? quote.customers[0] : quote.customers) : null;
      return {
        id: row.id,
        attendance_number: row.attendance_number,
        employee_id: row.employee_id,
        attendance_date: row.attendance_date,
        days: Number(row.days),
        amount_due: Number(row.amount_due),
        status: row.status,
        employeeName: names.get(row.employee_id) || '',
        site: customer?.name || quote?.quotation_number || '',
      };
    }));
    setError('');
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = rows.filter((row) => {
    if (filters.from && row.attendance_date < filters.from) return false;
    if (filters.to && row.attendance_date > filters.to) return false;
    if (filters.employee && !row.employeeName.toLowerCase().includes(filters.employee.trim().toLowerCase())) return false;
    if (filters.status !== 'All' && row.status !== filters.status) return false;
    if (filters.site && !row.site.toLowerCase().includes(filters.site.trim().toLowerCase())) return false;
    return true;
  });

  async function saveEmployee() {
    const wage = Number(form.wage);
    if (!form.name.trim()) return setError('Enter the employee name.');
    if (!Number.isFinite(wage) || wage < 0) return setError('Enter the daily rate.');
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      designation: form.designation.trim() || null,
      phone: form.phone.trim() || null,
      daily_wage: wage,
    };
    const result = editId
      ? await supabase.from('employees').update(payload).eq('id', editId)
      : await supabase.from('employees').insert(payload);
    setBusy(false);
    if (result.error) return setError(errorText(result.error));
    setShowForm(false);
    setEditId(null);
    setForm({ name: '', designation: '', phone: '', wage: '' });
    setError('');
    load();
  }

  async function setStatus(id: string, status: string) {
    const { error: updateError } = await supabase.from('attendance').update({ status }).eq('id', id);
    if (updateError) setError(errorText(updateError));
    else load();
  }

  function remove(id: string) {
    Alert.alert('Delete this attendance?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: deleteError } = await supabase.from('attendance').delete().eq('id', id);
          if (deleteError) setError(errorText(deleteError));
          else load();
        },
      },
    ]);
  }

  return (
    <ScreenFrame>
      <AppHeader
        title="Attendance"
        subtitle="Owner portal"
        action={tab === 'employees' ? { label: 'Add', onPress: () => { setEditId(null); setForm({ name: '', designation: '', phone: '', wage: '' }); setShowForm(true); } } : undefined}
      />
      <Body>
        {showForm ? (
          <FormScroll>
            <Notice kind="error" text={error} />
            <Field label="Name" required><TextField value={form.name} onChangeText={(name) => setForm({ ...form, name })} /></Field>
            <Field label="Designation"><TextField value={form.designation} onChangeText={(designation) => setForm({ ...form, designation })} /></Field>
            <Field label="Phone"><TextField value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" /></Field>
            <Field label="Daily rate" required><TextField value={form.wage} onChangeText={(wage) => setForm({ ...form, wage })} keyboardType="decimal-pad" /></Field>
            <Text style={styles.hint}>Changing the daily rate updates new attendance. Saved days keep the old amount.</Text>
            <PrimaryButton label="Save employee" onPress={saveEmployee} busy={busy} />
            <Pressable onPress={() => setShowForm(false)}><Text style={styles.cancel}>Cancel</Text></Pressable>
          </FormScroll>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Notice kind="error" text={error} />
            <View style={styles.grid}>
              <Mini label="Total unpaid" value={formatINR(stats?.total_unpaid)} />
              <Mini label="Total paid" value={formatINR(stats?.total_paid)} />
              <Mini label="This month days" value={String(stats?.this_month_days ?? 0)} />
              <Mini label="Employees" value={String(stats?.total_employees ?? 0)} />
            </View>
            <View style={styles.tabs}>
              <Pressable onPress={() => setTab('records')} style={[styles.tab, tab === 'records' && styles.tabOn]}><Text style={[styles.tabText, tab === 'records' && styles.tabTextOn]}>Records</Text></Pressable>
              <Pressable onPress={() => setTab('employees')} style={[styles.tab, tab === 'employees' && styles.tabOn]}><Text style={[styles.tabText, tab === 'employees' && styles.tabTextOn]}>Employees</Text></Pressable>
            </View>
            {tab === 'records' ? (
              <>
                <Field label="Employee"><TextField value={filters.employee} onChangeText={(employee) => setFilters({ ...filters, employee })} placeholder="Search by name" /></Field>
                <Field label="Date from"><TextField value={filters.from} onChangeText={(from) => setFilters({ ...filters, from })} placeholder="YYYY-MM-DD" /></Field>
                <Field label="Date to"><TextField value={filters.to} onChangeText={(to) => setFilters({ ...filters, to })} placeholder="YYYY-MM-DD" /></Field>
                <Field label="Status">
                  <ChoiceRow options={['All', 'Unpaid', 'Paid']} value={filters.status} onChange={(status) => setFilters({ ...filters, status })} />
                </Field>
                <Field label="Site / customer"><TextField value={filters.site} onChangeText={(site) => setFilters({ ...filters, site })} /></Field>
                {visible.length === 0 ? <EmptyText text="No attendance records" /> : visible.map((row) => (
                  <View key={row.id} style={styles.card}>
                    <Text style={styles.name}>{row.employeeName}</Text>
                    <Text style={styles.meta}>{formatDisplayDate(row.attendance_date)} · {row.days} day(s) · {formatINR(row.amount_due)}</Text>
                    <Text style={styles.meta}>{row.site || 'No site'} · {row.status}</Text>
                    <View style={styles.actions}>
                      <Pressable onPress={() => setStatus(row.id, row.status === 'Paid' ? 'Unpaid' : 'Paid')}>
                        <Text style={styles.link}>{row.status === 'Paid' ? 'Mark unpaid' : 'Mark paid'}</Text>
                      </Pressable>
                      <Pressable onPress={() => remove(row.id)}><Text style={styles.delete}>Delete</Text></Pressable>
                    </View>
                  </View>
                ))}
              </>
            ) : employees.length === 0 ? <EmptyText text="No employees yet" /> : employees.map((employee) => (
              <Pressable
                key={employee.id}
                style={styles.card}
                onPress={() => {
                  setEditId(employee.id);
                  setForm({ name: employee.name, designation: employee.designation || '', phone: employee.phone || '', wage: String(employee.daily_wage) });
                  setShowForm(true);
                }}
              >
                <Text style={styles.name}>{employee.name}</Text>
                <Text style={styles.meta}>{employee.designation || 'Worker'} · {formatINR(employee.daily_wage)} / day</Text>
                <Text style={styles.meta}>Unpaid {formatINR(employee.total_unpaid)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Body>
    </ScreenFrame>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mini: { width: '48%', backgroundColor: colors.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.line },
  miniValue: { color: colors.ink, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 14 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  tabOn: { backgroundColor: colors.ink },
  tabText: { color: colors.inkSoft, fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 10, shadowColor: '#1a2740', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  name: { color: colors.ink, fontWeight: '800' },
  meta: { color: colors.muted, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  link: { color: colors.blue, fontWeight: '700' },
  delete: { color: colors.danger, fontWeight: '700' },
  hint: { color: colors.muted, marginBottom: 8 },
  cancel: { color: colors.muted, textAlign: 'center', marginTop: 14, fontWeight: '700' },
});
