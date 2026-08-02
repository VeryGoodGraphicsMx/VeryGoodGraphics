-- Register VGG public acquisition forms only.
insert into public.crm_forms (
  slug,
  name,
  description,
  campaign,
  service,
  active,
  allowed_domains,
  fields,
  submit_label,
  success_message
)
values
  (
    'vgg-contacto-general',
    'Contacto general VGG',
    'Formulario principal del sitio corporativo.',
    'Sitio VGG · Contacto general',
    null,
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx'],
    '[
      {"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},
      {"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},
      {"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},
      {"name":"company","label":"Empresa","type":"text","required":false,"autocomplete":"organization"},
      {"name":"service","label":"Servicio","type":"select","required":true,"options":["Branding","Diseño gráfico","Diseño web","Fotografía","Video","Dron","Ilustración","Marketing","Otro"]},
      {"name":"budget_range","label":"Presupuesto","type":"select","required":false,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},
      {"name":"message","label":"Cuéntanos sobre el proyecto","type":"textarea","required":true}
    ]'::jsonb,
    'Solicitar recomendación',
    'Gracias. Recibimos tu solicitud y te contactaremos pronto.'
  ),
  (
    'vgg-video-general',
    'Producción de video',
    'Captación desde la landing general de producción de video.',
    'SEO audiovisual · Video',
    'Video',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Empresa","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"message","label":"Objetivo, fecha y canales","type":"textarea","required":true}]'::jsonb,
    'Solicitar recomendación',
    'Gracias. Recibimos tu solicitud de producción de video.'
  ),
  (
    'vgg-video-producto',
    'Video y fotografía de producto',
    'Captación desde la landing de producto.',
    'SEO audiovisual · Producto',
    'Video',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Marca o empresa","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"message","label":"Producto, cantidad y objetivo","type":"textarea","required":true}]'::jsonb,
    'Recibir ruta de producción',
    'Gracias. Ya tenemos el contexto inicial de tu producto.'
  ),
  (
    'vgg-video-restaurantes',
    'Video para restaurantes',
    'Captación desde la landing de restaurantes y hospitality.',
    'SEO audiovisual · Restaurantes',
    'Video',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Restaurante o grupo","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"message","label":"Objetivo, sucursales y fecha","type":"textarea","required":true}]'::jsonb,
    'Solicitar recomendación',
    'Gracias. Revisaremos la mejor ruta para tu restaurante.'
  ),
  (
    'vgg-video-eventos',
    'Video para eventos',
    'Captación desde la landing de cobertura de eventos.',
    'SEO audiovisual · Eventos',
    'Video',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Empresa o evento","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"message","label":"Fecha, sede y entregables","type":"textarea","required":true}]'::jsonb,
    'Validar disponibilidad',
    'Gracias. Revisaremos disponibilidad y cobertura para tu evento.'
  ),
  (
    'vgg-fotografia',
    'Fotografía profesional',
    'Captación desde la landing general de fotografía.',
    'SEO audiovisual · Fotografía',
    'Fotografía',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Marca o empresa","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"message","label":"Cantidad, usos y fecha","type":"textarea","required":true}]'::jsonb,
    'Solicitar recomendación',
    'Gracias. Revisaremos la sesión y los entregables adecuados.'
  ),
  (
    'vgg-dron',
    'Video y fotografía con dron',
    'Captación desde la landing de dron.',
    'SEO audiovisual · Dron',
    'Dron',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Empresa o proyecto","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"message","label":"Ubicación, objetivo y entregable","type":"textarea","required":true}]'::jsonb,
    'Solicitar evaluación',
    'Gracias. Primero validaremos la viabilidad de la locación.'
  )
on conflict (slug) do nothing;
