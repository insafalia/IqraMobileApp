import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { AppHeader, Badge, Body, ChoiceRow, DateField, EmptyText, Field, FormScroll, Notice, PrimaryButton, ScreenFrame, TextField, colors } from '../../components/ui';
import { errorText, formatDisplayDate, formatINR, parseAmount, related, todayISO } from '../../lib/format';
import { buildQuotationHtml } from '../../lib/quotationPdf';
import { supabase } from '../../lib/supabase';
import { JOB_STATUSES, PAYMENT_MODES, QUOTE_STATUSES, type JobStatus, type PaymentMode, type QuoteStatus } from '../../lib/types';
import type { OwnerStackParamList } from '../../navigation/types';

type Person = { id: string; display_name: string };
type CustomerRow = {
  name: string;
  phone: string | null;
  email: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country: string | null;
};
type Job = { id: string; job_number: string; job_date: string; technician_id: string | null; work_description: string; status: string };
type Payment = { id: string; payment_number: string; payment_date: string; amount: number; payment_mode: string; received_by: string | null; reference_number: string | null };
type Material = { id: string; material_number: string; spend_date: string; material_name: string; amount: number; vendor: string | null };
type Quote = {
  id: string;
  quotation_number: string;
  quotation_date: string;
  scope_of_work: string | null;
  quoted_amount: number;
  total_paid: number;
  balance_due: number;
  total_material_spend: number;
  status: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostal: string | null;
  addressCountry: string | null;
};

