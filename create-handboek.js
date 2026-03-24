const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
        BorderStyle, WidthType, ShadingType, PageNumber, PageBreak } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 200 }, children: [new TextRun(text)] });
}

function para(text, opts = {}) {
  return new Paragraph({ spacing: { after: 120 }, ...opts, children: [new TextRun({ size: 22, ...opts.run, text })] });
}

function boldPara(boldText, normalText) {
  return new Paragraph({ spacing: { after: 120 }, children: [
    new TextRun({ text: boldText, bold: true, size: 22 }),
    new TextRun({ text: normalText, size: 22 }),
  ]});
}

function bullet(text, ref = "bullets") {
  return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text, size: 22 })] });
}

function numberItem(text, ref = "numbers") {
  return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text, size: 22 })] });
}

function infoBox(title, lines) {
  const children = [
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: title, bold: true, size: 22, color: "1F4E79" })] }),
    ...lines.map(l => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: l, size: 20 })] }))
  ];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [new TableCell({
      borders, width: { size: 9360, type: WidthType.DXA },
      shading: { fill: "E8F0FE", type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      children
    })] })]
  });
}

function tableRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map((text, i) => new TableCell({
      borders,
      width: { size: i === 0 ? 3120 : 6240, type: WidthType.DXA },
      shading: isHeader ? { fill: "1F4E79", type: ShadingType.CLEAR } : undefined,
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text, size: 22, bold: isHeader, color: isHeader ? "FFFFFF" : "333333" })] })]
    }))
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Calibri", color: "1F4E79" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Calibri", color: "2E75B6" },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Calibri", color: "404040" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers2", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers3", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers4", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers5", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1273, bottom: 1440, left: 1273 }
      }
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "Sanders Capital \u2014 Technisch Handboek", size: 18, color: "999999", italics: true })]
      })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Pagina ", size: 18, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "999999" })]
      })] })
    },
    children: [
      // TITLE PAGE
      new Paragraph({ spacing: { before: 3000 }, alignment: AlignmentType.CENTER, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
        new TextRun({ text: "Sanders Capital", size: 56, bold: true, color: "1F4E79", font: "Calibri" })
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
        new TextRun({ text: "Technisch Handboek", size: 36, color: "2E75B6" })
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [
        new TextRun({ text: "Van statische website naar moderne webapplicatie", size: 24, color: "666666", italics: true })
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: "2E75B6", space: 10 } }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
        new TextRun({ text: "Datum: maart 2026", size: 22, color: "666666" })
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
        new TextRun({ text: "Versie: 1.0", size: 22, color: "666666" })
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: "Vertrouwelijk \u2014 alleen voor intern gebruik", size: 20, color: "999999", italics: true })
      ]}),

      // PAGE BREAK
      new Paragraph({ children: [new PageBreak()] }),

      // INHOUDSOPGAVE
      heading("Inhoudsopgave"),
      para("1. Wat hebben we gebouwd?"),
      para("2. Hoe werkt het? (simpel uitgelegd)"),
      para("3. De tech stack \u2014 welke tools gebruiken we?"),
      para("4. Stap voor stap: wat hebben we gedaan?"),
      para("5. Hoe werkt het doorzetproces? (van code naar live)"),
      para("6. Beveiliging \u2014 is het veilig?"),
      para("7. Hoe beheer je de website zelf?"),
      para("8. Veelgestelde vragen"),
      para("9. Belangrijke gegevens en links"),

      new Paragraph({ children: [new PageBreak()] }),

      // HOOFDSTUK 1
      heading("1. Wat hebben we gebouwd?"),
      para("We hebben je oude statische website (sanderscapital.nl) omgebouwd naar een moderne webapplicatie. Voorheen was je site een verzameling losse HTML-bestanden \u2014 simpele pagina\u2019s die je handmatig moest aanpassen. Nu is het een volwaardige applicatie met een database, gebruikerssysteem en admin panel."),

      heading("Wat is het verschil?", HeadingLevel.HEADING_2),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 3120, 3120],
        rows: [
          new TableRow({ children: ["", "Oude site", "Nieuwe site"].map((text, i) => new TableCell({
            borders, width: { size: 3120, type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text, size: 22, bold: true, color: "FFFFFF" })] })]
          })) }),
          ...([
            ["Technologie", "Losse HTML bestanden", "Next.js applicatie"],
            ["Content beheer", "Code handmatig aanpassen", "Admin panel in browser"],
            ["Gebruikers", "Geen", "Login/register systeem"],
            ["Database", "Geen", "Supabase (PostgreSQL)"],
            ["Artikelen", "Hardcoded in HTML", "Dynamisch uit database"],
            ["Premium content", "Niet mogelijk", "Ingebouwd met betaalmuur"],
          ]).map(row => new TableRow({
            children: row.map((text, i) => new TableCell({
              borders, width: { size: 3120, type: WidthType.DXA },
              shading: i === 0 ? { fill: "F2F2F2", type: ShadingType.CLEAR } : undefined,
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text, size: 20, bold: i === 0 })] })]
            }))
          }))
        ]
      }),

      para(""),
      heading("Welke pagina\u2019s heeft de site?", HeadingLevel.HEADING_2),
      bullet("Homepage (/) \u2014 hero sectie, stats, drie pijlers, laatste artikelen"),
      bullet("Blog (/blog) \u2014 overzicht van alle artikelen uit de database"),
      bullet("Blog artikel (/blog/[slug]) \u2014 individueel artikel met markdown rendering"),
      bullet("Kennisbank (/kennisbank) \u2014 educatieve content per categorie"),
      bullet("Premium (/premium) \u2014 uitleg over premium membership"),
      bullet("Over (/over) \u2014 over Sanders Capital"),
      bullet("Contact (/contact) \u2014 contactformulier"),
      bullet("Disclaimer (/disclaimer) \u2014 juridische tekst"),
      bullet("Login (/login) \u2014 inlogpagina"),
      bullet("Registreren (/register) \u2014 account aanmaken"),
      bullet("Dashboard (/dashboard) \u2014 persoonlijk dashboard (alleen ingelogd)"),
      bullet("Admin (/admin) \u2014 content beheer (alleen voor admins)"),

      new Paragraph({ children: [new PageBreak()] }),

      // HOOFDSTUK 2
      heading("2. Hoe werkt het? (simpel uitgelegd)"),
      para("Stel je de website voor als een restaurant:"),

      boldPara("De keuken (Supabase) ", "\u2014 hier wordt alles opgeslagen en bereid. Je artikelen, gebruikersgegevens en instellingen zitten hier. Dit is je database."),
      boldPara("De ober (Next.js) ", "\u2014 haalt de juiste gegevens uit de keuken en serveert ze aan de bezoeker in een mooi bord (de webpagina)."),
      boldPara("Het restaurant zelf (Vercel) ", "\u2014 de locatie waar bezoekers binnenkomen. Vercel zorgt dat je website 24/7 bereikbaar is op internet."),
      boldPara("Het adres (sanderscapital.nl) ", "\u2014 je domeinnaam bij Vimexx. Dit is het adres waarmee mensen je restaurant vinden."),
      boldPara("De menukaart (Admin panel) ", "\u2014 hiermee beheer jij wat er geserveerd wordt. Je voegt artikelen toe, wijzigt ze of verwijdert ze."),

      para(""),
      para("Wanneer een bezoeker naar sanderscapital.nl gaat, gebeurt dit:"),
      numberItem("De bezoeker typt sanderscapital.nl in de browser", "numbers"),
      numberItem("Vimexx (DNS) stuurt de bezoeker door naar Vercel", "numbers"),
      numberItem("Vercel start de Next.js applicatie", "numbers"),
      numberItem("Next.js haalt de benodigde data op uit Supabase (artikelen, etc.)", "numbers"),
      numberItem("De pagina wordt samengesteld en naar de bezoeker gestuurd", "numbers"),
      numberItem("De bezoeker ziet de website in zijn browser", "numbers"),
      para("Dit hele proces duurt minder dan 1 seconde."),

      new Paragraph({ children: [new PageBreak()] }),

      // HOOFDSTUK 3
      heading("3. De tech stack \u2014 welke tools gebruiken we?"),
      para("Hieronder een overzicht van alle tools en diensten die de website laten werken:"),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2340, 2340, 4680],
        rows: [
          new TableRow({ children: ["Tool", "Waarvoor", "Uitleg"].map(text => new TableCell({
            borders, width: { size: text === "Uitleg" ? 4680 : 2340, type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text, size: 22, bold: true, color: "FFFFFF" })] })]
          })) }),
          ...([
            ["Next.js", "Frontend + Backend", "Het framework waarmee de website gebouwd is. Maakt snelle, moderne websites."],
            ["TypeScript", "Programmeertaal", "Een veiligere versie van JavaScript. De taal waarin de code geschreven is."],
            ["Tailwind CSS", "Styling", "Zorgt voor het uiterlijk: kleuren, fonts, spacing, responsive design."],
            ["Supabase", "Database + Auth", "Slaat alle data op (artikelen, gebruikers) en regelt het login-systeem."],
            ["Vercel", "Hosting", "Maakt de website bereikbaar op internet. Deployt automatisch bij updates."],
            ["GitHub", "Code opslag", "Hier staat alle code veilig opgeslagen. Vercel leest hieruit."],
            ["Vimexx", "Domein + DNS", "Beheert het domein sanderscapital.nl en stuurt bezoekers naar Vercel."],
          ]).map(row => new TableRow({
            children: row.map((text, i) => new TableCell({
              borders, width: { size: i === 2 ? 4680 : 2340, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })]
            }))
          }))
        ]
      }),

      para(""),
      infoBox("Wat kost dit?", [
        "Supabase: Gratis (Free tier, meer dan genoeg voor jouw gebruik)",
        "Vercel: Gratis (Hobby plan)",
        "GitHub: Gratis",
        "Vimexx: Je bestaande hosting/domein abonnement",
        "Totale extra kosten: \u20AC0 per maand"
      ]),

      new Paragraph({ children: [new PageBreak()] }),

      // HOOFDSTUK 4
      heading("4. Stap voor stap: wat hebben we gedaan?"),

      heading("Stap 1: Project aangemaakt", HeadingLevel.HEADING_2),
      para("Met het commando npx create-next-app hebben we een nieuw Next.js project aangemaakt. Dit maakt automatisch de juiste mappenstructuur en configuratiebestanden aan."),

      heading("Stap 2: Supabase opgezet", HeadingLevel.HEADING_2),
      para("In Supabase hebben we drie tabellen aangemaakt:"),
      bullet("profiles \u2014 gebruikersprofielen (naam, email, rol: free/premium/admin)"),
      bullet("articles \u2014 blogartikelen (titel, inhoud, tag, premium ja/nee)"),
      bullet("kennisbank_items \u2014 kennisbank content per categorie"),
      para("Ook hebben we Row Level Security (RLS) ingesteld. Dit zijn regels die bepalen wie wat mag zien:"),
      bullet("Iedereen kan gratis artikelen lezen"),
      bullet("Alleen premium/admin gebruikers kunnen premium artikelen lezen"),
      bullet("Alleen admins kunnen artikelen aanmaken/bewerken/verwijderen"),

      heading("Stap 3: Design gebouwd", HeadingLevel.HEADING_2),
      para("Het bestaande design is exact overgenomen:"),
      bullet("Donker thema met specifieke kleuren (#0a0c10 achtergrond, #3d6ea5 accent blauw)"),
      bullet("Cormorant Garamond font voor titels, DM Sans voor body tekst"),
      bullet("Responsive design (werkt op desktop, tablet en mobiel)"),
      bullet("Fade-in animaties bij scrollen"),
      bullet("Scroll progress indicator (blauwe lijn bovenaan)"),

      heading("Stap 4: Alle pagina\u2019s gebouwd", HeadingLevel.HEADING_2),
      para("12 pagina\u2019s zijn gebouwd met Next.js App Router. Elke pagina is een apart bestand in de src/app/ map."),

      heading("Stap 5: Authenticatie", HeadingLevel.HEADING_2),
      para("Login en registratie werken via Supabase Auth. Bij registratie wordt automatisch een profiel aangemaakt via een database trigger. Beschermde routes (/dashboard, /admin) sturen niet-ingelogde gebruikers naar de loginpagina."),

      heading("Stap 6: Naar GitHub gepusht", HeadingLevel.HEADING_2),
      para("Alle code is naar GitHub geupload (github.com/dennissanderss/sanders-capital-v2). Dit is de centrale plek waar alle code staat."),

      heading("Stap 7: Vercel deployment", HeadingLevel.HEADING_2),
      para("Het GitHub project is gekoppeld aan Vercel. Environment variables (database keys) zijn ingesteld. Bij elke push naar GitHub deployt Vercel automatisch de nieuwste versie."),

      heading("Stap 8: Domein gekoppeld", HeadingLevel.HEADING_2),
      para("In Vercel is sanderscapital.nl toegevoegd als custom domein. In Vimexx zijn de DNS records aangepast zodat het domein naar Vercel wijst."),

      new Paragraph({ children: [new PageBreak()] }),

      // HOOFDSTUK 5
      heading("5. Hoe werkt het doorzetproces?"),
      para("Dit is het proces waarmee wijzigingen live komen op je website:"),

      para(""),
      infoBox("Het deployment proces in 4 stappen", [
        "1. Code wordt aangepast (door jou of door Claude)",
        "2. De wijziging wordt naar GitHub gepusht (git push)",
        "3. Vercel detecteert de push en start automatisch een build",
        "4. Na ~30 seconden staat de wijziging live op sanderscapital.nl"
      ]),

      para(""),
      heading("Hoe kan Claude automatisch aan je website werken?", HeadingLevel.HEADING_2),
      para("Claude (de AI assistent) heeft toegang tot de bestanden op je computer via Claude Code. Het proces werkt zo:"),
      numberItem("Jij vraagt Claude om iets aan te passen (bijv. \u201Cvoeg een tag toe\u201D)", "numbers2"),
      numberItem("Claude past het juiste bestand aan op je computer", "numbers2"),
      numberItem("Claude voert git add + git commit + git push uit", "numbers2"),
      numberItem("GitHub ontvangt de code", "numbers2"),
      numberItem("Vercel ziet de update en deployt automatisch", "numbers2"),
      numberItem("Binnen 30 seconden staat het live", "numbers2"),

      para(""),
      heading("Kan dat ook zonder Claude?", HeadingLevel.HEADING_2),
      para("Ja! Je kunt ook zelf wijzigingen maken:"),
      bullet("Direct op GitHub: open een bestand, klik edit, sla op \u2192 Vercel deployt"),
      bullet("Lokaal: pas bestanden aan in de sanders-capital-v2 map, dan git push"),
      bullet("Content (artikelen): via het Admin panel op je website, zonder code aan te raken"),

      new Paragraph({ children: [new PageBreak()] }),

      // HOOFDSTUK 6
      heading("6. Beveiliging \u2014 is het veilig?"),

      heading("Wat staat er op GitHub?", HeadingLevel.HEADING_2),
      para("Op GitHub staat alleen de broncode van je website: de HTML-structuur, styling en logica. Dit is vergelijkbaar met de bouwtekening van een huis \u2014 niet de sleutels."),

      heading("Wat staat er NIET op GitHub?", HeadingLevel.HEADING_2),
      bullet("Geen wachtwoorden"),
      bullet("Geen database keys (staan in .env.local, geblokkeerd door .gitignore)"),
      bullet("Geen persoonlijke gegevens van gebruikers"),
      bullet("Geen betalingsgegevens"),

      heading("De drie keys uitgelegd", HeadingLevel.HEADING_2),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 3120, 3120],
        rows: [
          new TableRow({ children: ["Key", "Wat doet het", "Risico"].map(text => new TableCell({
            borders, width: { size: 3120, type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text, size: 22, bold: true, color: "FFFFFF" })] })]
          })) }),
          ...([
            ["SUPABASE_URL", "Adres van je database", "Publiek \u2014 geen risico"],
            ["ANON_KEY", "Publieke sleutel voor lees-toegang", "Publiek \u2014 beschermd door RLS policies"],
            ["SERVICE_ROLE_KEY", "Admin sleutel voor server-operaties", "Geheim \u2014 staat NIET op GitHub"],
          ]).map(row => new TableRow({
            children: row.map((text, i) => new TableCell({
              borders, width: { size: 3120, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })]
            }))
          }))
        ]
      }),

      para(""),
      heading("Is het gevaarlijk dat Claude code doorzet?", HeadingLevel.HEADING_2),
      para("Nee, om deze redenen:"),
      bullet("Claude past alleen bestanden aan die jij goedkeurt"),
      bullet("Elke wijziging staat op GitHub \u2014 je kunt alles terugdraaien"),
      bullet("Claude heeft geen toegang tot je Supabase wachtwoord of Vercel account"),
      bullet("De geheime SERVICE_ROLE_KEY is nooit naar GitHub gepusht"),
      bullet("Je kunt op elk moment zelf de code controleren op GitHub"),

      heading("Wat als er iets misgaat?", HeadingLevel.HEADING_2),
      para("Elke wijziging wordt opgeslagen als een \u201Ccommit\u201D in GitHub. Dit is als een save-point in een game. Je kunt altijd terug naar een eerdere versie. Vercel houdt ook alle eerdere deployments bij \u2014 je kunt met \u00E9\u00E9n klik terug naar een werkende versie."),

      new Paragraph({ children: [new PageBreak()] }),

      // HOOFDSTUK 7
      heading("7. Hoe beheer je de website zelf?"),

      heading("Artikelen beheren", HeadingLevel.HEADING_2),
      numberItem("Ga naar sanderscapital.nl/admin", "numbers3"),
      numberItem("Log in met je admin account", "numbers3"),
      numberItem("Klik op \u201CNieuw artikel\u201D", "numbers3"),
      numberItem("Vul in: titel, tag, excerpt (korte samenvatting), content (in Markdown)", "numbers3"),
      numberItem("Vink \u201CGepubliceerd\u201D aan als het live mag", "numbers3"),
      numberItem("Klik \u201COpslaan\u201D", "numbers3"),
      para("Het artikel verschijnt direct op de blog pagina."),

      heading("Markdown basis", HeadingLevel.HEADING_2),
      para("De content van artikelen schrijf je in Markdown. Dit is een simpele opmaaktaal:"),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4680, 4680],
        rows: [
          new TableRow({ children: ["Wat je typt", "Wat je ziet"].map(text => new TableCell({
            borders, width: { size: 4680, type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text, size: 22, bold: true, color: "FFFFFF" })] })]
          })) }),
          ...([
            ["## Titel", "Grote kop"],
            ["### Subtitel", "Kleinere kop"],
            ["**dikke tekst**", "dikke tekst"],
            ["*schuine tekst*", "schuine tekst"],
            ["- punt 1\\n- punt 2", "Opsomming met bolletjes"],
            ["[link tekst](url)", "Klikbare link"],
          ]).map(row => new TableRow({
            children: row.map((text, i) => new TableCell({
              borders, width: { size: 4680, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: i === 0 ? "Consolas" : "Calibri" })] })]
            }))
          }))
        ]
      }),

      para(""),
      heading("Tags aanpassen", HeadingLevel.HEADING_2),
      para("De tag-opties in het admin panel staan in het codebestand src/app/admin/page.tsx op regel 30. Je kunt ze aanpassen via GitHub of via Claude."),

      heading("Gebruiker admin maken", HeadingLevel.HEADING_2),
      para("Om een gebruiker admin te maken, voer je dit uit in Supabase SQL Editor:"),
      para("UPDATE public.profiles SET role = 'admin' WHERE email = 'het@emailadres.com';", { run: { font: "Consolas", size: 20 } }),

      heading("Premium content", HeadingLevel.HEADING_2),
      para("Bij het aanmaken van een artikel kun je het vinkje \u201CPremium\u201D aanzetten. Niet-premium gebruikers zien dan alleen de eerste 2 paragrafen met een blur overlay en een \u201CUpgrade naar Premium\u201D knop."),

      new Paragraph({ children: [new PageBreak()] }),

      // HOOFDSTUK 8
      heading("8. Veelgestelde vragen"),

      boldPara("Kan iemand mijn website hacken via GitHub?", ""),
      para("Nee. GitHub bevat alleen de broncode, niet je geheime sleutels. Zelfs als iemand de code ziet, kunnen ze niets aanpassen aan je live site. Alleen jij (en Claude via jouw computer) kunnen naar GitHub pushen."),
      para(""),

      boldPara("Wat als Supabase of Vercel stopt?", ""),
      para("Je code staat op GitHub en op je eigen computer. Je kunt de site verhuizen naar een andere hosting provider. De database kun je exporteren vanuit Supabase."),
      para(""),

      boldPara("Hoeveel bezoekers kan de site aan?", ""),
      para("Op het gratis Vercel plan: tot ~100.000 bezoekers per maand. Supabase free tier: tot 500MB database en 50.000 requests per maand. Meer dan genoeg voor de komende tijd."),
      para(""),

      boldPara("Hoe update ik de website?", ""),
      para("Drie manieren: (1) Vraag het aan Claude in deze chat, (2) bewerk bestanden direct op GitHub, (3) gebruik het Admin panel voor content."),
      para(""),

      boldPara("Moet ik iets technisch weten?", ""),
      para("Voor dagelijks beheer (artikelen schrijven) niet \u2014 dat doe je via het Admin panel. Voor grotere wijzigingen kun je Claude vragen."),
      para(""),

      boldPara("Wat kost het als de site groeit?", ""),
      para("Zolang je onder de gratis limieten blijft: niets. Als je site echt groot wordt, zijn de betaalde plannen: Vercel Pro (~\u20AC20/mnd), Supabase Pro (~\u20AC25/mnd). Maar dat is pas nodig bij duizenden dagelijkse bezoekers."),

      new Paragraph({ children: [new PageBreak()] }),

      // HOOFDSTUK 9
      heading("9. Belangrijke gegevens en links"),

      infoBox("Accounts en toegang", [
        "GitHub: github.com/dennissanderss/sanders-capital-v2",
        "Vercel: vercel.com (project: sanderscapitalofficial)",
        "Supabase: supabase.com (project dashboard)",
        "Vimexx: DNS beheer voor sanderscapital.nl",
        "Website: sanderscapital.nl",
        "Admin panel: sanderscapital.nl/admin",
      ]),

      para(""),
      heading("Mappenstructuur", HeadingLevel.HEADING_2),
      para("De belangrijkste bestanden in het project:", { spacing: { after: 80 } }),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4680, 4680],
        rows: [
          new TableRow({ children: ["Bestand/map", "Wat het doet"].map(text => new TableCell({
            borders, width: { size: 4680, type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text, size: 22, bold: true, color: "FFFFFF" })] })]
          })) }),
          ...([
            ["src/app/page.tsx", "Homepage"],
            ["src/app/blog/page.tsx", "Blog overzichtspagina"],
            ["src/app/admin/page.tsx", "Admin panel"],
            ["src/app/globals.css", "Alle kleuren en styling"],
            ["src/components/Header.tsx", "De navigatiebalk bovenaan"],
            ["src/components/Footer.tsx", "De footer onderaan"],
            ["src/lib/supabase.ts", "Database verbinding"],
            [".env.local", "Geheime keys (NIET op GitHub)"],
            ["public/assets/images/", "Logo en afbeeldingen"],
          ]).map(row => new TableRow({
            children: row.map((text, i) => new TableCell({
              borders, width: { size: 4680, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: i === 0 ? "Consolas" : "Calibri" })] })]
            }))
          }))
        ]
      }),

      para(""),
      para(""),
      new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 2, color: "2E75B6", space: 10 } }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [
        new TextRun({ text: "Dit document is opgesteld in maart 2026.", size: 20, color: "999999", italics: true })
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: "Bij vragen: open een chat met Claude Code of neem contact op via sanderscapital@hotmail.com", size: 20, color: "999999", italics: true })
      ]}),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:/Users/denni/Documents/Claude/Website/Sanders Capital - Technisch Handboek.docx", buffer);
  console.log("Handboek aangemaakt!");
});
