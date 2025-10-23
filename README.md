# 🤖 KI-forordningen i skolen

**Interaktiv veileder for lærere, skoleledere og IKT-ansvarlige**

En praktisk og pedagogisk verktøy for å forstå og etterleve EU AI Act (KI-forordningen) i norsk skolekontekst.

## 🎯 Formål

Hjelpe skoleansatte med å:
- Forstå de fire risikonivåene i AI Act
- Vurdere egne KI-verktøy mot regelverket
- Få konkrete handlingsplaner basert på risikovurdering
- Dokumentere compliance-arbeid

## ✨ Funksjoner

### ✅ Implementert
- **Interaktiv veiviser** med 42 spørsmål som dekker:
  - Type KI-verktøy
  - Personvern og databehandling
  - Transparens og informasjonsplikt
  - Vurdering og karaktersetting
  - Likeverd og diskriminering
  - Menneskelig kontroll
- **Progress indicator** - se hvor langt du er kommet
- **Tilbake-knapp** - korriger svar underveis
- **Hjelpetekster** - kontekstuell veiledning
- **Nedlasting av vurdering** - dokumenter resultatene
- **Responsive design** - fungerer på mobil og desktop
- **Tilgjengelighet** - ARIA-labels, keyboard-navigasjon

### 📋 Kommende funksjoner
- Utvidet innhold om risikonivåene
- Case-eksempler fra skolevirkeligheten
- Labs-seksjon med eksperimentell funksjonalitet
- Eksport til PDF

## 🚀 Kom i gang

### Lokal utvikling
```bash
# Klon repository
git clone https://github.com/barx10/ki_forordninga.git
cd ki_forordninga

# Start lokal webserver (Python 3)
python -m http.server 8000

# Åpne i nettleser
# http://localhost:8000
```

### Deployment
Siden er statisk HTML/CSS/JavaScript og kan hostes hvor som helst:
- GitHub Pages
- Netlify
- Vercel
- Apache/Nginx

## 📁 Struktur

```
ki_forordninga/
├── index.html       # Hovedside
├── style.css        # All styling
├── script.js        # Veiviser-logikk
├── flow.json        # Spørsmål og resultater (42 steg)
└── README.md        # Denne filen
```

## 🎨 Design

- **Fargepalett**: Mørk modus med accent-farger for risikonivå
- **Typografi**: System fonts for optimal lesbarhet
- **Tilgjengelighet**: WCAG 2.1 AA-standard
- **Responsivt**: Mobile-first design

## 🔒 Personvern

- ✅ Ingen innlogging kreves
- ✅ Ingen data sendes til server
- ✅ Ingen cookies eller tracking
- ✅ Alt kjører lokalt i nettleseren
- ✅ Open source - kan selvhostes

## 📚 Juridisk grunnlag

Verktøyet bygger på:
- **EU AI Act** (Artificial Intelligence Act)
- **GDPR** (General Data Protection Regulation)
- **Opplæringsloven**
- **Personopplysningsloven**

## 🤝 Bidra

Bidrag er velkomne! Spesielt:
- Flere case-eksempler fra skolen
- Forbedringer i spørsmålslogikk
- Oversettelser
- Dokumentasjon
- Bug-rapporter

## 📄 Lisens

**CC BY-SA** (Creative Commons Attribution-ShareAlike)

Du kan fritt:
- Dele og distribuere
- Tilpasse og bygge videre
- Bruke kommersielt

Med vilkår:
- Kreditér opphavspersonen
- Del modifikasjoner under samme lisens

## 📞 Kontakt

- **Repository**: github.com/barx10/ki_forordninga
- **Issues**: github.com/barx10/ki_forordninga/issues

## 🙏 Anerkjennelser

Basert på:
- EU AI Act dokumentasjon
- Datatilsynets veiledere
- AI-Act-Compliance-Checker (Kenneth)
- Tilbakemeldinger fra norske skoler

## 📌 Versjon

**v0.2** - Oktober 2025

### Changelog
- v0.2: 42 spørsmål, progress bar, tilbake-knapp, forbedret nedlasting
- v0.1: Grunnleggende struktur med 2 spørsmål