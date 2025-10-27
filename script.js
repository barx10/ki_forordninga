// Dynamisk veiviser basert på flow.json

// === THEME TOGGLE ===
const initThemeToggle = () => {
  const themeToggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  
  // Hent lagret tema eller bruk system preferanse
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
  
  // Sett initial tema
  root.setAttribute('data-theme', initialTheme);
  updateThemeButton(initialTheme);
  
  // Toggle tema ved klikk
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = root.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      root.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeButton(newTheme);
    });
  }
  
  function updateThemeButton(theme) {
    const label = theme === 'dark' ? 'Bytt til lys modus' : 'Bytt til mørk modus';
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', label);
    }
  }
};

// === VIEW ROUTER ===
const initRouter = () => {
  const views = ['hjem', 'laer', 'sjekk', 'tiltak', 'ressurser', 'om'];
  const transition = document.getElementById('page-transition');
  
  const showView = (viewId) => {
    // Trigger transition overlay
    if (transition) {
      transition.classList.add('active');
    }
    
    // Wait for overlay to fade in (kortere tid for mindre flimring)
    setTimeout(() => {
      // Fjern active fra alle views
      document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
      });
      
      // Aktiver valgt view
      const targetView = document.getElementById(viewId);
      if (targetView) {
        targetView.classList.add('active');
        // Scroll til toppen
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
      
      // Oppdater nav active state
      document.querySelectorAll('nav a').forEach(link => {
        link.removeAttribute('aria-current');
        if (link.getAttribute('href') === `#${viewId}`) {
          link.setAttribute('aria-current', 'page');
        }
      });
      
      // Fade out transition overlay
      setTimeout(() => {
        if (transition) {
          transition.classList.remove('active');
        }
      }, 30);
      
    }, 80); // Raskere timing for mindre flimring
  };
  
  const handleRoute = () => {
    let hash = window.location.hash.slice(1) || 'hjem';
    
    // Fallback til hjem hvis ukjent route
    if (!views.includes(hash)) {
      hash = 'hjem';
      window.location.hash = '#hjem';
    }
    
    showView(hash);
  };
  
  // Lytt til hash-endringer
  window.addEventListener('hashchange', handleRoute);
  
  // Initial route
  handleRoute();
  
  // Oppdater nav links for å bruke hash routing
  document.querySelectorAll('nav a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetHash = link.getAttribute('href');
      window.location.hash = targetHash;
    });
  });
};

