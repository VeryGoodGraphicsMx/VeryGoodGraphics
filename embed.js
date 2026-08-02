(function () {
  'use strict';

  var script = document.currentScript;
  var baseUrl = script && script.src ? new URL(script.src).origin : window.location.origin;
  var memoryVisitorId = '';
  var memorySessionId = '';

  function randomId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function stableId(storage, key, kind) {
    try {
      var existing = storage.getItem(key);
      if (existing) return existing;
      var created = randomId();
      storage.setItem(key, created);
      return created;
    } catch (_) {
      if (kind === 'visitor') {
        memoryVisitorId = memoryVisitorId || randomId();
        return memoryVisitorId;
      }
      memorySessionId = memorySessionId || randomId();
      return memorySessionId;
    }
  }

  function element(tag, attributes, text) {
    var node = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function (name) {
      if (attributes[name] !== undefined && attributes[name] !== null) node.setAttribute(name, attributes[name]);
    });
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function trackingData() {
    var query = new URLSearchParams(window.location.search);
    return {
      visitor_id: stableId(window.localStorage, 'vgg_visitor_id', 'visitor'),
      session_id: stableId(window.sessionStorage, 'vgg_session_id', 'session'),
      page_url: window.location.href,
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

  function buildField(form, definition, slug) {
    var wrapper = element('div', { class: 'field' });
    var id = 'vgg-' + slug + '-' + definition.name;
    var input;

    if (definition.type === 'textarea') {
      input = element('textarea', { id: id, name: definition.name, rows: '4' });
    } else if (definition.type === 'select') {
      input = element('select', { id: id, name: definition.name });
      input.appendChild(element('option', { value: '' }, 'Selecciona una opción'));
      (definition.options || []).forEach(function (option) {
        input.appendChild(element('option', { value: option }, option));
      });
    } else {
      input = element('input', { id: id, name: definition.name, type: definition.type || 'text' });
    }

    if (definition.required) input.required = true;
    if (definition.placeholder) input.placeholder = definition.placeholder;
    if (definition.autocomplete) input.autocomplete = definition.autocomplete;

    if (definition.type === 'checkbox') {
      var consent = element('label', { class: 'consent', for: id });
      consent.appendChild(input);
      var copy = element('span');
      copy.appendChild(document.createTextNode(definition.label || 'Acepto el tratamiento de mis datos'));
      if (form.privacy_url) {
        copy.appendChild(document.createTextNode(' · '));
        copy.appendChild(element('a', { href: form.privacy_url, target: '_blank', rel: 'noopener noreferrer' }, 'Aviso de privacidad'));
      }
      if (definition.required) copy.appendChild(document.createTextNode(' *'));
      consent.appendChild(copy);
      wrapper.appendChild(consent);
      return wrapper;
    }

    wrapper.appendChild(element('label', { for: id }, definition.label + (definition.required ? ' *' : '')));
    wrapper.appendChild(input);
    return wrapper;
  }

  function render(container, config) {
    var root = container.attachShadow ? container.attachShadow({ mode: 'open' }) : container;
    var style = element('style');
    style.textContent =
      ':host{display:block;color-scheme:dark}*{box-sizing:border-box}.vgg-form{display:grid;gap:15px;font:15px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f7f7f2}' +
      '.intro{margin:0 0 4px;color:#a7aabd;line-height:1.6}.field{display:grid;gap:7px}label{color:#d8dae3;font-size:12px;font-weight:750}' +
      'input,select,textarea{width:100%;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:13px 14px;background:#11151f;color:#f7f7f2;font:inherit}' +
      'input:focus,select:focus,textarea:focus{outline:2px solid #e8ff00;outline-offset:2px;border-color:#e8ff00}textarea{min-height:118px;resize:vertical}' +
      '.consent{display:flex;align-items:flex-start;gap:10px;line-height:1.5}.consent input{width:auto;margin-top:3px}.consent a{color:#e8ff00}' +
      'button{min-height:48px;border:0;border-radius:12px;padding:13px 20px;background:#e8ff00;color:#080a10;font-weight:850;font-size:14px;cursor:pointer}' +
      'button[disabled]{opacity:.58;cursor:wait}.status{min-height:22px;margin:0;color:#a7aabd;font-size:12px}.status[data-state="error"]{color:#ff8491}.status[data-state="success"]{color:#57e389}' +
      '.hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}';
    root.appendChild(style);

    var form = element('form', { class: 'vgg-form', novalidate: '' });
    if (config.description) form.appendChild(element('p', { class: 'intro' }, config.description));
    (config.fields || []).forEach(function (field) { form.appendChild(buildField(config, field, config.slug)); });
    form.appendChild(element('input', { class: 'hp', name: 'website', type: 'text', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }));
    var button = element('button', { type: 'submit' }, config.submit_label || 'Enviar solicitud');
    var status = element('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
    form.appendChild(button);
    form.appendChild(status);
    root.appendChild(form);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      button.disabled = true;
      status.dataset.state = 'loading';
      status.textContent = 'Registrando solicitud…';
      var fields = {};
      new FormData(form).forEach(function (value, key) { fields[key] = String(value); });

      fetch(baseUrl + '/api/vgg-crm/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_key: config.slug, fields: fields, tracking: trackingData() })
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) throw new Error(body.error || 'No fue posible enviar el formulario.');
          return body;
        });
      }).then(function (body) {
        form.reset();
        status.dataset.state = 'success';
        status.textContent = body.message || config.success_message || 'Gracias. Recibimos tu solicitud.';
        container.dispatchEvent(new CustomEvent('vgg:form-submitted', { detail: { key: config.slug } }));
      }).catch(function (error) {
        status.dataset.state = 'error';
        status.textContent = error.message;
      }).finally(function () {
        button.disabled = false;
      });
    });
  }

  function initialize(container) {
    if (container.dataset.vggReady === 'true') return;
    container.dataset.vggReady = 'true';
    var key = container.getAttribute('data-vgg-form');
    fetch(baseUrl + '/api/vgg-form-config?key=' + encodeURIComponent(key))
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) throw new Error(body.error || 'Formulario no disponible.');
          return body.form;
        });
      })
      .then(function (form) { render(container, form); })
      .catch(function (error) { container.textContent = error.message; });
  }

  function boot() {
    document.querySelectorAll('[data-vgg-form]').forEach(initialize);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
