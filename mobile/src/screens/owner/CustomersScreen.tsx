import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppHeader, Badge, Body, ChoiceRow, EmptyText, Field, FormScroll, Notice, PrimaryButton, ScreenFrame, TextField, colors } from '../../components/ui';
import { errorText, formatDisplayDate, formatINR, related, todayISO } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { CUSTOMER_TYPES, QUOTE_STATUSES, type QuoteStatus } from '../../lib/types';
import type { OwnerStackParamList } from '../../navigation/types';

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  customer_type: string;
  address_city: string | null;
  address_state: string | null;
};

type Quote = {
  id: string;
  quotation_number: string;
  quotation_date: string;
  quoted_amount: number;
  balance_due: number;
  status: string;
};

export function CustomersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const [term, setTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', type: 'Residential', street: '', city: '', state: '', postal: '', country: '', notes: '',
  });
  const [quoteForm, setQuoteForm] = useState({ date: todayISO(), amount: '', status: 'Draft' as QuoteStatus, scope: '' });

  const load = useCallback(async (search = term) => {
    let query = supabase.from('customers').select('id, name, phone, email, customer_type, address_city, address_state').order('name').limit(100);
    if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);
    const { data, error: loadError } = await query;
    if (loadError) setError(errorText(loadError));
    else setCustomers((data ?? []) as Customer[]);
  }, [term]);

  const loadQuotes = useCallback(async (customerId: string) => {
    const { data, error: loadError } = await supabase
      .from('quotations')
      .select('id, quotation_number, quotation_date, quoted_amount, balance_due, status')
      .eq('customer_id', customerId)
      .order('quotation_date', { ascending: false });
    if (loadError) setError(errorText(loadError));
    else setQuotes((data ?? []) as Quote[]);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveCustomer() {
    if (!form.name.trim()) return setError('Enter the customer name.');
    setBusy(true);
    const { error: saveError } = await supabase.from('customers').insert({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      customer_type: form.type,
      address_street: form.street.trim() || null,
      address_city: form.city.trim() || null,
      address_state: form.state.trim() || null,
      address_postal_code: form.postal.trim() || null,
      address_country: form.country.trim() || null,
      notes: form.notes.trim() || null,
    });
    setBusy(false);
    if (saveError) return setError(errorText(saveError));
    setShowCustomer(false);
    setForm({ name: '', phone: '', email: '', type: 'Residential', street: '', city: '', state: '', postal: '', country: '', notes: '' });
    setError('');
    load();
  }

  async function saveQuote() {
    const amount = Number(quoteForm.amount);
    if (!selected) return;
    if (!quoteForm.date) return setError('Enter the quotation date.');
    if (!Number.isFinite(amount) || amount < 0) return setError('Enter the quoted amount.');
    setBusy(true);
    const { error: saveError } = await supabase.from('quotations').insert({
      customer_id: selected.id,
      quotation_date: quoteForm.date,
      quoted_amount: amount,
      status: quoteForm.status,
      scope_of_work: quoteForm.scope.trim() || null,
    });
    setBusy(false);
    if (saveError) return setError(errorText(saveError));
    setShowQuote(false);
    setQuoteForm({ date: todayISO(), amount: '', status: 'Draft', scope: '' });
    setError('');
    loadQuotes(selected.id);
  }

  return (
    <ScreenFrame>
      <AppHeader
        title={selected ? selected.name : 'Customers'}
        subtitle="Owner portal"
        onBack={selected ? () => setSelected(null) : undefined}
        action={selected
          ? { label: 'Quote', onPress: () => { setError(''); setShowQuote(true); } }
          : { label: 'Add', onPress: () => { setError(''); setShowCustomer(true); } }}
      />
      <Body>
        {showCustomer || showQuote ? (
          <FormScroll>
            <Notice kind="error" text={error} />
            {showCustomer ? (
              <>
                <Field label="Customer name" required><TextField value={form.name} onChangeText={(name) => setForm({ ...form, name })} /></Field>
                <Field label="Phone"><TextField value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" /></Field>
                <Field label="Email"><TextField value={form.email} onChangeText={(email) => setForm({ ...form, email })} autoCapitalize="none" /></Field>
                <Field label="Customer type"><ChoiceRow options={CUSTOMER_TYPES} value={form.type} onChange={(type) => setForm({ ...form, type })} /></Field>
                <Field label="Street"><TextField value={form.street} onChangeText={(street) => setForm({ ...form, street })} /></Field>
                <Field label="City"><TextField value={form.city} onChangeText={(city) => setForm({ ...form, city })} /></Field>
                <Field label="State"><TextField value={form.state} onChangeText={(state) => setForm({ ...form, state })} /></Field>
                <Field label="Postal code"><TextField value={form.postal} onChangeText={(postal) => setForm({ ...form, postal })} /></Field>
                <Field label="Country"><TextField value={form.country} onChangeText={(country) => setForm({ ...form, country })} /></Field>
                <Field label="Notes"><TextField value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} multiline /></Field>
                <PrimaryButton label="Save customer" onPress={saveCustomer} busy={busy} />
              </>
            ) : (
              <>
                <Field label="Date" required><TextField value={quoteForm.date} onChangeText={(date) => setQuoteForm({ ...quoteForm, date })} placeholder="YYYY-MM-DD" /></Field>
                <Field label="Quoted amount" required><TextField value={quoteForm.amount} onChangeText={(amount) => setQuoteForm({ ...quoteForm, amount })} keyboardType="decimal-pad" /></Field>
                <Field label="Status"><ChoiceRow options={QUOTE_STATUSES} value={quoteForm.status} onChange={(status) => setQuoteForm({ ...quoteForm, status: status as QuoteStatus })} /></Field>
                <Field label="Scope of work"><TextField value={quoteForm.scope} onChangeText={(scope) => setQuoteForm({ ...quoteForm, scope })} multiline /></Field>
                <PrimaryButton label="Save quotation" onPress={saveQuote} busy={busy} />
              </>
            )}
          </FormScroll>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Notice kind="error" text={error} />
            {!selected ? (
              <TextField
                value={term}
                onChangeText={(value) => { setTerm(value); load(value); }}
                placeholder="Search customers"
              />
            ) : (
              <Text style={styles.meta}>{[selected.phone, selected.address_city, selected.address_state].filter(Boolean).join(' · ') || selected.customer_type}</Text>
            )}
            <View style={{ height: 12 }} />
            {!selected && customers.length === 0 ? <EmptyText text="No customers yet" /> : null}
            {!selected && customers.map((customer) => (
              <Pressable key={customer.id} style={styles.card} onPress={() => { setSelected(customer); loadQuotes(customer.id); }}>
                <Text style={styles.name}>{customer.name}</Text>
                <Text style={styles.meta}>{customer.customer_type}{customer.phone ? ` · ${customer.phone}` : ''}</Text>
              </Pressable>
            ))}
            {selected && quotes.length === 0 ? <EmptyText text="No quotations for this customer" /> : null}
            {selected && quotes.map((quote) => (
              <Pressable key={quote.id} style={styles.card} onPress={() => navigation.navigate('QuotationDetail', { quotationId: quote.id })}>
                <View style={styles.row}>
                  <Text style={styles.name}>{quote.quotation_number}</Text>
                  <Badge label={quote.status} />
                </View>
                <Text style={styles.meta}>{formatDisplayDate(quote.quotation_date)} · {formatINR(quote.quoted_amount)} · Balance {formatINR(quote.balance_due)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Body>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#1a2740', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  name: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  meta: { color: colors.muted, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});