// === QUIZ LOGIC ===
document.addEventListener('DOMContentLoaded', () => {
  // Start theme toggle
  initThemeToggle();
  
  // Start router
  initRouter();
  
  // Start quiz hvis vi er på sjekk-siden
  const quiz = document.getElementById('quiz');
  if (!quiz) return;

  let flow = null;
  let history = []; // For tilbake-funksjonalitet

  const loadFlow = async () => {
    try {
      const res = await fetch('flow.json');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      flow = await res.json();
      
      // Valider flow.json struktur
      const validationErrors = validateFlow(flow);
      if (validationErrors.length > 0) {
        console.error('Valideringsfeil i flow.json:', validationErrors);
        quiz.innerHTML = `
          <div class="card" style="border-left: 5px solid var(--stop)">
            <h3>⚠️ Konfigurasjonsfeil</h3>
            <p>Det er feil i spørsmålskonfigurasjonen som må rettes:</p>
            <ul style="margin: 16px 0; padding-left: 20px;">
              ${validationErrors.map(err => `<li style="margin: 8px 0;">${err}</li>`).join('')}
            </ul>
            <p class="note">Ta kontakt med administrator.</p>
          </div>
        `;
        return;
      }
      
      // Sjekk om det finnes lagret historikk
      const savedHistory = sessionStorage.getItem('ki_history');
      if (savedHistory) {
        try {
          const parsed = JSON.parse(savedHistory);
          if (parsed.length > 0) {
            // Tilby å fortsette
            quiz.innerHTML = `
              <div class="card">
                <h3>💾 Fortsette der du slapp?</h3>
                <p>Vi fant en lagret økt med ${parsed.length} besvarte spørsmål.</p>
                <div style="display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap;">
                  <button class="cta" onclick="document.dispatchEvent(new CustomEvent('restoreHistory'))">
                    ↩️ Fortsett
                  </button>
                  <button class="cta-secondary" onclick="document.dispatchEvent(new CustomEvent('startFresh'))">
                    🔄 Start på nytt
                  </button>
                </div>
              </div>
            `;
            
            // Event listeners for valg
            document.addEventListener('restoreHistory', () => {
              history = parsed;
              const lastStepId = history[history.length - 1];
              const lastStep = flow.steps.find(s => s.id === lastStepId);
              if (lastStep) {
                renderStep(lastStep);
              } else {
                startFresh();
              }
            }, { once: true });
            
            document.addEventListener('startFresh', startFresh, { once: true });
            return;
          }
        } catch (e) {
          console.warn('Kunne ikke parse lagret historikk:', e);
        }
      }
      
      // Start normalt
      startFresh();
      
    } catch (error) {
      console.error('Kunne ikke laste flow.json:', error);
      quiz.innerHTML = `
        <div class="card" style="border-left: 5px solid var(--stop)">
          <h3>⚠️ Kunne ikke laste veiviseren</h3>
          <p>Det oppstod en feil ved lasting av spørsmålsflyten.</p>
          <p class="note">Feil: ${error.message}</p>
          <button class="cta" onclick="location.reload()">Prøv igjen</button>
        </div>
      `;
    }
  };
  
  const startFresh = () => {
    history = [];
    sessionStorage.removeItem('ki_history');
    renderStep(flow.steps[0]);
  };
  
  const validateFlow = (flow) => {
    const errors = [];
    
    if (!flow.steps || !Array.isArray(flow.steps)) {
      errors.push('Mangler "steps" array');
      return errors;
    }
    
    if (!flow.results || typeof flow.results !== 'object') {
      errors.push('Mangler "results" objekt');
      return errors;
    }
    
    const stepIds = new Set(flow.steps.map(s => s.id));
    const resultKeys = new Set(Object.keys(flow.results));
    
    flow.steps.forEach(step => {
      if (!step.id) {
        errors.push(`Steg mangler ID`);
        return;
      }
      
      if (!step.question) {
        errors.push(`Steg ${step.id}: Mangler spørsmål`);
      }
      
      if (!step.options || !Array.isArray(step.options)) {
        errors.push(`Steg ${step.id}: Mangler alternativer`);
        return;
      }
      
      step.options.forEach((opt, idx) => {
        if (!opt.text) {
          errors.push(`Steg ${step.id}, alternativ ${idx + 1}: Mangler tekst`);
        }
        
        if (opt.next && !stepIds.has(opt.next)) {
          errors.push(`Steg ${step.id}: Refererer til ikke-eksisterende steg ${opt.next}`);
        }
        
        if (opt.result && !resultKeys.has(opt.result)) {
          errors.push(`Steg ${step.id}: Refererer til ikke-eksisterende resultat "${opt.result}"`);
        }
        
        if (!opt.next && !opt.result) {
          errors.push(`Steg ${step.id}, alternativ ${idx + 1}: Mangler både "next" og "result"`);
        }
      });
    });
    
    return errors;
  };

  const calculateProgress = () => {
    // Basert på faktisk antall spørsmål i historikk
    // Estimert maks antall spørsmål i en typisk sti er ca 12-15
    const estimatedMaxSteps = 15;
    const current = history.length;
    // Cap på 95% inntil vi når resultat for å unngå 100% før ferdig
    const percent = Math.min(Math.round((current / estimatedMaxSteps) * 100), 95);
    return { current, percent };
  };

  const renderStep = (step) => {
    // Feilhåndtering: Sjekk om step eksisterer
    if (!step) {
      quiz.innerHTML = `
        <div class="card" style="border-left: 5px solid var(--stop); padding: 24px;">
          <h3>⚠️ Feil i veiviseren</h3>
          <p>Det oppstod en feil – spørsmålet ble ikke funnet. Dette kan skyldes en konfigurasjonsfeil.</p>
          <p class="note">Teknisk detalj: Manglende steg i flow.json</p>
          <button class="cta" onclick="location.reload()" style="margin-top: 16px;">🔄 Start på nytt</button>
        </div>
      `;
      console.error('renderStep fikk undefined/null step. History:', history);
      return;
    }

    // Legg til i historikk
    history.push(step.id);
    
    // Lagre historikk i sessionStorage
    try {
      sessionStorage.setItem('ki_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Kunne ikke lagre historikk:', e);
    }

    const progress = calculateProgress();
    
    quiz.innerHTML = `
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress.percent}%"></div>
        </div>
        <p class="note" style="text-align: center; margin: 8px 0;">Spørsmål ${history.length}</p>
      </div>
      <h3>${step.question}</h3>
      ${step.help ? `<p class="help-text">💡 ${step.help}</p>` : ''}
      <div class="options-container"></div>
      <div class="nav-buttons"></div>
    `;

    const optionsContainer = quiz.querySelector('.options-container');
    step.options.forEach(o => {
      const b = document.createElement('button');
      b.className = 'cta';
      b.style.margin = '6px';
      b.textContent = o.text;
      b.onclick = () => {
        if (o.next) {
          const next = flow.steps.find(s => s.id === o.next);
          if (!next) {
            console.error(`Steg ${o.next} ikke funnet`);
            quiz.innerHTML = `
              <div class="card" style="border-left: 5px solid var(--stop)">
                <h3>⚠️ Navigasjonsfeil</h3>
                <p>Kunne ikke finne neste spørsmål (ID: ${o.next}).</p>
                <button class="cta" onclick="location.reload()">Start på nytt</button>
              </div>
            `;
            return;
          }
          renderStep(next);
        } else if (o.result) {
          showResult(o.result);
        }
      };
      optionsContainer.appendChild(b);
    });

    // Tilbake-knapp
    const navButtons = quiz.querySelector('.nav-buttons');
    if (history.length > 1) {
      const backBtn = document.createElement('button');
      backBtn.className = 'cta-secondary';
      backBtn.textContent = '← Tilbake';
      backBtn.style.marginTop = '16px';
      backBtn.onclick = () => goBack();
      navButtons.appendChild(backBtn);
    }
  };

  const goBack = () => {
    if (history.length > 1) {
      history.pop(); // Fjern nåværende
      const previousStepId = history.pop(); // Fjern og hent forrige
      const previousStep = flow.steps.find(s => s.id === previousStepId);
      if (previousStep) {
        renderStep(previousStep);
      }
    }
  };

  const showResult = (key) => {
    const r = flow.results[key];
    
    if (!r) {
      quiz.innerHTML = `
        <div class="card" style="border-left: 5px solid var(--stop)">
          <h3>⚠️ Resultat ikke funnet</h3>
          <p>Resultatnøkkel "${key}" eksisterer ikke i konfigurasjonen.</p>
          <button class="cta" onclick="location.reload()">Start på nytt</button>
        </div>
      `;
      console.error(`Resultat "${key}" ikke funnet i flow.results`);
      return;
    }
    
    // Rens sessionStorage når resultat vises
    sessionStorage.removeItem('ki_history');
    
    // Bygg resultat-HTML
    let resultHTML = `
      <div class="result-card ${r.class}">
        <h3>${r.title}</h3>
        <div class="result-text">${r.text.replace(/\n/g, '<br>')}</div>
    `;

    // Legg til handlinger hvis de finnes
    if (r.actions && r.actions.length > 0) {
      resultHTML += `
        <div class="actions-list">
          <h4>📋 Neste steg:</h4>
          <ul>
            ${r.actions.map(action => `<li>${action}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Legg til artikkelreferanser hvis de finnes
    if (r.articles && r.articles.length > 0) {
      console.log('Viser artikler:', r.articles); // DEBUG
      resultHTML += `
        <div class="articles-list">
          <h4>⚖️ Juridisk grunnlag (AI Act):</h4>
          <div class="articles-grid">
            ${r.articles.map(article => `
              <div class="article-card">
                <div class="article-number">${article.number}</div>
                <div class="article-content">
                  <strong>${article.title}</strong>
                  <p>${article.description}</p>
                  <a href="${article.url}" target="_blank" rel="noopener" class="article-link">
                    Les mer →
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      console.log('Ingen artikler funnet for:', r.title); // DEBUG
    }

    // Legg til GDPR referanser hvis de finnes
    if (r.gdpr && r.gdpr.length > 0) {
      resultHTML += `
        <div class="gdpr-list">
          <h4>🔒 GDPR/Personvern:</h4>
          <ul class="compact-list">
            ${r.gdpr.map(gdpr => `<li>${gdpr}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Legg til andre lover hvis de finnes
    if (r.other_laws && r.other_laws.length > 0) {
      resultHTML += `
        <div class="other-laws-list">
          <h4>📚 Annet lovverk:</h4>
          <ul class="compact-list">
            ${r.other_laws.map(law => `<li>${law}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    resultHTML += `</div>`;
    quiz.innerHTML = resultHTML;

    // Knapper
    const btnContainer = document.createElement('div');
    btnContainer.style.marginTop = '16px';
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';
    btnContainer.style.flexWrap = 'wrap';

    const dl = document.createElement('button');
    dl.className = 'cta';
    dl.textContent = '📥 Last ned vurdering';
    dl.onclick = () => downloadResult(r);
    btnContainer.appendChild(dl);

    const reset = document.createElement('button');
    reset.className = 'cta-secondary';
    reset.textContent = '🔄 Start på nytt';
    reset.onclick = () => loadFlow();
    btnContainer.appendChild(reset);

    quiz.appendChild(btnContainer);
  };

  const downloadResult = (result) => {
    const timestamp = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('nb-NO');
    
    let content = `
╔════════════════════════════════════════════════════════════╗
║     KI-FORORDNINGEN I SKOLEN - RISIKOVURDERING            ║
╚════════════════════════════════════════════════════════════╝

Dato: ${timestamp} ${time}

${result.title}
${'='.repeat(result.title.length)}

${result.text}
`;

    if (result.actions && result.actions.length > 0) {
      content += `

ANBEFALTE HANDLINGER:
─────────────────────
`;
      result.actions.forEach((action, i) => {
        content += `${i + 1}. ${action}\n`;
      });
    }

    // Legg til AI Act artikler
    if (result.articles && result.articles.length > 0) {
      content += `

═══════════════════════════════════════════════════════════

JURIDISK GRUNNLAG - EU AI ACT:
───────────────────────────────
`;
      result.articles.forEach((article, i) => {
        content += `
${article.number}: ${article.title}
${article.description}
URL: ${article.url}
`;
      });
    }

    // Legg til GDPR referanser
    if (result.gdpr && result.gdpr.length > 0) {
      content += `

GDPR/PERSONVERNLOVGIVNING:
──────────────────────────
`;
      result.gdpr.forEach((gdpr, i) => {
        content += `• ${gdpr}\n`;
      });
    }

    // Legg til annet lovverk
    if (result.other_laws && result.other_laws.length > 0) {
      content += `

ANNET RELEVANT LOVVERK:
───────────────────────
`;
      result.other_laws.forEach((law, i) => {
        content += `• ${law}\n`;
      });
    }

    content += `

═══════════════════════════════════════════════════════════

RESSURSER:
- EU AI Act (offisiell tekst): https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689
- AI Act oversikt: https://artificialintelligenceact.eu/
- Datatilsynet (GDPR): https://www.datatilsynet.no/
- Datatilsynet (KI): https://www.datatilsynet.no/regelverk-og-verktoy/kunstig-intelligens-og-personvern/
- GDPR guide: https://gdpr.eu/
- Personopplysningsloven: https://lovdata.no/dokument/NL/lov/2018-06-15-38
- Opplæringsloven: https://lovdata.no/dokument/NL/lov/1998-07-17-61
- Utdanningsdirektoratet (KI): https://www.udir.no/laring-og-trivsel/rammeverk/kompetansepakke-for-kunstig-intelligens-i-skolen/

═══════════════════════════════════════════════════════════

Denne vurderingen er generert av: KI-forordningen i skolen
Versjon: 0.4 | Lisens: CC BY-SA  
Repository: github.com/barx10/ki_forordninga

VIKTIG: Dette er en veiledende vurdering. Konsulter alltid
med personvernombud, DPO og skolens ledelse før implementering
av KI-systemer.
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ki-risikovurdering-${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  loadFlow();
});

// === ACCORDION FUNCTIONALITY ===
document.addEventListener('DOMContentLoaded', () => {
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const expanded = header.getAttribute('aria-expanded') === 'true';
      
      // Close all other accordions (optional - remove if you want multiple open)
      accordionHeaders.forEach(otherHeader => {
        if (otherHeader !== header) {
          otherHeader.setAttribute('aria-expanded', 'false');
        }
      });
      
      // Toggle current accordion
      header.setAttribute('aria-expanded', !expanded);
    });
  });
  
  // Update timeline based on current date
  updateTimeline();
});

// === UPDATE TIMELINE ===
function updateTimeline() {
  const timeline = document.getElementById('ai-timeline');
  if (!timeline) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate date comparison
  
  const timelineItems = timeline.querySelectorAll('.timeline-item[data-date]');
  
  timelineItems.forEach(item => {
    const dateStr = item.getAttribute('data-date');
    const milestoneDate = new Date(dateStr);
    
    // If milestone date has passed, mark as complete
    if (milestoneDate <= today) {
      item.classList.add('complete');
    } else {
      item.classList.remove('complete');
    }
  });
}

// === DOWNLOAD TILTAKSPLAN ===
function printTiltaksplan() {
  // Create a print-friendly version
  const printWindow = window.open('', '_blank');
  const timestamp = new Date().toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const content = `
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <title>KI-forordningen: Tiltaksplan</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: white;
      font-size: 11pt;
    }
    
    .cover {
      text-align: center;
      padding: 4cm 2cm;
      page-break-after: always;
      border: 3px solid #2563eb;
      margin: 1cm 0;
    }
    
    .cover h1 {
      font-size: 32pt;
      color: #2563eb;
      margin-bottom: 1cm;
      font-weight: 700;
    }
    
    .cover h2 {
      font-size: 18pt;
      color: #64748b;
      margin-bottom: 2cm;
      font-weight: 400;
    }
    
    .cover .meta {
      font-size: 12pt;
      color: #64748b;
      margin-top: 2cm;
    }
    
    h2 {
      color: #2563eb;
      font-size: 16pt;
      margin-top: 1.5cm;
      margin-bottom: 0.5cm;
      padding-bottom: 0.3cm;
      border-bottom: 2px solid #2563eb;
      page-break-after: avoid;
    }
    
    h3 {
      color: #1e40af;
      font-size: 13pt;
      margin-top: 1cm;
      margin-bottom: 0.3cm;
      page-break-after: avoid;
    }
    
    p {
      margin-bottom: 0.5cm;
      text-align: justify;
    }
    
    .intro {
      background: #eff6ff;
      padding: 0.8cm;
      border-left: 4px solid #2563eb;
      margin: 1cm 0;
      page-break-inside: avoid;
    }
    
    .phase {
      margin-bottom: 1.5cm;
      page-break-inside: avoid;
    }
    
    .phase-header {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
      padding: 0.5cm;
      margin-bottom: 0.5cm;
      border-radius: 4px;
    }
    
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #2563eb;
      padding: 0.6cm;
      margin-bottom: 0.8cm;
      page-break-inside: avoid;
    }
    
    .card h4 {
      color: #1e40af;
      font-size: 12pt;
      margin-bottom: 0.3cm;
    }
    
    ul {
      margin-left: 1cm;
      margin-bottom: 0.5cm;
    }
    
    li {
      margin-bottom: 0.2cm;
      list-style-type: none;
      position: relative;
      padding-left: 0.5cm;
    }
    
    li:before {
      content: "▸";
      color: #2563eb;
      font-weight: bold;
      position: absolute;
      left: 0;
    }
    
    .checklist li:before {
      content: "☐";
      color: #2563eb;
    }
    
    .responsibility {
      background: #fef3c7;
      border-left: 3px solid #f59e0b;
      padding: 0.3cm;
      margin-top: 0.3cm;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    
    .alert {
      background: #fee2e2;
      border-left: 4px solid #ef4444;
      padding: 0.5cm;
      margin: 0.5cm 0;
      page-break-inside: avoid;
    }
    
    .resources {
      background: #f0fdf4;
      border: 1px solid #86efac;
      padding: 0.5cm;
      margin: 0.5cm 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    
    .resources h4 {
      color: #16a34a;
      margin-bottom: 0.3cm;
    }
    
    .timeline {
      margin: 1cm 0;
    }
    
    .timeline-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 0.5cm;
      page-break-inside: avoid;
    }
    
    .timeline-dot {
      width: 0.4cm;
      height: 0.4cm;
      border-radius: 50%;
      margin-right: 0.5cm;
      margin-top: 0.2cm;
      flex-shrink: 0;
    }
    
    .timeline-dot.complete {
      background: #22c55e;
    }
    
    .timeline-dot.pending {
      background: #3b82f6;
    }
    
    .footer {
      margin-top: 2cm;
      padding-top: 0.5cm;
      border-top: 1px solid #e2e8f0;
      font-size: 9pt;
      color: #64748b;
      text-align: center;
    }
    
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>KI-FORORDNINGEN<br/>I SKOLEN</h1>
    <h2>Komplett tiltaksplan for AI Act compliance</h2>
    <div class="meta">
      <p><strong>Generert:</strong> ${timestamp}</p>
      <p><strong>Versjon:</strong> 0.4</p>
    </div>
  </div>
  
  <div class="intro">
    <h2>Innledning</h2>
    <p>
      Denne tiltaksplanen gir deg en steg-for-steg guide til å bli compliant med 
      EU's AI Act (KI-forordningen) i skolen.
    </p>
    <p>
      AI Act trådte i kraft 1. august 2024, med gradvis innføring:
    </p>
    <div class="timeline">
      <div class="timeline-item">
        <div class="timeline-dot complete"></div>
        <div><strong>August 2024:</strong> Forordningen trådte i kraft</div>
      </div>
      <div class="timeline-item">
        <div class="timeline-dot complete"></div>
        <div><strong>Februar 2025:</strong> Forbud mot uakseptable praksiser</div>
      </div>
      <div class="timeline-item">
        <div class="timeline-dot complete"></div>
        <div><strong>August 2025:</strong> Krav til generativ KI (ER NÅ AKTIV!)</div>
      </div>
      <div class="timeline-item">
        <div class="timeline-dot pending"></div>
        <div><strong>August 2026:</strong> Transparenskrav</div>
      </div>
      <div class="timeline-item">
        <div class="timeline-dot pending"></div>
        <div><strong>August 2027:</strong> Alle høyrisiko-krav</div>
      </div>
    </div>
    <p>Start med Fase 1 og arbeid deg systematisk gjennom alle fasene.</p>
  </div>
  
  <h2>Fase 1: Kartlegging (Uke 1-2)</h2>
  
  <div class="card">
    <h4>1.1 Kartlegg alle KI-verktøy</h4>
    <p>Lag en fullstendig liste over alle KI-systemer som brukes på skolen.</p>
    <ul class="checklist">
      <li>Chatboter (ChatGPT, Bing Chat, Claude, etc.)</li>
      <li>Generative AI-verktøy (Midjourney, DALL-E, etc.)</li>
      <li>Adaptive læringssystemer (Khan Academy, etc.)</li>
      <li>Oversettelsesverktøy (Google Translate, DeepL)</li>
      <li>Vurderingssystemer med KI</li>
      <li>Spamfiltre og sikkerhetssystemer</li>
      <li>Læringsspill med KI</li>
    </ul>
    <div class="responsibility">
      <strong>Ansvar:</strong> IKT-ansvarlig + skoleleder
    </div>
  </div>
  
  <div class="card">
    <h4>1.2 Klassifiser risikonivå</h4>
    <p>For hvert verktøy: Bestem risikonivå.</p>
    <ul>
      <li><strong>MINIMAL:</strong> Spamfilter, enkle læringsspill</li>
      <li><strong>TRANSPARENS:</strong> Chatboter, generativ AI</li>
      <li><strong>HØY RISIKO:</strong> Vurdering, karaktersystemer, elevprofiler</li>
      <li><strong>UAKSEPTABEL:</strong> Manipulasjon, skjult scoring, diskriminering</li>
    </ul>
    <div class="responsibility">
      <strong>Verktøy:</strong> Bruk veiviseren på ki-forordningen.no
    </div>
  </div>
  
  <div class="card">
    <h4>1.3 Lag oversikt med dokumentasjon</h4>
    <p>Dokumenter alle verktøy i en tabell eller database.</p>
    <ul class="checklist">
      <li>Verktøynavn og leverandør</li>
      <li>Formål og bruksområde</li>
      <li>Risikonivå (Minimal/Transparens/Høy/Uakseptabel)</li>
      <li>Ansvarlig lærer/koordinator</li>
      <li>Dato for siste vurdering</li>
      <li>Status (Godkjent/Under vurdering/Ikke tillatt)</li>
      <li>Link til databehandleravtale (hvis relevant)</li>
    </ul>
    <div class="responsibility">
      <strong>Mal:</strong> Excel eller Google Sheets
    </div>
  </div>
  
  <h2>Fase 2: Personvern og GDPR (Uke 3-4)</h2>
  
  <div class="card">
    <h4>2.1 Databehandleravtaler</h4>
    <p>Alle verktøy som behandler persondata MÅ ha signert databehandleravtale (DBA).</p>
    <ul class="checklist">
      <li>Formål og varighet av behandlingen</li>
      <li>Type persondata som behandles</li>
      <li>Sikkerhetstiltak (kryptering, tilgangskontroll)</li>
      <li>Hvor data lagres (EU/EØS vs. tredjeland)</li>
      <li>Underleverandører (hvem har tilgang?)</li>
      <li>Prosedyre for sletting ved oppsigelse</li>
      <li>Rett til revisjon og kontroll</li>
    </ul>
    <div class="responsibility">
      <strong>Ansvar:</strong> Personvernombud/DPO + IKT-ansvarlig
    </div>
  </div>
  
  <div class="card">
    <h4>2.2 DPIA for høyrisiko-systemer</h4>
    <p>Personvernkonsekvensvurdering (DPIA) er LOVPÅLAGT for høyrisiko KI.</p>
    <ul class="checklist">
      <li>Systematisk beskrivelse av databehandlingen</li>
      <li>Formål og nødvendighet (hvorfor KI?)</li>
      <li>Risikovurdering (hva kan gå galt?)</li>
      <li>Tiltak for å redusere risiko</li>
      <li>Proporsjonalitetsvurdering (nytte vs. risiko)</li>
      <li>Godkjenning av personvernombud/DPO</li>
      <li>Årlig oppdatering</li>
    </ul>
    <div class="resources">
      <h4>Verktøy:</h4>
      <p>https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdere-personvernkonsekvenser/</p>
    </div>
  </div>
  
  <div class="card">
    <h4>2.3 Informer elever og foresatte</h4>
    <p>Transparens er et krav både i GDPR og AI Act.</p>
    <ul class="checklist">
      <li>Hvilke KI-verktøy som brukes</li>
      <li>Formål (hvorfor brukes KI?)</li>
      <li>Hvilke data som samles inn</li>
      <li>Hvordan data beskyttes</li>
      <li>Hvem som har tilgang til data</li>
      <li>Hvor lenge data lagres</li>
      <li>Rett til innsyn, sletting og reservasjon</li>
      <li>Kontaktinformasjon for spørsmål</li>
    </ul>
    <div class="responsibility">
      <strong>Kanal:</strong> Foreldremøte, nyhetsbrev, Vigilo/Its learning
    </div>
  </div>
  
  <h2>Fase 3: Ansvar og organisering (Uke 5-6)</h2>
  
  <div class="card">
    <h4>3.1 Opprett KI-arbeidsgruppe</h4>
    <p>Samle nøkkelpersoner som skal jobbe med KI-implementering.</p>
    <ul class="checklist">
      <li>Skoleleder (ansvarlig for compliance)</li>
      <li>IKT-ansvarlig (teknisk kompetanse)</li>
      <li>Personvernombud/DPO (GDPR-ansvar)</li>
      <li>Lærerrepresentant (brukerperspektiv)</li>
      <li>Elevrepresentant (brukermedvirkning)</li>
      <li>Tillitsvalgt (medbestemmelse)</li>
    </ul>
    <div class="responsibility">
      <strong>Møtefrekvens:</strong> Månedlig første år, deretter kvartalsvis
    </div>
  </div>
  
  <div class="card">
    <h4>3.2 Utarbeid retningslinjer</h4>
    <p>Skriv ned klare retningslinjer for bruk av KI på skolen.</p>
    <ul class="checklist">
      <li>Tillatte KI-verktøy og bruksområder</li>
      <li>Forbudte verktøy og praksiser</li>
      <li>Lærernes ansvar og plikter</li>
      <li>Elevenes rettigheter (klageadgang, innsyn)</li>
      <li>Pedagogisk begrunnelse for KI-bruk</li>
      <li>Personvern og datasikkerhet</li>
      <li>Vurdering og evaluering med KI</li>
      <li>Håndtering av hendelser og klager</li>
      <li>Prosess for evaluering og oppdatering</li>
    </ul>
    <div class="responsibility">
      <strong>Godkjenning:</strong> Skolens ledelse + medvirkning fra ansatte og elever
    </div>
  </div>
  
  <div class="card">
    <h4>3.3 Definer ansvarsroller</h4>
    <p>Klargjør hvem som er ansvarlig for hva.</p>
    <ul>
      <li><strong>SKOLELEDER:</strong> Overordnet ansvar for AI Act compliance</li>
      <li><strong>IKT-ANSVARLIG:</strong> Teknisk drift, avtaler med leverandører</li>
      <li><strong>PERSONVERNOMBUD:</strong> GDPR-compliance, DPIA-godkjenning</li>
      <li><strong>KI-KOORDINATOR:</strong> Daglig oppfølging av KI-verktøy</li>
      <li><strong>LÆRERE:</strong> Ansvarlig bruk, dokumentasjon, tilbakemelding</li>
      <li><strong>LEVERANDØR:</strong> Teknisk dokumentasjon, oppdateringer, support</li>
    </ul>
    <div class="responsibility">
      <strong>Dokument:</strong> Lag en RACI-matrise (Responsible, Accountable, Consulted, Informed)
    </div>
  </div>
  
  <h2>Fase 4: Kompetansebygging (Pågående)</h2>
  
  <div class="card">
    <h4>4.1 Opplæring for lærere</h4>
    <p>Alle lærere må ha grunnleggende KI- og AI Act-kompetanse.</p>
    <ul class="checklist">
      <li>Hva er KI? (Grunnleggende forståelse)</li>
      <li>AI Act og GDPR (Juridisk ramme)</li>
      <li>Risikovurdering (Hvordan klassifisere?)</li>
      <li>Personvern og datasikkerhet</li>
      <li>Elevrettigheter og medvirkning</li>
      <li>Ansvarlig bruk av KI i vurdering</li>
      <li>Pedagogisk bruk (når er KI hensiktsmessig?)</li>
      <li>Håndtering av hendelser</li>
    </ul>
    <div class="resources">
      <h4>Ressurs:</h4>
      <p>https://www.udir.no/laring-og-trivsel/rammeverk/kompetansepakke-for-kunstig-intelligens-i-skolen/</p>
    </div>
  </div>
  
  <div class="card">
    <h4>4.2 KI-undervisning for elever</h4>
    <p>Elever skal forstå KI og sine rettigheter.</p>
    <ul class="checklist">
      <li>Hva er KI og hvordan fungerer det?</li>
      <li>Kildekritikk (KI gjør feil!)</li>
      <li>Etikk og ansvar</li>
      <li>Personvern og datarettigheter</li>
      <li>Rett til innsyn, sletting og klage</li>
      <li>Opphavsrett og KI-generert innhold</li>
      <li>Kreativ og kritisk bruk</li>
    </ul>
    <div class="responsibility">
      <strong>Integrasjon:</strong> Tverrfaglig i alle fag
    </div>
  </div>
  
  <div class="card">
    <h4>4.3 Løpende kompetanseheving</h4>
    <p>KI-feltet utvikler seg raskt. Kontinuerlig læring er nødvendig.</p>
    <ul class="checklist">
      <li>Månedlige frokostmøter om KI</li>
      <li>Fagfellesskap (f.eks. lærerLiv.no)</li>
      <li>Nyhetsbrev fra Datatilsynet og Udir</li>
      <li>Kurs og webinarer</li>
      <li>Pilotering og testing av nye verktøy</li>
      <li>Deling av erfaringer på personalmøter</li>
    </ul>
    <div class="responsibility">
      <strong>Tid:</strong> Sett av 2 timer/måned i årshjulet
    </div>
  </div>
  
  <h2>Fase 5: Oppfølging og evaluering (Kontinuerlig)</h2>
  
  <div class="card">
    <h4>5.1 Logging og monitorering</h4>
    <p>Dokumenter bruk av KI-systemer, spesielt høyrisiko.</p>
    <ul class="checklist">
      <li>Bruksstatistikk (hvor mye brukes systemet?)</li>
      <li>Lærerinngrep (overstyringer av KI-beslutninger)</li>
      <li>Hendelser og feil</li>
      <li>Klager fra elever/foresatte</li>
      <li>Systemoppdateringer og endringer</li>
      <li>DPIA-oppdateringer</li>
    </ul>
    <div class="responsibility">
      <strong>Lagringstid:</strong> Minimum 6 måneder (AI Act Art. 29)
    </div>
  </div>
  
  <div class="card">
    <h4>5.2 Bias-testing og kvalitetskontroll</h4>
    <p>Test KI-systemer jevnlig for bias og diskriminering.</p>
    <ul class="checklist">
      <li>Kjønnsbias (gutter vs. jenter?)</li>
      <li>Språkbias (norsk vs. andre språk?)</li>
      <li>Alderbias (yngre vs. eldre elever?)</li>
      <li>Kulturell bias (minoriteter?)</li>
      <li>Funksjonshemming (universell utforming?)</li>
      <li>Teknisk nøyaktighet (feilrater?)</li>
    </ul>
    <div class="responsibility">
      <strong>Frekvens:</strong> Halvårlig for høyrisiko-systemer
    </div>
  </div>
  
  <div class="card">
    <h4>5.3 Årlig gjennomgang</h4>
    <p>Sett av tid i årshjulet til å evaluere og oppdatere.</p>
    <ul class="checklist">
      <li>Oppdater oversikt over KI-verktøy</li>
      <li>Re-evaluer risikonivå</li>
      <li>Sjekk at alle avtaler er gyldige</li>
      <li>DPIA-oppdatering for høyrisiko</li>
      <li>Evaluer retningslinjer (trenger de endring?)</li>
      <li>Hør med brukere (lærere, elever, foresatte)</li>
      <li>Analyser logger og hendelser</li>
      <li>Dokumenter compliance med AI Act</li>
      <li>Sett mål for neste år</li>
    </ul>
    <div class="responsibility">
      <strong>Tidspunkt:</strong> Mai/juni (planlegg for nytt skoleår)
    </div>
  </div>
  
  <h2>Krisehåndtering</h2>
  
  <div class="alert">
    <h3>Hvis noe går galt:</h3>
    <ol style="margin-left: 1cm;">
      <li><strong>STOPP</strong> bruken av systemet umiddelbart</li>
      <li><strong>DOKUMENTER</strong> hendelsen (hva, når, hvem)</li>
      <li><strong>INFORMER</strong> berørte parter (elever, foresatte, personvernombud)</li>
      <li><strong>KONTAKT</strong> leverandør og personvernombud</li>
      <li><strong>VURDER</strong> rapporteringsplikt (Datatilsynet innen 72 timer ved GDPR-brudd)</li>
      <li><strong>JUSTER</strong> rutiner for å forhindre gjentakelse</li>
    </ol>
  </div>
  
  <h2>Viktige ressurser</h2>
  
  <div class="resources">
    <h4>EU AI Act:</h4>
    <p>https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689</p>
  </div>
  
  <div class="resources">
    <h4>Datatilsynet (GDPR):</h4>
    <p>https://www.datatilsynet.no/</p>
  </div>
  
  <div class="resources">
    <h4>Datatilsynet (KI-veiledning):</h4>
    <p>https://www.datatilsynet.no/regelverk-og-verktoy/kunstig-intelligens-og-personvern/</p>
  </div>
  
  <div class="resources">
    <h4>Utdanningsdirektoratet (KI-kompetansepakke):</h4>
    <p>https://www.udir.no/laring-og-trivsel/rammeverk/kompetansepakke-for-kunstig-intelligens-i-skolen/</p>
  </div>
  
  <div class="resources">
    <h4>Lovdata - Opplæringsloven:</h4>
    <p>https://lovdata.no/dokument/NL/lov/1998-07-17-61</p>
  </div>
  
  <div class="resources">
    <h4>lærerLiv (fagfellesskap):</h4>
    <p>https://www.laererliv.no/</p>
  </div>
  
  <div class="footer">
    <p>
      <strong>Generert av:</strong> KI-forordningen i skolen | 
      <strong>Versjon:</strong> 0.4 | 
      <strong>Lisens:</strong> CC BY-SA
    </p>
    <p>
      <strong>Repository:</strong> github.com/barx10/ki_forordninga
    </p>
    <p style="margin-top: 0.5cm;">
      <em>VIKTIG: Dette er en veiledende tiltaksplan. Konsulter alltid med personvernombud, 
      DPO og skolens ledelse før implementering av KI-systemer.</em>
    </p>
  </div>
</body>
</html>
  `;
  
  printWindow.document.write(content);
  printWindow.document.close();
  
  // Wait for content to load, then trigger print dialog
  printWindow.onload = function() {
    printWindow.focus();
    printWindow.print();
  };
}

function downloadTiltaksplan() {
  const timestamp = new Date().toISOString().slice(0, 10);
  
  const content = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   KI-FORORDNINGEN I SKOLEN                               ║
║   Komplett tiltaksplan for AI Act compliance             ║
║                                                           ║
║   Generert: ${timestamp}                                 ║
║   Versjon: 0.4                                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝


INNLEDNING
═══════════════════════════════════════════════════════════

Denne tiltaksplanen gir deg en steg-for-steg guide til å bli
compliant med EU's AI Act (KI-forordningen) i skolen.

AI Act trådte i kraft 1. august 2024, med gradvis innføring:
- Februar 2025: Forbud mot uakseptable praksiser
- August 2025: Krav til generativ KI (ER NÅ AKTIV!)
- August 2026: Transparenskrav
- August 2027: Alle høyrisiko-krav

Start med Fase 1 og arbeid deg systematisk gjennom alle fasene.


═══════════════════════════════════════════════════════════
FASE 1: KARTLEGGING (UKE 1-2)
═══════════════════════════════════════════════════════════

1.1 KARTLEGG ALLE KI-VERKTØY
─────────────────────────────────────────────────────────

Lag en fullstendig liste over alle KI-systemer som brukes 
på skolen.

Sjekkliste:
  ☐ Chatboter (ChatGPT, Bing Chat, Claude, etc.)
  ☐ Generative AI-verktøy (Midjourney, DALL-E, etc.)
  ☐ Adaptive læringssystemer (Khan Academy, etc.)
  ☐ Oversettelsesverktøy (Google Translate, DeepL)
  ☐ Vurderingssystemer med KI
  ☐ Spamfiltre og sikkerhetssystemer
  ☐ Læringsspill med KI

Ansvar: IKT-ansvarlig + skoleleder


1.2 KLASSIFISER RISIKONIVÅ
─────────────────────────────────────────────────────────

For hvert verktøy: Bestem risikonivå.

Klassifiseringskriterier:
  • MINIMAL: Spamfilter, enkle læringsspill
  • TRANSPARENS: Chatboter, generativ AI
  • HØY RISIKO: Vurdering, karaktersystemer, elevprofiler
  • UAKSEPTABEL: Manipulasjon, skjult scoring, diskriminering

Verktøy: Bruk veiviseren på ki-forordningen.no


1.3 LAG OVERSIKT MED DOKUMENTASJON
─────────────────────────────────────────────────────────

Dokumenter alle verktøy i en tabell eller database.

Kolonner i oversikten:
  • Verktøynavn og leverandør
  • Formål og bruksområde
  • Risikonivå (Minimal/Transparens/Høy/Uakseptabel)
  • Ansvarlig lærer/koordinator
  • Dato for siste vurdering
  • Status (Godkjent/Under vurdering/Ikke tillatt)
  • Link til databehandleravtale (hvis relevant)

Mal: Excel eller Google Sheets


═══════════════════════════════════════════════════════════
FASE 2: PERSONVERN OG GDPR (UKE 3-4)
═══════════════════════════════════════════════════════════

2.1 DATABEHANDLERAVTALER
─────────────────────────────────────────────────────────

Alle verktøy som behandler persondata MÅ ha signert 
databehandleravtale (DBA).

Hva må avtalen inneholde:
  ☐ Formål og varighet av behandlingen
  ☐ Type persondata som behandles
  ☐ Sikkerhetstiltak (kryptering, tilgangskontroll)
  ☐ Hvor data lagres (EU/EØS vs. tredjeland)
  ☐ Underleverandører (hvem har tilgang?)
  ☐ Prosedyre for sletting ved oppsigelse
  ☐ Rett til revisjon og kontroll

Ansvar: Personvernombud/DPO + IKT-ansvarlig


2.2 DPIA FOR HØYRISIKO-SYSTEMER
─────────────────────────────────────────────────────────

Personvernkonsekvensvurdering (DPIA) er LOVPÅLAGT for 
høyrisiko KI.

DPIA skal inneholde:
  ☐ Systematisk beskrivelse av databehandlingen
  ☐ Formål og nødvendighet (hvorfor KI?)
  ☐ Risikovurdering (hva kan gå galt?)
  ☐ Tiltak for å redusere risiko
  ☐ Proporsjonalitetsvurdering (nytte vs. risiko)
  ☐ Godkjenning av personvernombud/DPO
  ☐ Årlig oppdatering

Verktøy: 
https://www.datatilsynet.no/rettigheter-og-plikter/
virksomhetenes-plikter/vurdere-personvernkonsekvenser/


2.3 INFORMER ELEVER OG FORESATTE
─────────────────────────────────────────────────────────

Transparens er et krav både i GDPR og AI Act.

Hva skal informeres om:
  ☐ Hvilke KI-verktøy som brukes
  ☐ Formål (hvorfor brukes KI?)
  ☐ Hvilke data som samles inn
  ☐ Hvordan data beskyttes
  ☐ Hvem som har tilgang til data
  ☐ Hvor lenge data lagres
  ☐ Rett til innsyn, sletting og reservasjon
  ☐ Kontaktinformasjon for spørsmål

Kanal: Foreldremøte, nyhetsbrev, Vigilo/Its learning


═══════════════════════════════════════════════════════════
FASE 3: ANSVAR OG ORGANISERING (UKE 5-6)
═══════════════════════════════════════════════════════════

3.1 OPPRETT KI-ARBEIDSGRUPPE
─────────────────────────────────────────────────────────

Samle nøkkelpersoner som skal jobbe med KI-implementering.

Hvem skal være med:
  ☐ Skoleleder (ansvarlig for compliance)
  ☐ IKT-ansvarlig (teknisk kompetanse)
  ☐ Personvernombud/DPO (GDPR-ansvar)
  ☐ Lærerrepresentant (brukerperspektiv)
  ☐ Elevrepresentant (brukermedvirkning)
  ☐ Tillitsvalgt (medbestemmelse)

Møtefrekvens: Månedlig første år, deretter kvartalsvis


3.2 UTARBEID RETNINGSLINJER
─────────────────────────────────────────────────────────

Skriv ned klare retningslinjer for bruk av KI på skolen.

Retningslinjer skal dekke:
  ☐ Tillatte KI-verktøy og bruksområder
  ☐ Forbudte verktøy og praksiser
  ☐ Lærernes ansvar og plikter
  ☐ Elevenes rettigheter (klageadgang, innsyn)
  ☐ Pedagogisk begrunnelse for KI-bruk
  ☐ Personvern og datasikkerhet
  ☐ Vurdering og evaluering med KI
  ☐ Håndtering av hendelser og klager
  ☐ Prosess for evaluering og oppdatering

Godkjenning: Skolens ledelse + medvirkning fra 
ansatte og elever


3.3 DEFINER ANSVARSROLLER
─────────────────────────────────────────────────────────

Klargjør hvem som er ansvarlig for hva.

Rollebeskrivelser:
  • SKOLELEDER: Overordnet ansvar for AI Act compliance
  • IKT-ANSVARLIG: Teknisk drift, avtaler med leverandører
  • PERSONVERNOMBUD: GDPR-compliance, DPIA-godkjenning
  • KI-KOORDINATOR: Daglig oppfølging av KI-verktøy
  • LÆRERE: Ansvarlig bruk, dokumentasjon, tilbakemelding
  • LEVERANDØR: Teknisk dokumentasjon, oppdateringer, support

Dokument: Lag en RACI-matrise 
(Responsible, Accountable, Consulted, Informed)


═══════════════════════════════════════════════════════════
FASE 4: KOMPETANSEBYGGING (PÅGÅENDE)
═══════════════════════════════════════════════════════════

4.1 OPPLÆRING FOR LÆRERE
─────────────────────────────────────────────────────────

Alle lærere må ha grunnleggende KI- og AI Act-kompetanse.

Opplæringstemaer:
  ☐ Hva er KI? (Grunnleggende forståelse)
  ☐ AI Act og GDPR (Juridisk ramme)
  ☐ Risikovurdering (Hvordan klassifisere?)
  ☐ Personvern og datasikkerhet
  ☐ Elevrettigheter og medvirkning
  ☐ Ansvarlig bruk av KI i vurdering
  ☐ Pedagogisk bruk (når er KI hensiktsmessig?)
  ☐ Håndtering av hendelser

Ressurs: 
https://www.udir.no/laring-og-trivsel/rammeverk/
kompetansepakke-for-kunstig-intelligens-i-skolen/


4.2 KI-UNDERVISNING FOR ELEVER
─────────────────────────────────────────────────────────

Elever skal forstå KI og sine rettigheter.

Læremål for elever:
  ☐ Hva er KI og hvordan fungerer det?
  ☐ Kildekritikk (KI gjør feil!)
  ☐ Etikk og ansvar
  ☐ Personvern og datarettigheter
  ☐ Rett til innsyn, sletting og klage
  ☐ Opphavsrett og KI-generert innhold
  ☐ Kreativ og kritisk bruk

Integrasjon: Tverrfaglig i alle fag


4.3 LØPENDE KOMPETANSEHEVING
─────────────────────────────────────────────────────────

KI-feltet utvikler seg raskt. Kontinuerlig læring er 
nødvendig.

Arenaer for læring:
  ☐ Månedlige frokostmøter om KI
  ☐ Fagfellesskap (f.eks. lærerLiv.no)
  ☐ Nyhetsbrev fra Datatilsynet og Udir
  ☐ Kurs og webinarer
  ☐ Pilotering og testing av nye verktøy
  ☐ Deling av erfaringer på personalmøter

Tid: Sett av 2 timer/måned i årshjulet


═══════════════════════════════════════════════════════════
FASE 5: OPPFØLGING OG EVALUERING (KONTINUERLIG)
═══════════════════════════════════════════════════════════

5.1 LOGGING OG MONITORERING
─────────────────────────────────────────────────────────

Dokumenter bruk av KI-systemer, spesielt høyrisiko.

Hva skal logges:
  ☐ Bruksstatistikk (hvor mye brukes systemet?)
  ☐ Lærerinngrep (overstyringer av KI-beslutninger)
  ☐ Hendelser og feil
  ☐ Klager fra elever/foresatte
  ☐ Systemoppdateringer og endringer
  ☐ DPIA-oppdateringer

Lagringstid: Minimum 6 måneder (AI Act Art. 29)


5.2 BIAS-TESTING OG KVALITETSKONTROLL
─────────────────────────────────────────────────────────

Test KI-systemer jevnlig for bias og diskriminering.

Testområder:
  ☐ Kjønnsbias (gutter vs. jenter?)
  ☐ Språkbias (norsk vs. andre språk?)
  ☐ Alderbias (yngre vs. eldre elever?)
  ☐ Kulturell bias (minoriteter?)
  ☐ Funksjonshemming (universell utforming?)
  ☐ Teknisk nøyaktighet (feilrater?)

Frekvens: Halvårlig for høyrisiko-systemer


5.3 ÅRLIG GJENNOMGANG
─────────────────────────────────────────────────────────

Sett av tid i årshjulet til å evaluere og oppdatere.

Sjekkliste årlig gjennomgang:
  ☐ Oppdater oversikt over KI-verktøy
  ☐ Re-evaluer risikonivå
  ☐ Sjekk at alle avtaler er gyldige
  ☐ DPIA-oppdatering for høyrisiko
  ☐ Evaluer retningslinjer (trenger de endring?)
  ☐ Hør med brukere (lærere, elever, foresatte)
  ☐ Analyser logger og hendelser
  ☐ Dokumenter compliance med AI Act
  ☐ Sett mål for neste år

Tidspunkt: Mai/juni (planlegg for nytt skoleår)


═══════════════════════════════════════════════════════════
KRISEHÅNDTERING
═══════════════════════════════════════════════════════════

Hvis noe går galt:

1. STOPP bruken av systemet umiddelbart

2. DOKUMENTER hendelsen
   - Hva skjedde?
   - Når skjedde det?
   - Hvem ble berørt?

3. INFORMER berørte parter
   - Elever
   - Foresatte
   - Personvernombud

4. KONTAKT leverandør og personvernombud

5. VURDER rapporteringsplikt
   - Brudd på GDPR må rapporteres til Datatilsynet 
     innen 72 timer
   - Alvorlige AI Act-hendelser må rapporteres

6. JUSTER rutiner for å forhindre gjentakelse


═══════════════════════════════════════════════════════════
RESSURSER
═══════════════════════════════════════════════════════════

EU AI Act:
https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689

Datatilsynet (GDPR):
https://www.datatilsynet.no/

Datatilsynet (KI-veiledning):
https://www.datatilsynet.no/regelverk-og-verktoy/
kunstig-intelligens-og-personvern/

Utdanningsdirektoratet (KI-kompetansepakke):
https://www.udir.no/laring-og-trivsel/rammeverk/
kompetansepakke-for-kunstig-intelligens-i-skolen/

Lovdata - Opplæringsloven:
https://lovdata.no/dokument/NL/lov/1998-07-17-61

Lovdata - Personopplysningsloven:
https://lovdata.no/dokument/NL/lov/2018-06-15-38

lærerLiv (fagfellesskap):
https://www.laererliv.no/


═══════════════════════════════════════════════════════════

Denne tiltaksplanen er generert av: KI-forordningen i skolen
Versjon: 0.4 | Lisens: CC BY-SA
Repository: github.com/barx10/ki_forordninga

VIKTIG: Dette er en veiledende tiltaksplan. Konsulter alltid
med personvernombud, DPO og skolens ledelse før implementering
av KI-systemer.

For mer informasjon og interaktiv veiviser:
https://github.com/barx10/ki_forordninga

═══════════════════════════════════════════════════════════
`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ki-tiltaksplan-${timestamp}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// === RISK LEVEL MODAL ===
const riskData = {
  minimal: {
    icon: '✅',
    title: 'Minimal risiko',
    subtitle: 'Lav risiko for brukerrettigheter',
    description: 'KI-systemer med minimal eller ingen risiko for menneskers rettigheter og sikkerhet. Disse systemene har svært få krav i AI Act.',
    characteristics: [
      'Begrenset interaksjon med brukere',
      'Ingen påvirkning på rettigheter eller sikkerhet',
      'Enkle, veldefinerte oppgaver',
      'Lav sannsynlighet for feil med alvorlige konsekvenser'
    ],
    examples: {
      title: 'Eksempler fra skolen:',
      items: [
        '📧 <strong>Spamfilter:</strong> Filtrerer e-post automatisk, men påvirker ikke rettigheter',
        '🎮 <strong>Enkle læringsspill:</strong> Spill uten adaptiv læring eller profilering',
        '📊 <strong>Statistikkverktøy:</strong> Samler inn anonymiserte data for analyse',
        '🔍 <strong>Søkefunksjoner:</strong> Enkle søk i læringsressurser'
      ]
    },
    requirements: [
      'Frivillig å følge Code of Conduct',
      'Ingen spesifikke compliance-krav',
      'God praksis anbefales, men ikke påkrevd',
      'GDPR gjelder fortsatt hvis persondata behandles'
    ],
    action: 'Dokumenter hvilke systemer som er minimal risiko og følg god praksis.'
  },
  transparency: {
    icon: '💬',
    title: 'Transparenskrav',
    subtitle: 'Generativ AI og chatboter',
    description: 'KI-systemer som interagerer med mennesker eller genererer innhold må være transparente. Brukere skal vite at de kommuniserer med KI.',
    characteristics: [
      'Genererer tekst, bilder, lyd eller video',
      'Brukes i direkte interaksjon med mennesker',
      'Kan påvirke beslutninger',
      'Krever tydelig merking og informasjon'
    ],
    examples: {
      title: 'Eksempler fra skolen:',
      items: [
        '🤖 <strong>ChatGPT/Claude:</strong> Må informere elever om at de bruker KI',
        '🎨 <strong>DALL-E/Midjourney:</strong> Må merke KI-genererte bilder',
        '📝 <strong>AI-skriveverktøy:</strong> Elever må vite at forslag kommer fra KI',
        '🗣️ <strong>Stemmebots:</strong> Må tydelig kommunisere at det er KI'
      ]
    },
    requirements: [
      '📢 <strong>Informasjonsplikt:</strong> Brukere må informeres om KI-bruk',
      '🏷️ <strong>Merking:</strong> KI-generert innhold må merkes tydelig',
      '📋 <strong>Dokumentasjon:</strong> Logg hvordan KI brukes',
      '🔄 <strong>Transparens:</strong> Forklar hvordan KI fungerer (på et fornuftig nivå)',
      '⚖️ <strong>GDPR-krav:</strong> Databehandleravtale hvis persondata brukes'
    ],
    warning: '<strong>NB!</strong> Transparenskravene er aktive fra august 2025. Hvis dere bruker ChatGPT, må elevene informeres.',
    action: 'Lag rutiner for informasjon til elever og foresatte. Merk KI-generert innhold.'
  },
  high: {
    icon: '⚠️',
    title: 'Høy risiko',
    subtitle: 'Vurdering, karakterer og elevprofiler',
    description: 'KI-systemer som kan påvirke elevers rettigheter, utdanning eller fremtid. Disse har strenge krav i AI Act.',
    characteristics: [
      'Påvirker vurdering, karakterer eller tilgang til utdanning',
      'Brukes til å profilere eller klassifisere elever',
      'Kan ha diskriminerende effekter',
      'Krever omfattende dokumentasjon og kontroll'
    ],
    examples: {
      title: 'Eksempler fra skolen:',
      items: [
        '📊 <strong>KI-basert vurdering:</strong> Systemer som gir karakterer eller tilbakemeldinger',
        '🎯 <strong>Adaptive læringssystemer:</strong> Systemer som tilpasser innhold basert på elevdata',
        '📈 <strong>Elevprofiler:</strong> Systemer som lager profiler for å predikere prestasjoner',
        '🚨 <strong>Fravær- og atferdssystemer:</strong> Systemer som automatisk rapporterer eller reagerer',
        '🔒 <strong>Tilgangskontroll:</strong> KI som bestemmer hvem som får tilgang til ressurser'
      ]
    },
    requirements: [
      '📋 <strong>Risikovurdering (DPIA):</strong> Grundig vurdering av risiko før bruk',
      '📚 <strong>Teknisk dokumentasjon:</strong> Komplett oversikt over systemet',
      '🔍 <strong>Datastyring:</strong> Kontroll over treningsdata og kvalitet',
      '👥 <strong>Menneskelig oversikt:</strong> Lærer må kunne overstyre KI-beslutninger',
      '🔒 <strong>Cybersikkerhet:</strong> Sikkerhetstiltak mot hacking',
      '📝 <strong>Logging:</strong> Minst 6 måneders logger',
      '⚖️ <strong>Leverandør-ansvar:</strong> Leverandøren må være CE-merket',
      '🏫 <strong>Skole-ansvar:</strong> Dere er ansvarlige som brukere (Artikkel 29)'
    ],
    warning: '<strong>VIKTIG!</strong> Høyrisiko-krav gjelder fullt ut fra august 2027, men forberedelser må starte NÅ. DPIA er påkrevd.',
    action: 'Gjennomgå alle høyrisiko-systemer. Lag DPIA. Krev dokumentasjon fra leverandør.'
  },
  unacceptable: {
    icon: '🚫',
    title: 'Uakseptabel risiko',
    subtitle: 'Forbudte KI-praksiser',
    description: 'KI-systemer som utgjør en uakseptabel trussel mot menneskers rettigheter og sikkerhet. Disse er FORBUDT i AI Act fra februar 2025.',
    characteristics: [
      'Manipulerer atferd på skadelig måte',
      'Utnytter sårbare grupper',
      'Gjør skjult eller diskriminerende profilering',
      'Brukes til sosial scoring'
    ],
    examples: {
      title: 'Forbudt i skolen:',
      items: [
        '🧠 <strong>Atferdsmanipulasjon:</strong> Systemer som manipulerer elever til å handle mot sin vilje',
        '👤 <strong>Skjult profilering:</strong> Systemer som profilerer elever uten deres kunnskap',
        '🏆 <strong>Sosial scoring:</strong> Systemer som gir elever "poengsummer" basert på atferd',
        '🎭 <strong>Følelsesanalyse:</strong> Systemer som analyserer elevers følelser uten samtykke',
        '📊 <strong>Prediktiv atferd:</strong> Systemer som predikerer kriminalitet eller problematferd',
        '🚨 <strong>Biometrisk identifikasjon:</strong> Sanntids ansiktsgjenkjenning i skolegården'
      ]
    },
    requirements: [
      '🚫 <strong>FORBUDT:</strong> Kan ikke brukes under noen omstendigheter',
      '⚖️ <strong>Juridiske konsekvenser:</strong> Brudd kan føre til store bøter',
      '🗑️ <strong>Umiddelbar handling:</strong> Hvis dere bruker slikt, STOPP NÅ',
      '📢 <strong>Rapporteringsplikt:</strong> Alvorlige hendelser må rapporteres'
    ],
    warning: '<strong>ADVARSEL!</strong> Forbudet trådte i kraft februar 2025. Brudd kan føre til bøter på opptil €35 millioner eller 7% av global omsetning.',
    action: 'Sjekk om dere har systemer som kan falle under uakseptabel risiko. Stopp bruken UMIDDELBART hvis ja.'
  }
};

function openRiskModal(riskLevel) {
  const modal = document.getElementById('riskModal');
  const modalBody = document.getElementById('modalBody');
  const data = riskData[riskLevel];
  
  if (!data) return;
  
  // Build modal content
  let content = `
    <div class="modal-header">
      <span class="modal-icon">${data.icon}</span>
      <div class="modal-title">
        <h2>${data.title}</h2>
        <p class="modal-subtitle">${data.subtitle}</p>
      </div>
    </div>
    
    <div class="modal-section">
      <p><strong>${data.description}</strong></p>
    </div>
    
    <div class="modal-section">
      <h3>Kjennetegn</h3>
      <ul class="modal-list">
        ${data.characteristics.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
    
    <div class="modal-examples">
      <h4>${data.examples.title}</h4>
      <ul class="modal-list">
        ${data.examples.items.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
    
    <div class="modal-section">
      <h3>Krav i AI Act</h3>
      <ul class="modal-list">
        ${data.requirements.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
  `;
  
  if (data.warning) {
    content += `
      <div class="${riskLevel === 'unacceptable' ? 'modal-warning' : 'modal-success'}">
        ${data.warning}
      </div>
    `;
  }
  
  content += `
    <div class="modal-footer">
      <p><strong>💡 Neste steg:</strong> ${data.action}</p>
      <button class="cta" onclick="closeRiskModal(); window.location.hash='#sjekk';">Gå til veiviseren →</button>
    </div>
  `;
  
  modalBody.innerHTML = content;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function closeRiskModal(event) {
  // Close if clicking backdrop or close button
  if (!event || event.target.id === 'riskModal' || event.target.classList.contains('modal-close')) {
    const modal = document.getElementById('riskModal');
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  }
}

// === GDPR MODAL ===
// === GDPR MODAL ===
const gdprData = {
  pol1: {
    icon: '📋',
    title: 'Personopplysningsloven artikkel 6',
    subtitle: 'Lovlig behandlingsgrunnlag',
    description: 'All behandling av personopplysninger må ha et lovlig grunnlag. Personopplysningsloven § 1 gjør hele GDPR til norsk lov, inkludert GDPR artikkel 6 om behandlingsgrunnlag.',
    sections: [
      {
        title: 'Hva sier loven?',
        items: [
          '<strong>§ 1:</strong> GDPR gjelder som norsk lov (GDPR artikkel 6 om behandlingsgrunnlag)',
          '<strong>§ 8:</strong> Supplerende bestemmelser om behandling i allmennhetens interesse',
          'GDPR artikkel 6 nr. 1 bokstav e: Offentlig myndighetsutøvelse eller allmenn interesse'
        ]
      },
      {
        title: 'For KI i skolen',
        items: [
          '<strong>Samtykke</strong> fungerer IKKE som grunnlag i offentlig sektor (det finnes et maktforhold - samtykket er ikke frivillig)',
          '<strong>Offentlig myndighetsutøvelse</strong> er vanligvis grunnlaget (artikkel 6 nr. 1 bokstav e)',
          'Behandling må være nødvendig for allmennhetens interesse eller lovpålagt plikt',
          'Opplæringsloven gir hjemmel for behandling av elevdata i undervisning og vurdering'
        ]
      }
    ],
    practical: 'Dokumenter behandlingsgrunnlag i DPIA. Bruk <strong>ikke</strong> samtykke - bruk myndighetsutøvelse eller allmenn interesse som grunnlag.',
    link: 'https://lovdata.no/dokument/NL/lov/2018-06-15-38/KAPITTEL_gdpr-2#gdpr%2Fa6'
  },
  pol16: {
    icon: '📋',
    title: 'Personopplysningsloven artikkel 13-14',
    subtitle: 'Informasjonsplikt til elever og foresatte',
    description: 'Elever og foresatte har rett til å vite hvordan deres personopplysninger brukes. Hovedregelen om informasjonsplikt ligger i GDPR artikkel 13-14, som gjelder direkte i Norge via § 1.',
    sections: [
      {
        title: 'Hva sier loven?',
        items: [
          '<strong>§ 16:</strong> Begrensninger i retten til informasjon (unntak fra GDPR art. 13-14)',
          'GDPR artikkel 13-14: Informasjonsplikt ved innsamling av personopplysninger',
          'Hovedregelen: Du <strong>må</strong> informere om KI-bruk',
          'Unntak gjelder kun i særskilte situasjoner (straffesaker, nasjonal sikkerhet)'
        ]
      },
      {
        title: 'For KI i skolen',
        items: [
          'Informer <strong>før</strong> KI-systemet tas i bruk',
          'Forklar på et språk som elever og foresatte forstår',
          'Spesifiser hvilke data som samles inn og hvorfor',
          'Oppgi hvor lenge data lagres og hvem som har tilgang',
          'Forklar hvordan de kan utøve sine rettigheter (innsyn, sletting, klage)'
        ]
      }
    ],
    practical: 'Lag en egen informasjonsside om KI-bruk på skolens nettsted. Send ut informasjon på foreldremøter. Hovedregelen er at du <strong>må</strong> informere.',
    link: 'https://lovdata.no/dokument/NL/lov/2018-06-15-38/KAPITTEL_gdpr-3-2#KAPITTEL_gdpr-3-2'
  },
  pol1art22: {
    icon: '📋',
    title: 'Personopplysningsloven artikkel 22',
    subtitle: 'Automatiserte avgjørelser (GDPR art. 22)',
    description: 'Ingen skal utsettes for avgjørelser basert utelukkende på automatisk behandling som har rettslige eller vesentlige konsekvenser. GDPR artikkel 22 gjelder direkte i Norge via personopplysningsloven § 1.',
    sections: [
      {
        title: 'Hva sier loven?',
        items: [
          '<strong>§ 1:</strong> GDPR gjelder som norsk lov (inkludert artikkel 22)',
          'GDPR artikkel 22: Forbud mot rent automatiserte avgjørelser med rettsvirkning',
          'Norge har ikke egen paragraf for dette - det følger direkte av GDPR artikkel 22'
        ]
      },
      {
        title: 'For KI i skolen',
        items: [
          'KI kan <strong>aldri</strong> sette karakterer alene - en lærer må alltid gjøre den endelige vurderingen',
          'KI kan foreslå, men mennesker må bestemme',
          'Gjelder også opptak til skole, klasseinndeling, spesialundervisning, og andre vedtak med rettsvirkning',
          'Elever har rett til å be om menneskelig vurdering og til å bestride avgjørelsen',
          'Unntak krever uttrykkelig lovhjemmel, avtale, eller gyldig samtykke - og alltid med menneskelig kontroll'
        ]
      }
    ],
    practical: 'Dokumenter alltid at en kvalifisert person har sett gjennom og godkjent KI-output før det får konsekvenser for eleven. Skolen kan <strong>ikke</strong> la KI fatte vedtak alene.',
    link: 'https://lovdata.no/dokument/NL/lov/2018-06-15-38/gdpr/ARTIKKEL_22#gdpr/ARTIKKEL_22'
  },
  pol1art28: {
    icon: '🔴',
    title: 'Personopplysningsloven artikkel 28',
    subtitle: 'Databehandleravtale (GDPR art. 28) - OBLIGATORISK',
    description: 'Når en ekstern leverandør behandler personopplysninger på vegne av skolen, MÅ det foreligge en bindende databehandleravtale. GDPR artikkel 28 gjelder direkte i Norge via personopplysningsloven § 1.',
    sections: [
      {
        title: 'Hva sier loven?',
        items: [
          '<strong>§ 1:</strong> GDPR gjelder som norsk lov (inkludert artikkel 28)',
          'GDPR artikkel 28: Krav til databehandleravtale',
          'Datatilsynet krever at innholdet i avtalen følger artikkel 28'
        ]
      },
      {
        title: 'For KI i skolen',
        items: [
          '<strong>OBLIGATORISK</strong> for alle KI-tjenester som behandler elevdata (ChatGPT, Google Classroom, osv.)',
          'Avtalen må beskrive: formål, varighet, typer opplysninger, kategorier registrerte, sikkerhetstiltak',
          'Leverandøren (databehandler) skal kun handle på instruks fra skolen (behandlingsansvarlig)',
          'Skolen er <strong>behandlingsansvarlig</strong> og har ansvar selv om feilen skjer hos leverandøren'
        ]
      }
    ],
    practical: 'IKKE bruk KI-verktøy uten signert databehandleravtale. Sjekk om avtalen dekker tredjelandsoverføring (data utenfor EU/EØS). Kravet gjelder direkte i Norge.',
    link: 'https://lovdata.no/dokument/NL/lov/2018-06-15-38/gdpr/ARTIKKEL_28#gdpr/ARTIKKEL_28'
  },
  pol9: {
    icon: '📋',
    title: 'Personopplysningsloven artikkel 35',
    subtitle: 'DPIA - Personvernkonsekvensvurdering (GDPR art. 35)',
    description: 'Før bruk av ny teknologi som kan medføre høy risiko for personvernet, må det gjennomføres en DPIA. Personopplysningsloven § 9 knytter GDPR artikkel 35 inn i norsk rett.',
    sections: [
      {
        title: 'Hva sier loven?',
        items: [
          '<strong>§ 9:</strong> Rådføring med personvernombud ved behandling av særlige kategorier personopplysninger',
          'Hvis DPIA etter GDPR artikkel 35 er utført, oppfyller du rådføringsplikten i § 9',
          'GDPR artikkel 35: Krav om DPIA ved høyrisiko-behandling'
        ]
      },
      {
        title: 'For KI i skolen',
        items: [
          '<strong>OBLIGATORISK</strong> for høyrisiko-KI (vurdering, karaktersetting, overvåking, profilering)',
          'Særlig viktig ved behandling av særlige kategorier personopplysninger (sensitive elevdata)',
          'Må være ferdig <strong>før</strong> systemet tas i bruk',
          'Skal identifisere risikoer og beskrive tiltak for å redusere dem',
          'Personvernombud skal rådføres (§ 9) - hvis DPIA er utført, oppfyller du denne plikten',
          'Skal oppdateres årlig eller ved endringer'
        ]
      }
    ],
    practical: 'Bruk Datatilsynets DPIA-mal. Involver personvernombud tidlig i prosessen. § 9 gjør DPIA til et krav for høyrisiko-behandling av elevdata.',
    link: 'https://lovdata.no/dokument/NL/lov/2018-06-15-38/gdpr/ARTIKKEL_35#gdpr/ARTIKKEL_35'
  }
};

function openGDPRModal(article) {
  const modal = document.getElementById('riskModal');
  const modalBody = document.getElementById('modalBody');
  const data = gdprData[article];
  
  if (!data) return;
  
  let content = `
    <div class="modal-header">
      <span class="modal-icon">${data.icon}</span>
      <div class="modal-title">
        <h2>${data.title}</h2>
        <p class="modal-subtitle">${data.subtitle}</p>
      </div>
    </div>
    
    <div class="modal-section">
      <p><strong>${data.description}</strong></p>
    </div>
  `;
  
  data.sections.forEach(section => {
    content += `
      <div class="modal-section">
        <h3>${section.title}</h3>
        <ul class="modal-list">
          ${section.items.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `;
  });
  
  content += `
    <div class="modal-success">
      <strong>💡 Praktisk:</strong> ${data.practical}
    </div>
    
    <div class="modal-footer">
      <a href="${data.link}" target="_blank" rel="noopener" class="cta">Les mer om ${data.title} →</a>
    </div>
  `;
  
  modalBody.innerHTML = content;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// === NORSK LOV MODAL ===
const norskLovData = {
  opplaringsloven: {
    icon: '⚖️',
    title: 'Opplæringsloven',
    subtitle: 'Elevens rettigheter',
    sections: [
      {
        title: '§ 1-1 Likeverd',
        items: [
          'KI-systemer må gi <strong>alle elever lik tilgang</strong> til god opplæring',
          'Må fungere for elever med funksjonshemming (universell utforming)',
          'Må ikke diskriminere basert på språk, kultur eller bakgrunn',
          '<strong>Test regelmessig for bias!</strong>'
        ]
      },
      {
        title: '§ 3-1 Rettssikkerhet',
        items: [
          'Elever har rett til å klage på vurderinger',
          'KI-baserte vurderinger må kunne <strong>forklares</strong> og <strong>etterprøves</strong>',
          'Elever har rett til å vite at KI er brukt i vurderingen',
          'Klagesystemet må fungere selv når KI er involvert'
        ]
      },
      {
        title: '§ 3-3 og Kap 9a - Psykososialt miljø',
        items: [
          'KI skal <strong>ikke</strong> brukes til overvåking av elever på måter som skaper utrygghet',
          'Elever skal beskyttes mot krenkelser - også fra KI-systemer',
          'Hvis KI oppdager mobbing, må skolen følge opp (ikke bare stole på KI)'
        ]
      }
    ],
    practical: 'Vurder hvordan KI påvirker elevens rettigheter <strong>før</strong> bruk. Involver elevråd i beslutninger om KI.',
    link: 'https://lovdata.no/dokument/LTI/lov/2023-06-09-30'
  },
  personopplysningsloven: {
    icon: '⚖️',
    title: 'Personopplysningsloven',
    subtitle: 'GDPR i Norge',
    description: 'GDPR er implementert i norsk lov gjennom personopplysningsloven.',
    sections: [
      {
        title: 'Hva det betyr for skolen',
        items: [
          'Datatilsynet er tilsynsmyndighet i Norge',
          'Samme regler som GDPR, men tilpasset norsk forvaltning',
          'Sanksjoner kan gis av Datatilsynet',
          'Skolen må ha personvernombud (DPO) hvis den behandler personopplysninger systematisk'
        ]
      }
    ],
    practical: 'Ta kontakt med personvernombud ved alle spørsmål om KI og personvern. De skal hjelpe deg!',
    link: 'https://lovdata.no/dokument/NL/lov/2018-06-15-38'
  },
  diskrimineringsloven: {
    icon: '🔴',
    title: 'Diskrimineringsloven',
    subtitle: 'Forbud mot diskriminering',
    sections: [
      {
        title: '§ 6 Diskriminering i utdanning er forbudt',
        items: [
          'KI må <strong>ikke</strong> diskriminere basert på kjønn, etnisitet, religion, funksjonsnedsettelse, seksuell orientering, eller alder',
          'Indirekte diskriminering er også forbudt (når KI tilsynelatende er nøytral, men rammer enkelte grupper hardere)',
          'Skolen har <strong>aktivitets- og redegjørelsesplikt</strong> - du må aktivt jobbe for å forebygge diskriminering'
        ]
      }
    ],
    practical: 'Test KI-systemer for bias mot ulike elevgrupper. Dokumenter testing og tiltak. Juster algoritmer hvis bias oppdages.',
    link: 'https://lovdata.no/dokument/NL/lov/2017-06-16-51'
  },
  forvaltningsloven: {
    icon: '⚖️',
    title: 'Forvaltningsloven',
    subtitle: 'Elevens rett til klage',
    sections: [
      {
        title: '§ 2 Klagerett på forvaltningsvedtak',
        items: [
          'Avgjørelser som påvirker elevers rettigheter er <strong>forvaltningsvedtak</strong>',
          'Elever/foresatte har rett til å klage på vedtak (f.eks. karakterer, spesialundervisning, tilpasset opplæring)',
          'KI-baserte vedtak må kunne <strong>forklares</strong> i klagesak',
          'Klagenemnda må kunne etterprøve beslutningen'
        ]
      }
    ],
    practical: 'Dokumenter hvordan KI er brukt i vurderinger. Sørg for at lærere kan forklare og begrunne vedtak selv når KI er involvert.',
    link: 'https://lovdata.no/dokument/NL/lov/1967-02-10'
  }
};

function openNorskLovModal(law) {
  const modal = document.getElementById('riskModal');
  const modalBody = document.getElementById('modalBody');
  const data = norskLovData[law];
  
  if (!data) return;
  
  let content = `
    <div class="modal-header">
      <span class="modal-icon">${data.icon}</span>
      <div class="modal-title">
        <h2>${data.title}</h2>
        <p class="modal-subtitle">${data.subtitle}</p>
      </div>
    </div>
  `;
  
  if (data.description) {
    content += `
      <div class="modal-section">
        <p><strong>${data.description}</strong></p>
      </div>
    `;
  }
  
  data.sections.forEach(section => {
    content += `
      <div class="modal-section">
        <h3>${section.title}</h3>
        <ul class="modal-list">
          ${section.items.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `;
  });
  
  content += `
    <div class="modal-success">
      <strong>💡 Praktisk:</strong> ${data.practical}
    </div>
    
    <div class="modal-footer">
      <a href="${data.link}" target="_blank" rel="noopener" class="cta">Les ${data.title} på Lovdata →</a>
    </div>
  `;
  
  modalBody.innerHTML = content;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// === AI ACT ARTIKLER MODAL ===
const aiActArticles = {
  art5: {
    icon: '🚫',
    title: 'Artikkel 5',
    subtitle: 'Forbudte praksiser',
    description: 'Definerer KI-systemer som er forbudt fordi de utgjør en uakseptabel risiko.',
    sections: [
      {
        title: 'Hva er forbudt?',
        items: [
          'Manipulasjon av atferd som kan skade personer',
          'Utnyttelse av sårbare grupper (barn, funksjonshemmede)',
          'Sosial scoring av borgere',
          'Sanntids biometrisk identifikasjon i offentlige rom (med snevre unntak)'
        ]
      },
      {
        title: 'For skolen',
        items: [
          'IKKE bruk KI som manipulerer elevers atferd',
          'IKKE lag "elevscorer" basert på atferd eller sosiale faktorer',
          'IKKE skjult følelsesanalyse uten samtykke',
          'IKKE sanntids ansiktsgjenkjenning i skolegården'
        ]
      }
    ],
    practical: 'Hvis dere bruker systemer som dette, stopp umiddelbart. Forbudet gjelder fra februar 2025.',
    norwegianPdfPage: 51,
    euLink: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'
  },
  art6: {
    icon: '⚠️',
    title: 'Artikkel 6 + Vedlegg III',
    subtitle: 'Høyrisiko-klassifisering',
    description: 'Definerer hvilke KI-systemer som er høyrisiko basert på bruksområde.',
    sections: [
      {
        title: 'Høyrisiko i utdanning (Vedlegg III)',
        items: [
          'Tilgang til utdanning (opptak, klasseplassering)',
          'Vurdering og evaluering (karakterer, eksamener)',
          'Overvåking og profilering av elevers atferd',
          'Adaptive læringssystemer med betydelig påvirkning'
        ]
      },
      {
        title: 'For skolen',
        items: [
          'Alle systemer som påvirker vurdering eller tilgang er høyrisiko',
          'Krever DPIA, databehandleravtale, logging, menneskelig oversikt',
          'Leverandøren må være CE-merket (fra august 2027)',
          'Skolen har ansvar som "deployer" (bruker av systemet)'
        ]
      }
    ],
    practical: 'Kartlegg alle høyrisiko-systemer. Start forberedelser nå - kravene gjelder fullt ut fra august 2027.',
    norwegianPdfPage: '53 (Artikkel 6) og 127 (Vedlegg III)',
    euLink: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'
  },
  art9: {
    icon: '📊',
    title: 'Artikkel 9',
    subtitle: 'Risikovurdering',
    description: 'Krav til risikostyringssystem for høyrisiko KI-systemer.',
    sections: [
      {
        title: 'Hva kreves?',
        items: [
          'Identifiser og analyser kjente og forutsigbare risikoer',
          'Estimer og evaluer risikoer som kan oppstå ved bruk',
          'Vurder risikoer basert på tilgjengelige data og testing',
          'Implementer egnede risikostyringstiltak'
        ]
      },
      {
        title: 'For skolen',
        items: [
          'Gjennomfør DPIA før bruk (obligatorisk)',
          'Identifiser hva som kan gå galt (bias, feil, diskriminering)',
          'Test systemet før full utrulling',
          'Ha beredskapsplan hvis noe går galt'
        ]
      }
    ],
    practical: 'Bruk Datatilsynets DPIA-mal. Dokumenter alle risikoer og tiltak. Oppdater årlig.',
    norwegianPdfPage: 56,
    euLink: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'
  },
  art10: {
    icon: '📚',
    title: 'Artikkel 10',
    subtitle: 'Data og datastyring',
    description: 'Krav til kvalitet på treningsdata, testdata og valideringsdata.',
    sections: [
      {
        title: 'Datakvalitet',
        items: [
          'Data må være relevant, representativ og fri for feil',
          'Må dekke alle relevante scenarier og bruksområder',
          'Må vurderes for mulig bias',
          'Dokumentasjon av datakilder og datakvalitet'
        ]
      },
      {
        title: 'For skolen',
        items: [
          'Krev dokumentasjon fra leverandør om treningsdata',
          'Sjekk om data er representativ for norske elever',
          'Vurder om systemet fungerer likt for alle elevgrupper',
          'Test systemet med reelle elevdata før full bruk'
        ]
      }
    ],
    practical: 'Still spørsmål til leverandør: Hvilke data er systemet trent på? Er det testet for bias? Fungerer det for norsk språk og kultur?',
    norwegianPdfPage: 57,
    euLink: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'
  },
  art13: {
    icon: '📋',
    title: 'Artikkel 13',
    subtitle: 'Transparens og informasjon',
    description: 'Krav til dokumentasjon og brukerveiledning.',
    sections: [
      {
        title: 'Hva må dokumenteres?',
        items: [
          'Identitet og kontaktinformasjon til leverandør',
          'Systemets egenskaper, kapasitet og begrensninger',
          'Forventet ytelse og nøyaktighet',
          'Instruksjoner for bruk',
          'Hva som kan gå galt og hvordan håndtere det'
        ]
      },
      {
        title: 'For skolen',
        items: [
          'Krev fullstendig dokumentasjon fra leverandør',
          'Les brukerveiledningen før bruk',
          'Forstå systemets begrensninger',
          'Informer lærere om hva systemet kan og ikke kan'
        ]
      }
    ],
    practical: 'Ikke bruk KI-systemer uten fullstendig dokumentasjon. Lagre dokumentasjonen trygt - dere kan trenge den ved klagesaker.',
    norwegianPdfPage: 59,
    euLink: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'
  },
  art14: {
    icon: '👁️',
    title: 'Artikkel 14',
    subtitle: 'Menneskelig oversikt',
    description: 'Krav til menneskelig kontroll over høyrisiko KI-systemer.',
    sections: [
      {
        title: 'Hva kreves?',
        items: [
          'Kvalifiserte personer må kunne overvåke systemet',
          'Må kunne forstå systemets beslutninger',
          'Må kunne gripe inn og overstyre KI',
          'Må kunne stoppe systemet hvis nødvendig'
        ]
      },
      {
        title: 'For skolen',
        items: [
          'Lærere må alltid kunne overstyre KI-vurderinger',
          'KI kan aldri sette karakter alene - lærer må godkjenne',
          'Lærere må forstå hvordan KI kom frem til resultatet',
          'Ha rutiner for å stoppe systemet ved feil'
        ]
      }
    ],
    practical: 'Tren lærere i hvordan de skal overvåke og overstyre KI-systemer. Dokumenter alle overstyringer.',
    norwegianPdfPage: 60,
    euLink: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'
  },
  art26: {
    icon: '👤',
    title: 'Artikkel 26',
    subtitle: 'Brukerplikter (deployers)',
    description: 'Skolens ansvar som bruker av høyrisiko KI-systemer.',
    sections: [
      {
        title: 'Skolens plikter',
        items: [
          'Bruk systemet i henhold til instruksjonene',
          'Tildel kvalifiserte personer til å overvåke systemet',
          'Logg alle relevante hendelser og feil',
          'Rapporter alvorlige hendelser til tilsynsmyndigheten',
          'Gjennomfør DPIA når det kreves',
          'Stopp bruken hvis systemet ikke fungerer som det skal'
        ]
      },
      {
        title: 'For skolen',
        items: [
          'Dere er ansvarlige selv om leverandøren eier systemet',
          'Hvis noe går galt, er det dere som må håndtere det',
          'Hold oversikt over hvordan systemet brukes',
          'Dokumenter alle avvik og hendelser'
        ]
      }
    ],
    practical: 'Lag rutiner for logging og rapportering. Bestem hvem som er ansvarlig for oppfølging av KI-systemene.',
    norwegianPdfPage: 67,
    euLink: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'
  },
  art50: {
    icon: '💬',
    title: 'Artikkel 50',
    subtitle: 'Transparensplikter',
    description: 'Krav til åpenhet når KI brukes i interaksjon med mennesker eller genererer innhold.',
    sections: [
      {
        title: 'Hva kreves?',
        items: [
          'Informer brukere om at de interagerer med KI (chatboter)',
          'Merk KI-generert innhold tydelig (tekst, bilder, lyd, video)',
          'Informer om bruk av emosjonsgjenkjenning eller biometrisk kategorisering',
          'Informer om deepfakes eller manipulert innhold'
        ]
      },
      {
        title: 'For skolen',
        items: [
          'Hvis dere bruker ChatGPT eller lignende: Informer elevene',
          'KI-genererte bilder/tekster må merkes',
          'Elever må vite når de snakker med en bot',
          'Gjelder fra august 2025 - gjør det NÅ!'
        ]
      }
    ],
    practical: 'Lag en standard informasjonstekst om KI-bruk. Lær elevene å kjenne igjen KI-generert innhold. Implementer merking av KI-output.',
    norwegianPdfPage: 82,
    euLink: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'
  }
};

function openAIActModal(articleId) {
  const modal = document.getElementById('riskModal');
  const modalBody = document.getElementById('modalBody');
  const data = aiActArticles[articleId];
  
  if (!data) return;
  
  let content = `
    <div class="modal-header">
      <span class="modal-icon">${data.icon}</span>
      <div class="modal-title">
        <h2>${data.title}</h2>
        <p class="modal-subtitle">${data.subtitle}</p>
      </div>
    </div>
    
    <div class="modal-section">
      <p><strong>${data.description}</strong></p>
    </div>
  `;
  
  data.sections.forEach(section => {
    content += `
      <div class="modal-section">
        <h3>${section.title}</h3>
        <ul class="modal-list">
          ${section.items.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `;
  });
  
  content += `
    <div class="modal-success">
      <strong>💡 Praktisk:</strong> ${data.practical}
    </div>
    
    <div class="modal-footer">
      <p style="margin-bottom: 1rem;"><strong>📄 Les artikkelen:</strong></p>
      <a href="https://www.regjeringen.no/contentassets/e823dc21809c43f2b4ba9ff1e389e245/ki-forordningen-eu-2024.1689-uoffisiell-norsk-131037.pdf#page=${data.norwegianPdfPage.toString().split(' ')[0]}" target="_blank" rel="noopener" class="cta" style="margin-bottom: 0.5rem;">
        🇳🇴 Norsk oversettelse (side ${data.norwegianPdfPage}) →
      </a>
      <a href="${data.euLink}" target="_blank" rel="noopener" class="cta secondary">
        🇪🇺 Engelsk original (EUR-Lex) →
      </a>
    </div>
  `;
  
  modalBody.innerHTML = content;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeRiskModal();
  }
});

// Fjern gammel scroll-basert navigasjon
// (Router håndterer nå all navigasjon)

