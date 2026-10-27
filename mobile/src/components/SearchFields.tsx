import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { errorText } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Field, TextField, colors } from './ui';

export type SelectedQuote = {
  id: string;
  quotationNumber: string;
  customerName: string;
};

export function QuotationSearch({
  label,
  optional,
  selected,
  onSelect,
}: {
  label: string;
  optional?: boolean;
  selected: SelectedQuote | null;
  onSelect: (quote: SelectedQuote | null) => void;
}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SelectedQuote[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (selected || term.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    setOpen(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_approved_quotations', { term: term.trim() });
      if (error) {
        setMessage(errorText(error));
        setResults([]);
      } else {
        setMessage('');
        setResults((data ?? []).map((row: { id: string; quotation_number: string; customer_name: string }) => ({
          id: row.id,
          quotationNumber: row.quotation_number,
          customerName: row.customer_name,
        })));
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [selected, term]);

  return (
    <Field label={optional ? `${label} (optional)` : label} required={!optional}>
      {selected ? (
        <View style={styles.pill}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{selected.customerName.slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.pillText}>
            <Text style={styles.pillTitle}>{selected.customerName}</Text>
            <Text style={styles.pillSub}>{selected.quotationNumber}</Text>
          </View>
          <Pressable onPress={() => onSelect(null)} hitSlop={8}><Text style={styles.clear}>✕</Text></Pressable>
        </View>
      ) : (
        <TextField
          value={term}
          onChangeText={setTerm}
          placeholder="Type customer name..."
          autoCapitalize="words"
        />
      )}
      {open ? (
        <View style={styles.dropdown}>
          {searching ? <Text style={styles.hint}>Searching...</Text> : null}
          {!searching && results.length === 0 ? <Text style={styles.hint}>{message || 'No quotations found'}</Text> : null}
          {results.map((quote) => (
            <Pressable
              key={quote.id}
              onPress={() => {
                onSelect(quote);
                setTerm('');
                setOpen(false);
              }}
              style={styles.result}
            >
              <Text style={styles.pillTitle}>{quote.customerName}</Text>
              <Text style={styles.pillSub}>{quote.quotationNumber}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Field>
  );
}

export type SelectedEmployee = {
  id: string;
  name: string;
  designation: string;
};

export function EmployeeSearch({
  selected,
  onSelect,
}: {
  selected: SelectedEmployee | null;
  onSelect: (employee: SelectedEmployee | null) => void;
}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SelectedEmployee[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (selected || term.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    setOpen(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc('search_employees', { term: term.trim() });
      setResults((data ?? []).map((row: { id: string; employee_name: string; designation: string | null }) => ({
        id: row.id,
        name: row.employee_name,
        designation: row.designation || '',
      })));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [selected, term]);

  return (
    <Field label="Employee" required>
      {selected ? (
        <View style={styles.pill}>
          <View style={[styles.avatar, styles.avatarEmp]}><Text style={styles.avatarText}>{selected.name.slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.pillText}>
            <Text style={styles.pillTitle}>{selected.name}</Text>
            <Text style={styles.pillSub}>{selected.designation || 'Worker'}</Text>
          </View>
          <Pressable onPress={() => onSelect(null)} hitSlop={8}><Text style={styles.clear}>✕</Text></Pressable>
        </View>
      ) : (
        <TextField value={term} onChangeText={setTerm} placeholder="Search employee by name..." />
      )}
      {open ? (
        <View style={styles.dropdown}>
          {searching ? <Text style={styles.hint}>Searching...</Text> : null}
          {!searching && results.length === 0 ? <Text style={styles.hint}>No employees found</Text> : null}
          {results.map((employee) => (
            <Pressable
              key={employee.id}
              onPress={() => {
                onSelect(employee);
                setTerm('');
                setOpen(false);
              }}
              style={styles.result}
            >
              <Text style={styles.pillTitle}>{employee.name}</Text>
              <Text style={styles.pillSub}>{employee.designation}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Field>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: colors.amber,
    borderRadius: 10,
    padding: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmp: { backgroundColor: '#0f766e' },
  avatarText: { color: '#fff', fontWeight: '700' },
  pillText: { flex: 1 },
  pillTitle: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  pillSub: { color: colors.muted, marginTop: 2 },
  clear: { color: colors.muted, fontSize: 16, paddingHorizontal: 6 },
  dropdown: {
    marginTop: 6,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d1dce8',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  result: { paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#f0f4f8' },
  hint: { color: colors.muted, padding: 12 },
});
