-- =============================================================
-- Search Price — Supabase 資料表
-- 在 Supabase Dashboard → SQL Editor 貼上並執行
-- =============================================================

create table if not exists public.price_reports (
  id            uuid primary key,                       -- 由 App 端產生，方便離線後同步不重複
  barcode       text not null check (barcode ~ '^[0-9]{8,14}$'),
  product_name  text not null check (char_length(product_name) between 1 and 120),
  price         numeric(10, 2) not null check (price > 0 and price < 100000),
  store_chain   text not null check (char_length(store_chain) between 1 and 40),
  store_name    text check (store_name is null or char_length(store_name) <= 120),
  latitude      double precision check (latitude is null or latitude between -90 and 90),
  longitude     double precision check (longitude is null or longitude between -180 and 180),
  reported_at   timestamptz not null default now(),      -- 使用者回報時間（畫面上的「最後更新」）
  device_id     text,
  image_url     text,                                   -- 商品圖片（Base64 或 Storage 網址）
  source_url    text,                                   -- 原始資料來源網址（電商、開放庫或官方連結）
  created_at    timestamptz not null default now()       -- 伺服器寫入時間（增量同步用）
);

-- 使用者不能偽造伺服器時間
create or replace function public.price_reports_set_created_at()
returns trigger language plpgsql as $$
begin
  new.created_at := now();
  if new.reported_at > now() + interval '5 minutes' then
    new.reported_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_price_reports_created_at on public.price_reports;
create trigger trg_price_reports_created_at
  before insert on public.price_reports
  for each row execute function public.price_reports_set_created_at();

create index if not exists idx_price_reports_created_at on public.price_reports (created_at);
create index if not exists idx_price_reports_barcode on public.price_reports (barcode, store_chain, reported_at desc);
create index if not exists idx_price_reports_name on public.price_reports using gin (to_tsvector('simple', product_name));

-- -------------------------------------------------------------
-- Row Level Security：任何人可讀取、可新增；不可修改或刪除
-- -------------------------------------------------------------
alter table public.price_reports enable row level security;

drop policy if exists "price_reports_read" on public.price_reports;
create policy "price_reports_read" on public.price_reports
  for select to anon, authenticated using (true);

drop policy if exists "price_reports_insert" on public.price_reports;
create policy "price_reports_insert" on public.price_reports
  for insert to anon, authenticated with check (true);

-- -------------------------------------------------------------
-- （選用）每個條碼、每個通路最新價格的檢視表，方便在 Dashboard 查看
-- -------------------------------------------------------------
create or replace view public.latest_prices
with (security_invoker = true) as
select distinct on (barcode, store_chain)
  barcode, store_chain, store_name, product_name, price, reported_at
from public.price_reports
order by barcode, store_chain, reported_at desc;
