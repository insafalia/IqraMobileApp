import { useState } from 'react';
import { QuotationSearch, type SelectedQuote } from '../../components/SearchFields';
import { ChoiceRow, DateField, Field, FormCard, FormScroll, Notice, PrimaryButton, TextField } from '../../components/ui';
import { errorText, parseAmount, todayISO } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { PAYMENT_MODES, type PaymentMode } from '../../lib/types';

export function PaymentScreen() {
  const [quote, setQuote] = useState<SelectedQuote | null>(null);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<PaymentMode | ''>('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit() {
    setError('');
    setSuccess('');
    const parsed = parseAmount(amount);
    if (!quote) return setError('Please select a customer / quotation.');
    if (!date || date > todayISO()) return setError('Please enter a payment date that is not in the future.');
    if (!parsed) return setError('Please enter a valid amount.');
    if (!mode) return setError('Please select a payment mode.');
    setBusy(true);
    const { data, error: insertError } = await supabase.from('payments').insert({
      quotation_id: quote.id,
      payment_date: date,
      amount: parsed,
      payment_mode: mode,
      reference_number: reference.trim() || null,
    }).select('payment_number').single();
    setBusy(false);
    if (insertError) return setError(errorText(insertError));
    setSuccess(`Payment ${data.payment_number} saved successfully.`);
    setQuote(null);
    setDate(todayISO());
    setAmount('');
    setMode('');
    setReference('');
  }

  return (
    <FormScroll>
      <FormCard icon="💳" title="Record Payment">
        <Notice kind="error" text={error} />
        <Notice kind="success" text={success} />
        <QuotationSearch label="Customer / Quotation" selected={quote} onSelect={setQuote} />
        <Field label="Payment date" required><DateField value={date} onChange={setDate} /></Field>
        <Field label="Amount" required>
          <TextField value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
        </Field>
        <Field label="Mode" required>
          <ChoiceRow options={PAYMENT_MODES} value={mode} onChange={(value) => setMode(value as PaymentMode)} />
        </Field>
        <Field label="Reference number">
          <TextField value={reference} onChangeText={setReference} placeholder="UPI ID / Cheque no. / Transaction ref" />
        </Field>
        <PrimaryButton label="Submit payment" onPress={submit} busy={busy} />
      </FormCard>
    </FormScroll>
  );
}
