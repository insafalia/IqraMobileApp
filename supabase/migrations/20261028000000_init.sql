-- Iqra Construction ledger.
-- Mirrors the Salesforce objects and adds login plus per-staff action flags.
-- Money is rupees, numeric(14,2). Balance due = quoted amount - total paid.

begin;

create sequence if not exists public.quotation_no_seq;
create sequence if not exists public.job_no_seq;
create sequence if not exists public.payment_no_seq;
create sequence if not exists public.material_no_seq;
create sequence if not exists public.attendance_no_seq;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  display_name text not null,
  phone text,
  active boolean not null default true,
  can_add_payment boolean not null default false,
  can_add_job boolean not null default false,
  can_add_material boolean not null default false,
  can_add_attendance boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  email text,
  customer_type text not null default 'Residential' check (customer_type in ('Residential', 'Commercial')),
  notes text,
  address_street text,
  address_city text,
  address_state text,
  address_postal_code text,
  address_country text,
  created_at timestamptz not null default now()
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique default ('QT-' || lpad(nextval('public.quotation_no_seq')::text, 4, '0')),
  customer_id uuid not null references public.customers (id) on delete restrict,
  quotation_date date not null default current_date,
  scope_of_work text,
  quoted_amount numeric(14,2) not null default 0 check (quoted_amount >= 0),
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Approved', 'Rejected', 'Expired')),
  total_paid numeric(14,2) not null default 0,
  total_material_spend numeric(14,2) not null default 0,
  balance_due numeric(14,2) generated always as (quoted_amount - total_paid) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_number text not null unique default ('JB-' || lpad(nextval('public.job_no_seq')::text, 4, '0')),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  job_date date not null,
  technician_id uuid references public.profiles (id),
  work_description text not null check (length(trim(work_description)) > 0),
  status text not null check (status in ('In Progress', 'Completed')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique default ('PAY-' || lpad(nextval('public.payment_no_seq')::text, 4, '0')),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card')),
  received_by uuid references public.profiles (id),
  reference_number text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.material_spends (
  id uuid primary key default gen_random_uuid(),
  material_number text not null unique default ('MAT-' || lpad(nextval('public.material_no_seq')::text, 4, '0')),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  spend_date date not null,
  material_name text not null check (length(trim(material_name)) > 0),
  amount numeric(14,2) not null check (amount > 0),
  vendor text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  designation text,
  daily_wage numeric(14,2) not null default 0 check (daily_wage >= 0),
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  attendance_number text not null unique default ('ATT-' || lpad(nextval('public.attendance_no_seq')::text, 4, '0')),
  employee_id uuid not null references public.employees (id) on delete restrict,
  quotation_id uuid references public.quotations (id) on delete set null,
  attendance_date date not null,
  days numeric(6,2) not null check (days > 0 and days <= 31),
  status text not null default 'Unpaid' check (status in ('Unpaid', 'Paid')),
  amount_due numeric(14,2) not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index customers_name_idx on public.customers (lower(name));
create index quotations_customer_status_idx on public.quotations (customer_id, status);
create index jobs_quotation_date_idx on public.jobs (quotation_id, job_date desc);
create index payments_quotation_date_idx on public.payments (quotation_id, payment_date desc);
create index material_spends_quotation_date_idx on public.material_spends (quotation_id, spend_date desc);
create index attendance_employee_date_idx on public.attendance (employee_id, attendance_date desc);
create index attendance_quotation_idx on public.attendance (quotation_id);

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'owner'
      and active
  );
$$;

create or replace function public.staff_flag(flag_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  if flag_name not in ('can_add_payment', 'can_add_job', 'can_add_material', 'can_add_attendance') then
    return false;
  end if;

  execute format(
    'select active and role = ''staff'' and %I from public.profiles where id = auth.uid()',
    flag_name
  )
  into allowed;

  return coalesce(allowed, false);
end;
$$;

create or replace function public.staff_has_site_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active
      and role = 'staff'
      and (
        can_add_payment
        or can_add_job
        or can_add_material
        or can_add_attendance
      )
  );
$$;

create or replace function public.quotation_is_approved(qid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quotations
    where id = qid
      and status = 'Approved'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_attendance_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wage numeric(14,2);
begin
  select daily_wage into wage
  from public.employees
  where id = new.employee_id;

  new.amount_due := round(coalesce(new.days, 0) * coalesce(wage, 0), 2);
  return new;
end;
$$;

create or replace function public.refresh_quotation_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qid uuid;
begin
  qid := case when tg_op = 'DELETE' then old.quotation_id else new.quotation_id end;

  update public.quotations
  set total_paid = coalesce((
    select sum(amount) from public.payments where quotation_id = qid
  ), 0)
  where id = qid;

  if tg_op = 'UPDATE' and old.quotation_id is distinct from new.quotation_id then
    update public.quotations
    set total_paid = coalesce((
      select sum(amount) from public.payments where quotation_id = old.quotation_id
    ), 0)
    where id = old.quotation_id;
  end if;

  return null;
end;
$$;

create or replace function public.refresh_quotation_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qid uuid;
begin
  qid := case when tg_op = 'DELETE' then old.quotation_id else new.quotation_id end;

  update public.quotations
  set total_material_spend = coalesce((
    select sum(amount) from public.material_spends where quotation_id = qid
  ), 0)
  where id = qid;

  if tg_op = 'UPDATE' and old.quotation_id is distinct from new.quotation_id then
    update public.quotations
    set total_material_spend = coalesce((
      select sum(amount) from public.material_spends where quotation_id = old.quotation_id
    ), 0)
    where id = old.quotation_id;
  end if;

  return null;
end;
$$;

create or replace function public.stamp_site_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    new.created_by := auth.uid();
    if tg_table_name = 'payments' then
      new.received_by := auth.uid();
    elsif tg_table_name = 'jobs' then
      new.technician_id := auth.uid();
    end if;
  else
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if tg_table_name = 'payments' and new.received_by is null then
      new.received_by := auth.uid();
    end if;
    if tg_table_name = 'jobs' and new.technician_id is null then
      new.technician_id := auth.uid();
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role text;
begin
  if (select count(*) from public.profiles) = 0 then
    next_role := 'owner';
  else
    next_role := 'staff';
  end if;

  insert into public.profiles (id, display_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'User'),
    new.raw_user_meta_data ->> 'phone',
    next_role
  );

  return new;
end;
$$;

create trigger quotations_touch_updated_at
before update on public.quotations
for each row execute function public.touch_updated_at();

create trigger attendance_set_amount
before insert or update of employee_id, days on public.attendance
for each row execute function public.set_attendance_amount();

create trigger payments_refresh_total
after insert or update or delete on public.payments
for each row execute function public.refresh_quotation_paid();

create trigger materials_refresh_total
after insert or update or delete on public.material_spends
for each row execute function public.refresh_quotation_material();

create trigger payments_stamp_actor
before insert on public.payments
for each row execute function public.stamp_site_row();

create trigger jobs_stamp_actor
before insert on public.jobs
for each row execute function public.stamp_site_row();

create trigger materials_stamp_actor
before insert on public.material_spends
for each row execute function public.stamp_site_row();

create trigger attendance_stamp_actor
before insert on public.attendance
for each row execute function public.stamp_site_row();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create view public.employee_wage_totals
with (security_invoker = true) as
select
  e.id as employee_id,
  coalesce(sum(a.amount_due) filter (where a.status = 'Unpaid'), 0)::numeric(14,2) as total_unpaid,
  coalesce(sum(a.amount_due) filter (where a.status = 'Paid'), 0)::numeric(14,2) as total_paid
from public.employees e
left join public.attendance a on a.employee_id = e.id
group by e.id;

create or replace function public.owner_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_owner() then
    raise exception 'not allowed';
  end if;

  select jsonb_build_object(
    'total_customers', (select count(*) from public.customers),
    'total_quotations', (select count(*) from public.quotations),
    'active_quotations', (
      select count(*) from public.quotations
      where status not in ('Rejected', 'Expired')
    ),
    'completed_jobs', (
      select count(*) from public.jobs where status = 'Completed'
    ),
    'total_collected', coalesce((select sum(amount) from public.payments), 0),
    'total_material_spend', coalesce((select sum(amount) from public.material_spends), 0),
    'total_outstanding', coalesce((
      select sum(balance_due) from public.quotations where balance_due > 0
    ), 0)
  ) into result;

  return result;
end;
$$;

create or replace function public.search_approved_quotations(term text)
returns table (
  id uuid,
  quotation_number text,
  customer_name text,
  quoted_amount numeric,
  balance_due numeric,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.quotation_number,
    c.name,
    q.quoted_amount,
    q.balance_due,
    q.status
  from public.quotations q
  join public.customers c on c.id = q.customer_id
  where q.status = 'Approved'
    and (public.is_owner() or public.staff_has_site_access())
    and char_length(trim(coalesce(term, ''))) >= 2
    and strpos(lower(c.name), lower(trim(term))) > 0
  order by c.name, q.quotation_number
  limit 10;
$$;

create or replace function public.search_employees(term text)
returns table (
  id uuid,
  employee_name text,
  designation text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.name, e.designation
  from public.employees e
  where (public.is_owner() or public.staff_flag('can_add_attendance'))
    and char_length(trim(coalesce(term, ''))) >= 2
    and strpos(lower(e.name), lower(trim(term))) > 0
  order by e.name
  limit 10;
$$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.quotations enable row level security;
alter table public.jobs enable row level security;
alter table public.payments enable row level security;
alter table public.material_spends enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;

create policy profiles_select_self on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_owner());

create policy profiles_update_owner on public.profiles
for update to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy customers_owner_all on public.customers
for all to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy quotations_owner_all on public.quotations
for all to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy jobs_owner_all on public.jobs
for all to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy jobs_staff_insert on public.jobs
for insert to authenticated
with check (
  public.staff_flag('can_add_job')
  and technician_id = auth.uid()
  and created_by = auth.uid()
  and public.quotation_is_approved(quotation_id)
);

create policy jobs_staff_select_own on public.jobs
for select to authenticated
using (created_by = auth.uid() or technician_id = auth.uid());

create policy payments_owner_all on public.payments
for all to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy payments_staff_insert on public.payments
for insert to authenticated
with check (
  public.staff_flag('can_add_payment')
  and received_by = auth.uid()
  and created_by = auth.uid()
  and public.quotation_is_approved(quotation_id)
);

create policy payments_staff_select_own on public.payments
for select to authenticated
using (created_by = auth.uid() or received_by = auth.uid());

create policy materials_owner_all on public.material_spends
for all to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy materials_staff_insert on public.material_spends
for insert to authenticated
with check (
  public.staff_flag('can_add_material')
  and created_by = auth.uid()
  and public.quotation_is_approved(quotation_id)
);

create policy materials_staff_select_own on public.material_spends
for select to authenticated
using (created_by = auth.uid());

create policy employees_owner_all on public.employees
for all to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy attendance_owner_all on public.attendance
for all to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy attendance_staff_insert on public.attendance
for insert to authenticated
with check (
  public.staff_flag('can_add_attendance')
  and created_by = auth.uid()
  and (quotation_id is null or public.quotation_is_approved(quotation_id))
);

create policy attendance_staff_select_own on public.attendance
for select to authenticated
using (created_by = auth.uid());

revoke all on table
  public.profiles,
  public.customers,
  public.quotations,
  public.jobs,
  public.payments,
  public.material_spends,
  public.employees,
  public.attendance
from anon, public;

grant select, insert, update, delete on table
  public.profiles,
  public.customers,
  public.quotations,
  public.jobs,
  public.payments,
  public.material_spends,
  public.employees,
  public.attendance
to authenticated;

grant select on public.employee_wage_totals to authenticated;
revoke all on public.employee_wage_totals from anon, public;

grant usage, select on sequence
  public.quotation_no_seq,
  public.job_no_seq,
  public.payment_no_seq,
  public.material_no_seq,
  public.attendance_no_seq
to authenticated;

revoke all on function public.is_owner() from public, anon;
revoke all on function public.staff_flag(text) from public, anon;
revoke all on function public.staff_has_site_access() from public, anon;
revoke all on function public.quotation_is_approved(uuid) from public, anon;
revoke all on function public.owner_dashboard() from public, anon;
revoke all on function public.search_approved_quotations(text) from public, anon;
revoke all on function public.search_employees(text) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.is_owner() to authenticated;
grant execute on function public.staff_flag(text) to authenticated;
grant execute on function public.staff_has_site_access() to authenticated;
grant execute on function public.quotation_is_approved(uuid) to authenticated;
grant execute on function public.owner_dashboard() to authenticated;
grant execute on function public.search_approved_quotations(text) to authenticated;
grant execute on function public.search_employees(text) to authenticated;

commit;
