-- Short preview for note lists, so lists don't download full note text.
alter table public.notes
  add column preview text generated always as (left(content_text, 200)) stored;
