create sequence if not exists public.journal_entries_number_seq;

select setval(
  'public.journal_entries_number_seq',
  coalesce(
    (
      select max(nullif(regexp_replace(number, '\D', '', 'g'), '')::bigint)
      from public.journal_entries
    ),
    0
  )
);

create or replace function public.set_journal_entry_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.number is null or btrim(new.number) = '' then
    new.number := 'JE-' || lpad(nextval('public.journal_entries_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_journal_entry_number on public.journal_entries;

create trigger trg_set_journal_entry_number
before insert on public.journal_entries
for each row
execute function public.set_journal_entry_number();