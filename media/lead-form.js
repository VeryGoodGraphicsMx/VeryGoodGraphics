(function () {
  'use strict';

  var loaderScript = document.currentScript;
  var upgraded = [];
  var FORM_KEYS = {
    '/': 'vgg-contacto-general',
    '/index.html': 'vgg-contacto-general',
    '/servicios/video.html': 'vgg-video-general',
    '/servicios/video-producto.html': 'vgg-video-producto',
    '/servicios/video-restaurantes.html': 'vgg-video-restaurantes',
    '/servicios/video-eventos.html': 'vgg-video-eventos',
    '/servicios/fotografia.html': 'vgg-fotografia',
    '/servicios/dron.html': 'vgg-dron'
  };

  function thanksUrl(form) {
    var destination = new URL(form.getAttribute('action') || '/gracias.html', location.origin);
    destination.searchParams.set('via', 'crm');
    if (form.dataset.vggSourceDetail) destination.searchParams.set('servicio', form.dataset.vggSourceDetail);
    return destination.pathname + destination.search;
  }

  function restore(entry) {
    if (!entry || !entry.form) return;
    clearTimeout(entry.fallbackTimer);
    entry.generated.remove();
    entry.form.hidden = false;
    entry.form.removeAttribute('aria-hidden');
    entry.form.removeAttribute('data-vgg-fallback');
  }

  function restoreAll() {
    upgraded.slice().forEach(restore);
  }

  function upgrade(form) {
    var key = form.dataset.vggFormKey || FORM_KEYS[location.pathname];
    if (!key) return;
    var generated = document.createElement('div');
    generated.className = 'vgg-generated-form';
    generated.setAttribute('data-vgg-form', key);
    generated.setAttribute('aria-busy', 'true');
    generated.innerHTML = '<p class="vgg-form-loading">Cargando formulario seguro…</p>';
    form.insertAdjacentElement('beforebegin', generated);
    form.hidden = true;
    form.setAttribute('aria-hidden', 'true');
    form.setAttribute('data-vgg-fallback', '');
    var entry = { form: form, generated: generated };
    entry.fallbackTimer = setTimeout(function () { restore(entry); }, 8000);
    upgraded.push(entry);

    generated.addEventListener('vgg:form-ready', function () {
      clearTimeout(entry.fallbackTimer);
      generated.removeAttribute('aria-busy');
    }, { once: true });
    generated.addEventListener('vgg:form-error', function () {
      restore(entry);
    }, { once: true });
    generated.addEventListener('vgg:form-submitted', function () {
      location.assign(thanksUrl(form));
    }, { once: true });
  }

  document.querySelectorAll('form[data-vgg-lead-form]').forEach(upgrade);
  if (!upgraded.length) return;

  if (window.VGGForms && typeof window.VGGForms.boot === 'function') {
    window.VGGForms.boot();
    return;
  }

  var runtime = document.querySelector('script[data-vgg-embed-runtime]');
  if (runtime) {
    runtime.addEventListener('load', function () { window.VGGForms && window.VGGForms.boot(); }, { once: true });
    runtime.addEventListener('error', restoreAll, { once: true });
    return;
  }

  runtime = document.createElement('script');
  runtime.src = new URL('../embed.js', loaderScript && loaderScript.src ? loaderScript.src : location.href).href;
  runtime.async = true;
  runtime.setAttribute('data-vgg-embed-runtime', '');
  runtime.addEventListener('error', restoreAll, { once: true });
  document.head.appendChild(runtime);
})();
