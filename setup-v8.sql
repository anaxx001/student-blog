-- Run AFTER setup.sql, setup-v4.sql, setup-v5.sql (needs is_admin()). Once, in Supabase > SQL editor > New query > paste > Run.

create or replace function public.set_post_slug(p_post_id uuid, p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid post slug' using errcode = '22023';
  end if;

  if exists (select 1 from public.posts where slug = p_slug and id <> p_post_id) then
    raise exception 'post slug already exists' using errcode = '23505';
  end if;

  update public.posts
     set slug = p_slug
   where id = p_post_id;

  if not found then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_post_slug(uuid, text) from public, anon;
grant execute on function public.set_post_slug(uuid, text) to authenticated;
