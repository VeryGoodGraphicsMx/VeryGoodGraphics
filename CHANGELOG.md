# Changelog

## 2026-08-02

- Se corrigió el header de la Home para usar el logo oficial de VGG en lugar de una aproximación geométrica.
- Se unificó el fondo atmosférico negro/violeta con retícula en Home, servicios y contenido editorial.
- Se añadieron favicon ICO/PNG y `apple-touch-icon` a todas las páginas HTML para mejorar compatibilidad con Safari y navegadores móviles.
- Se publicó la landing `/sesion-promocional/` para negocios locales con paquete breve, ejemplos por vertical y agenda directa en Calendly para sábados y domingos.

## 2026-08-01

- Se creó el portal CRM privado de VGG con diseño negro, acentos lima/morado y logo corporativo.
- Se añadieron pipeline, prospectos, scoring, propuestas, control de margen, proyectos, tareas, pagos y tableros operativos.
- Se incorporó un modo demo con datos claramente ficticios para validar la experiencia sin una base conectada.
- Se añadieron funciones Netlify con autenticación y permisos de servidor por rol.
- Se preparó el esquema Supabase independiente con RLS, acceso directo revocado e índices operativos.
- Se preparó el endpoint de formularios, desactivado hasta completar la prueba controlada.
- Se documentó la separación absoluta entre VGG y AMITAI, la arquitectura y la ruta de activación.
- Se priorizó producción audiovisual en la home sin cambiar el sistema visual de VGG.
- Se crearon landings SEO para video de producto, contenido para restaurantes y video de eventos.
- Se reestructuraron las páginas de video, fotografía y dron con arquitectura comercial, copy, schema y formularios específicos.
- Se conectaron los formularios públicos al intake del CRM con atribución de landing/UTM y fallback a Netlify Forms.
- Se optimizaron logo y artes principales a WebP, reduciendo cada asset de portada a aproximadamente 30–151 KB.
- Se añadieron validaciones automáticas de rutas, JSON-LD, contenido, canonicals, formularios y regresiones del CRM.
- Se portó a VGG el flujo operativo del generador de formularios: creación, edición, activación controlada y copia del código embebible.
- Se añadió una lectura clara de atribución por formulario, landing, fuente/medio, campaña, contenido, término, referente y click ID.
- Se preparó el registro idempotente de siete formularios VGG para contacto, video, producto, restaurantes, eventos, fotografía y dron.
- Se reforzaron los formularios públicos con campos permitidos, dominios normalizados, privacidad HTTPS, honeypot y límite de frecuencia por visitante.
- Se sustituyó la interfaz visible de los siete formularios públicos por configuraciones administrables desde el CRM, conservando el formulario Netlify oculto como respaldo automático si el runtime del CRM no responde.
- Se añadieron campos comerciales por vertical —tipo de proyecto, ventana de inicio y fecha tentativa— sin perder landing, referente, UTM ni click ID.
