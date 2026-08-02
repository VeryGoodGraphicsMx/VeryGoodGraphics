# Arquitectura VGG CRM

```text
Sitio / landings / cotizador
           |
           v
Netlify Function de ingreso ----> Supabase VGG
           |                       leads, atribución, tareas
           v
 Confirmación segura

Usuario CRM -> Supabase Auth -> Netlify Functions -> Supabase VGG
                                      |
                                      +-> permisos y validaciones
                                      +-> propuestas y margen
                                      +-> proyectos y pagos
```

## Capas

- `crm/`: portal privado. Solo recibe la URL y llave publicable de Supabase; nunca una llave secreta.
- `netlify/functions/`: verifica la sesión, consulta el perfil autorizado y aplica permisos de servidor.
- `media/lead-form.js`: actúa como mejora progresiva. Selecciona el `slug` según la ruta y prepara el formulario generado por el CRM mientras el formulario Netlify original continúa visible y funcional. Solo intercambia ambos cuando el runtime confirma que está listo; si la configuración falla, excede el tiempo de espera o el visitante ya interactuó con el respaldo, cancela el intercambio sin perder datos.
- `embed.js`: carga por `slug` una configuración pública saneada, genera el formulario dentro de Shadow DOM y conserva visitante, sesión, landing, referente, UTM y click IDs.
- `crm_forms` + `crm_form_submissions`: separan la definición reutilizable del formulario de cada entrada; el prospecto conserva `form_id` para navegar desde la oportunidad hasta su origen.
- `supabase/schema.sql`: base operativa independiente con RLS activado y acceso directo revocado para `anon` y `authenticated`.
- Supabase Auth: sesiones y recuperación de acceso.

## Roles

- `owner`: control total; aprueba propuestas, proyectos y pagos.
- `sales`: administra sus prospectos, seguimiento, tareas y borradores de propuestas.
- `production`: ve sus proyectos y tareas asignadas.

Los permisos se validan en backend. El ocultamiento de botones en la interfaz es únicamente una ayuda visual.

## Datos principales

Prospectos, clientes, propuestas, proyectos, tareas, actividades, pagos, formularios, reglas de automatización e historial de ejecuciones.

Cada prospecto público conserva el servicio general para reporting y un `source_detail` específico —por ejemplo, `Video de producto`, `Video para restaurantes` o `Video para eventos`— además de `form_id`, landing, referente, UTM y click ID. El CRM resuelve esos datos en una ficha de atribución legible.

Los siete puntos públicos de captura tienen un formulario CRM independiente: contacto general, video general, video de producto, video para restaurantes, video de eventos, fotografía y dron. Los campos particulares se guardan también dentro del contexto legible del prospecto para que asignación y seguimiento no dependan de inspeccionar el payload técnico.

## Seguridad

- Secretos solo en variables de entorno de Netlify.
- CRM marcado `noindex`, `noarchive` y bloqueado para iframes.
- Orígenes públicos en lista permitida.
- Honeypot, límites de longitud, frecuencia por visitante, campos permitidos, dominios autorizados y validación del formulario.
- Ninguna política permite leer las tablas desde el navegador; el backend filtra por rol y propietario.
