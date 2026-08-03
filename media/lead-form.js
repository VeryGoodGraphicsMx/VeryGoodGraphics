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

  function randomId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function stableId(storage, key) {
    try {
      var existing = storage.getItem(key);
      if (existing) return existing;
      var created = randomId();
      storage.setItem(key, created);
      return created;
    } catch (_) {
      return randomId();
    }
  }

  function trackingData() {
    var query = new URLSearchParams(location.search);
    return {
      visitor_id: stableId(window.localStorage, 'vgg_visitor_id'),
      session_id: stableId(window.sessionStorage, 'vgg_session_id'),
      page_url: location.href,
      page_title: document.title,
      referrer: document.referrer,
      utm_source: query.get('utm_source') || '',
      utm_medium: query.get('utm_medium') || '',
      utm_campaign: query.get('utm_campaign') || '',
      utm_content: query.get('utm_content') || '',
      utm_term: query.get('utm_term') || '',
      gclid: query.get('gclid') || '',
      fbclid: query.get('fbclid') || ''
    };
  }

  function normalizeService(value) {
    var services = {
      'Branding Corporativo': 'Branding',
      'Diseño Gráfico': 'Diseño gráfico',
      'Diseño Web & Landing Pages': 'Diseño web',
      'Fotografía Profesional': 'Fotografía',
      'Video & Edición': 'Video'
    };
    return services[value] || value;
  }

  function fallbackFields(form) {
    var raw = {};
    new FormData(form).forEach(function (value, key) { raw[key] = String(value); });
    return {
      form_name: raw['form-name'] || form.getAttribute('name') || 'contacto-vgg',
      contact_name: raw.contact_name || raw.nombre || '',
      email: raw.email || '',
      phone: raw.phone || '',
      company: raw.company || '',
      service: normalizeService(raw.service || raw.servicio || form.dataset.vggService || ''),
      project_type: raw.project_type || raw.tipo_proyecto || '',
      budget_range: raw.budget_range || raw.presupuesto || '',
      start_window: raw.start_window || raw.inicio || '',
      event_date: raw.event_date || '',
      message: raw.message || raw.mensaje || '',
      source: raw.source || 'Sitio web',
      source_detail: raw.source_detail || form.dataset.vggSourceDetail || '',
      landing_path: location.pathname,
      website: raw.website || raw['bot-field'] || ''
    };
  }

  function fallbackStatus(form) {
    var status = form.querySelector('[data-form-status]');
    if (status) return status;
    status = document.createElement('p');
    status.className = 'form-status';
    status.setAttribute('data-form-status', '');
    status.setAttribute('role', 'status');
    form.appendChild(status);
    return status;
  }

  function enableFallbackSubmit(entry) {
    entry.form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!entry.form.reportValidity()) return;
      var button = entry.form.querySelector('[type="submit"]');
      var status = fallbackStatus(entry.form);
      if (button) button.disabled = true;
      status.dataset.state = 'loading';
      status.textContent = 'Registrando solicitud…';
      fetch('/api/vgg-crm/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fallbackFields(entry.form), tracking: trackingData() })
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) throw new Error(body.error || 'No fue posible enviar el formulario.');
          return body;
        });
      }).then(function () {
        entry.form.reset();
        location.assign(thanksUrl(entry.form));
      }).catch(function (error) {
        status.dataset.state = 'error';
        status.textContent = error.message;
      }).finally(function () {
        if (button) button.disabled = false;
      });
    });
  }

  function restore(entry) {
    if (!entry || !entry.form || entry.active) return;
    entry.restored = true;
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
    generated.setAttribute('aria-hidden', 'true');
    generated.hidden = true;
    generated.innerHTML = '<p class="vgg-form-loading">Cargando formulario seguro…</p>';
    form.insertAdjacentElement('beforebegin', generated);
    form.setAttribute('data-vgg-fallback', '');
    var entry = { form: form, generated: generated, active: false, restored: false };
    entry.fallbackTimer = setTimeout(function () { restore(entry); }, 8000);
    upgraded.push(entry);
    enableFallbackSubmit(entry);

    generated.addEventListener('vgg:form-ready', function () {
      if (entry.restored) return;
      entry.active = true;
      clearTimeout(entry.fallbackTimer);
      generated.removeAttribute('aria-busy');
      generated.removeAttribute('aria-hidden');
      generated.hidden = false;
      form.hidden = true;
      form.setAttribute('aria-hidden', 'true');
    }, { once: true });
    generated.addEventListener('vgg:form-error', function () {
      restore(entry);
    }, { once: true });
    generated.addEventListener('vgg:form-submitted', function () {
      location.assign(thanksUrl(form));
    }, { once: true });
    form.addEventListener('focusin', function () { restore(entry); }, { once: true });
    form.addEventListener('input', function () { restore(entry); }, { once: true });
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
