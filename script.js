// Enkel trinnvis veiviser for å vurdere KI-verktøy i skolen.
// Alt kjører lokalt uten datalagring.

document.addEventListener('DOMContentLoaded', () => {
  const quiz = document.getElementById('quiz');
  if (!quiz) return;

  const steps = [
    {
      q: 'Hva er din rolle?',
      options: [
        { t: 'Lærer', n: 'teacher' },
        { t: 'Skoleleder', n: 'leader' },
        { t: 'IKT-ansvarlig', n: 'it' }
      ]
    },
    {
      q: 'Hvilken type KI-verktøy gjelder det?',
      options: [
        { t: 'Chatbot eller språkassistent', n: 'chatbot' },
        { t: 'Adaptive læringssystemer', n: 'adaptive' },
        { t: 'Automatisk vurdering / karaktersetting', n: 'grading' },
        { t: 'Spill eller quiz‑generator uten datainnsamling', n: 'low' }
      ]
    }
  ];

  const results = {
    chatbot: 'Transparenskrav – informer brukere og følg opp jevnlig (Art. 50).',
    adaptive: 'Høy risiko – krever dokumentasjon og overvåking (Art. 6, Annex III).',
    grading: 'Høy risiko – krever risikovurdering, menneskelig kontroll og åpenhet.',
    low: 'Minimal risiko – få krav utover grunnleggende personvern.'
  };

  let step = 0;
  let data = {};

  const renderStep = () => {
    const s = steps[step];
    quiz.innerHTML = `<h3>${s.q}</h3>`;
    s.options.forEach(o => {
      const b = document.createElement('button');
      b.textContent = o.t;
      b.className = 'cta';
      b.style.margin = '6px';
      b.onclick = () => {
        data[step] = o.n;
        step++;
        if (step < steps.length) renderStep();
        else showResult();
      };
      quiz.appendChild(b);
    });
  };

  const showResult = () => {
    const key = data[1];
    const text = results[key] || 'Ingen vurdering tilgjengelig.';
    quiz.innerHTML = `<h3>Resultat</h3><p>${text}</p>`;
    const reset = document.createElement('button');
    reset.textContent = 'Start på nytt';
    reset.className = 'cta';
    reset.onclick = () => { step = 0; data = {}; renderStep(); };
    quiz.appendChild(reset);
  };

  renderStep();
});
