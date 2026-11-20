-- Cognithan: notes, folders, tags, sharing, collaboration, image storage.
-- Access model:
--   * A user owns their folders, tags and notes.
--   * A note can be shared with other users (note_collaborators) as editor or viewer.
--   * A note can be published read-only via an unguessable share_token (read through get_shared_note()).

create extension if not exists pg_trgm with schema extensions;

-- Private schema for helper functions (not exposed through the Data API).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

------------------------------------------------------------------------------
-- profiles
------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

------------------------------------------------------------------------------
-- folders & tags
------------------------------------------------------------------------------
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default 'violet',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index folders_user_id_idx on public.folders (user_id);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'fuchsia',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

------------------------------------------------------------------------------
-- notes
------------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null default '',
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_text text not null default '',
  ydoc text, -- base64-encoded Yjs state for real-time collaboration
  emoji text,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  is_public boolean not null default false,
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content_text, '')), 'B')
  ) stored
);
create index notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index notes_folder_id_idx on public.notes (folder_id);
create index notes_search_idx on public.notes using gin (search);
create index notes_title_trgm_idx on public.notes using gin (title extensions.gin_trgm_ops);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function private.touch_updated_at();

create table public.note_tags (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (note_id, tag_id)
);
create index note_tags_tag_id_idx on public.note_tags (tag_id);

create table public.note_collaborators (
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);
create index note_collaborators_user_id_idx on public.note_collaborators (user_id);

------------------------------------------------------------------------------
-- access helpers (security definer to avoid RLS recursion; private schema)
------------------------------------------------------------------------------
create or replace function private.is_note_owner(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note_id and n.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note_id and n.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.note_collaborators c
    where c.note_id = p_note_id and c.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note_id and n.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.note_collaborators c
    where c.note_id = p_note_id and c.user_id = (select auth.uid()) and c.role = 'editor'
  );
$$;

create or replace function private.shares_note_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.note_collaborators c
    join public.notes n on n.id = c.note_id
    where (n.user_id = (select auth.uid()) and c.user_id = p_user_id)
       or (c.user_id = (select auth.uid()) and n.user_id = p_user_id)
       or (c.user_id = (select auth.uid()) and exists (
             select 1 from public.note_collaborators c2
             where c2.note_id = c.note_id and c2.user_id = p_user_id))
  );
$$;

revoke all on function private.is_note_owner(uuid), private.can_view_note(uuid),
  private.can_edit_note(uuid), private.shares_note_with(uuid) from public;
grant execute on function private.is_note_owner(uuid), private.can_view_note(uuid),
  private.can_edit_note(uuid), private.shares_note_with(uuid) to authenticated;

------------------------------------------------------------------------------
-- RLS
------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.tags enable row level security;
alter table public.notes enable row level security;
alter table public.note_tags enable row level security;
alter table public.note_collaborators enable row level security;

-- profiles: see yourself and people you collaborate with; edit only yourself.
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_note_with(id));
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- folders / tags: owner only.
create policy "folders_all" on public.folders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tags_all" on public.tags for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- notes
create policy "notes_select" on public.notes for select to authenticated
  using (user_id = (select auth.uid()) or private.can_view_note(id));
create policy "notes_insert" on public.notes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "notes_update" on public.notes for update to authenticated
  using (private.can_edit_note(id))
  with check (private.can_edit_note(id));
create policy "notes_delete" on public.notes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Collaborators must not change ownership / sharing / organisation fields.
create or replace function private.guard_note_owner_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and old.user_id is distinct from (select auth.uid()) then
    if new.user_id is distinct from old.user_id
       or new.folder_id is distinct from old.folder_id
       or new.is_public is distinct from old.is_public
       or new.share_token is distinct from old.share_token
       or new.is_pinned is distinct from old.is_pinned
       or new.is_archived is distinct from old.is_archived then
      raise exception 'Only the note owner can change these fields';
    end if;
  end if;
  return new;
end;
$$;

create trigger notes_guard_owner_fields
  before update on public.notes
  for each row execute function private.guard_note_owner_fields();

-- note_tags: owner of the note, using their own tags.
create policy "note_tags_select" on public.note_tags for select to authenticated
  using (private.is_note_owner(note_id));
create policy "note_tags_insert" on public.note_tags for insert to authenticated
  with check (
    private.is_note_owner(note_id)
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  );
create policy "note_tags_delete" on public.note_tags for delete to authenticated
  using (private.is_note_owner(note_id));

-- note_collaborators: owner manages; collaborators can see the list and remove themselves.
create policy "collab_select" on public.note_collaborators for select to authenticated
  using (private.can_view_note(note_id));
create policy "collab_update" on public.note_collaborators for update to authenticated
  using (private.is_note_owner(note_id)) with check (private.is_note_owner(note_id));
create policy "collab_delete" on public.note_collaborators for delete to authenticated
  using (private.is_note_owner(note_id) or user_id = (select auth.uid()));
-- inserts go through public.invite_collaborator()

------------------------------------------------------------------------------
-- RPCs
------------------------------------------------------------------------------
-- Invite an existing user (by email) to a note you own.
create or replace function public.invite_collaborator(p_note_id uuid, p_email text, p_role text default 'editor')
returns public.note_collaborators
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_row public.note_collaborators;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'Invalid role';
  end if;
  if not exists (select 1 from public.notes where id = p_note_id and user_id = (select auth.uid())) then
    raise exception 'Only the note owner can invite collaborators';
  end if;

  select id into v_user_id from public.profiles where email = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'No Cognithan account uses that email yet';
  end if;
  if v_user_id = (select auth.uid()) then
    raise exception 'You already own this note';
  end if;

  insert into public.note_collaborators (note_id, user_id, role, invited_by)
  values (p_note_id, v_user_id, p_role, (select auth.uid()))
  on conflict (note_id, user_id) do update set role = excluded.role
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.invite_collaborator(uuid, text, text) from public, anon;
grant execute on function public.invite_collaborator(uuid, text, text) to authenticated;

-- Read a published note by its share token (anyone with the link).
create or replace function public.get_shared_note(p_token text)
returns table (id uuid, title text, emoji text, content jsonb, updated_at timestamptz, author text)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.title, n.emoji, n.content, n.updated_at, p.display_name
  from public.notes n
  left join public.profiles p on p.id = n.user_id
  where n.is_public and n.share_token is not null and n.share_token = p_token
    and char_length(p_token) >= 20;
$$;

revoke all on function public.get_shared_note(text) from public;
grant execute on function public.get_shared_note(text) to anon, authenticated;

------------------------------------------------------------------------------
-- Data API grants (RLS still applies)
------------------------------------------------------------------------------
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.folders, public.tags, public.notes to authenticated;
grant select, insert, delete on public.note_tags to authenticated;
grant select, update, delete on public.note_collaborators to authenticated;

------------------------------------------------------------------------------
-- Realtime: broadcast/presence channels are used for live editing (no table publication needed).
------------------------------------------------------------------------------

------------------------------------------------------------------------------
-- Storage: note images. Public read (so shared notes render), write only in your own folder.
------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-images', 'note-images', true, 10485760,
        array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "note_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "note_images_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "note_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "note_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
