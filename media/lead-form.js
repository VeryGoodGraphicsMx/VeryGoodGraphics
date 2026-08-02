(function () {
  'use strict';

  var SERVICE_ALIASES = {
    'Branding Corporativo': 'Branding',
    'Diseño Gráfico': 'Diseño gráfico',
    'Diseño Web & Landing Pages': 'Diseño web',
    'Fotografía Profesional': 'Fotografía',
    'Video & Edición': 'Video',
    'Ilustración': 'Ilustración'
  };

  function stableId(store, key) {
    try {
      var current = store.getItem(key);
      if (current) return current;
      current = crypto.randomUUID();
      store.setItem(key, current);
      return current;
    } catch (_) {
      return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
  }

  function tracking() {
    var query = new URLSearchParams(location.search);
    return {
      visitor_id: stableId(localStorage, 'vgg_visitor_id'),
      session_id: stableId(sessionStorage, 'vgg_session_id'),
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

  function value(data, preferred, legacy) {
    return String(data.get(preferred) || (legacy ? data.get(legacy) : '') || '').trim();
  }

  function crmFields(form, data) {
    var rawService = value(data, 'service', 'servicio');
    var sourceDetail = value(data, 'source_detail', 'tipo_proyecto') || form.dataset.vggSourceDetail || rawService;
    return {
      form_name: value(data, 'form-name') || form.name || 'prospectos-vgg',
      contact_name: value(data, 'contact_name', 'nombre'),
      email: value(data, 'email'),
      phone: value(data, 'phone', 'telefono'),
      company: value(data, 'company', 'empresa'),
      service: SERVICE_ALIASES[rawService] || rawService || form.dataset.vggService || 'Otro',
      budget_range: value(data, 'budget_range', 'presupuesto'),
      message: value(data, 'message', 'mensaje'),
      source: value(data, 'source') || 'Sitio web',
      source_detail: sourceDetail,
      landing_path: location.pathname
    };
  }

  async function postToCrm(form, data) {
    var response = await fetch('/api/vgg-crm/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: crmFields(form, data), tracking: tracking() })
    });
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(body.error || 'CRM no disponible');
    return body;
  }

  async function postToNetlify(data) {
    var response = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString()
    });
    if (!response.ok) throw new Error('No fue posible registrar la solicitud.');
  }

  function redirectToThanks(form, channel) {
    var destination = new URL(form.getAttribute('action') || '/gracias.html', location.origin);
    destination.searchParams.set('via', channel);
    if (form.dataset.vggSourceDetail) destination.searchParams.set('servicio', form.dataset.vggSourceDetail);
    location.assign(destination.pathname + destination.search);
  }

  document.querySelectorAll('form[data-vgg-lead-form]').forEach(function (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;

      var data = new FormData(form);
      if (String(data.get('bot-field') || '').trim()) {
        redirectToThanks(form, 'filtered');
        return;
      }

      var button = form.querySelector('[type="submit"]');
      var status = form.querySelector('[data-form-status]');
      if (!status) {
        status = document.createElement('p');
        status.className = 'form-status';
        status.setAttribute('data-form-status', '');
        status.setAttribute('role', 'status');
        button.insertAdjacentElement('afterend', status);
      }

      button.disabled = true;
      button.dataset.originalLabel = button.textContent;
      button.textContent = 'Registrando solicitud…';
      status.dataset.state = 'loading';
      status.textContent = 'Estamos guardando tus datos de forma segura.';

      try {
        await postToCrm(form, data);
        redirectToThanks(form, 'crm');
      } catch (_) {
        try {
          status.textContent = 'Usando el canal de respaldo…';
          await postToNetlify(data);
          redirectToThanks(form, 'netlify');
        } catch (fallbackError) {
          status.dataset.state = 'error';
          status.textContent = fallbackError.message + ' Escríbenos a verygoodgraphicsmx@gmail.com.';
          button.disabled = false;
          button.textContent = button.dataset.originalLabel;
        }
      }
    });
  });
})();
