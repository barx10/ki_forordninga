// Dynamisk veiviser basert på flow.json

document.addEventListener('DOMContentLoaded', () => {
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
      history = [];
      renderStep(flow.steps[0]);
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

  const calculateProgress = (currentStepId) => {
    // Enkel progresjon basert på steg-ID
    const totalSteps = flow.steps.length;
    const currentIndex = flow.steps.findIndex(s => s.id === currentStepId);
    const progress = Math.round(((currentIndex + 1) / totalSteps) * 100);
    return { current: currentIndex + 1, total: totalSteps, percent: progress };
  };

  const renderStep = (step) => {
    // Legg til i historikk
    history.push(step.id);

    const progress = calculateProgress(step.id);
    
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

// Aktiv navigasjon - oppdater aria-current når bruker klikker
document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('nav a[href^="#"]');
  
  const updateActiveNav = () => {
    const scrollPos = window.scrollY + 100;
    
    navLinks.forEach(link => {
      const section = document.querySelector(link.getAttribute('href'));
      if (section) {
        const sectionTop = section.offsetTop;
        const sectionBottom = sectionTop + section.offsetHeight;
        
        if (scrollPos >= sectionTop && scrollPos < sectionBottom) {
          navLinks.forEach(l => l.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'page');
        }
      }
    });
  };
  
  // Oppdater ved scroll
  window.addEventListener('scroll', updateActiveNav);
  
  // Oppdater ved klikk
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        navLinks.forEach(l => l.removeAttribute('aria-current'));
        link.setAttribute('aria-current', 'page');
        
        // Beregn offset for sticky header (ca 60px)
        const headerOffset = 70;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerOffset;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
  
  // Initial oppdatering
  updateActiveNav();
});
