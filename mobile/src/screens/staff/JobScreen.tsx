import { useState } from 'react';
import { QuotationSearch, type SelectedQuote } from '../../components/SearchFields';
import { ChoiceRow, DateField, Field, FormCard, FormScroll, Notice, PrimaryButton, TextField } from '../../components/ui';
import { errorText, todayISO } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { JOB_STATUSES, type JobStatus } from '../../lib/types';

export function JobScreen() {
  const [quote, setQuote] = useState<SelectedQuote | null>(null);
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [work, setWork] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit() {
    setError('');
    setSuccess('');
    if (!quote) return setError('Please select a customer / quotation.');
    if (!date || date > todayISO()) return setError('Please enter a job date that is not in the future.');
    if (!status) return setError('Please select a status.');
    if (!work.trim()) return setError('Please enter a work description.');
    setBusy(true);
    const { data, error: insertError } = await supabase.from('jobs').insert({
      quotation_id: quote.id,
      job_date: date,
      work_description: work.trim(),
      status,
    }).select('job_number').single();
    setBusy(false);
    if (insertError) return setError(errorText(insertError));
    setSuccess(`Job ${data.job_number} saved successfully.`);
    setQuote(null);
    setDate(todayISO());
    setStatus('');
    setWork('');
  }

  return (
    <FormScroll>
      <FormCard icon="✅" title="Record Job Done">
        <Notice kind="error" text={error} />
        <Notice kind="success" text={success} />
        <QuotationSearch label="Customer / Quotation" selected={quote} onSelect={setQuote} />
        <Field label="Job date" required><DateField value={date} onChange={setDate} /></Field>
        <Field label="Status" required>
          <ChoiceRow options={JOB_STATUSES} value={status} onChange={(value) => setStatus(value as JobStatus)} />
        </Field>
        <Field label="Work description" required>
          <TextField
            value={work}
            onChangeText={setWork}
            placeholder="Describe the work done..."
            multiline
            style={{ minHeight: 100, textAlignVertical: 'top' }}
          />
        </Field>
        <PrimaryButton label="Submit job" onPress={submit} busy={busy} />
      </FormCard>
    </FormScroll>
  );
}
