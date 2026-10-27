import { useState } from 'react';
import { QuotationSearch, type SelectedQuote } from '../../components/SearchFields';
import { ChoiceRow, DateField, Field, FormCard, FormScroll, Notice, PrimaryButton, TextField } from '../../components/ui';
import { errorText, parseAmount, todayISO } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { MATERIALS } from '../../lib/types';

export function MaterialScreen() {
  const [quote, setQuote] = useState<SelectedQuote | null>(null);
  const [date, setDate] = useState(todayISO());
  const [material, setMaterial] = useState('');
  const [other, setOther] = useState('');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit() {
    setError('');
    setSuccess('');
    const parsed = parseAmount(amount);
    const name = material === 'Other' ? other.trim() : material;
    if (!quote) return setError('Please select a customer / quotation.');
    if (!date || date > todayISO()) return setError('Please enter a spend date that is not in the future.');
    if (!material) return setError('Please select a material.');
    if (!name) return setError('Please enter the material name.');
    if (!parsed) return setError('Please enter a valid amount.');
    setBusy(true);
    const { data, error: insertError } = await supabase.from('material_spends').insert({
      quotation_id: quote.id,
      spend_date: date,
      material_name: name,
      amount: parsed,
      vendor: vendor.trim() || null,
    }).select('material_number').single();
    setBusy(false);
    if (insertError) return setError(errorText(insertError));
    setSuccess(`Material spend ${data.material_number} saved successfully.`);
    setQuote(null);
    setDate(todayISO());
    setMaterial('');
    setOther('');
    setAmount('');
    setVendor('');
  }

  return (
    <FormScroll>
      <FormCard icon="🛒" title="Record Material Spend">
        <Notice kind="error" text={error} />
        <Notice kind="success" text={success} />
        <QuotationSearch label="Customer / Quotation" selected={quote} onSelect={setQuote} />
        <Field label="Spend date" required><DateField value={date} onChange={setDate} /></Field>
        <Field label="Material name" required>
          <ChoiceRow options={MATERIALS} value={material} onChange={setMaterial} />
        </Field>
        {material === 'Other' ? (
          <Field label="Other material" required>
            <TextField value={other} onChangeText={setOther} placeholder="Enter material name..." />
          </Field>
        ) : null}
        <Field label="Amount" required>
          <TextField value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
        </Field>
        <Field label="Vendor">
          <TextField value={vendor} onChangeText={setVendor} placeholder="Supplier / shop name" />
        </Field>
        <PrimaryButton label="Submit material spend" onPress={submit} busy={busy} />
      </FormCard>
    </FormScroll>
  );
}