export function QuotationDetailScreen({ route, navigation }: NativeStackScreenProps<OwnerStackParamList, 'QuotationDetail'>) {
  const { profile } = useAuth();
  const { quotationId } = route.params;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [labor, setLabor] = useState({ days: 0, paid: 0, unpaid: 0 });
  const [tab, setTab] = useState<'jobs' | 'payments' | 'materials'>('jobs');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [includeJobs, setIncludeJobs] = useState(true);
  const [includePayments, setIncludePayments] = useState(true);
  const [includeMaterials, setIncludeMaterials] = useState(true);
  const [editing, setEditing] = useState<'quote' | 'job' | 'payment' | 'material' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState({ date: '', amount: '', status: 'Draft' as QuoteStatus, scope: '' });
  const [jobForm, setJobForm] = useState({ date: todayISO(), technicianId: '', status: 'In Progress' as JobStatus, work: '' });
  const [payForm, setPayForm] = useState({ date: todayISO(), amount: '', mode: 'Cash' as PaymentMode, receivedBy: '', reference: '' });
  const [matForm, setMatForm] = useState({ date: todayISO(), name: '', amount: '', vendor: '' });

  const load = useCallback(async () => {
    const [quoteResult, jobResult, payResult, matResult, attResult, peopleResult] = await Promise.all([
      supabase.from('quotations').select('id, quotation_number, quotation_date, scope_of_work, quoted_amount, total_paid, balance_due, total_material_spend, status, customers(name, phone, email, address_street, address_city, address_state, address_postal_code, address_country)').eq('id', quotationId).single(),
      supabase.from('jobs').select('id, job_number, job_date, technician_id, work_description, status').eq('quotation_id', quotationId).order('job_date', { ascending: false }),
      supabase.from('payments').select('id, payment_number, payment_date, amount, payment_mode, received_by, reference_number').eq('quotation_id', quotationId).order('payment_date', { ascending: false }),
      supabase.from('material_spends').select('id, material_number, spend_date, material_name, amount, vendor').eq('quotation_id', quotationId).order('spend_date', { ascending: false }),
      supabase.from('attendance').select('days, amount_due, status').eq('quotation_id', quotationId),
      supabase.from('profiles').select('id, display_name').eq('active', true).order('display_name'),
    ]);
    const failed = quoteResult.error || jobResult.error || payResult.error || matResult.error || attResult.error || peopleResult.error;
    if (failed || !quoteResult.data) {
      setError(errorText(failed || new Error('Quotation not found')));
      return;
    }
    const row = quoteResult.data;
    const customer = related(row.customers as unknown as CustomerRow | CustomerRow[] | null);
    setQuote({
      id: row.id,
      quotation_number: row.quotation_number,
      quotation_date: row.quotation_date,
      scope_of_work: row.scope_of_work,
      quoted_amount: Number(row.quoted_amount),
      total_paid: Number(row.total_paid),
      balance_due: Number(row.balance_due),
      total_material_spend: Number(row.total_material_spend),
      status: row.status,
      customerName: customer?.name || '',
      customerPhone: customer?.phone ?? null,
      customerEmail: customer?.email ?? null,
      addressStreet: customer?.address_street ?? null,
      addressCity: customer?.address_city ?? null,
      addressState: customer?.address_state ?? null,
      addressPostal: customer?.address_postal_code ?? null,
      addressCountry: customer?.address_country ?? null,
    });
    setJobs((jobResult.data ?? []) as Job[]);
    setPayments((payResult.data ?? []) as Payment[]);
    setMaterials((matResult.data ?? []) as Material[]);
    setPeople((peopleResult.data ?? []) as Person[]);
    const attendance = attResult.data ?? [];
    setLabor({
      days: attendance.reduce((sum, item) => sum + Number(item.days), 0),
      paid: attendance.filter((item) => item.status === 'Paid').reduce((sum, item) => sum + Number(item.amount_due), 0),
      unpaid: attendance.filter((item) => item.status === 'Unpaid').reduce((sum, item) => sum + Number(item.amount_due), 0),
    });
    setError('');
  }, [quotationId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function sharePdf() {
    if (!quote) return;
    setBusy(true);
    setError('');
    try {
      const html = buildQuotationHtml({
        quotationNumber: quote.quotation_number,
        quotationDate: quote.quotation_date,
        status: quote.status,
        scope: quote.scope_of_work,
        quotedAmount: quote.quoted_amount,
        totalPaid: quote.total_paid,
        balanceDue: quote.balance_due,
        totalMaterial: quote.total_material_spend,
        customer: {
          name: quote.customerName,
          phone: quote.customerPhone,
          email: quote.customerEmail,
          address_street: quote.addressStreet,
          address_city: quote.addressCity,
          address_state: quote.addressState,
          address_postal_code: quote.addressPostal,
          address_country: quote.addressCountry,
        },
        jobs: jobs.map((job) => ({
          job_number: job.job_number,
          job_date: job.job_date,
          technician: nameOf(job.technician_id),
          work_description: job.work_description,
          status: job.status,
        })),
        payments: payments.map((payment) => ({
          payment_number: payment.payment_number,
          payment_date: payment.payment_date,
          payment_mode: payment.payment_mode,
          received_by: nameOf(payment.received_by),
          reference_number: payment.reference_number,
          amount: Number(payment.amount),
        })),
        materials: materials.map((material) => ({
          material_name: material.material_name,
          spend_date: material.spend_date,
          vendor: material.vendor,
          amount: Number(material.amount),
        })),
        includeJobs,
        includePayments,
        includeMaterials,
      });
      if (Platform.OS === 'web') {
        const popup = window.open('', '_blank');
        if (!popup) throw new Error('Allow pop-ups to open the quotation PDF.');
        popup.document.write(html);
        popup.document.close();
        popup.focus();
        popup.print();
      } else {
        const file = await Print.printToFileAsync({ html });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: quote.quotation_number });
        } else {
          await Print.printAsync({ html });
        }
      }
      setPdfOpen(false);
    } catch (shareError) {
      setError(errorText(shareError));
    } finally {
      setBusy(false);
    }
  }

  function nameOf(id: string | null) {
    return people.find((person) => person.id === id)?.display_name || '';
  }

  function openJob(job?: Job) {
    setEditId(job?.id ?? null);
    setJobForm({
      date: job?.job_date || todayISO(),
      technicianId: job?.technician_id || profile?.id || '',
      status: (job?.status as JobStatus) || 'In Progress',
      work: job?.work_description || '',
    });
    setEditing('job');
    setError('');
  }

  function openPayment(payment?: Payment) {
    setEditId(payment?.id ?? null);
    setPayForm({
      date: payment?.payment_date || todayISO(),
      amount: payment ? String(payment.amount) : '',
      mode: (payment?.payment_mode as PaymentMode) || 'Cash',
      receivedBy: payment?.received_by || profile?.id || '',
      reference: payment?.reference_number || '',
    });
    setEditing('payment');
    setError('');
  }

  function openMaterial(material?: Material) {
    setEditId(material?.id ?? null);
    setMatForm({
      date: material?.spend_date || todayISO(),
      name: material?.material_name || '',
      amount: material ? String(material.amount) : '',
      vendor: material?.vendor || '',
    });
    setEditing('material');
    setError('');
  }

  async function save() {
    setBusy(true);
    let saveError: { message: string } | null = null;
    if (editing === 'quote' && quote) {
      const amount = Number(quoteForm.amount);
      if (!quoteForm.date || !Number.isFinite(amount) || amount < 0) {
        setBusy(false);
        return setError('Enter a date and quoted amount.');
      }
      const result = await supabase.from('quotations').update({
        quotation_date: quoteForm.date,
        quoted_amount: amount,
        status: quoteForm.status,
        scope_of_work: quoteForm.scope.trim() || null,
      }).eq('id', quote.id);
      saveError = result.error;
    }
    if (editing === 'job') {
      if (!jobForm.date || !jobForm.work.trim() || !jobForm.status) {
        setBusy(false);
        return setError('Enter the job date, status, and work description.');
      }
      const payload = {
        quotation_id: quotationId,
        job_date: jobForm.date,
        technician_id: jobForm.technicianId || null,
        work_description: jobForm.work.trim(),
        status: jobForm.status,
      };
      const result = editId
        ? await supabase.from('jobs').update(payload).eq('id', editId)
        : await supabase.from('jobs').insert(payload);
      saveError = result.error;
    }
    if (editing === 'payment') {
      const amount = parseAmount(payForm.amount);
      if (!payForm.date || !amount || !payForm.mode) {
        setBusy(false);
        return setError('Enter the payment date, amount, and mode.');
      }
      const payload = {
        quotation_id: quotationId,
        payment_date: payForm.date,
        amount,
        payment_mode: payForm.mode,
        received_by: payForm.receivedBy || null,
        reference_number: payForm.reference.trim() || null,
      };
      const result = editId
        ? await supabase.from('payments').update(payload).eq('id', editId)
        : await supabase.from('payments').insert(payload);
      saveError = result.error;
    }
    if (editing === 'material') {
      const amount = parseAmount(matForm.amount);
      if (!matForm.date || !matForm.name.trim() || !amount) {
        setBusy(false);
        return setError('Enter the spend date, material name, and amount.');
      }
      const payload = {
        quotation_id: quotationId,
        spend_date: matForm.date,
        material_name: matForm.name.trim(),
        amount,
        vendor: matForm.vendor.trim() || null,
      };
      const result = editId
        ? await supabase.from('material_spends').update(payload).eq('id', editId)
        : await supabase.from('material_spends').insert(payload);
      saveError = result.error;
    }
    setBusy(false);
    if (saveError) return setError(errorText(saveError));
    setEditing(null);
    setError('');
    load();
  }

  function confirmDelete(kind: 'job' | 'payment' | 'material', id: string) {
    Alert.alert('Delete this record?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const table = kind === 'job' ? 'jobs' : kind === 'payment' ? 'payments' : 'material_spends';
          const { error: deleteError } = await supabase.from(table).delete().eq('id', id);
          if (deleteError) setError(errorText(deleteError));
          else load();
        },
      },
    ]);
  }

  if (editing) {
    return (
      <ScreenFrame>
        <AppHeader title="Edit" onBack={() => setEditing(null)} />
        <Body>
          <FormScroll>
            <Notice kind="error" text={error} />
            {editing === 'quote' ? (
              <>
                <Field label="Date" required><DateField value={quoteForm.date} onChange={(date) => setQuoteForm({ ...quoteForm, date })} /></Field>
                <Field label="Quoted amount" required><TextField value={quoteForm.amount} onChangeText={(amount) => setQuoteForm({ ...quoteForm, amount })} keyboardType="decimal-pad" /></Field>
                <Field label="Status"><ChoiceRow options={QUOTE_STATUSES} value={quoteForm.status} onChange={(status) => setQuoteForm({ ...quoteForm, status: status as QuoteStatus })} /></Field>
                <Field label="Scope of work"><TextField value={quoteForm.scope} onChangeText={(scope) => setQuoteForm({ ...quoteForm, scope })} multiline /></Field>
              </>
            ) : null}
            {editing === 'job' ? (
              <>
                <Field label="Job date" required><DateField value={jobForm.date} onChange={(date) => setJobForm({ ...jobForm, date })} /></Field>
                <Field label="Technician" required>
                  <ChoiceRow options={people.map((person) => person.display_name)} value={nameOf(jobForm.technicianId)} onChange={(label) => setJobForm({ ...jobForm, technicianId: people.find((person) => person.display_name === label)?.id || '' })} />
                </Field>
                <Field label="Status" required>
                  <ChoiceRow options={JOB_STATUSES} value={jobForm.status} onChange={(status) => setJobForm({ ...jobForm, status: status as JobStatus })} />
                </Field>
                <Field label="Work description" required>
                  <TextField value={jobForm.work} onChangeText={(work) => setJobForm({ ...jobForm, work })} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
                </Field>
              </>
            ) : null}
            {editing === 'payment' ? (
              <>
                <Field label="Payment date" required><DateField value={payForm.date} onChange={(date) => setPayForm({ ...payForm, date })} /></Field>
                <Field label="Amount" required><TextField value={payForm.amount} onChangeText={(amount) => setPayForm({ ...payForm, amount })} keyboardType="decimal-pad" /></Field>
                <Field label="Mode" required>
                  <ChoiceRow options={PAYMENT_MODES} value={payForm.mode} onChange={(mode) => setPayForm({ ...payForm, mode: mode as PaymentMode })} />
                </Field>
                <Field label="Received by" required>
                  <ChoiceRow options={people.map((person) => person.display_name)} value={nameOf(payForm.receivedBy)} onChange={(label) => setPayForm({ ...payForm, receivedBy: people.find((person) => person.display_name === label)?.id || '' })} />
                </Field>
                <Field label="Reference number"><TextField value={payForm.reference} onChangeText={(reference) => setPayForm({ ...payForm, reference })} /></Field>
              </>
            ) : null}
            {editing === 'material' ? (
              <>
                <Field label="Spend date" required><DateField value={matForm.date} onChange={(date) => setMatForm({ ...matForm, date })} /></Field>
                <Field label="Material name" required><TextField value={matForm.name} onChangeText={(name) => setMatForm({ ...matForm, name })} /></Field>
                <Field label="Amount" required><TextField value={matForm.amount} onChangeText={(amount) => setMatForm({ ...matForm, amount })} keyboardType="decimal-pad" /></Field>
                <Field label="Vendor"><TextField value={matForm.vendor} onChangeText={(vendor) => setMatForm({ ...matForm, vendor })} /></Field>
              </>
            ) : null}
            <PrimaryButton label="Save" onPress={save} busy={busy} />
          </FormScroll>
        </Body>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame>
      <AppHeader title={quote?.quotation_number || 'Quotation'} subtitle={quote?.customerName} onBack={() => navigation.goBack()} action={{ label: 'Edit', onPress: () => {
        if (!quote) return;
        setQuoteForm({ date: quote.quotation_date, amount: String(quote.quoted_amount), status: quote.status as QuoteStatus, scope: quote.scope_of_work || '' });
        setEditing('quote');
      } }} />
      <Body>
        <ScrollView contentContainerStyle={styles.content}>
          <Notice kind="error" text={error} />
          {quote ? (
            <>
              <View style={styles.top}><Badge label={quote.status} /><Text style={styles.date}>{formatDisplayDate(quote.quotation_date)}</Text></View>
              <View style={styles.grid}>
                <Stat label="Quoted" value={formatINR(quote.quoted_amount)} />
                <Stat label="Collected" value={formatINR(quote.total_paid)} />
                <Stat label="Outstanding" value={formatINR(quote.balance_due)} />
                <Stat label="Materials" value={formatINR(quote.total_material_spend)} />
                <Stat label="Labor days" value={String(labor.days)} />
                <Stat label="Unpaid salary" value={formatINR(labor.unpaid)} />
              </View>
              {quote.scope_of_work ? <Text style={styles.scope}>{quote.scope_of_work}</Text> : null}
              <Pressable onPress={() => setPdfOpen((open) => !open)} style={styles.pdfButton}>
                <Text style={styles.pdfButtonText}>PDF</Text>
              </Pressable>
              {pdfOpen ? (
                <View style={styles.pdfBox}>
                  <Text style={styles.pdfTitle}>Choose which sections to include</Text>
                  <PdfSwitch label="Jobs / Work Done" value={includeJobs} onChange={setIncludeJobs} />
                  <PdfSwitch label="Payments Received" value={includePayments} onChange={setIncludePayments} />
                  <PdfSwitch label="Material Expenditure" value={includeMaterials} onChange={setIncludeMaterials} />
                  <PrimaryButton label="Generate PDF" onPress={sharePdf} busy={busy} />
                </View>
              ) : null}
            </>
          ) : null}
          <View style={styles.tabs}>
            {(['jobs', 'payments', 'materials'] as const).map((item) => (
              <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabOn]}>
                <Text style={[styles.tabText, tab === item && styles.tabTextOn]}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <PrimaryButton
            label={tab === 'jobs' ? 'Add job' : tab === 'payments' ? 'Add payment' : 'Add material'}
            onPress={() => tab === 'jobs' ? openJob() : tab === 'payments' ? openPayment() : openMaterial()}
          />
          {tab === 'jobs' && jobs.length === 0 ? <EmptyText text="No jobs recorded" /> : null}
          {tab === 'jobs' && jobs.map((job) => (
            <Record key={job.id} title={`${job.job_number} · ${job.status}`} meta={`${formatDisplayDate(job.job_date)} · ${nameOf(job.technician_id)}\n${job.work_description}`} onEdit={() => openJob(job)} onDelete={() => confirmDelete('job', job.id)} />
          ))}
          {tab === 'payments' && payments.length === 0 ? <EmptyText text="No payments recorded" /> : null}
          {tab === 'payments' && payments.map((payment) => (
            <Record key={payment.id} title={formatINR(payment.amount)} meta={`${payment.payment_number} · ${formatDisplayDate(payment.payment_date)} · ${payment.payment_mode} · ${nameOf(payment.received_by)}`} onEdit={() => openPayment(payment)} onDelete={() => confirmDelete('payment', payment.id)} />
          ))}
          {tab === 'materials' && materials.length === 0 ? <EmptyText text="No material spend recorded" /> : null}
          {tab === 'materials' && materials.map((material) => (
            <Record key={material.id} title={`${material.material_name} · ${formatINR(material.amount)}`} meta={`${material.material_number} · ${formatDisplayDate(material.spend_date)}${material.vendor ? ` · ${material.vendor}` : ''}`} onEdit={() => openMaterial(material)} onDelete={() => confirmDelete('material', material.id)} />
          ))}
        </ScrollView>
      </Body>
    </ScreenFrame>
  );
}

function PdfSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.pdfRow}>
      <Text style={styles.pdfLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Record({ title, meta, onEdit, onDelete }: { title: string; meta: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.record}>
      <Text style={styles.recordTitle}>{title}</Text>
      <Text style={styles.recordMeta}>{meta}</Text>
      <View style={styles.actions}>
        <Pressable onPress={onEdit}><Text style={styles.edit}>Edit</Text></Pressable>
        <Pressable onPress={onDelete}><Text style={styles.delete}>Delete</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  date: { color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '48%', backgroundColor: colors.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.line },
  statValue: { color: colors.ink, fontWeight: '800' },
  statLabel: { color: colors.muted, marginTop: 2, fontSize: 12 },
  scope: { color: colors.inkSoft, marginTop: 12, lineHeight: 20 },
  pdfButton: { alignSelf: 'flex-start', marginTop: 14, backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  pdfButtonText: { color: '#fff', fontWeight: '800' },
  pdfBox: { marginTop: 10, backgroundColor: colors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.line },
  pdfTitle: { color: colors.ink, fontWeight: '700', marginBottom: 6 },
  pdfRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  pdfLabel: { color: colors.inkSoft },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  tabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { color: colors.inkSoft, fontWeight: '700', textTransform: 'capitalize' },
  tabTextOn: { color: '#fff' },
  record: { backgroundColor: colors.card, borderRadius: 14, padding: 12, marginTop: 10, borderWidth: 1, borderColor: colors.line },
  recordTitle: { color: colors.ink, fontWeight: '800' },
  recordMeta: { color: colors.muted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  edit: { color: colors.blue, fontWeight: '700' },
  delete: { color: colors.danger, fontWeight: '700' },
});
