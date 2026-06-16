-- ─────────────────────────────────────────────────────────────
-- CB rates update — 16 juni 2026
-- Op basis van besluiten t/m juni 2026 (RBA 15-16/6, ECB 11/6,
-- BoC 10/6, BoJ 28/4 met juni-meeting upcoming).
-- ─────────────────────────────────────────────────────────────

UPDATE public.central_bank_rates SET
  rate = 4.35,
  bias = 'afwachtend',
  last_move = '15-16 juni 2026: unanieme hold op 4,35% na hikes in feb/mrt/mei',
  next_meeting = '10-11 augustus 2026'
WHERE currency = 'AUD';

UPDATE public.central_bank_rates SET
  rate = 2.25,
  bias = 'afwachtend',
  last_move = '10 juni 2026: hold op 2,25%, geen duidelijke richting door geopolitieke onzekerheid',
  next_meeting = '30 juli 2026'
WHERE currency = 'CAD';

UPDATE public.central_bank_rates SET
  rate = 2.25,
  bias = 'verkrappend',
  last_move = '11 juni 2026: hike 25 bp naar 2,25% (eerste verhoging sinds 2023, ingegeven door Iran/olie inflatie)',
  next_meeting = '23 juli 2026'
WHERE currency = 'EUR';

UPDATE public.central_bank_rates SET
  rate = 0.75,
  bias = 'voorzichtig verkrappend',
  last_move = '28 april 2026: hold op 0,75% in split 6-3 vote (3 dissenters wilden naar 1,0%), signaal voor juni-hike',
  next_meeting = '18 juni 2026'
WHERE currency = 'JPY';

-- Controle: laat de geüpdatete rijen zien
SELECT currency, bank, rate, target, bias, last_move, next_meeting
FROM public.central_bank_rates
WHERE currency IN ('AUD', 'CAD', 'EUR', 'JPY')
ORDER BY currency;
