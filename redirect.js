(() => {
  const oldBase = '/deaf-navi-web';
  const newBase = 'https://deafnavi.com';
  const path = location.pathname.startsWith(oldBase)
    ? location.pathname.slice(oldBase.length)
    : '/';
  const target = `${newBase}${path || '/'}${location.search}${location.hash}`;

  const link = document.querySelector('[data-new-location]');
  if (link) link.href = target;
  location.replace(target);
})();
