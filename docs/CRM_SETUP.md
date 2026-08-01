# Activación del CRM VGG

## 1. Crear la base independiente

Crear un proyecto Supabase dentro de una organización propiedad de VGG. No usar la organización ni los proyectos de AMITAI.

Aplicar `supabase/schema.sql` en el proyecto nuevo. Después crear el usuario de Dirección en Supabase Auth e insertar su perfil usando el mismo UUID:

```sql
insert into public.crm_profiles (id, email, full_name, role)
values ('UUID_DEL_USUARIO_AUTH', 'correo@verygoodgraphics.mx', 'Nombre', 'owner');
```

## 2. Variables de Netlify

Configurar solo en el sitio Netlify de VGG:

```text
VGG_SUPABASE_URL
VGG_SUPABASE_PUBLISHABLE_KEY
VGG_SUPABASE_SECRET_KEY
VGG_ALLOWED_ORIGINS=https://verygoodgraphics.mx,https://www.verygoodgraphics.mx
VGG_CRM_DEFAULT_OWNER_ID
VGG_CRM_FORM_ENABLED=false
VGG_CRM_AUTOMATION_ENABLED=false
```

La llave secreta nunca debe escribirse en Git, HTML ni JavaScript del navegador.

## 3. Prueba controlada

1. Desplegar una vista previa de la rama.
2. Probar login, permisos de Dirección y recuperación de acceso.
3. Crear prospecto, tarea, propuesta con margen mayor y menor a 50%, proyecto y pago.
4. Probar el endpoint con origen permitido y rechazado.
5. Hacer un envío desde una landing de prueba y confirmar lead, atribución y tarea.
6. Activar el formulario solo después de validar el recorrido completo.

## 4. Publicación gradual

Mantener Netlify Forms durante la transición. Conectar primero una landing, medir y recuperar un lead real de prueba; luego conectar el formulario general y por último iniciar campañas.
