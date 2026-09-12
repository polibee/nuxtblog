-- Transitional compatibility columns. The locale-aware service will move
-- these values into author_profile_translations in the next migration.
alter table public.author_profile add column if not exists display_name varchar(80) not null default '';
alter table public.author_profile add column if not exists headline varchar(120) not null default '';
alter table public.author_profile add column if not exists bio text;
alter table public.author_profile add column if not exists location varchar(120) not null default '';
