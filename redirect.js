(() => {
  const oldBase = '/deaf-navi-web';
  const newBase = 'https://deaf-navi.github.io/deaf-navi-web';
  const path = location.pathname.startsWith(oldBase)
    ? location.pathname.slice(oldBase.length)
    : '/';
  const target = `${newBase}${path || '/'}${location.search}${location.hash}`;

  const link = document.querySelector('[data-new-location]');
  if (link) link.href = target;
  location.replace(target);
})();
