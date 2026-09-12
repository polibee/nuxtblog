-- Internal persistence tables used by the server-side CMS store.
-- The application connects with the database role; browser/Data API roles
-- must not access these tables directly.
alter table if exists public.cms_records enable row level security;
alter table if exists public.cms_sequences enable row level security;

revoke all on table public.cms_records from anon, authenticated;
revoke all on table public.cms_sequences from anon, authenticated;
