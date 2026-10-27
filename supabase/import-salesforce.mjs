import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const importDir = path.resolve(root, process.argv[2] || path.join('supabase', 'import'));

function readEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return env;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = (rows.shift() || []).map((header) => header.trim());
  return rows
    .filter((cells) => cells.some((value) => value.trim()))
    .map((cells) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = (cells[index] ?? '').trim();
      });
      return record;
    });
}

function pick(record, names) {
  const keys = Object.keys(record);
  for (const name of names) {
    const found = keys.find((key) => key.toLowerCase() === name.toLowerCase() || key.toLowerCase().endsWith(`.${name.toLowerCase()}`));
    if (found && record[found]) return record[found];
  }
  return '';
}

function parseDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const match = value.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return null;
}

function money(value) {
  if (!value) return 0;
  const amount = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

function readTable(dir, fileName) {
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) return [];
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

function usage() {
  console.log(`Put Salesforce CSV exports in ${importDir}`);
  console.log('Accepted files: customers.csv, employees.csv, quotations.csv, jobs.csv, payments.csv, materials.csv, attendance.csv');
  console.log('Headers can use the Salesforce API names, for example Name, Phone__c, Customer__c, Quoted_Amount__c.');
}

export async function importSalesforce(client, dir) {
  const customers = readTable(dir, 'customers.csv');
  const employees = readTable(dir, 'employees.csv');
  const quotations = readTable(dir, 'quotations.csv');
  const jobs = readTable(dir, 'jobs.csv');
  const payments = readTable(dir, 'payments.csv');
  const materials = readTable(dir, 'materials.csv');
  const attendance = readTable(dir, 'attendance.csv');
  const present = [customers, employees, quotations, jobs, payments, materials, attendance].some((rows) => rows.length);
  if (!present) return null;

  const customerIds = new Map();
  const employeeIds = new Map();
  const quotationIds = new Map();
  const profiles = await client.query(`select id, display_name from public.profiles where active`);
  const profileByName = new Map(profiles.rows.map((row) => [row.display_name.toLowerCase(), row.id]));

  for (const row of customers) {
    const name = pick(row, ['Name', 'Customer Name', 'name']);
    if (!name) continue;
    const inserted = await client.query(
      `insert into public.customers
        (name, phone, email, customer_type, notes, address_street, address_city, address_state, address_postal_code, address_country)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id`,
      [
        name,
        pick(row, ['Phone__c', 'Phone']) || null,
        pick(row, ['Email__c', 'Email']) || null,
        (pick(row, ['Customer_Type__c', 'Customer Type']) === 'Commercial' ? 'Commercial' : 'Residential'),
        pick(row, ['Notes__c', 'Notes']) || null,
        pick(row, ['Address_Street__c', 'Address Street']) || null,
        pick(row, ['Address_City__c', 'Address City']) || null,
        pick(row, ['Address_State__c', 'Address State']) || null,
        pick(row, ['Address_PostalCode__c', 'Address Postal Code']) || null,
        pick(row, ['Address_Country__c', 'Address Country']) || null,
      ],
    );
    const salesforceId = pick(row, ['Id', 'Customer Id']);
    if (salesforceId) customerIds.set(salesforceId, inserted.rows[0].id);
    customerIds.set(name.toLowerCase(), inserted.rows[0].id);
  }

  for (const row of employees) {
    const name = pick(row, ['Name', 'Employee Name', 'name']);
    if (!name) continue;
    const inserted = await client.query(
      `insert into public.employees (name, phone, designation, daily_wage)
       values ($1,$2,$3,$4) returning id`,
      [
        name,
        pick(row, ['Phone__c', 'Phone']) || null,
        pick(row, ['Designation__c', 'Designation']) || null,
        money(pick(row, ['Basic_Salary__c', 'Basic Salary (Per Day)', 'Daily Wage'])),
      ],
    );
    const salesforceId = pick(row, ['Id', 'Employee Id']);
    if (salesforceId) employeeIds.set(salesforceId, inserted.rows[0].id);
    employeeIds.set(name.toLowerCase(), inserted.rows[0].id);
  }

  for (const row of quotations) {
    const customerKey = pick(row, ['Customer__c', 'Customer Id', 'Customer__r.Name', 'Customer Name']);
    const customerId = customerIds.get(customerKey) || customerIds.get(customerKey.toLowerCase());
    if (!customerId) continue;
    const number = pick(row, ['Name', 'Quotation Number']);
    const inserted = await client.query(
      `insert into public.quotations
        (quotation_number, customer_id, quotation_date, scope_of_work, quoted_amount, status)
       values (coalesce(nullif($1, ''), 'QT-' || lpad(nextval('public.quotation_no_seq')::text, 4, '0')), $2, $3, $4, $5, $6)
       returning id`,
      [
        number && !/^a[a-z0-9]{14,17}$/i.test(number) ? number : '',
        customerId,
        parseDate(pick(row, ['Quotation_Date__c', 'Quotation Date'])) || new Date().toISOString().slice(0, 10),
        pick(row, ['Scope_of_Work__c', 'Scope of Work']) || null,
        money(pick(row, ['Quoted_Amount__c', 'Quoted Amount'])),
        pick(row, ['Status__c', 'Status']) || 'Draft',
      ],
    );
    const salesforceId = pick(row, ['Id', 'Quotation Id']);
    if (salesforceId) quotationIds.set(salesforceId, inserted.rows[0].id);
    if (number) quotationIds.set(number.toLowerCase(), inserted.rows[0].id);
  }

  function quotationIdOf(row) {
    const key = pick(row, ['Quotation__c', 'Quotation Id', 'Quotation__r.Name', 'Quotation Name']);
    return quotationIds.get(key) || quotationIds.get(key.toLowerCase()) || null;
  }

  function personId(name) {
    return name ? profileByName.get(name.toLowerCase()) || null : null;
  }

  for (const row of jobs) {
    const quotationId = quotationIdOf(row);
    const work = pick(row, ['Work_Description__c', 'Work Description']);
    if (!quotationId || !work) continue;
    const inserted = await client.query(
      `insert into public.jobs (quotation_id, job_date, work_description, status)
       values ($1,$2,$3,$4) returning id`,
      [
        quotationId,
        parseDate(pick(row, ['Job_Date__c', 'Job Date'])) || new Date().toISOString().slice(0, 10),
        work,
        pick(row, ['Status__c', 'Status']) || 'In Progress',
      ],
    );
    const technician = personId(pick(row, ['Technician__c', 'Technician']));
    if (technician) {
      await client.query(`update public.jobs set technician_id = $1 where id = $2`, [technician, inserted.rows[0].id]);
    }
  }

  for (const row of payments) {
    const quotationId = quotationIdOf(row);
    const amount = money(pick(row, ['Amount__c', 'Amount']));
    if (!quotationId || amount <= 0) continue;
    const inserted = await client.query(
      `insert into public.payments (quotation_id, payment_date, amount, payment_mode, reference_number)
       values ($1,$2,$3,$4,$5) returning id`,
      [
        quotationId,
        parseDate(pick(row, ['Payment_Date__c', 'Payment Date'])) || new Date().toISOString().slice(0, 10),
        amount,
        pick(row, ['Payment_Mode__c', 'Payment Mode']) || 'Cash',
        pick(row, ['Reference_Number__c', 'Reference Number']) || null,
      ],
    );
    const receiver = personId(pick(row, ['Received_By__c', 'Received By']));
    if (receiver) {
      await client.query(`update public.payments set received_by = $1 where id = $2`, [receiver, inserted.rows[0].id]);
    }
  }

  for (const row of materials) {
    const quotationId = quotationIdOf(row);
    const name = pick(row, ['Material_Name__c', 'Material Name']);
    const amount = money(pick(row, ['Amount__c', 'Amount']));
    if (!quotationId || !name || amount <= 0) continue;
    await client.query(
      `insert into public.material_spends (quotation_id, spend_date, material_name, amount, vendor)
       values ($1,$2,$3,$4,$5)`,
      [
        quotationId,
        parseDate(pick(row, ['Spend_Date__c', 'Spend Date'])) || new Date().toISOString().slice(0, 10),
        name,
        amount,
        pick(row, ['Vendor__c', 'Vendor']) || null,
      ],
    );
  }

  for (const row of attendance) {
    const employeeKey = pick(row, ['Employee__c', 'Employee Id', 'Employee__r.Name', 'Employee Name']);
    const employeeId = employeeIds.get(employeeKey) || employeeIds.get(employeeKey.toLowerCase());
    const days = money(pick(row, ['Days__c', 'Days']));
    if (!employeeId || days <= 0) continue;
    const inserted = await client.query(
      `insert into public.attendance (employee_id, quotation_id, attendance_date, days, status)
       values ($1,$2,$3,$4,$5) returning id`,
      [
        employeeId,
        quotationIdOf(row),
        parseDate(pick(row, ['Attendance_Date__c', 'Attendance Date'])) || new Date().toISOString().slice(0, 10),
        days,
        pick(row, ['Status__c', 'Status']) || 'Unpaid',
      ],
    );
    const historical = pick(row, ['Amount_Due__c', 'Amount Due']);
    if (historical) {
      await client.query(`update public.attendance set amount_due = $1 where id = $2`, [money(historical), inserted.rows[0].id]);
    }
  }

  return {
    customers: customers.length,
    employees: employees.length,
    quotations: quotations.length,
    jobs: jobs.length,
    payments: payments.length,
    materials: materials.length,
    attendance: attendance.length,
  };
}

async function selfTest(env) {
  const os = await import('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iqra-import-'));
  const files = {
    'customers.csv': 'Id,Name,Phone__c,Customer_Type__c\nC1,Import Site,999,Residential\n',
    'employees.csv': 'Id,Name,Designation__c,Basic_Salary__c\nE1,Import Worker,Mason,800\n',
    'quotations.csv': 'Id,Name,Customer__c,Quotation_Date__c,Quoted_Amount__c,Status__c,Scope_of_Work__c\nQ1,QT-9001,C1,2026-10-01,5000,Approved,Paint walls\n',
    'jobs.csv': 'Quotation__c,Job_Date__c,Work_Description__c,Status__c\nQ1,2026-10-02,Painted the hall,Completed\n',
    'payments.csv': 'Quotation__c,Payment_Date__c,Amount__c,Payment_Mode__c\nQ1,2026-10-03,1500,Cash\n',
    'materials.csv': 'Quotation__c,Spend_Date__c,Material_Name__c,Amount__c,Vendor__c\nQ1,2026-10-02,Cement,400,Local shop\n',
    'attendance.csv': 'Employee__c,Quotation__c,Attendance_Date__c,Days__c,Status__c,Amount_Due__c\nE1,Q1,2026-10-02,1,Unpaid,800\n',
  };
  for (const [name, contents] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), contents);

  const client = new pg.Client({
    host: env.SUPABASE_DB_HOST,
    port: Number(env.SUPABASE_DB_PORT || 5432),
    database: env.SUPABASE_DB_NAME,
    user: env.SUPABASE_DB_USER,
    password: env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query('begin');
    const summary = await importSalesforce(client, dir);
    const check = await client.query(
      `select q.quotation_number, q.total_paid, q.total_material_spend, q.balance_due
       from public.quotations q
       join public.customers c on c.id = q.customer_id
       where c.name = 'Import Site'`,
    );
    const row = check.rows[0];
    if (!summary || row?.quotation_number !== 'QT-9001' || Number(row.total_paid) !== 1500 || Number(row.balance_due) !== 3500 || Number(row.total_material_spend) !== 400) {
      throw new Error(`import check failed ${JSON.stringify(row)}`);
    }
    await client.query('rollback');
    console.log('self-test ok');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const env = readEnv(path.join(root, '.env.local'));
  if (process.argv.includes('--self-test')) {
    await selfTest(env);
  } else if (!fs.existsSync(importDir)) {
    fs.mkdirSync(importDir, { recursive: true });
    usage();
  } else {
    const client = new pg.Client({
      host: env.SUPABASE_DB_HOST,
      port: Number(env.SUPABASE_DB_PORT || 5432),
      database: env.SUPABASE_DB_NAME,
      user: env.SUPABASE_DB_USER,
      password: env.SUPABASE_DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
      await client.query('begin');
      const summary = await importSalesforce(client, importDir);
      if (!summary) {
        await client.query('rollback');
        usage();
      } else {
        await client.query('commit');
        console.log(summary);
      }
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      await client.end();
    }
  }
}
