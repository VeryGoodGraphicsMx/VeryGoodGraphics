# Decisiones

## 2026-08-01 — Instancia independiente para VGG

VGG no reutilizará el proyecto Supabase, usuarios, datos ni variables de AMITAI. La conexión actual permite auditar patrones, no alojar el CRM de VGG.

## 2026-08-01 — Acceso a datos solo por backend

El navegador autentica con Supabase Auth y entrega su token a Netlify Functions. Las funciones verifican al usuario, consultan `crm_profiles` y aplican permisos por rol. Las tablas no conceden acceso directo a `anon` ni `authenticated`.

## 2026-08-01 — Margen protegido

La propuesta calcula precio, costo y margen. Dirección no puede aprobar desde el flujo normal una propuesta con margen inferior al 50%; primero debe corregir precio, alcance o costo.

Los descuentos muestran precio de lista, ahorro, precio final y una vigencia real. Nunca se fabrica una cuenta regresiva ni se conserva un beneficio vencido sin revisión humana.

Las propuestas y kickoffs se comparten mediante tokens aleatorios; Supabase conserva únicamente su hash. Las páginas son privadas, `noindex`, `no-store` y no envían el token como referente.

## 2026-08-01 — Automatizar preparación, no compromisos

Se automatizan captura, scoring, atribución, recordatorios, tareas y borradores. Precio final, alcance, negociación, pago y kickoff requieren acción humana.

## 2026-08-01 — Migración gradual del formulario

Netlify Forms permanece activo como respaldo. El nuevo endpoint solo se activa después de probar la escritura, notificación y recuperación del lead en el CRM de producción.
