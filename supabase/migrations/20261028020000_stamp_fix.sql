-- The shared stamp trigger must not read a column that the current table does not have.
-- PostgreSQL evaluates both sides of AND, so a payment row cannot mention technician_id.

begin;

create or replace function public.stamp_site_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null or not public.is_owner() then
    new.created_by := auth.uid();
  end if;

  if tg_table_name = 'payments' then
    if not public.is_owner() or new.received_by is null then
      new.received_by := auth.uid();
    end if;
  elsif tg_table_name = 'jobs' then
    if not public.is_owner() or new.technician_id is null then
      new.technician_id := auth.uid();
    end if;
  end if;

  return new;
end;
$$;

commit;
