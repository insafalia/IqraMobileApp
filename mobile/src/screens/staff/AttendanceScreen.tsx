import { useState } from 'react';
import { EmployeeSearch, QuotationSearch, type SelectedEmployee, type SelectedQuote } from '../../components/SearchFields';
import { ChoiceRow, DateField, Field, FormCard, FormScroll, Notice, PrimaryButton, TextField } from '../../components/ui';
import { errorText, todayISO } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { AttendanceStatus } from '../../lib/types';

export function AttendanceScreen() {
  const [quote, setQuote] = useState<SelectedQuote | null>(null);
  const [employee, setEmployee] = useState<SelectedEmployee | null>(null);
  const [date, setDate] = useState(todayISO());
  const [days, setDays] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('Unpaid');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function submit() {
    setError('');
    setSuccess('');
    const worked = Number(days);
    if (!employee) return setError('Please select an employee.');
    if (!date || date > todayISO()) return setError('Please select an attendance date that is not in the future.');
    if (!Number.isFinite(worked) || worked <= 0 || worked > 31) return setError('Please enter valid days worked.');
    setBusy(true);
    const { data, error: insertError } = await supabase.from('attendance').insert({
      quotation_id: quote?.id ?? null,
      employee_id: employee.id,
      attendance_date: date,
      days: worked,
      status,
    }).select('attendance_number').single();
    setBusy(false);
    if (insertError) return setError(errorText(insertError));
    setSuccess(`Attendance ${data.attendance_number} saved successfully.`);
    setQuote(null);
    setEmployee(null);
    setDate(todayISO());
    setDays('');
    setStatus('Unpaid');
  }

  return (
    <FormScroll>
      <FormCard icon="📅" title="Record Attendance">
        <Notice kind="error" text={error} />
        <Notice kind="success" text={success} />
        <QuotationSearch label="Quotation / Site" optional selected={quote} onSelect={setQuote} />
        <EmployeeSearch selected={employee} onSelect={setEmployee} />
        <Field label="Attendance date" required><DateField value={date} onChange={setDate} /></Field>
        <Field label="Days" required>
          <TextField value={days} onChangeText={setDays} keyboardType="decimal-pad" placeholder="0.5 or 1" />
        </Field>
        <Field label="Status" required>
          <ChoiceRow options={['Unpaid', 'Paid']} value={status} onChange={(value) => setStatus(value as AttendanceStatus)} />
        </Field>
        <PrimaryButton label="Save attendance" onPress={submit} busy={busy} />
      </FormCard>
    </FormScroll>
  );
}
