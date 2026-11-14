import { redirect } from 'next/navigation'

// Audit fase 6: deze verweesde pagina rendert het oude dashboard niet meer.
// Dat dashboard vuurde bij elk bezoek een POST naar /api/trackrecord-v2 af
// (bron van weekend-calls, dubbele afrekeningen en races — zie
// docs/audit/fundamental-audit.md, fase 1/5). Oude URL's gaan naar de
// huidige briefing; de redirect staat ook permanent in next.config.ts.
export default function VerwijderdeOudeDashboardPagina() {
  redirect('/tools/fx-selector/v2')
}
