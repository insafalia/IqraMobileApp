-- Owner is created from the app once. After that, only the owner can create staff.
-- Email is marked confirmed so the phone can sign in without a confirmation mail.

begin;

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
  elsif coalesce(new.raw_user_meta_data ->> 'created_by_owner', '') = 'true' then
    next_role := 'staff';
  else
    raise exception 'Sign up is closed';
  end if;

  insert into public.profiles (id, display_name, phone, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    ),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    next_role
  );

  return new;
end;
$$;

create or replace function public.insert_login(
  login_email text,
  login_password text,
  login_name text,
  login_phone text,
  mark_staff boolean
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_id uuid := gen_random_uuid();
  clean_email text := lower(trim(coalesce(login_email, '')));
  instance uuid;
begin
  if clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email';
  end if;
  if login_name is null or length(trim(login_name)) = 0 then
    raise exception 'Enter a name';
  end if;
  if login_password is null or length(login_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  select id into instance from auth.instances limit 1;
  if instance is null then
    instance := '00000000-0000-0000-0000-000000000000';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    instance,
    new_id,
    'authenticated',
    'authenticated',
    clean_email,
    crypt(login_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'display_name', trim(login_name),
      'phone', nullif(trim(coalesce(login_phone, '')), ''),
      'created_by_owner', case when mark_staff then 'true' else 'false' end
    ),
    now(),
    now(),
    '', '', '', ''
  );

  insert into auth.identities (
    user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    new_id,
    jsonb_build_object('sub', new_id::text, 'email', clean_email, 'email_verified', true),
    'email',
    new_id::text,
    now(),
    now(),
    now()
  );

  return new_id;
exception
  when unique_violation then
    raise exception 'That email is already used';
end;
$$;

create or replace function public.has_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where role = 'owner' and active
  );
$$;

create or replace function public.create_owner(
  owner_email text,
  owner_password text,
  owner_name text,
  owner_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  lock table public.profiles in exclusive mode;
  if exists (select 1 from public.profiles where role = 'owner') then
    raise exception 'An owner already exists';
  end if;
  new_id := public.insert_login(owner_email, owner_password, owner_name, owner_phone, false);
  return new_id;
end;
$$;

create or replace function public.create_staff(
  staff_email text,
  staff_password text,
  staff_name text,
  staff_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'not allowed';
  end if;
  return public.insert_login(staff_email, staff_password, staff_name, staff_phone, true);
end;
$$;

create or replace function public.attendance_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  month_start date;
  result jsonb;
begin
  if not public.is_owner() then
    raise exception 'not allowed';
  end if;

  month_start := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;

  select jsonb_build_object(
    'total_unpaid', coalesce((select sum(amount_due) from public.attendance where status = 'Unpaid'), 0),
    'total_paid', coalesce((select sum(amount_due) from public.attendance where status = 'Paid'), 0),
    'total_employees', (select count(*) from public.employees),
    'this_month_days', coalesce((
      select sum(days) from public.attendance
      where attendance_date >= month_start
        and attendance_date < (month_start + interval '1 month')::date
    ), 0)
  ) into result;

  return result;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.insert_login(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.has_owner() from public;
revoke all on function public.create_owner(text, text, text, text) from public;
revoke all on function public.create_staff(text, text, text, text) from public, anon;
revoke all on function public.attendance_stats() from public, anon;

grant execute on function public.has_owner() to anon, authenticated;
grant execute on function public.create_owner(text, text, text, text) to anon, authenticated;
grant execute on function public.create_staff(text, text, text, text) to authenticated;
grant execute on function public.attendance_stats() to authenticated;

commit;
