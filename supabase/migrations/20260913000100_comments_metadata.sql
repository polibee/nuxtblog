alter table public.comments
  add column if not exists author_url varchar(500),
  add column if not exists gravatar_hash varchar(32),
  add column if not exists browser_name varchar(40),
  add column if not exists browser_version varchar(40),
  add column if not exists os_name varchar(40),
  add column if not exists os_version varchar(40),
  add column if not exists device_type varchar(16),
  add column if not exists ip_hash varchar(64),
  add column if not exists moderation_reason varchar(500),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by bigint;

create index if not exists comments_post_status_idx
  on public.comments(post_id, status);
create index if not exists comments_parent_idx
  on public.comments(parent_id);
create index if not exists comments_user_idx
  on public.comments(user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_approved_by_fk'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_approved_by_fk
      foreign key (approved_by) references public.users(id) on delete set null;
  end if;
end
$$;
