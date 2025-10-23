// Dynamisk veiviser basert på flow.json

document.addEventListener('DOMContentLoaded', () => {
  const quiz = document.getElementById('quiz');
  if (!quiz) return;

  let flow = null;

  const loadFlow = async () => {
    const res = await fetch('flow.json');
    flow = await res.json();
    renderStep(flow.steps[0]);
  };

  const renderStep = (step) => {
    quiz.innerHTML = `<h3>${step.question}</h3>`;
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
      quiz.appendChild(b);
    });
  };

  const showResult = (key) => {
  const r = flow.results[key];
  quiz.innerHTML = `
    <div class="card ${r.class}">
      <h3>${r.title}</h3>
      <p>${r.text}</p>
    </div>
  `;

  const dl = document.createElement('button');
  dl.className = 'cta';
  dl.textContent = 'Last ned vurdering';
  dl.onclick = () => downloadResult(r.title, r.text);
  quiz.appendChild(dl);

  const reset = document.createElement('button');
  reset.className = 'cta';
  reset.textContent = 'Start på nytt';
  reset.onclick = () => loadFlow();
  quiz.appendChild(reset);
};


  loadFlow();
});
