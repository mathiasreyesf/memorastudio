-- =====================================================================
-- Memora Studio — banco de dados (Supabase / PostgreSQL)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- Segurança: RLS ligado em tudo. Cada cliente só enxerga os PRÓPRIOS dados.
-- =====================================================================

-- Validação de CPF (dígitos verificadores) também no servidor
create or replace function public.cpf_valido(c text) returns boolean
language plpgsql immutable as $$
declare s int; i int; d1 int; d2 int;
begin
  if c is null or c !~ '^[0-9]{11}$' or c ~ '^(.)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(c,i,1)::int * (11 - i); end loop;
  d1 := (s * 10) % 11; if d1 = 10 then d1 := 0; end if;
  s := 0; for i in 1..10 loop s := s + substr(c,i,1)::int * (12 - i); end loop;
  d2 := (s * 10) % 11; if d2 = 10 then d2 := 0; end if;
  return d1 = substr(c,10,1)::int and d2 = substr(c,11,1)::int;
end $$;

-- ---------------------------------------------------------------------
-- PERFIS (dados do cliente)
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  nome_completo text not null check (char_length(nome_completo) between 5 and 120),
  cpf           text not null unique check (public.cpf_valido(cpf)),
  celular       text not null check (celular ~ '^[1-9][1-9]9[0-9]{8}$'),
  cep           text not null check (cep ~ '^[0-9]{8}$'),
  logradouro    text not null check (char_length(logradouro) between 3 and 120),
  numero        text not null check (char_length(numero) between 1 and 12),
  complemento   text check (complemento is null or char_length(complemento) <= 60),
  bairro        text not null check (char_length(bairro) between 2 and 80),
  cidade        text not null check (char_length(cidade) between 2 and 80),
  uf            char(2) not null,
  criado_em     timestamptz not null default now()
);

alter table public.perfis enable row level security;

create policy "cliente le o proprio perfil" on public.perfis
  for select to authenticated using (auth.uid() = id);

create policy "cliente atualiza o proprio perfil" on public.perfis
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- O cliente só pode alterar estes campos (e-mail e CPF ficam travados)
revoke update on public.perfis from authenticated;
grant  update (nome_completo, celular, cep, logradouro, numero, complemento, bairro, cidade, uf)
  on public.perfis to authenticated;
-- Sem policy de INSERT/DELETE: o perfil nasce pelo gatilho abaixo.

-- Cria o perfil automaticamente quando a conta é criada (dados vêm do cadastro)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.perfis (id, email, nome_completo, cpf, celular, cep, logradouro, numero, complemento, bairro, cidade, uf)
  values (
    new.id, new.email,
    trim(m->>'nome_completo'),
    regexp_replace(coalesce(m->>'cpf',''),     '\D', '', 'g'),
    regexp_replace(coalesce(m->>'celular',''), '\D', '', 'g'),
    regexp_replace(coalesce(m->>'cep',''),     '\D', '', 'g'),
    trim(m->>'logradouro'), trim(m->>'numero'), nullif(trim(coalesce(m->>'complemento','')), ''),
    trim(m->>'bairro'), trim(m->>'cidade'), upper(trim(m->>'uf'))
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- PEDIDOS
-- Só as Edge Functions (service role) criam/alteram pedidos: o preço é
-- recalculado no servidor, então ninguém consegue "baratear" um pedido.
-- ---------------------------------------------------------------------
create table if not exists public.pedidos (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity (start with 1001),
  user_id          uuid not null references auth.users(id) on delete restrict,
  itens            jsonb not null,
  subtotal         numeric(10,2) not null check (subtotal > 0),
  frete_servico    text not null,
  frete_valor      numeric(10,2) not null check (frete_valor >= 0),
  total            numeric(10,2) not null check (total > 0),
  endereco         jsonb not null,
  status           text not null default 'aguardando_pagamento'
                   check (status in ('aguardando_pagamento','pago','em_producao','enviado','entregue','cancelado')),
  mp_preference_id text,
  mp_payment_id    text,
  criado_em        timestamptz not null default now()
);

alter table public.pedidos enable row level security;

create policy "cliente le os proprios pedidos" on public.pedidos
  for select to authenticated using (auth.uid() = user_id);
-- (sem policies de insert/update/delete para clientes)

create index if not exists pedidos_user_idx on public.pedidos (user_id, criado_em desc);
