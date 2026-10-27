type PdfCustomer = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal_code?: string | null;
  address_country?: string | null;
};

type PdfJob = { job_number: string; job_date: string; technician: string; work_description: string; status: string };
type PdfPayment = { payment_number: string; payment_date: string; payment_mode: string; received_by: string; reference_number: string | null; amount: number };
type PdfMaterial = { material_name: string; spend_date: string; vendor: string | null; amount: number };

export type QuotationPdfInput = {
  quotationNumber: string;
  quotationDate: string;
  status: string;
  scope: string | null;
  quotedAmount: number;
  totalPaid: number;
  balanceDue: number;
  totalMaterial: number;
  customer: PdfCustomer;
  jobs: PdfJob[];
  payments: PdfPayment[];
  materials: PdfMaterial[];
  includeJobs: boolean;
  includePayments: boolean;
  includeMaterials: boolean;
};

function esc(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escBreaks(value: string | null | undefined) {
  return esc(value).replace(/\n/g, '<br/>');
}

function rupees(value: number) {
  const rounded = Math.round(Number(value) || 0);
  return `Rs. ${rounded.toLocaleString('en-IN')}`;
}

function prettyDate(iso: string) {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-');
  if (!year || !month || !day) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}

function statusColors(status: string) {
  if (status === 'Approved') return { bg: '#dcfce7', text: '#166534' };
  if (status === 'Sent') return { bg: '#dbeafe', text: '#1e40af' };
  if (status === 'Rejected' || status === 'Expired') return { bg: '#fee2e2', text: '#991b1b' };
  return { bg: '#f1f5f9', text: '#475569' };
}

export function buildQuotationHtml(input: QuotationPdfInput) {
  const tone = statusColors(input.status);
  const balanceColor = input.balanceDue > 0 ? '#dc2626' : '#16a34a';
  const address = [
    input.customer.address_street,
    input.customer.address_city,
    input.customer.address_state,
    input.customer.address_postal_code,
    input.customer.address_country,
  ].filter(Boolean).join(', ');
  const showMaterials = input.includeMaterials;
  const jobs = input.includeJobs ? [...input.jobs].sort((a, b) => a.job_date.localeCompare(b.job_date)) : [];
  const payments = input.includePayments ? [...input.payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date)) : [];
  const materials = input.includeMaterials ? [...input.materials].sort((a, b) => a.spend_date.localeCompare(b.spend_date)) : [];

  const jobRows = jobs.map((job) => `
    <tr class="dt-r">
      <td>${esc(job.job_number)}</td>
      <td>${esc(prettyDate(job.job_date))}</td>
      <td>${esc(job.technician)}</td>
      <td>${escBreaks(job.work_description)}</td>
      <td class="tac"><span class="${job.status === 'Completed' ? 'badge-g' : 'badge-a'}">${esc(job.status)}</span></td>
    </tr>`).join('');

  const paymentRows = payments.map((payment) => `
    <tr class="dt-r">
      <td>${esc(payment.payment_number)}</td>
      <td>${esc(prettyDate(payment.payment_date))}</td>
      <td>${esc(payment.payment_mode)}</td>
      <td>${esc(payment.received_by)}</td>
      <td>${esc(payment.reference_number)}</td>
      <td class="tar grn">${esc(rupees(payment.amount).replace('Rs. ', ''))}</td>
    </tr>`).join('');

  const materialRows = materials.map((material) => `
    <tr class="dt-r">
      <td>${esc(material.material_name)}</td>
      <td>${esc(prettyDate(material.spend_date))}</td>
      <td>${esc(material.vendor)}</td>
      <td class="tar grn">${esc(rupees(material.amount).replace('Rs. ', ''))}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4 portrait; margin: 0 0 36pt 0; }
  * { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a2740; background: #fff; }
  table { border-collapse: collapse; }
  .sh { background: #eef2f7; color: #1a2740; font-size: 7pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; padding: 5pt 10pt; }
  .dt { width: 100%; border: 0.5pt solid #d1d5db; }
  .dt-h td { background: #1a2740; color: #fff; font-size: 7pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; padding: 6pt 10pt; }
  .dt-r td { color: #374151; font-size: 8.5pt; padding: 5pt 10pt; border-bottom: 0.5pt solid #e5e7eb; }
  .tar { text-align: right; } .tac { text-align: center; }
  .grn { color: #15803d; font-weight: bold; }
  .badge-g { font-size: 7pt; font-weight: bold; color: #166534; background: #dcfce7; padding: 2pt 6pt; }
  .badge-a { font-size: 7pt; font-weight: bold; color: #92400e; background: #fef3c7; padding: 2pt 6pt; }
</style>
</head>
<body>
<table width="100%">
  <tr>
    <td style="background:#1a2740; padding:22pt 36pt 16pt;">
      <table width="100%">
        <tr>
          <td valign="bottom">
            <div style="font-size:22pt; font-weight:bold; color:#fff;">Iqra Construction</div>
            <div style="font-size:7pt; color:#a3b8cc; text-transform:uppercase; letter-spacing:1.2px; margin-top:5pt;">Professional Construction &amp; Engineering Services</div>
          </td>
          <td valign="bottom" align="right">
            <div style="font-size:7pt; color:#8ba5bf; text-transform:uppercase; letter-spacing:1px;">Quotation</div>
            <div style="font-size:17pt; font-weight:bold; color:#f59e0b; margin-top:3pt;">${esc(input.quotationNumber)}</div>
            <div style="font-size:8pt; color:#b0c4d6; margin-top:5pt;">${esc(prettyDate(input.quotationDate))}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr><td style="background:#f59e0b; height:3pt; font-size:1pt;"> </td></tr>
  <tr>
    <td style="background:${tone.bg}; color:${tone.text}; font-size:7.5pt; font-weight:bold; text-transform:uppercase; letter-spacing:1px; padding:5pt 36pt;">
      Status: ${esc(input.status)}
    </td>
  </tr>
</table>
<table width="100%"><tr><td style="padding:18pt 36pt 24pt;">
  <table width="100%" style="margin-bottom:14pt;">
    <tr>
      <td width="55%" valign="top" style="border:0.5pt solid #d1d5db; padding:12pt 14pt;">
        <div style="font-size:7pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.8px; color:#6b7280; margin-bottom:8pt;">Bill To</div>
        <div style="font-size:11pt; font-weight:bold; color:#1a2740; margin-bottom:5pt;">${esc(input.customer.name)}</div>
        ${input.customer.phone ? `<div style="font-size:8.5pt; color:#374151; margin-bottom:3pt;">Tel: ${esc(input.customer.phone)}</div>` : ''}
        ${input.customer.email ? `<div style="font-size:8.5pt; color:#374151; margin-bottom:3pt;">${esc(input.customer.email)}</div>` : ''}
        ${address ? `<div style="font-size:8.5pt; color:#374151;">${esc(address)}</div>` : ''}
      </td>
      <td width="4%"></td>
      <td width="41%" valign="top" style="border:0.5pt solid #d1d5db;">
        <table width="100%">
          <tr><td colspan="2" style="background:#1a2740; color:#fff; font-size:7pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.8px; padding:5pt 12pt;">Quotation Details</td></tr>
          <tr><td style="font-size:7.5pt; color:#6b7280; padding:7pt 12pt 3pt;">Quotation No.</td><td align="right" style="font-size:8pt; font-weight:bold; padding:7pt 12pt 3pt;">${esc(input.quotationNumber)}</td></tr>
          <tr><td style="font-size:7.5pt; color:#6b7280; padding:3pt 12pt; border-top:0.5pt solid #e5e7eb;">Date</td><td align="right" style="font-size:8pt; font-weight:bold; padding:3pt 12pt; border-top:0.5pt solid #e5e7eb;">${esc(prettyDate(input.quotationDate))}</td></tr>
          <tr><td style="font-size:7.5pt; color:#6b7280; padding:3pt 12pt 7pt; border-top:0.5pt solid #e5e7eb;">Status</td><td align="right" style="font-size:8pt; font-weight:bold; color:${tone.text}; background:${tone.bg}; padding:3pt 12pt 7pt; border-top:0.5pt solid #e5e7eb;">${esc(input.status)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <table width="100%" style="margin-bottom:14pt; border:0.5pt solid #d1d5db;">
    <tr>
      <td width="25%" align="center" style="background:#1a2740; padding:12pt 8pt;"><div style="font-size:7pt; text-transform:uppercase; color:#a3b8cc;">Quoted</div><div style="font-size:11pt; font-weight:bold; color:#fff;">${esc(rupees(input.quotedAmount))}</div></td>
      <td width="25%" align="center" style="background:#f0fdf4; padding:12pt 8pt; border-left:0.5pt solid #d1d5db;"><div style="font-size:7pt; text-transform:uppercase; color:#6b7280;">Collected</div><div style="font-size:11pt; font-weight:bold; color:#15803d;">${esc(rupees(input.totalPaid))}</div></td>
      <td width="25%" align="center" style="padding:12pt 8pt; border-left:0.5pt solid #d1d5db;"><div style="font-size:7pt; text-transform:uppercase; color:#6b7280;">Balance Due</div><div style="font-size:11pt; font-weight:bold; color:${balanceColor};">${esc(rupees(input.balanceDue))}</div></td>
      ${showMaterials ? `<td width="25%" align="center" style="background:#fafafa; padding:12pt 8pt; border-left:0.5pt solid #d1d5db;"><div style="font-size:7pt; text-transform:uppercase; color:#6b7280;">Material Cost</div><div style="font-size:11pt; font-weight:bold;">${esc(rupees(input.totalMaterial))}</div></td>` : ''}
    </tr>
  </table>
  ${input.scope ? `<table width="100%" style="margin-bottom:14pt;"><tr><td class="sh">Scope of Work</td></tr><tr><td style="background:#fffbeb; border-left:3pt solid #f59e0b; border-bottom:0.5pt solid #d1d5db; border-right:0.5pt solid #d1d5db; padding:10pt 14pt; font-size:8.5pt; color:#374151; line-height:1.6;">${escBreaks(input.scope)}</td></tr></table>` : ''}
  ${jobs.length ? `<table width="100%" style="margin-bottom:6pt;"><tr><td class="sh">Jobs / Work Done</td></tr></table><table class="dt" style="margin-bottom:14pt;"><thead><tr class="dt-h"><td width="18%">Job</td><td width="14%">Date</td><td width="20%">Technician</td><td width="34%">Description</td><td width="14%" align="center">Status</td></tr></thead><tbody>${jobRows}</tbody></table>` : ''}
  ${payments.length ? `<table width="100%" style="margin-bottom:6pt;"><tr><td class="sh">Payments Received</td></tr></table><table class="dt" style="margin-bottom:14pt;"><thead><tr class="dt-h"><td>Payment #</td><td>Date</td><td>Mode</td><td>Received By</td><td>Reference</td><td align="right">Amount (Rs.)</td></tr></thead><tbody>${paymentRows}</tbody></table>` : ''}
  ${materials.length ? `<table width="100%" style="margin-bottom:6pt;"><tr><td class="sh">Material Expenditure</td></tr></table><table class="dt" style="margin-bottom:14pt;"><thead><tr class="dt-h"><td>Material</td><td>Date</td><td>Vendor</td><td align="right">Amount (Rs.)</td></tr></thead><tbody>${materialRows}</tbody></table>` : ''}
  <table width="100%" style="margin-bottom:20pt;"><tr><td width="55%"></td><td width="45%">
    <table width="100%" style="border:0.5pt solid #d1d5db;">
      <tr><td colspan="2" style="background:#1a2740; color:#fff; font-size:7pt; font-weight:bold; text-transform:uppercase; padding:5pt 12pt;">Summary</td></tr>
      <tr><td style="font-size:8pt; padding:5pt 12pt; border-top:0.5pt solid #e5e7eb;">Total Quoted</td><td align="right" style="font-weight:bold; padding:5pt 12pt; border-top:0.5pt solid #e5e7eb;">${esc(rupees(input.quotedAmount))}</td></tr>
      <tr><td style="font-size:8pt; padding:5pt 12pt; border-top:0.5pt solid #e5e7eb;">Total Collected</td><td align="right" style="font-weight:bold; color:#15803d; padding:5pt 12pt; border-top:0.5pt solid #e5e7eb;">${esc(rupees(input.totalPaid))}</td></tr>
      ${showMaterials ? `<tr><td style="font-size:8pt; padding:5pt 12pt; border-top:0.5pt solid #e5e7eb;">Material Cost <span style="font-size:6.5pt; color:#9ca3af;">(business expense, not billed)</span></td><td align="right" style="font-weight:bold; padding:5pt 12pt; border-top:0.5pt solid #e5e7eb;">${esc(rupees(input.totalMaterial))}</td></tr>` : ''}
      <tr><td style="font-size:9pt; font-weight:bold; padding:8pt 12pt; background:#eef2f7; border-top:1pt solid #1a2740;">Balance Due</td><td align="right" style="font-size:11pt; font-weight:bold; color:${balanceColor}; padding:8pt 12pt; background:#eef2f7; border-top:1pt solid #1a2740;">${esc(rupees(input.balanceDue))}</td></tr>
    </table>
  </td></tr></table>
  <table width="100%"><tr><td style="border-top:0.5pt solid #d1d5db; padding-top:10pt; font-size:7pt; color:#9ca3af;">This is a computer-generated document. No manual signature required.</td><td align="right" style="border-top:0.5pt solid #d1d5db; padding-top:10pt; font-size:7pt; color:#9ca3af;">Generated: ${esc(prettyDate(new Date().toISOString().slice(0, 10)))}</td></tr></table>
</td></tr></table>
</body>
</html>`;
}
