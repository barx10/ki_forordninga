// Dynamisk veiviser basert på flow.json

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

    content += `

═══════════════════════════════════════════════════════════

JURIDISK GRUNNLAG:
- EU AI Act (Artificial Intelligence Act)
- GDPR (General Data Protection Regulation)
- Opplæringsloven
- Personopplysningsloven

RESSURSER:
- Datatilsynet: https://www.datatilsynet.no/
- EU AI Act: https://artificialintelligenceact.eu/
- Nkom: https://nkom.no/

═══════════════════════════════════════════════════════════

Denne vurderingen er generert av: KI-forordningen i skolen
Versjon: 0.2 | Lisens: CC BY-SA
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

// Fjern gammel scroll-basert navigasjon
// (Router håndterer nå all navigasjon)
