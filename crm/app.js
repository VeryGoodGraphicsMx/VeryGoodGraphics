(() => {
  'use strict';

  const STAGES = [
    ['new', 'Nuevo'],
    ['contacted', 'Contactado'],
    ['qualified', 'Calificado'],
    ['proposal', 'Propuesta'],
    ['negotiation', 'Negociación'],
    ['won', 'Ganado'],
  ];
  const PROJECT_STAGES = [
    ['kickoff', 'Kickoff'],
    ['production', 'Producción'],
    ['review', 'Revisión'],
    ['delivery', 'Entrega'],
  ];
  const ROLE_NAMES = { owner: 'Dirección', sales: 'Comercial', production: 'Producción' };
  const PRIORITY_NAMES = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };
  const PROPOSAL_NAMES = { draft: 'Borrador', approved: 'Aprobada internamente', sent: 'Enviada', accepted: 'Aceptada', rejected: 'Rechazada' };
  const FORM_FIELDS = {
    phone: { name: 'phone', label: 'Teléfono', type: 'tel', autocomplete: 'tel' },
    company: { name: 'company', label: 'Empresa', type: 'text', autocomplete: 'organization' },
    service: { name: 'service', label: 'Servicio', type: 'select', options: ['Branding', 'Diseño gráfico', 'Diseño web', 'Fotografía', 'Video', 'Dron', 'Ilustración', 'Marketing', 'Otro'] },
    budget_range: { name: 'budget_range', label: 'Presupuesto', type: 'select', options: ['$5,000–$15,000 MXN', '$15,000–$35,000 MXN', '$35,000–$75,000 MXN', 'Más de $75,000 MXN', 'Necesito orientación'] },
    message: { name: 'message', label: 'Mensaje', type: 'textarea' },
    consent: { name: 'consent', label: 'Acepto el tratamiento de mis datos', type: 'checkbox', required: true },
  };
  const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const shortDate = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' });
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const demoMode = new URLSearchParams(location.search).get('demo') === '1';
  const authSearch = new URLSearchParams(location.search);
  const authHash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const recoveryCallback = authSearch.get('type') === 'recovery' || authHash.get('type') === 'recovery';
  const recoveryRequested = authSearch.get('recovery') === '1';
  const recoveryError = authSearch.get('error_description') || authHash.get('error_description') || '';
  const FORCE_REAUTH_KEY = 'vgg_crm_force_reauthentication';

  let client = null;
  let accessToken = '';
  let recoveryMode = recoveryCallback || recoveryRequested;
  let recoverySessionReady = recoveryCallback;
  let resetCooldownTimer = null;
  let currentView = 'dashboard';
  let selectedLeadId = null;
  let toastTimer = null;
  let state = emptyState();

  function emptyState() {
    return {
      profile: null,
      leads: [], clients: [], proposals: [], projects: [], tasks: [], payments: [], activities: [], profiles: [], forms: [], assignment_rules: [], form_submissions: [], kickoffs: [],
      system: { database: false, form: false, automation: false },
    };
  }

  function demoState() {
    const now = new Date();
    const isoDays = (offset) => new Date(now.getTime() + offset * 86400000).toISOString();
    return {
      profile: { id: 'demo-owner', full_name: 'Juan Palao', role: 'owner', email: 'direccion@verygoodgraphics.mx' },
      leads: [
        { id: 'lead-1', contact_name: 'Mariana Torres', company: 'Nébula Café', email: 'mariana@ejemplo.mx', phone: '55 0000 1001', service: 'Branding', budget_range: '$35,000–$75,000 MXN', stage: 'negotiation', priority: 'urgent', score: 91, source: 'Sitio web', message: 'Nueva marca de café y empaque para lanzamiento nacional.', created_at: isoDays(-7), next_action_at: isoDays(0) },
        { id: 'lead-2', contact_name: 'Eduardo Peña', company: 'Atlas Legal', email: 'eduardo@ejemplo.mx', phone: '55 0000 1002', service: 'Diseño web', budget_range: '$35,000–$75,000 MXN', stage: 'proposal', priority: 'high', score: 84, source: 'Referido', message: 'Sitio institucional con contenido y captación de prospectos.', created_at: isoDays(-5), next_action_at: isoDays(1) },
        { id: 'lead-3', contact_name: 'Sofía Mendoza', company: 'Casa Lumen', email: 'sofia@ejemplo.mx', phone: '55 0000 1003', service: 'Fotografía', budget_range: '$15,000–$35,000 MXN', stage: 'qualified', priority: 'high', score: 77, source: 'Instagram', message: 'Fotografía para catálogo de temporada.', created_at: isoDays(-3), next_action_at: isoDays(2) },
        { id: 'lead-4', contact_name: 'Andrés Villar', company: 'Estudio Norte', email: 'andres@ejemplo.mx', phone: '55 0000 1004', service: 'Video', budget_range: '$15,000–$35,000 MXN', stage: 'contacted', priority: 'normal', score: 66, source: 'Formulario web', source_detail: 'Video y fotografía de producto', form_id: 'form-demo', landing_path: '/servicios/video-producto.html', landing_url: 'https://www.verygoodgraphics.mx/servicios/video-producto.html?utm_source=google&utm_medium=cpc&utm_campaign=producto', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'producto', message: 'Video corto de presentación del despacho.', created_at: isoDays(-2), next_action_at: isoDays(0) },
        { id: 'lead-5', contact_name: 'Paola Ríos', company: 'Taller Origen', email: 'paola@ejemplo.mx', phone: '', service: 'Diseño gráfico', budget_range: '$5,000–$15,000 MXN', stage: 'new', priority: 'normal', score: 48, source: 'Cotizador', message: 'Piezas mensuales para redes.', created_at: isoDays(-1), next_action_at: isoDays(0) },
        { id: 'lead-6', contact_name: 'Carlos Suárez', company: 'Ruta Viva', email: 'carlos@ejemplo.mx', phone: '55 0000 1006', service: 'Dron', budget_range: 'Más de $75,000 MXN', stage: 'won', priority: 'high', score: 96, source: 'Referido', message: 'Producción audiovisual para campaña turística.', created_at: isoDays(-22), next_action_at: null },
      ],
      clients: [
        { id: 'client-1', name: 'Ruta Viva', contact_name: 'Carlos Suárez', email: 'carlos@ejemplo.mx' },
        { id: 'client-2', name: 'Museo Horizonte', contact_name: 'Elena Cruz', email: 'elena@ejemplo.mx' },
        { id: 'client-3', name: 'Aflora', contact_name: 'Daniel Soto', email: 'daniel@ejemplo.mx' },
      ],
      proposals: [
        { id: 'proposal-1', lead_id: 'lead-1', title: 'Identidad y lanzamiento Nébula', amount_mxn: 68000, estimated_cost_mxn: 28000, margin_percent: 58.8, status: 'draft', scope: 'Estrategia, identidad, empaque base y guía de lanzamiento.', created_at: isoDays(-2) },
        { id: 'proposal-2', lead_id: 'lead-2', title: 'Portal comercial Atlas', amount_mxn: 52000, estimated_cost_mxn: 22500, margin_percent: 56.7, status: 'approved', scope: 'Arquitectura, UI, desarrollo y configuración de medición.', created_at: isoDays(-3) },
        { id: 'proposal-3', lead_id: 'lead-3', title: 'Catálogo Casa Lumen', amount_mxn: 24000, estimated_cost_mxn: 13800, margin_percent: 42.5, status: 'draft', scope: 'Producción de dos jornadas y edición de 60 fotografías.', created_at: isoDays(-1) },
      ],
      projects: [
        { id: 'project-1', client_id: 'client-1', name: 'Campaña Ruta Viva', service: 'Video + dron', status: 'production', progress: 58, due_date: isoDays(16), budget_mxn: 96000, cost_mxn: 39000, spent_mxn: 23100 },
        { id: 'project-2', client_id: 'client-2', name: 'Temporada Horizonte', service: 'Diseño gráfico', status: 'review', progress: 78, due_date: isoDays(8), budget_mxn: 44000, cost_mxn: 19000, spent_mxn: 17400 },
        { id: 'project-3', client_id: 'client-3', name: 'Rebranding Aflora', service: 'Branding', status: 'kickoff', progress: 18, due_date: isoDays(34), budget_mxn: 72000, cost_mxn: 30000, spent_mxn: 5200 },
      ],
      tasks: [
        { id: 'task-1', title: 'Aprobar propuesta de Nébula', priority: 'urgent', due_at: isoDays(0), status: 'pending', lead_id: 'lead-1' },
        { id: 'task-2', title: 'Dar seguimiento a Estudio Norte', priority: 'high', due_at: isoDays(0), status: 'pending', lead_id: 'lead-4' },
        { id: 'task-3', title: 'Confirmar materiales de Ruta Viva', priority: 'normal', due_at: isoDays(2), status: 'pending', project_id: 'project-1' },
        { id: 'task-4', title: 'Revisar margen de Casa Lumen', priority: 'high', due_at: isoDays(1), status: 'pending', lead_id: 'lead-3' },
        { id: 'task-5', title: 'Enviar resumen de kickoff Aflora', priority: 'normal', due_at: isoDays(-1), status: 'done', project_id: 'project-3', completed_at: isoDays(-1) },
      ],
      payments: [
        { id: 'payment-1', project_id: 'project-1', concept: 'Anticipo 50%', amount_mxn: 48000, due_date: isoDays(-12), status: 'paid', paid_at: isoDays(-13) },
        { id: 'payment-2', project_id: 'project-1', concept: 'Liquidación', amount_mxn: 48000, due_date: isoDays(16), status: 'pending' },
        { id: 'payment-3', project_id: 'project-2', concept: 'Segundo pago', amount_mxn: 22000, due_date: isoDays(3), status: 'pending' },
        { id: 'payment-4', project_id: 'project-3', concept: 'Anticipo 50%', amount_mxn: 36000, due_date: isoDays(-4), status: 'paid', paid_at: isoDays(-4) },
      ],
      activities: [
        { id: 'activity-1', lead_id: 'lead-1', kind: 'note', body: 'Pidió ajustar el calendario para presentar internamente el viernes.', created_at: isoDays(-1) },
        { id: 'activity-2', lead_id: 'lead-1', kind: 'stage_change', body: 'El prospecto pasó a negociación.', created_at: isoDays(-2) },
        { id: 'activity-3', lead_id: 'lead-2', kind: 'proposal', body: 'Propuesta aprobada internamente; lista para envío.', created_at: isoDays(-1) },
      ],
      forms: [
        { id: 'form-demo', slug: 'vgg-video-producto', name: 'Video y fotografía de producto', description: 'Landing enfocada en producto y e-commerce.', campaign: 'SEO audiovisual · Producto', service: 'Video', active: true, allowed_domains: ['verygoodgraphics.mx'], fields: [{ name: 'contact_name', label: 'Nombre', type: 'text', required: true }, { name: 'email', label: 'Correo', type: 'email', required: true }, { ...FORM_FIELDS.phone }, { ...FORM_FIELDS.company }, { ...FORM_FIELDS.budget_range }, { ...FORM_FIELDS.message, required: true }], submit_label: 'Recibir ruta de producción', success_message: 'Gracias. Recibimos tu solicitud.', privacy_url: null, default_owner_id: 'demo-owner', created_at: isoDays(-12) },
      ],
      form_submissions: [
        { id: 'submission-demo', lead_id: 'lead-4', form_id: 'form-demo', form_name: 'Video y fotografía de producto', page_path: '/servicios/video-producto.html', page_url: 'https://www.verygoodgraphics.mx/servicios/video-producto.html?utm_source=google&utm_campaign=producto', domain: 'verygoodgraphics.mx', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'producto', created_at: isoDays(-2) },
      ],
      system: { database: false, form: false, automation: false },
    };
  }

  const safe = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const id = () => (crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}-${Math.random()}`);
  const asDate = (value) => value ? new Date(value) : null;
  const fmtDate = (value, compact = false) => {
    const parsed = asDate(value);
    return parsed && !Number.isNaN(parsed.valueOf()) ? (compact ? shortDate : date).format(parsed) : 'Sin fecha';
  };
  const percent = (amount, cost) => Number(amount) > 0 ? ((Number(amount) - Number(cost || 0)) / Number(amount)) * 100 : 0;
  const daysFromNow = (value) => value ? Math.ceil((new Date(value).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;
  const stageName = (value) => STAGES.find(([key]) => key === value)?.[1] || value || 'Sin etapa';
  const projectStageName = (value) => PROJECT_STAGES.find(([key]) => key === value)?.[1] || value || 'Sin etapa';
  const leadById = (leadId) => state.leads.find((lead) => lead.id === leadId);
  const clientById = (clientId) => state.clients.find((client) => client.id === clientId);
  const projectById = (projectId) => state.projects.find((project) => project.id === projectId);
  const formById = (formId) => state.forms.find((form) => form.id === formId);
  const relationName = (item) => leadById(item.lead_id)?.company || projectById(item.project_id)?.name || 'General';
  const initials = (name = 'VGG') => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const formSnippet = (slug) => `<div data-vgg-form="${slug}"></div>\n<script async src="https://www.verygoodgraphics.mx/embed.js"><\/script>`;
  const formSlug = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

  function pageLabel(value) {
    if (!value) return '—';
    try {
      const url = new URL(value, location.origin);
      return `${url.pathname}${url.search}`;
    } catch (_) {
      return String(value);
    }
  }

  function notify(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  async function api(path, options = {}) {
    const response = await fetch(`/api/vgg-crm/${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'No fue posible completar la operación.');
    return payload;
  }

  async function boot() {
    bindEvents();
    fillFilters();
    if (demoMode) {
      state = { ...emptyState(), ...demoState() };
      $('#demo-banner').hidden = false;
      showApp();
      return;
    }

    try {
      const config = await api('config');
      if (!config.supabaseUrl || !config.supabasePublishableKey || !window.supabase) throw new Error('El CRM de VGG aún no tiene una base conectada.');
      client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      client.auth.onAuthStateChange((event, sessionValue) => {
        if (event === 'SIGNED_OUT') {
          accessToken = '';
          if (!recoveryMode) showAuth();
          return;
        }
        if (sessionValue?.access_token) accessToken = sessionValue.access_token;
        if (event === 'PASSWORD_RECOVERY') {
          recoveryMode = true;
          recoverySessionReady = Boolean(sessionValue?.access_token);
          showPasswordRecovery();
        }
      });
      const { data: { session } } = await client.auth.getSession();
      if (localStorage.getItem(FORCE_REAUTH_KEY) === '1' && !recoveryMode) {
        await client.auth.signOut({ scope: 'local' });
        accessToken = '';
        showAuth('Inicia sesión con tu nueva contraseña para continuar.');
      } else if (recoveryMode) {
        if (recoveryError || !session || !recoverySessionReady) {
          await client.auth.signOut({ scope: 'local' });
          recoveryMode = false;
          recoverySessionReady = false;
          history.replaceState(null, '', location.pathname);
          throw new Error('El enlace de recuperación expiró, ya fue utilizado o dejó de ser válido al solicitar otro. Solicita uno nuevo y abre únicamente el correo más reciente.');
        }
        accessToken = session.access_token;
        showPasswordRecovery();
      } else if (session) {
        accessToken = session.access_token;
        await loadData();
        showApp();
      } else {
        showAuth();
      }
    } catch (error) {
      showAuth(error.message);
    }
  }

  async function loadData() {
    const payload = await api('data');
    state = { ...emptyState(), ...payload, system: { database: true, form: Boolean(payload.system?.form), automation: Boolean(payload.system?.automation) } };
  }

  function showAuth(message = '') {
    document.body.classList.remove('is-loading');
    $('#app-shell').hidden = true;
    $('#auth-shell').hidden = false;
    $('#login-panel').hidden = false;
    $('#password-recovery-panel').hidden = true;
    $('#auth-message').textContent = message;
  }

  function showPasswordRecovery(message = '') {
    document.body.classList.remove('is-loading');
    $('#app-shell').hidden = true;
    $('#auth-shell').hidden = false;
    $('#login-panel').hidden = true;
    $('#password-recovery-panel').hidden = false;
    $('#password-recovery-message').textContent = message;
    $('#new-password').focus();
  }

  function showApp() {
    if (localStorage.getItem(FORCE_REAUTH_KEY) === '1') return showAuth('Inicia sesión con tu nueva contraseña para continuar.');
    if (recoveryMode) {
      if (recoverySessionReady) return showPasswordRecovery();
      return showAuth('Completa la recuperación de contraseña antes de entrar al CRM.');
    }
    document.body.classList.remove('is-loading');
    $('#auth-shell').hidden = true;
    $('#app-shell').hidden = false;
    syncProfile();
    renderAll();
  }

  function syncProfile() {
    const profile = state.profile || {};
    const name = profile.full_name || profile.email?.split('@')[0] || 'Equipo VGG';
    $('#user-name').textContent = name;
    $('#user-role').textContent = ROLE_NAMES[profile.role] || 'Colaborador';
    $('#user-avatar').textContent = initials(name);
    $('#greeting').textContent = `Hola, ${name.split(' ')[0]}.`;
    $$('.owner-only').forEach((element) => { element.hidden = profile.role !== 'owner'; });
    $('#db-status-dot').classList.toggle('standby', !state.system.database);
    $('#db-status-copy').textContent = state.system.database
      ? 'Conectada a la instancia independiente de VGG y protegida por el backend.'
      : 'Demo local: falta conectar una cuenta Supabase independiente de VGG.';
  }

  function renderAll() {
    renderDashboard();
    renderPipeline();
    renderLeads();
    renderProposals();
    renderProjects();
    renderTasks();
    renderFinance();
    renderTeam();
    renderForms();
    renderFormSubmissions();
    renderAssignment();
    fillRelations();
    $('#nav-lead-count').textContent = state.leads.filter((lead) => !['won', 'lost'].includes(lead.stage)).length;
    $('#nav-task-count').textContent = state.tasks.filter((task) => task.status !== 'done').length;
    if (selectedLeadId) renderLeadDetail(selectedLeadId);
  }

  function renderDashboard() {
    const openLeads = state.leads.filter((lead) => !['won', 'lost'].includes(lead.stage));
    const pipelineValue = state.proposals.filter((proposal) => !['rejected'].includes(proposal.status)).reduce((total, proposal) => total + Number(proposal.amount_mxn || 0), 0);
    const pendingRevenue = state.payments.filter((payment) => payment.status === 'pending').reduce((total, payment) => total + Number(payment.amount_mxn || 0), 0);
    const urgentTasks = state.tasks.filter((task) => task.status !== 'done' && (task.priority === 'urgent' || daysFromNow(task.due_at) <= 0));
    const activeProjects = state.projects.filter((project) => !['completed', 'cancelled'].includes(project.status));
    const averageMargin = activeProjects.length ? activeProjects.reduce((total, project) => total + percent(project.budget_mxn, project.cost_mxn), 0) / activeProjects.length : 0;
    const kpis = [
      ['Prospectos abiertos', openLeads.length, 'requieren avance', openLeads.length > 5 ? 'warn' : ''],
      ['Pipeline cotizado', money.format(pipelineValue), 'valor sin cerrar', ''],
      ['Por cobrar', money.format(pendingRevenue), 'pagos pendientes', pendingRevenue ? 'warn' : 'good'],
      ['Atención hoy', urgentTasks.length, 'acciones prioritarias', urgentTasks.length ? 'bad' : 'good'],
      ['Margen previsto', `${averageMargin.toFixed(0)}%`, 'objetivo ≥ 50%', averageMargin >= 50 ? 'good' : 'bad'],
    ];
    $('#dashboard-kpis').innerHTML = kpis.map(([label, value, copy, tone]) => `<article class="kpi ${tone}"><small>${safe(label)}</small><strong>${safe(value)}</strong><span>${safe(copy)}</span></article>`).join('');

    const maxCount = Math.max(1, ...STAGES.map(([stage]) => state.leads.filter((lead) => lead.stage === stage).length));
    $('#pipeline-summary').innerHTML = STAGES.slice(0, 5).map(([stage, label]) => {
      const count = state.leads.filter((lead) => lead.stage === stage).length;
      return `<div class="pipeline-row"><label>${safe(label)}</label><div class="pipeline-bar"><i style="width:${Math.max(count ? 12 : 0, count / maxCount * 100)}%"></i></div><b>${count}</b></div>`;
    }).join('') || empty('Sin prospectos todavía.');

    const attention = buildAttention().slice(0, 5);
    $('#attention-list').innerHTML = attention.length ? attention.map((item) => `<button class="attention-item" data-attention="${safe(item.id)}"><i></i><span><b>${safe(item.title)}</b><p>${safe(item.copy)}</p></span><time>${safe(item.when)}</time></button>`).join('') : empty('Todo está al día.');

    $('#active-projects').innerHTML = activeProjects.length ? activeProjects.slice(0, 3).map(projectMini).join('') : empty('El primer proyecto aparecerá aquí cuando una propuesta sea aceptada.');
  }

  function buildAttention() {
    const items = state.tasks.filter((task) => task.status !== 'done').map((task) => ({ id: task.lead_id || task.project_id || task.id, title: task.title, copy: relationName(task), when: daysFromNow(task.due_at) < 0 ? 'Vencida' : daysFromNow(task.due_at) === 0 ? 'Hoy' : fmtDate(task.due_at, true), sort: new Date(task.due_at).valueOf() }));
    state.proposals.filter((proposal) => proposal.status === 'draft').forEach((proposal) => {
      const lead = leadById(proposal.lead_id);
      items.push({ id: proposal.lead_id, title: proposal.margin_percent < 50 ? 'Revisar margen antes de aprobar' : 'Aprobar propuesta', copy: lead?.company || proposal.title, when: `${Number(proposal.margin_percent).toFixed(0)}% margen`, sort: new Date(proposal.created_at).valueOf() });
    });
    return items.sort((a, b) => a.sort - b.sort);
  }

  function projectMini(project) {
    const clientName = clientById(project.client_id)?.name || 'Cliente';
    return `<article class="project-mini"><header><h3>${safe(project.name)}</h3><span class="tag purple">${safe(projectStageName(project.status))}</span></header><p>${safe(clientName)} · ${safe(project.service)}</p><div class="progress"><i style="width:${Math.min(100, Number(project.progress || 0))}%"></i></div><footer><span>${Number(project.progress || 0)}% completo</span><span>${fmtDate(project.due_date, true)}</span></footer></article>`;
  }

  function renderPipeline() {
    $('#kanban').innerHTML = STAGES.map(([stage, label]) => {
      const leads = state.leads.filter((lead) => lead.stage === stage);
      return `<section class="kanban-column" data-stage="${stage}"><header><span>${safe(label)}</span><b>${leads.length}</b></header>${leads.length ? leads.map((lead) => `<article class="lead-card" data-lead-id="${safe(lead.id)}"><h3>${safe(lead.company || lead.contact_name)}</h3><p>${safe(lead.contact_name)} · ${safe(lead.service || 'Por definir')}</p><footer><span class="tag ${priorityTone(lead.priority)}">${safe(PRIORITY_NAMES[lead.priority] || lead.priority)}</span><small>${Number(lead.score || 0)} pts</small></footer></article>`).join('') : empty('Sin oportunidades')}</section>`;
    }).join('');
  }

  function renderLeads() {
    const search = ($('#lead-search').value || '').toLowerCase();
    const stage = $('#lead-stage-filter').value;
    const service = $('#lead-service-filter').value;
    const leads = state.leads.filter((lead) => (!stage || lead.stage === stage) && (!service || lead.service === service) && (!search || [lead.contact_name, lead.company, lead.email].some((value) => String(value || '').toLowerCase().includes(search))));
    $('#leads-table').innerHTML = leads.length ? leads.map((lead) => `<tr data-lead-id="${safe(lead.id)}"><td><strong>${safe(lead.company || lead.contact_name)}</strong><small>${safe(lead.contact_name)} · ${safe(lead.email)}</small></td><td>${safe(lead.service || 'Por definir')}</td><td>${safe(lead.budget_range || 'Sin definir')}</td><td><span class="tag purple">${safe(stageName(lead.stage))}</span></td><td><span class="tag ${priorityTone(lead.priority)}">${safe(PRIORITY_NAMES[lead.priority] || lead.priority)}</span></td><td>${fmtDate(lead.created_at, true)}</td></tr>`).join('') : `<tr><td colspan="6">${empty('No encontramos oportunidades con esos filtros.')}</td></tr>`;
  }

  function renderProposals() {
    const open = state.proposals.filter((proposal) => !['accepted', 'rejected'].includes(proposal.status));
    const approved = state.proposals.filter((proposal) => ['approved', 'sent', 'accepted'].includes(proposal.status));
    const atRisk = state.proposals.filter((proposal) => Number(proposal.margin_percent) < 50);
    $('#proposal-stats').innerHTML = [
      ['En proceso', open.length],
      ['Valor aprobado', money.format(approved.reduce((total, proposal) => total + Number(proposal.amount_mxn || 0), 0))],
      ['Margen por revisar', atRisk.length],
    ].map(([label, value]) => `<div><small>${safe(label)}</small><b>${safe(value)}</b></div>`).join('');
    $('#proposal-grid').innerHTML = state.proposals.length ? state.proposals.map((proposal) => {
      const lead = leadById(proposal.lead_id);
      const margin = Number(proposal.margin_percent ?? percent(proposal.amount_mxn, proposal.estimated_cost_mxn));
      const listPrice = Number(proposal.list_price_mxn || proposal.amount_mxn || 0);
      const savings = Math.max(0, listPrice - Number(proposal.amount_mxn || 0));
      const canApprove = state.profile?.role === 'owner' && proposal.status === 'draft' && margin >= 50;
      const canShare = state.profile?.role === 'owner' && ['approved', 'sent'].includes(proposal.status);
      const canKickoff = state.profile?.role === 'owner' && proposal.status === 'accepted';
      const kickoff = state.kickoffs.find((item) => item.proposal_id === proposal.id);
      return `<article class="proposal-card"><header><div><h3>${safe(proposal.title)}</h3><p>${safe(lead?.company || lead?.contact_name || 'Prospecto')}</p></div><span class="tag ${proposal.status === 'accepted' ? 'green' : 'purple'}">${safe(PROPOSAL_NAMES[proposal.status] || proposal.status)}</span></header><p>${safe(proposal.scope || 'Alcance por completar.')}</p>${savings ? `<div class="discount-chip"><b>${money.format(savings)} de ahorro</b><span>${safe(proposal.discount_label || 'Beneficio comercial')} · hasta ${fmtDate(proposal.discount_expires_at, true)}</span></div>` : ''}<div class="proposal-numbers"><div><small>PRECIO FINAL</small><b>${money.format(proposal.amount_mxn || 0)}</b>${savings ? `<s>${money.format(listPrice)}</s>` : ''}</div><div><small>MARGEN</small><b class="${margin >= 50 ? '' : 'danger'}">${margin.toFixed(0)}%</b></div></div><footer><small>${proposal.accepted_at ? `Aceptada ${fmtDate(proposal.accepted_at, true)}` : proposal.client_viewed_at ? `Vista ${fmtDate(proposal.client_viewed_at, true)}` : margin >= 50 ? 'Cumple objetivo VGG' : 'Requiere ajustar precio o costo'}</small><div class="proposal-actions">${canApprove ? `<button class="text-action" data-approve-proposal="${safe(proposal.id)}">Aprobar →</button>` : ''}${canShare ? `<button class="text-action" data-share-proposal="${safe(proposal.id)}">${proposal.status === 'sent' ? 'Regenerar liga' : 'Generar liga'} →</button>` : ''}${canKickoff ? `<button class="text-action" data-open="kickoff-dialog" data-proposal-context="${safe(proposal.id)}">${kickoff ? 'Regenerar kickoff' : 'Generar kickoff'} →</button>` : ''}</div></footer></article>`;
    }).join('') : empty('Crea la primera propuesta desde una oportunidad calificada.');
  }

  function renderProjects() {
    $('#project-board').innerHTML = PROJECT_STAGES.map(([stage, label]) => {
      const projects = state.projects.filter((project) => project.status === stage);
      return `<section class="project-column"><header><span>${safe(label)}</span><b>${projects.length}</b></header>${projects.length ? projects.map((project) => {
        const margin = percent(project.budget_mxn, project.cost_mxn);
        return `<article class="project-card"><h3>${safe(project.name)}</h3><p>${safe(clientById(project.client_id)?.name || 'Cliente')} · ${safe(project.service)}</p><div class="progress"><i style="width:${Math.min(100, Number(project.progress || 0))}%"></i></div><dl><div><dt>ENTREGA</dt><dd>${fmtDate(project.due_date, true)}</dd></div><div><dt>MARGEN</dt><dd>${margin.toFixed(0)}%</dd></div></dl><span class="tag ${daysFromNow(project.due_date) < 5 ? 'red' : 'green'}">${Number(project.progress || 0)}% completo</span></article>`;
      }).join('') : empty('Sin proyectos')}</section>`;
    }).join('');
  }

  function renderTasks() {
    const pending = state.tasks.filter((task) => task.status !== 'done').sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
    const done = state.tasks.filter((task) => task.status === 'done').sort((a, b) => new Date(b.completed_at || b.due_at) - new Date(a.completed_at || a.due_at));
    $('#pending-tasks').innerHTML = pending.length ? pending.map(taskItem).join('') : empty('No hay pendientes.');
    $('#completed-tasks').innerHTML = done.length ? done.map(taskItem).join('') : empty('Todavía no hay tareas completadas.');
  }

  function taskItem(task) {
    const done = task.status === 'done';
    const due = daysFromNow(task.due_at);
    return `<article class="task-item"><button class="task-check ${done ? 'done' : ''}" data-toggle-task="${safe(task.id)}" aria-label="${done ? 'Reabrir' : 'Completar'} tarea">${done ? '✓' : ''}</button><div><b>${safe(task.title)}</b><p>${safe(relationName(task))} · ${safe(PRIORITY_NAMES[task.priority] || task.priority)}</p></div><time class="${!done && due < 0 ? 'danger' : ''}">${done ? 'Lista' : due < 0 ? 'Vencida' : due === 0 ? 'Hoy' : fmtDate(task.due_at, true)}</time></article>`;
  }

  function renderFinance() {
    const invoiced = state.payments.reduce((total, payment) => total + Number(payment.amount_mxn || 0), 0);
    const paid = state.payments.filter((payment) => payment.status === 'paid').reduce((total, payment) => total + Number(payment.amount_mxn || 0), 0);
    const pending = invoiced - paid;
    const costs = state.projects.reduce((total, project) => total + Number(project.cost_mxn || 0), 0);
    const budgets = state.projects.reduce((total, project) => total + Number(project.budget_mxn || 0), 0);
    const margin = percent(budgets, costs);
    $('#finance-kpis').innerHTML = [
      ['Facturado', money.format(invoiced), 'pagos registrados', ''],
      ['Cobrado', money.format(paid), invoiced ? `${(paid / invoiced * 100).toFixed(0)}% del total` : 'sin movimientos', 'good'],
      ['Pendiente', money.format(pending), 'por cobrar', pending ? 'warn' : 'good'],
      ['Costo previsto', money.format(costs), 'proyectos activos', ''],
      ['Margen cartera', `${margin.toFixed(0)}%`, 'objetivo ≥ 50%', margin >= 50 ? 'good' : 'bad'],
    ].map(([label, value, copy, tone]) => `<article class="kpi ${tone}"><small>${safe(label)}</small><strong>${safe(value)}</strong><span>${safe(copy)}</span></article>`).join('');

    const payments = [...state.payments].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    $('#payment-list').innerHTML = payments.length ? payments.map((payment) => `<article class="payment-row"><div><b>${safe(projectById(payment.project_id)?.name || 'Proyecto')}</b><p>${safe(payment.concept)} · ${fmtDate(payment.due_date, true)}</p></div><strong>${money.format(payment.amount_mxn || 0)}</strong><span class="tag ${payment.status === 'paid' ? 'green' : daysFromNow(payment.due_date) < 0 ? 'red' : 'warm'}">${payment.status === 'paid' ? 'Pagado' : daysFromNow(payment.due_date) < 0 ? 'Vencido' : 'Pendiente'}</span></article>`).join('') : empty('No hay pagos registrados.');
    $('#margin-list').innerHTML = state.projects.length ? state.projects.map((project) => {
      const value = percent(project.budget_mxn, project.cost_mxn);
      return `<article class="margin-row"><header><h3>${safe(project.name)}</h3><b class="${value >= 50 ? '' : 'danger'}">${value.toFixed(0)}%</b></header><p>${money.format(project.budget_mxn || 0)} ingreso · ${money.format(project.cost_mxn || 0)} costo previsto</p><div class="progress"><i style="width:${Math.min(100, value)}%;background:${value >= 50 ? 'var(--lime)' : 'var(--red)'}"></i></div></article>`;
    }).join('') : empty('Los márgenes aparecerán con los proyectos.');
  }

  function renderTeam() {
    const target = $('#team-list'); if (!target) return;
    target.innerHTML = state.profiles.length ? state.profiles.map((profile) => `<tr><td><strong>${safe(profile.full_name || profile.email)}</strong><small>${safe(profile.email)}</small></td><td>${safe(ROLE_NAMES[profile.role] || profile.role)}</td><td>${safe(profile.team || '—')}</td><td><span class="tag ${profile.active ? 'green' : 'red'}">${profile.active ? 'Activo' : 'Inactivo'}</span></td></tr>`).join('') : `<tr><td colspan="4">${empty('Todavía no hay usuarios.')}</td></tr>`;
  }

  function renderForms() {
    const target = $('#forms-list'); if (!target) return;
    target.innerHTML = state.forms.length ? state.forms.map((form) => {
      const submissions = state.form_submissions.filter((item) => item.form_id === form.id);
      const lastSubmission = submissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      return `<article class="panel admin-card"><header><div><p class="eyebrow">${safe(form.campaign || 'SIN CAMPAÑA')}</p><h2>${safe(form.name)}</h2></div><span class="tag ${form.active ? 'green' : 'red'}">${form.active ? 'Activo' : 'Inactivo'}</span></header><p>${safe(form.description || 'Formulario embebible con atribución completa.')}</p><dl><div><dt>ID</dt><dd>${safe(form.slug)}</dd></div><div><dt>Dominios</dt><dd>${safe((form.allowed_domains || []).join(', ') || 'Sin dominios')}</dd></div><div><dt>Envíos</dt><dd>${submissions.length}${lastSubmission ? ` · último ${safe(fmtDate(lastSubmission.created_at, true))}` : ''}</dd></div></dl><code>${safe(formSnippet(form.slug))}</code><div class="card-actions"><button class="button ghost" type="button" data-edit-form="${safe(form.id)}">Editar</button><button class="button primary" type="button" data-copy-form="${safe(form.id)}">Copiar código</button></div></article>`;
    }).join('') : empty('Crea el primer formulario para una landing de VGG.');
  }

  function renderFormSubmissions() {
    const target = $('#form-submission-list'); if (!target) return;
    target.innerHTML = state.form_submissions.length ? state.form_submissions.map((submission) => {
      const form = formById(submission.form_id);
      const source = [submission.utm_source, submission.utm_medium].filter(Boolean).join(' / ') || 'Directo';
      const campaign = submission.utm_campaign || form?.campaign || 'Sin campaña';
      return `<tr><td><strong>${safe(form?.name || submission.form_name || 'Formulario')}</strong><small>${safe(form?.slug || 'Sin ID')}</small></td><td><strong>${safe(pageLabel(submission.page_path || submission.page_url))}</strong><small>${safe(submission.domain || '')}</small></td><td><strong>${safe(source)}</strong><small>${safe(campaign)}</small></td><td>${safe(fmtDate(submission.created_at))}</td></tr>`;
    }).join('') : `<tr><td colspan="4">${empty('Las entradas aparecerán aquí con su landing y campaña de origen.')}</td></tr>`;
  }

  function renderAssignment() {
    const target = $('#assignment-list'); if (!target) return;
    target.innerHTML = state.assignment_rules.length ? state.assignment_rules.map((rule) => {
      const conditions = [rule.form_id && `Formulario: ${state.forms.find((item) => item.id === rule.form_id)?.name || rule.form_id}`, rule.service && `Servicio: ${rule.service}`, rule.utm_source && `Fuente: ${rule.utm_source}`, rule.utm_campaign && `Campaña: ${rule.utm_campaign}`, rule.landing_contains && `Landing: ${rule.landing_contains}`].filter(Boolean).join(' · ') || 'Todos los prospectos';
      const owner = state.profiles.find((item) => item.id === rule.assignee_id);
      return `<tr><td>${Number(rule.priority)}</td><td><strong>${safe(rule.name)}</strong></td><td>${safe(conditions)}</td><td>${safe(owner?.full_name || owner?.email || 'Sin responsable')}</td><td><span class="tag ${rule.active ? 'green' : 'red'}">${rule.active ? 'Activa' : 'Inactiva'}</span></td></tr>`;
    }).join('') : `<tr><td colspan="5">${empty('No hay reglas automáticas todavía.')}</td></tr>`;
  }

  function renderLeadDetail(leadId) {
    const lead = leadById(leadId);
    if (!lead) return closeDrawer();
    selectedLeadId = leadId;
    const activities = state.activities.filter((activity) => activity.lead_id === leadId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const owners = state.profiles.filter((item) => item.active && ['owner', 'sales'].includes(item.role));
    const sourceForm = formById(lead.form_id);
    const attribution = [
      sourceForm && ['Formulario', sourceForm.name],
      sourceForm?.slug && ['ID del formulario', sourceForm.slug],
      lead.source_detail && ['Detalle de origen', lead.source_detail],
      (lead.utm_source || lead.utm_medium) && ['Fuente / medio', [lead.utm_source, lead.utm_medium].filter(Boolean).join(' / ')],
      (lead.utm_campaign || sourceForm?.campaign) && ['Campaña', lead.utm_campaign || sourceForm.campaign],
      lead.utm_content && ['Contenido', lead.utm_content],
      lead.utm_term && ['Término', lead.utm_term],
      (lead.landing_path || lead.landing_url) && ['Landing', pageLabel(lead.landing_path || lead.landing_url)],
      lead.referrer_url && ['Referencia', pageLabel(lead.referrer_url)],
      lead.click_id && ['Click ID', lead.click_id],
    ].filter(Boolean);
    $('#lead-detail').innerHTML = `<section class="lead-hero"><p class="eyebrow">${safe(stageName(lead.stage))}</p><h2>${safe(lead.company || lead.contact_name)}</h2><p>${safe(lead.contact_name)} · ${safe(lead.email)}${lead.phone ? ` · ${safe(lead.phone)}` : ''}</p></section><div class="lead-meta"><div><small>SERVICIO</small><b>${safe(lead.service || 'Por definir')}</b></div><div><small>PRESUPUESTO</small><b>${safe(lead.budget_range || 'Sin definir')}</b></div><div><small>ORIGEN</small><b>${safe(lead.source || 'Manual')}</b></div><div><small>SCORE</small><b>${Number(lead.score || 0)} / 100</b></div></div><p>${safe(lead.message || 'Sin contexto registrado.')}</p><div class="drawer-actions">${STAGES.map(([stage, label]) => `<button class="button ${lead.stage === stage ? 'primary' : 'ghost'}" data-change-stage="${stage}" ${lead.stage === stage ? 'disabled' : ''}>${safe(label)}</button>`).join('')}</div><div class="timeline"><p class="eyebrow">HISTORIAL</p>${activities.length ? activities.map((activity) => `<article class="timeline-item"><b>${safe(activity.kind === 'stage_change' ? 'Cambio de etapa' : activity.kind === 'proposal' ? 'Propuesta' : 'Nota')}</b><p>${safe(activity.body)}</p><time>${fmtDate(activity.created_at)}</time></article>`).join('') : empty('Aún no hay actividad registrada.')}</div>`;
    if (['owner', 'sales'].includes(state.profile?.role)) $('#lead-detail').insertAdjacentHTML('beforeend', `<button class="button primary" data-open="proposal-dialog" data-lead-context="${safe(lead.id)}">Generar propuesta para este prospecto →</button>`);
    if (state.profile?.role === 'owner') $('#lead-detail').insertAdjacentHTML('beforeend', `<div class="assignment-box"><label>Responsable<select data-assign-lead="${safe(lead.id)}"><option value="">Sin asignar</option>${owners.map((owner) => `<option value="${safe(owner.id)}" ${lead.owner_id === owner.id ? 'selected' : ''}>${safe(owner.full_name || owner.email)}</option>`).join('')}</select></label></div>`);
    if (attribution.length) $('#lead-detail').insertAdjacentHTML('beforeend', `<div class="attribution-box"><p class="eyebrow">ATRIBUCIÓN DEL LEAD</p><div class="attribution-grid">${attribution.map(([label, value]) => `<div><small>${safe(label)}</small><b>${safe(value)}</b></div>`).join('')}</div></div>`);
    $('#lead-drawer').classList.add('open');
    $('#lead-drawer').setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('open');
  }

  function fillFilters() {
    $('#lead-stage-filter').insertAdjacentHTML('beforeend', STAGES.concat([['lost', 'Perdido']]).map(([value, label]) => `<option value="${value}">${label}</option>`).join(''));
  }

  function fillRelations() {
    const services = [...new Set(state.leads.map((lead) => lead.service).filter(Boolean))].sort();
    const serviceFilter = $('#lead-service-filter');
    const currentService = serviceFilter.value;
    serviceFilter.innerHTML = '<option value="">Todos los servicios</option>' + services.map((service) => `<option>${safe(service)}</option>`).join('');
    serviceFilter.value = currentService;
    $('#proposal-lead').innerHTML = '<option value="">Selecciona</option>' + state.leads.filter((lead) => !['won', 'lost'].includes(lead.stage)).map((lead) => `<option value="${safe(lead.id)}">${safe(lead.company || lead.contact_name)} · ${safe(lead.service || 'Por definir')}</option>`).join('');
    $('#project-client').innerHTML = '<option value="">Selecciona</option>' + state.clients.map((client) => `<option value="${safe(client.id)}">${safe(client.name)}</option>`).join('');
    $('#task-relation').innerHTML = '<option value="">General</option><optgroup label="Prospectos">' + state.leads.filter((lead) => !['won', 'lost'].includes(lead.stage)).map((lead) => `<option value="lead:${safe(lead.id)}">${safe(lead.company || lead.contact_name)}</option>`).join('') + '</optgroup><optgroup label="Proyectos">' + state.projects.map((project) => `<option value="project:${safe(project.id)}">${safe(project.name)}</option>`).join('') + '</optgroup>';
    const owners = state.profiles.filter((profile) => profile.active && ['owner', 'sales'].includes(profile.role));
    const ownerOptions = '<option value="">Sin responsable predeterminado</option>' + owners.map((profile) => `<option value="${safe(profile.id)}">${safe(profile.full_name || profile.email)}</option>`).join('');
    if ($('#form-default-owner')) $('#form-default-owner').innerHTML = ownerOptions;
    if ($('#rule-assignee')) $('#rule-assignee').innerHTML = owners.map((profile) => `<option value="${safe(profile.id)}">${safe(profile.full_name || profile.email)}</option>`).join('');
    if ($('#rule-form')) $('#rule-form').innerHTML = '<option value="">Cualquier formulario</option>' + state.forms.map((form) => `<option value="${safe(form.id)}">${safe(form.name)}</option>`).join('');
  }

  function priorityTone(priority) {
    return priority === 'urgent' ? 'red' : priority === 'high' ? 'hot' : priority === 'low' ? '' : 'warm';
  }

  function empty(copy) {
    return `<div class="empty">${safe(copy)}</div>`;
  }

  function switchView(view) {
    currentView = view;
    $$('.view').forEach((element) => element.classList.toggle('active', element.id === `view-${view}`));
    $$('.nav-item').forEach((element) => element.classList.toggle('active', element.dataset.view === view));
    $('#sidebar').classList.remove('open');
    $('#scrim').classList.remove('open');
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeDrawer() {
    selectedLeadId = null;
    $('#lead-drawer').classList.remove('open');
    $('#lead-drawer').setAttribute('aria-hidden', 'true');
    $('#scrim').classList.remove('open');
  }

  async function mutate(action, payload, localMutation) {
    try {
      if (demoMode) {
        localMutation?.();
        renderAll();
        notify('Demo actualizada temporalmente. No se guardaron datos reales.');
        return null;
      }
      const result = await api('action', { method: 'POST', body: JSON.stringify({ action, payload }) });
      await loadData();
      renderAll();
      notify(result.message || 'Cambio guardado.');
      return result;
    } catch (error) {
      notify(error.message);
      throw error;
    }
  }

  async function submitForm(form) {
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const submit = form.dataset.submit;
    if (submit === 'create-lead') {
      await mutate('create_lead', values, () => state.leads.unshift({ id: id(), ...values, stage: 'new', priority: 'normal', score: 45, source: 'Captura manual', created_at: new Date().toISOString(), next_action_at: new Date().toISOString() }));
    } else if (submit === 'save-proposal') {
      const proposal = { ...values, list_price_mxn: Number(values.list_price_mxn), amount_mxn: Number(values.amount_mxn), estimated_cost_mxn: Number(values.estimated_cost_mxn), discount_expires_at: values.discount_expires_at ? new Date(values.discount_expires_at).toISOString() : null };
      proposal.margin_percent = percent(proposal.amount_mxn, proposal.estimated_cost_mxn);
      await mutate('save_proposal', proposal, () => state.proposals.unshift({ id: id(), ...proposal, status: 'draft', created_at: new Date().toISOString() }));
    } else if (submit === 'generate-kickoff') {
      const result = await mutate('generate_kickoff', { ...values, deposit_percent: Number(values.deposit_percent) });
      if (result?.url) await copyPrivateLink(result.url);
    } else if (submit === 'save-project') {
      const project = { ...values, budget_mxn: Number(values.budget_mxn || 0), cost_mxn: Number(values.cost_mxn || 0) };
      await mutate('save_project', project, () => state.projects.unshift({ id: id(), ...project, status: 'kickoff', progress: 5, spent_mxn: 0 }));
    } else if (submit === 'create-task') {
      const [relationType, relationId] = String(values.relation || '').split(':');
      const task = { title: values.title, due_at: values.due_at, priority: values.priority, ...(relationType === 'lead' ? { lead_id: relationId } : relationType === 'project' ? { project_id: relationId } : {}) };
      await mutate('create_task', task, () => state.tasks.unshift({ id: id(), ...task, status: 'pending' }));
    } else if (submit === 'invite-user') {
      await mutate('invite_user', values);
    } else if (submit === 'save-form') {
      const optional = $$('[name="field_names"]:checked', form).map((input) => ({ ...FORM_FIELDS[input.value] }));
      const payload = { ...values, active: form.elements.active.checked, fields: [{ name: 'contact_name', label: 'Nombre', type: 'text', required: true, autocomplete: 'name' }, { name: 'email', label: 'Correo', type: 'email', required: true, autocomplete: 'email' }, ...optional] };
      delete payload.field_names;
      await mutate('save_form', payload, () => {
        const existing = state.forms.find((item) => item.id === payload.form_id);
        const record = {
          ...(existing || {}),
          ...payload,
          id: existing?.id || id(),
          slug: payload.slug || formSlug(payload.name),
          allowed_domains: String(payload.allowed_domains || '').split(/[\n,]+/).map((item) => item.trim()).filter(Boolean),
          privacy_url: payload.privacy_url || null,
          default_owner_id: payload.default_owner_id || null,
          created_at: existing?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (existing) Object.assign(existing, record); else state.forms.unshift(record);
      });
    } else if (submit === 'save-assignment') {
      await mutate('save_assignment_rule', { ...values, active: form.elements.active.checked, priority: Number(values.priority) });
    }
    form.closest('dialog').close();
    form.reset();
    updateMarginPreview();
  }

  function bindEvents() {
    document.addEventListener('click', async (event) => {
      const viewButton = event.target.closest('[data-view], [data-view-target]');
      if (viewButton) return switchView(viewButton.dataset.view || viewButton.dataset.viewTarget);
      const editFormButton = event.target.closest('[data-edit-form]');
      if (editFormButton) return openFormDialog(formById(editFormButton.dataset.editForm));
      const copyFormButton = event.target.closest('[data-copy-form]');
      if (copyFormButton) return copyFormEmbed(copyFormButton.dataset.copyForm);
      const openButton = event.target.closest('[data-open]');
      if (openButton) {
        if (openButton.dataset.open === 'form-dialog') return openFormDialog();
        prepareDialog(openButton);
        return $(`#${openButton.dataset.open}`).showModal();
      }
      const leadButton = event.target.closest('[data-lead-id]');
      if (leadButton) return renderLeadDetail(leadButton.dataset.leadId);
      const attentionButton = event.target.closest('[data-attention]');
      if (attentionButton && leadById(attentionButton.dataset.attention)) return renderLeadDetail(attentionButton.dataset.attention);
      const taskButton = event.target.closest('[data-toggle-task]');
      if (taskButton) {
        const task = state.tasks.find((item) => item.id === taskButton.dataset.toggleTask);
        if (!task) return;
        const nextStatus = task.status === 'done' ? 'pending' : 'done';
        return mutate('toggle_task', { task_id: task.id, status: nextStatus }, () => { task.status = nextStatus; task.completed_at = nextStatus === 'done' ? new Date().toISOString() : null; });
      }
      const stageButton = event.target.closest('[data-change-stage]');
      if (stageButton && selectedLeadId) {
        const lead = leadById(selectedLeadId);
        const nextStage = stageButton.dataset.changeStage;
        return mutate('change_stage', { lead_id: selectedLeadId, stage: nextStage }, () => { const previous = lead.stage; lead.stage = nextStage; state.activities.unshift({ id: id(), lead_id: lead.id, kind: 'stage_change', body: `La oportunidad pasó de ${stageName(previous)} a ${stageName(nextStage)}.`, created_at: new Date().toISOString() }); });
      }
      const proposalButton = event.target.closest('[data-approve-proposal]');
      if (proposalButton) {
        const proposal = state.proposals.find((item) => item.id === proposalButton.dataset.approveProposal);
        if (!proposal) return;
        return mutate('approve_proposal', { proposal_id: proposal.id }, () => { proposal.status = 'approved'; });
      }
      const shareButton = event.target.closest('[data-share-proposal]');
      if (shareButton) {
        const result = await mutate('generate_proposal_link', { proposal_id: shareButton.dataset.shareProposal });
        if (result?.url) await copyPrivateLink(result.url);
      }
    });

    document.addEventListener('change', async (event) => {
      const assignment = event.target.closest('[data-assign-lead]');
      if (!assignment) return;
      await mutate('assign_lead', { lead_id: assignment.dataset.assignLead, owner_id: assignment.value || null });
    });

    $$('form[data-submit]').forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitter = event.submitter;
      if (submitter?.value === 'cancel') return form.closest('dialog').close();
      submitter?.setAttribute('disabled', '');
      try { await submitForm(form); } catch (_) { /* shown by mutate */ } finally { submitter?.removeAttribute('disabled'); }
    }));
    $$('.dialog-close').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); button.closest('dialog').close(); }));
    $('.drawer-close').addEventListener('click', closeDrawer);
    $('#scrim').addEventListener('click', () => {
      closeDrawer();
      $('#sidebar').classList.remove('open');
      $('#menu-toggle').setAttribute('aria-expanded', 'false');
    });
    $('#menu-toggle').addEventListener('click', () => {
      const open = $('#sidebar').classList.toggle('open');
      $('#menu-toggle').setAttribute('aria-expanded', String(open));
      $('#scrim').classList.toggle('open', open);
    });
    $('#lead-search').addEventListener('input', renderLeads);
    $('#lead-stage-filter').addEventListener('change', renderLeads);
    $('#lead-service-filter').addEventListener('change', renderLeads);
    $('#proposal-dialog').addEventListener('input', updateMarginPreview);
    $('#login-form').addEventListener('submit', login);
    $('#password-recovery-form').addEventListener('submit', saveRecoveredPassword);
    $('#reset-password').addEventListener('click', resetPassword);
    $('#sign-out').addEventListener('click', signOut);
  }

  function updateMarginPreview() {
    const form = $('#proposal-dialog form');
    const value = percent(form.elements.amount_mxn.value, form.elements.estimated_cost_mxn.value);
    const strong = $('#proposal-margin-preview strong');
    strong.textContent = form.elements.amount_mxn.value ? `${value.toFixed(0)}%` : '—';
    strong.style.color = value >= 50 ? 'var(--lime)' : 'var(--red)';
  }

  function prepareDialog(button) {
    if (button.dataset.open === 'proposal-dialog' && button.dataset.leadContext) $('#proposal-lead').value = button.dataset.leadContext;
    if (button.dataset.open !== 'kickoff-dialog') return;
    const proposal = state.proposals.find((item) => item.id === button.dataset.proposalContext);
    if (!proposal) return;
    const lead = leadById(proposal.lead_id) || {};
    const form = $('#kickoff-dialog form');
    form.reset();
    form.elements.proposal_id.value = proposal.id;
    form.elements.project_name.value = proposal.title;
    form.elements.headline.value = `El siguiente paso para ${lead.company || lead.contact_name || 'tu proyecto'}`;
    form.elements.objectives.value = proposal.client_message || proposal.scope || '';
    form.elements.deliverables.value = (proposal.deliverables || []).join('\n');
    form.elements.process_steps.value = (proposal.timeline || []).join('\n');
    form.elements.deposit_percent.value = 50;
    form.elements.payment_url.value = proposal.payment_url || '';
    form.elements.calendar_url.value = proposal.calendar_url || '';
  }

  function openFormDialog(record = null) {
    const dialog = $('#form-dialog');
    const form = $('form', dialog);
    form.reset();
    $('h2', dialog).textContent = record ? 'Editar formulario' : 'Nuevo formulario';
    $('button[value="default"]', form).textContent = record ? 'Guardar cambios' : 'Guardar formulario';
    form.elements.form_id.value = record?.id || '';
    form.elements.name.value = record?.name || '';
    form.elements.slug.value = record?.slug || '';
    form.elements.slug.readOnly = Boolean(record);
    form.elements.campaign.value = record?.campaign || '';
    form.elements.service.value = record?.service || '';
    form.elements.allowed_domains.value = (record?.allowed_domains || ['verygoodgraphics.mx']).join('\n');
    form.elements.description.value = record?.description || '';
    const selectedFields = new Set((record?.fields || []).map((field) => field.name));
    $$('[name="field_names"]', form).forEach((input) => {
      input.checked = record ? selectedFields.has(input.value) : ['phone', 'company', 'service', 'budget_range', 'message'].includes(input.value);
    });
    form.elements.submit_label.value = record?.submit_label || 'Enviar solicitud';
    form.elements.success_message.value = record?.success_message || 'Gracias. Recibimos tu solicitud.';
    form.elements.privacy_url.value = record?.privacy_url || '';
    form.elements.default_owner_id.value = record?.default_owner_id || '';
    form.elements.active.checked = record ? Boolean(record.active) : false;
    dialog.showModal();
  }

  async function copyFormEmbed(formId) {
    const form = formById(formId);
    if (!form) return notify('No encontramos ese formulario.');
    const snippet = formSnippet(form.slug);
    try {
      await navigator.clipboard.writeText(snippet);
      notify(`Código de ${form.name} copiado.`);
    } catch (_) {
      window.prompt('Copia el código del formulario:', snippet);
    }
  }

  async function copyPrivateLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      notify('Liga privada copiada. Compártela únicamente con el cliente.');
    } catch (_) {
      window.prompt('Copia la liga privada:', url);
    }
  }

  async function login(event) {
    event.preventDefault();
    if (!client) return $('#auth-message').textContent = 'Primero conecta el proyecto Supabase independiente de VGG. Mientras tanto puedes abrir la demo segura.';
    const button = event.submitter;
    button.disabled = true;
    $('#auth-message').textContent = 'Validando acceso…';
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-password').value });
      if (error) throw error;
      localStorage.removeItem(FORCE_REAUTH_KEY);
      accessToken = data.session.access_token;
      await loadData();
      showApp();
    } catch (error) {
      $('#auth-message').textContent = error.message || 'No fue posible iniciar sesión.';
    } finally { button.disabled = false; }
  }

  async function resetPassword() {
    const email = $('#login-email').value.trim();
    const button = $('#reset-password');
    if (!client) return $('#auth-message').textContent = 'La recuperación estará disponible al conectar Supabase VGG.';
    if (!email) return $('#auth-message').textContent = 'Escribe tu correo primero.';
    if (button.disabled) return;
    button.disabled = true;
    $('#auth-message').textContent = 'Enviando enlace seguro…';
    try {
      const redirectUrl = new URL('/crm/', location.origin);
      redirectUrl.searchParams.set('recovery', '1');
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl.toString() });
      if (error) throw error;
      $('#auth-message').textContent = 'Revisa tu correo y abre únicamente el mensaje más reciente. Cada enlace es de un solo uso y uno nuevo invalida los anteriores.';
      startResetCooldown(button, 60);
    } catch (error) {
      button.disabled = false;
      $('#auth-message').textContent = error?.status === 429
        ? 'Espera un minuto antes de solicitar otro enlace. Después usa únicamente el correo más reciente.'
        : (error.message || 'No fue posible enviar el enlace de recuperación.');
    }
  }

  function startResetCooldown(button, seconds) {
    clearInterval(resetCooldownTimer);
    const original = button.textContent;
    let remaining = seconds;
    button.textContent = `Reenviar en ${remaining} s`;
    resetCooldownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        button.textContent = `Reenviar en ${remaining} s`;
        return;
      }
      clearInterval(resetCooldownTimer);
      resetCooldownTimer = null;
      button.textContent = original;
      button.disabled = false;
    }, 1000);
  }

  async function saveRecoveredPassword(event) {
    event.preventDefault();
    const button = event.submitter;
    const password = $('#new-password').value;
    const confirmation = $('#confirm-password').value;
    const message = $('#password-recovery-message');
    message.textContent = '';
    if (!client || !recoveryMode || !recoverySessionReady) return showAuth('El enlace de recuperación expiró o no es válido. Solicita uno nuevo.');
    if (password.length < 12) return message.textContent = 'La contraseña debe tener al menos 12 caracteres.';
    if (password !== confirmation) return message.textContent = 'Las contraseñas no coinciden.';
    button.disabled = true;
    try {
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw error;
      if (!data.user) throw new Error('Supabase no confirmó el cambio de contraseña.');
      recoveryMode = false;
      recoverySessionReady = false;
      localStorage.setItem(FORCE_REAUTH_KEY, '1');
      history.replaceState(null, '', location.pathname);
      const { error: signOutError } = await client.auth.signOut({ scope: 'global' });
      if (signOutError) await client.auth.signOut({ scope: 'local' });
      accessToken = '';
      state = emptyState();
      $('#new-password').value = '';
      $('#confirm-password').value = '';
      $('#login-password').value = '';
      showAuth('Contraseña actualizada. Por seguridad, todas las sesiones se cerraron; inicia sesión con la nueva contraseña.');
    } catch (error) {
      message.textContent = error.message || 'No fue posible actualizar la contraseña.';
    } finally {
      button.disabled = false;
    }
  }

  async function signOut() {
    if (demoMode) return location.assign('./');
    await client?.auth.signOut();
    accessToken = '';
    state = emptyState();
    showAuth();
  }

  boot();
})();
