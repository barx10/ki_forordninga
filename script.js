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
  const views = ['hjem', 'laer', 'sjekk', 'tiltak', 'ressurser', 'labs'];
  const transition = document.getElementById('page-transition');
  
  const showView = (viewId) => {
    // Trigger transition overlay
    if (transition) {
      transition.classList.add('active');
    }
    
    // Wait for overlay to fade in
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
      }, 50);
      
    }, 150); // Half of transition duration for smooth crossfade
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

// === CHAT FUNCTIONALITY ===
let messageCount = 0;
const MAX_MESSAGES = 10;

// Supabase configuration (PUBLIC keys - safe for frontend)
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Erstatt med din URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Erstatt med din anon key

function toggleChatInfo() {
  const infoPanel = document.getElementById('chatInfo');
  if (infoPanel.style.display === 'none') {
    infoPanel.style.display = 'block';
  } else {
    infoPanel.style.display = 'none';
  }
}

function askQuestion(question) {
  const input = document.getElementById('chatInput');
  input.value = question;
  input.focus();
  // Auto-expand textarea
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
}

function handleChatKeydown(event) {
  // Send on Enter (without Shift)
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
  
  // Auto-expand textarea
  const textarea = event.target;
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  // Check message limit
  if (messageCount >= MAX_MESSAGES) {
    showChatStatus('Du har nådd grensen på 10 meldinger. Last inn siden på nytt for å fortsette.');
    return;
  }
  
  // Add user message to chat
  addMessageToChat('user', message);
  
  // Clear input
  input.value = '';
  input.style.height = 'auto';
  
  // Increment counter
  messageCount++;
  updateMessageCounter();
  
  // Show typing indicator
  showTypingIndicator();
  
  // Call Supabase Edge Function
  callChatAPI(message);
}

function addMessageToChat(role, content, sources = null) {
  const messagesContainer = document.getElementById('chatMessages');
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🤖';
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  
  // Convert markdown-style links to HTML
  const formattedContent = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  messageContent.innerHTML = `<p>${formattedContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
  
  // Add sources if provided
  if (sources && sources.length > 0) {
    const sourcesDiv = document.createElement('div');
    sourcesDiv.className = 'message-sources';
    sourcesDiv.innerHTML = `<strong>📚 Kilder:</strong> ${sources.join(', ')}`;
    messageContent.appendChild(sourcesDiv);
  }
  
  // Add action buttons for assistant messages
  if (role === 'assistant') {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    actionsDiv.innerHTML = `
      <button class="message-action-btn" onclick="copyMessage(this)">📋 Kopier</button>
      <button class="message-action-btn" onclick="rateMessage(this, 'up')">👍</button>
      <button class="message-action-btn" onclick="rateMessage(this, 'down')">👎</button>
    `;
    messageContent.appendChild(actionsDiv);
  }
  
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(messageContent);
  
  messagesContainer.appendChild(messageDiv);
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
  const messagesContainer = document.getElementById('chatMessages');
  
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-message assistant typing-indicator';
  typingDiv.id = 'typingIndicator';
  typingDiv.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content">
      <p style="color: var(--text-secondary);">Skriver...</p>
    </div>
  `;
  
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.remove();
  }
}

async function callChatAPI(message) {
  // Check if API is configured
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    removeTypingIndicator();
    
    const response = `⚠️ <strong>Chat-funksjonen er ikke konfigurert ennå.</strong>

Backend er deployert, men API-nøkler må legges inn i koden.

<strong>For utviklere:</strong> Se \`supabase/DEPLOY.md\` for instruksjoner.

<strong>For brukere:</strong> Prøv <a href="#sjekk">veiviseren</a> eller <a href="#laer">lær-seksjonen</a>.`;
    
    addMessageToChat('assistant', response);
    
    if (messageCount === 1) {
      document.getElementById('chatStatus').style.display = 'block';
    }
    return;
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message })
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    removeTypingIndicator();
    
    // Format sources as string array
    const sources = data.sources.map(s => 
      `Artikkel ${s.article}: ${s.title}`
    );
    
    addMessageToChat('assistant', data.message, sources);
    
  } catch (error) {
    console.error('Chat API error:', error);
    
    removeTypingIndicator();
    
    const errorMessage = `❌ <strong>Kunne ikke hente svar.</strong>

Det oppstod en feil ved kommunikasjon med serveren. 

Prøv igjen senere, eller bruk <a href="#sjekk">veiviseren</a> for å finne svar.`;
    
    addMessageToChat('assistant', errorMessage);
  }
}

function updateMessageCounter() {
  const counter = document.getElementById('messageCounter');
  counter.textContent = `${messageCount}/${MAX_MESSAGES}`;
  
  // Change color when approaching limit
  if (messageCount >= MAX_MESSAGES * 0.8) {
    counter.style.color = '#f59e0b';
  }
  if (messageCount >= MAX_MESSAGES) {
    counter.style.color = '#ef4444';
  }
}

function showChatStatus(message) {
  const statusDiv = document.getElementById('chatStatus');
  statusDiv.innerHTML = `<div class="alert-box">⚠️ ${message}</div>`;
  statusDiv.style.display = 'block';
}

function copyMessage(button) {
  const messageContent = button.closest('.message-content');
  const text = messageContent.querySelector('p').innerText;
  
  navigator.clipboard.writeText(text).then(() => {
    button.textContent = '✓ Kopiert!';
    setTimeout(() => {
      button.textContent = '📋 Kopier';
    }, 2000);
  });
}

function rateMessage(button, rating) {
  // Store rating (implement later with backend)
  console.log('Message rated:', rating);
  
  // Visual feedback
  button.style.opacity = '0.5';
  button.disabled = true;
  
  // Disable the other rating button
  const actionsDiv = button.parentElement;
  const buttons = actionsDiv.querySelectorAll('.message-action-btn');
  buttons.forEach(btn => {
    if (btn !== button && (btn.textContent.includes('👍') || btn.textContent.includes('👎'))) {
      btn.disabled = true;
      btn.style.opacity = '0.3';
    }
  });
}

// Fjern gammel scroll-basert navigasjon
// (Router håndterer nå all navigasjon)
