(function () {
  'use strict';

  const buttons = document.querySelectorAll('button.filter');
  const articles = document.querySelectorAll('.card');
  const emptyMsg = document.getElementById('empty-msg');

  function apply(filter) {
    let visible = 0;
    articles.forEach((el) => {
      const cat = el.getAttribute('data-category');
      const show = filter === 'all' || cat === filter;
      el.hidden = !show;
      if (show) visible += 1;
    });
    if (emptyMsg) emptyMsg.hidden = visible > 0;
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      apply(btn.getAttribute('data-filter'));
    });
  });
})();