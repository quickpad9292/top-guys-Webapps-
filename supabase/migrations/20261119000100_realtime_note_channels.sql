-- Private Realtime channels "note:<uuid>" for live co-editing and presence.
-- Only the owner and collaborators of a note may join / send on its channel.

create or replace function private.can_access_note_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_topic is null or p_topic not like 'note:%' then
    return false;
  end if;
  begin
    v_id := substring(p_topic from 6)::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return private.can_view_note(v_id);
end;
$$;

revoke all on function private.can_access_note_topic(text) from public;
grant execute on function private.can_access_note_topic(text) to authenticated;

create policy "note_channel_receive" on realtime.messages for select to authenticated
  using (private.can_access_note_topic((select realtime.topic())));

create policy "note_channel_send" on realtime.messages for insert to authenticated
  with check (private.can_access_note_topic((select realtime.topic())));
