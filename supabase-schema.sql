-- ============================================
-- Sanders Capital — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. PROFILES TABLE
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  role text default 'free' check (role in ('free', 'premium', 'admin')),
  created_at timestamp with time zone default now()
);

-- Trigger: auto-create profile on user registration
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, '', 'free');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. ARTICLES TABLE
create table public.articles (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text unique not null,
  excerpt text,
  content text,
  tag text,
  is_premium boolean default false,
  published boolean default false,
  author_id uuid references public.profiles,
  reading_time integer default 5,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. KENNISBANK TABLE
create table public.kennisbank_items (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text unique not null,
  content text,
  category text check (category in ('risicomanagement', 'psychologie', 'marktstructuur', 'fundamentals', 'data-analyse', 'verdieping')),
  is_premium boolean default false,
  order_index integer default 0,
  created_at timestamp with time zone default now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Profiles RLS
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Articles RLS
alter table public.articles enable row level security;

create policy "Anyone can read published free articles"
  on public.articles for select
  using (published = true and is_premium = false);

create policy "Premium users can read premium articles"
  on public.articles for select
  using (
    published = true and (
      is_premium = false or
      exists (select 1 from public.profiles where id = auth.uid() and role in ('premium', 'admin'))
    )
  );

create policy "Admins can do everything with articles"
  on public.articles for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Kennisbank RLS
alter table public.kennisbank_items enable row level security;

create policy "Anyone can read free kennisbank items"
  on public.kennisbank_items for select
  using (is_premium = false);

create policy "Premium users can read all kennisbank items"
  on public.kennisbank_items for select
  using (
    is_premium = false or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('premium', 'admin'))
  );

create policy "Admins can do everything with kennisbank"
  on public.kennisbank_items for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 4. TOOL SETTINGS TABLE
create table public.tool_settings (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  name text not null,
  is_premium boolean default false,
  visible boolean default true,
  created_at timestamp with time zone default now()
);

-- Tool settings RLS
alter table public.tool_settings enable row level security;

create policy "Anyone can read tool settings"
  on public.tool_settings for select
  using (true);

create policy "Admins can manage tool settings"
  on public.tool_settings for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 5. CENTRAL BANK RATES TABLE
create table public.central_bank_rates (
  id uuid default gen_random_uuid() primary key,
  currency text unique not null,
  country text not null,
  bank text not null,
  rate numeric(6,2),
  target numeric(6,2),
  flag text,
  bias text default '',
  last_move text default '',
  next_meeting text default '',
  source_url text default '',
  updated_at timestamp with time zone default now()
);

-- Central bank rates RLS
alter table public.central_bank_rates enable row level security;

create policy "Anyone can read central bank rates"
  on public.central_bank_rates for select
  using (true);

create policy "Admins can manage central bank rates"
  on public.central_bank_rates for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Seed central bank rates
insert into public.central_bank_rates (currency, country, bank, rate, target, flag, bias, last_move, next_meeting, source_url) values
('USD', 'Verenigde Staten', 'Federal Reserve (Fed)', 3.75, 3.50, 'US', 'afwachtend', '25bp knip (januari 2026)', '6 mei 2026', 'https://www.federalreserve.gov/monetarypolicy.htm'),
('EUR', 'Eurozone', 'Europese Centrale Bank (ECB)', 1.90, 1.75, 'EU', 'afwachtend', '25bp knip (januari 2026)', '16 april 2026', 'https://www.ecb.europa.eu/mopo/decisions/html/index.en.html'),
('GBP', 'Verenigd Koninkrijk', 'Bank of England (BoE)', 3.75, 3.50, 'GB', 'voorzichtig verruimend', '25bp knip (februari 2026)', '7 mei 2026', 'https://www.bankofengland.co.uk/monetary-policy'),
('JPY', 'Japan', 'Bank of Japan (BoJ)', 1.00, 1.25, 'JP', 'voorzichtig verkrappend', '25bp verhoging (januari 2026)', '28 april 2026', 'https://www.boj.or.jp/en/mopo/index.htm'),
('CHF', 'Zwitserland', 'Zwitserse Nationale Bank (SNB)', 0.00, 0.00, 'CH', 'afwachtend', '25bp knip (juni 2025)', '18 juni 2026', 'https://www.snb.ch/en/iabout/monpol'),
('AUD', 'Australië', 'Reserve Bank of Australia (RBA)', 3.35, 3.10, 'AU', 'voorzichtig verruimend', '25bp knip (februari 2026)', '5 mei 2026', 'https://www.rba.gov.au/monetary-policy/'),
('CAD', 'Canada', 'Bank of Canada (BoC)', 2.25, 2.00, 'CA', 'afwachtend', '25bp knip (december 2025)', '15 april 2026', 'https://www.bankofcanada.ca/core-functions/monetary-policy/'),
('NZD', 'Nieuw-Zeeland', 'Reserve Bank of New Zealand (RBNZ)', 2.75, 2.50, 'NZ', 'afwachtend', '25bp knip (februari 2026)', '13 mei 2026', 'https://www.rbnz.govt.nz/monetary-policy'),
('CNY', 'China', 'People''s Bank of China (PBoC)', 3.10, 3.00, 'CN', '', '', '', 'http://www.pbc.gov.cn/en/3688006/index.html'),
('SEK', 'Zweden', 'Sveriges Riksbank', 2.25, 2.00, 'SE', '', '', '', 'https://www.riksbank.se/en-gb/monetary-policy/'),
('NOK', 'Noorwegen', 'Norges Bank', 4.50, 4.00, 'NO', '', '', '', 'https://www.norges-bank.no/en/topics/Monetary-policy/'),
('MXN', 'Mexico', 'Banco de México', 9.50, 9.00, 'MX', '', '', '', 'https://www.banxico.org.mx/monetary-policy/index.html'),
('ZAR', 'Zuid-Afrika', 'South African Reserve Bank', 7.50, 7.25, 'ZA', '', '', '', 'https://www.resbank.co.za/en/home/what-we-do/monetary-policy'),
('TRY', 'Turkije', 'Central Bank of Turkey', 42.50, 40.00, 'TR', '', '', '', 'https://www.tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Main+Menu/Core+Functions/Monetary+Policy/'),
('BRL', 'Brazilië', 'Banco Central do Brasil', 14.25, 13.75, 'BR', '', '', '', 'https://www.bcb.gov.br/en/monetarypolicy');

-- Seed tool settings
insert into public.tool_settings (slug, name, is_premium, visible) values
('fx-selector', 'FX Pair Selector', true, true),
('fx-analyse', 'Fundamental FX Analyse', true, true),
('marktoverzicht', 'Marktoverzicht', false, true),
('calculator', 'Position Size Calculator', false, true),
('kalender', 'Economische Kalender', false, true),
('rente', 'Rentetarieven', false, true);

-- ============================================
-- SEED DATA
-- ============================================

insert into public.articles (title, slug, excerpt, content, tag, is_premium, published, reading_time) values
('Basis van trading', 'basis-van-trading', 'Wat is traden, hoe lees je een chart, welke handelsstijlen zijn er en wie zijn de spelers op de forex markt. Het fundament voor alles wat volgt.', '## Wat is traden?\n\nTraden is het kopen en verkopen van financiële instrumenten met als doel te profiteren van prijsverschillen over tijd. In essentie koop je iets wanneer je verwacht dat de prijs stijgt, of verkoop je iets wanneer je verwacht dat de prijs daalt.\n\nTrading vindt plaats op financiële markten: forex (valutahandel), aandelen, grondstoffen, indices en cryptovaluta. Elke markt heeft eigen kenmerken, maar de onderliggende principes zijn universeel: er is altijd een koper en een verkoper, en de prijs wordt bepaald door vraag en aanbod.\n\n## Traden vs gokken\n\nDit is een cruciaal onderscheid. Op het eerste gezicht lijkt trading op gokken: je zet geld in en de uitkomst is onzeker. Maar er is een fundamenteel verschil — en dat verschil heet *edge*.\n\nEen gokker in een casino heeft geen structureel voordeel. Een trader die gestructureerd werkt, probeert een statistisch voordeel te ontwikkelen: een set van regels die over een groot aantal trades een positief verwacht resultaat oplevert.\n\n**Gokken:** Geen plan. Beslissingen gebaseerd op gevoel. Geen risicomanagement. Geen data.\n\n**Traden:** Een duidelijk plan met vooraf gedefinieerde regels. Risico per trade is vastgelegd. Data wordt bijgehouden en geëvalueerd.\n\n## Wat zie je op een chart?\n\nEen chart is de visuele weergave van prijsbewegingen over tijd. De horizontale as toont tijd, de verticale as toont de prijs.\n\n### Candlesticks\n\nDe meest gebruikte weergave is de candlestick chart. Elke candlestick vertegenwoordigt een tijdsperiode. Een candle toont vier datapunten: de openingsprijs, de sluitingsprijs, het hoogste punt en het laagste punt.\n\nEen groene candle betekent dat de prijs hoger sloot dan hij opende. Een rode candle betekent dat de prijs lager sloot dan hij opende.\n\n### Tijdsframes\n\nJe kunt dezelfde markt bekijken op verschillende tijdsframes: van 1-minuutgrafieken tot maandgrafieken. Het tijdsframe dat je kiest bepaalt hoeveel detail je ziet.\n\n## Welke handelsstijlen zijn er\n\n### Scalping\nScalpers houden posities vast voor seconden tot minuten. Dit vereist intense focus en is niet geschikt voor beginners.\n\n### Day trading\nDay traders openen en sluiten al hun posities binnen dezelfde handelsdag. Typische tijdsframes zijn 5 minuten tot 1 uur.\n\n### Swing trading\nSwing traders houden posities vast voor meerdere dagen tot weken. Beter combineerbaar met andere verplichtingen.\n\n### Position trading\nPosition traders houden posities vast voor weken tot maanden. De minst tijdsintensieve stijl.\n\n## Wie zijn de spelers op de forex markt?\n\nDe forex markt heeft een dagelijks handelsvolume van meer dan $7 biljoen.\n\n### Centrale banken\nZij bepalen de rente en voeren monetair beleid. Wanneer een centrale bank spreekt, luistert de markt.\n\n### Commerciële banken\nGrote banken vormen het interbankennetwerk — het hart van de forex markt.\n\n### Institutionele beleggers\nHedgefondsen, pensioenfondsen en vermogensbeheerders handelen grote volumes.\n\n### Retail traders\nDat ben jij. Individuele traders vormen circa 3-5% van het totale volume.\n\n## Wanneer zijn ze actief?\n\n### Aziatische sessie (00:00–09:00 CET)\nDe rustigste sessie. JPY en AUD paren zijn het meest actief.\n\n### Europese sessie (08:00–17:00 CET)\nDe meest actieve sessie. EUR, GBP en CHF paren zijn bijzonder actief.\n\n### Amerikaanse sessie (14:00–23:00 CET)\nDe overlap met Europa (14:00–17:00) is het meest volatiele window van de dag.', 'Module 1', false, true, 15),

('Marktstructuur begrijpen: de basis van prijsbeweging', 'marktstructuur-begrijpen', 'Een educatieve verkenning van hoe markten functioneren, waarom prijzen bewegen en welke factoren structuur geven aan financiële markten.', '## Wat is marktstructuur?\n\nMarktstructuur verwijst naar de manier waarop prijzen zich ordenen over tijd. Het is de opeenvolging van hogere toppen en hogere bodems (in een opwaartse trend), of lagere toppen en lagere bodems (in een neerwaartse trend).\n\n## Waarom bewegen prijzen?\n\nOp het meest fundamentele niveau bewegen prijzen door het samenspel van vraag en aanbod. Achter deze dynamiek liggen factoren als economische data, geopolitieke gebeurtenissen, monetair beleid en marktsentiment.\n\n## Trends en ranges\n\nEen markt bevindt zich altijd in één van twee toestanden: een trend of een range. Het onderscheid is cruciaal omdat het bepaalt welke analytische frameworks van toepassing zijn.\n\n### Kenmerken van een trend\nEen opwaartse trend kenmerkt zich door hogere toppen (higher highs) en hogere bodems (higher lows).\n\n### Kenmerken van een range\nEen range-gebonden markt beweegt tussen een herkenbare bovengrens (weerstand) en ondergrens (steun).\n\n## Steun en weerstand\n\nSteun- en weerstandsniveaus zijn prijsniveaus waar historisch significante koop- of verkoopactiviteit heeft plaatsgevonden. Deze niveaus weerspiegelen zones waar grotere orders in de markt liggen.\n\n## De rol van tijdsframes\n\nMarktstructuur is fractal: patronen op hogere tijdsframes bestaan uit vergelijkbare patronen op lagere tijdsframes.', 'Marktanalyse', false, true, 8),

('Discipline en psychologie: waarom kennis alleen niet genoeg is', 'discipline-en-psychologie', 'Over de rol van emotie, bias en zelfkennis in financiële besluitvorming — en waarom discipline het verschil maakt.', '## De kloof tussen weten en doen\n\nEr is een fundamenteel verschil tussen kennis hebben en die kennis consistent toepassen. Onze hersenen zijn niet ontworpen voor de constante stroom van onzekerheid die financiële markten produceren.\n\n## Cognitieve biases\n\n### Loss aversion\nMensen ervaren verlies gemiddeld twee keer zo zwaar als een equivalente winst. Dit leidt ertoe dat traders verliezende posities te lang aanhouden.\n\n### Confirmation bias\nWe zoeken actief naar informatie die onze bestaande overtuigingen bevestigt en negeren tegenargumenten.\n\n### Recency bias\nWe geven meer gewicht aan recente gebeurtenissen dan aan historische data.\n\n## De waarde van een proces\n\nDiscipline is het resultaat van een systeem. Door een duidelijk proces te ontwerpen verminder je de ruimte voor impulsieve beslissingen. Dit betekent: checklists, vastgelegde criteria, evaluatie achteraf, en systematisch data bijhouden.\n\n## Data als spiegel\n\nDoor elke beslissing te documenteren bouw je een dataset op die patronen onthult. Houd naast kwantitatieve data ook kwalitatieve data bij: emotionele toestand, slaapkwaliteit, stressniveau.\n\n## Geduld als strategisch voordeel\n\nHet vermogen om te wachten op de juiste condities en niet te handelen wanneer er geen duidelijk kader is — dit onderscheidt een gestructureerde benadering van een impulsieve.', 'Psychologie', false, true, 6);
