-- Durable record of every contact-form submission and the verdict it received.
--
-- Motivation: until now a submission existed only as a `[BOTLOG]` console line,
-- and Vercel retention eats those within hours. Two consequences, both realised:
-- a blocked lead left no trace at all, and the 2026-08-03 detection regression
-- could not be measured after the fact - it had to be reconstructed from commit
-- messages a week later.
--
-- This table is the observability half of the anti-spam work. It also gives the
-- per-IP rate limiter something to count against.

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Verdict
  verdict text not null check (verdict in ('accepted', 'rejected')),
  reason text not null,

  -- Signals, kept separate so a threshold can be retuned against history
  content_score integer not null default 0,
  content_signals text[] not null default '{}',
  honeypot_tripped boolean not null default false,
  honeypot_value text,
  elapsed_ms integer,
  botid_is_bot boolean,
  botid_is_human boolean,

  -- Request context
  email text,
  ip text,
  user_agent text,
  referer text
);

comment on table public.contact_submissions is
  'Append-only audit log of contact-form submissions with their anti-spam verdict. Written by the service role from /api/contact; also backs per-IP rate limiting.';

comment on column public.contact_submissions.content_score is
  'Heuristic gibberish score at submission time. Logged for accepted submissions too so the rejection threshold can be tuned from real traffic.';

comment on column public.contact_submissions.honeypot_value is
  'First 32 characters of the honeypot field, enough to tell a browser autofill (a company name) from bot filler text.';

-- Rate limiting counts recent rows per IP; the log is also read newest-first.
create index if not exists contact_submissions_ip_created_at_idx
  on public.contact_submissions (ip, created_at desc);

create index if not exists contact_submissions_created_at_idx
  on public.contact_submissions (created_at desc);

-- This table holds submitter emails and IPs. Nothing outside the service role
-- may read it: no anon or authenticated policy is defined, and with RLS enabled
-- and no policy the effective grant is deny-all for those roles.
alter table public.contact_submissions enable row level security;

revoke all on public.contact_submissions from anon, authenticated;
