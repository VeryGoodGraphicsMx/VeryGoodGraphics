# Contexto del CRM VGG

## Objetivo

Convertir el sitio de Very Good Graphics en un sistema comercial que reciba, clasifique y dé seguimiento a prospectos; prepare propuestas; controle producción, cobros y margen; y solicite intervención humana solo para decisiones comerciales o compromisos reales.

## Límites de proyecto

- Este código, sus datos, usuarios y secretos pertenecen exclusivamente a VGG.
- AMITAI se usó solo como referencia de patrones técnicos. No se copian datos, cuentas, usuarios, llaves ni configuración.
- El proyecto Supabase de VGG debe vivir en una organización/cuenta independiente de AMITAI.
- El despliegue debe conectarse al sitio Netlify y al repositorio GitHub de VGG.

## Estado al 1 de agosto de 2026

- Interfaz CRM: publicada con autenticación, recuperación segura y permisos por rol.
- Supabase: proyecto `VGG CRM` activo en la organización exclusiva `ztbbjsrelrzmshesdiho`; 14 tablas CRM y tres migraciones aplicadas.
- Usuarios: un perfil `owner` activo; no hay usuarios, datos ni secretos de AMITAI.
- Captación: endpoint Netlify preparado para recibir servicio, subtipo, landing, URL, referente y UTM; Netlify Forms se mantiene como fallback.
- SEO comercial: home con prioridad audiovisual y landings para producto, restaurantes, eventos, fotografía y dron.
- Automatizaciones de correo: estructura preparada, proveedor pendiente.
