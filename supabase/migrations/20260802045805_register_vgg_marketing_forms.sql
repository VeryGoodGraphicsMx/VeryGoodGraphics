-- Register the seven VGG public acquisition forms.
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
    'Cuéntanos qué necesitas y te recomendaremos una ruta clara para avanzar.',
    'Sitio VGG · Contacto general',
    null,
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx', 'verygoodgraphics.netlify.app'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Empresa","type":"text","required":false,"autocomplete":"organization"},{"name":"service","label":"Servicio","type":"select","required":true,"options":["Branding","Diseño gráfico","Diseño web","Fotografía","Video","Dron","Ilustración","Marketing","Otro"]},{"name":"project_type","label":"Tipo de proyecto","type":"select","required":false,"options":["Branding","Landing page","Video de producto","Contenido para restaurante","Video para evento","Fotografía","Video corporativo","Dron","Ilustración","Otro"]},{"name":"budget_range","label":"Presupuesto","type":"select","required":false,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"start_window","label":"¿Cuándo quieres iniciar?","type":"select","required":false,"options":["Esta semana","En 2–4 semanas","En 1–3 meses","Solo estoy explorando"]},{"name":"message","label":"Cuéntanos sobre el proyecto","type":"textarea","required":true}]'::jsonb,
    'Solicitar recomendación',
    'Gracias. Recibimos tu solicitud y te contactaremos pronto.'
  ),
  (
    'vgg-video-general',
    'Producción de video',
    'Comparte el objetivo, la fecha y los canales donde vivirá la pieza.',
    'SEO audiovisual · Video',
    'Video',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx', 'verygoodgraphics.netlify.app'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Empresa","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"project_type","label":"Tipo de proyecto","type":"select","required":true,"options":["Producto","Restaurante u hospitality","Evento","Corporativo","Otro"]},{"name":"message","label":"Objetivo, fecha y canales","type":"textarea","required":true}]'::jsonb,
    'Solicitar recomendación',
    'Gracias. Recibimos tu solicitud de producción de video.'
  ),
  (
    'vgg-video-producto',
    'Video y fotografía de producto',
    'Cuéntanos qué producto vendes, cuántas piezas necesitas y dónde se publicarán.',
    'SEO audiovisual · Producto',
    'Video',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx', 'verygoodgraphics.netlify.app'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Marca o empresa","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"start_window","label":"¿Cuándo quieres iniciar?","type":"select","required":true,"options":["Esta semana","En 2–4 semanas","En 1–3 meses","Solo estoy explorando"]},{"name":"message","label":"Producto, cantidad y objetivo","type":"textarea","required":true}]'::jsonb,
    'Recibir ruta de producción',
    'Gracias. Ya tenemos el contexto inicial de tu producto.'
  ),
  (
    'vgg-video-restaurantes',
    'Video para restaurantes',
    'Comparte qué quieres promover, cuántos platillos o espacios participan y tu fecha objetivo.',
    'SEO audiovisual · Restaurantes',
    'Video',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx', 'verygoodgraphics.netlify.app'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Restaurante o grupo","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"start_window","label":"¿Cuándo quieres iniciar?","type":"select","required":true,"options":["Esta semana","En 2–4 semanas","En 1–3 meses","Solo estoy explorando"]},{"name":"message","label":"Objetivo, sucursales y entregables","type":"textarea","required":true}]'::jsonb,
    'Solicitar recomendación',
    'Gracias. Revisaremos la mejor ruta para tu restaurante.'
  ),
  (
    'vgg-video-eventos',
    'Video para eventos',
    'Envíanos fecha, sede, agenda y entregables para validar la cobertura.',
    'SEO audiovisual · Eventos',
    'Video',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx', 'verygoodgraphics.netlify.app'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Empresa o evento","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"event_date","label":"Fecha del evento","type":"date","required":true},{"name":"message","label":"Sede, agenda y entregables","type":"textarea","required":true}]'::jsonb,
    'Validar disponibilidad',
    'Gracias. Revisaremos disponibilidad y cobertura para tu evento.'
  ),
  (
    'vgg-fotografia',
    'Fotografía profesional',
    'Cuéntanos qué necesitas fotografiar, cuántas piezas participan y dónde se usarán las imágenes.',
    'SEO audiovisual · Fotografía',
    'Fotografía',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx', 'verygoodgraphics.netlify.app'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Marca o empresa","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"project_type","label":"Tipo de sesión","type":"select","required":true,"options":["Producto","Restaurante","Corporativo o retrato","Instalaciones","Lifestyle"]},{"name":"message","label":"Cantidad, usos y fecha objetivo","type":"textarea","required":true}]'::jsonb,
    'Solicitar recomendación',
    'Gracias. Revisaremos la sesión y los entregables adecuados.'
  ),
  (
    'vgg-dron',
    'Video y fotografía con dron',
    'Comparte ubicación, fecha, objetivo y uso final para revisar la viabilidad de la operación.',
    'SEO audiovisual · Dron',
    'Dron',
    true,
    array['verygoodgraphics.mx', 'www.verygoodgraphics.mx', 'verygoodgraphics.netlify.app'],
    '[{"name":"contact_name","label":"Nombre","type":"text","required":true,"autocomplete":"name"},{"name":"email","label":"Correo","type":"email","required":true,"autocomplete":"email"},{"name":"phone","label":"Teléfono","type":"tel","required":false,"autocomplete":"tel"},{"name":"company","label":"Empresa o proyecto","type":"text","required":false,"autocomplete":"organization"},{"name":"budget_range","label":"Presupuesto","type":"select","required":true,"options":["$5,000–$15,000 MXN","$15,000–$35,000 MXN","$35,000–$75,000 MXN","Más de $75,000 MXN","Necesito orientación"]},{"name":"event_date","label":"Fecha tentativa","type":"date","required":true},{"name":"message","label":"Ubicación, objetivo y entregable","type":"textarea","required":true}]'::jsonb,
    'Solicitar evaluación',
    'Gracias. Primero validaremos la viabilidad de la locación.'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  campaign = excluded.campaign,
  service = excluded.service,
  active = excluded.active,
  allowed_domains = excluded.allowed_domains,
  fields = excluded.fields,
  submit_label = excluded.submit_label,
  success_message = excluded.success_message,
  updated_at = now();
