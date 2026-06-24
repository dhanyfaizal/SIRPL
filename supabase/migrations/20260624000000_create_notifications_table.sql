create table public.notifikasi (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    message text not null,
    type text not null,
    link text default '',
    is_read boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.notifikasi enable row level security;

-- Policies
create policy "Users can view their own notifications"
    on public.notifikasi for select
    using (auth.uid() = user_id);

create policy "Users can update their own notifications"
    on public.notifikasi for update
    using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
    on public.notifikasi for delete
    using (auth.uid() = user_id);

create policy "Anyone can insert notifications"
    on public.notifikasi for insert
    with check (true);
