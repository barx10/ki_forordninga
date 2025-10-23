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

  const downloadResult = (title, text) => {
  const blob = new Blob(
    [ `Risikovurdering\n\n${title}\n\n${text}\n\nKilde: AI Act` ],
    { type: 'text/plain' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ki-risikovurdering.txt';
  a.click();
  URL.revokeObjectURL(url);
};

  loadFlow();
});
