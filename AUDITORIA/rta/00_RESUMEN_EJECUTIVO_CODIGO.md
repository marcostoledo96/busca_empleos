# Auditoría mejorada sobre código fuente — Busca Empleos

**Fecha:** 27 de mayo de 2026  
**Alcance:** revisión estática del ZIP `busca_empleos.zip`, código backend, frontend, SQL, configuración y tests.  
**Stack auditado:** Node.js 22 + Express 5 + PostgreSQL + Angular 20 + Firebase Auth.

## Resumen ejecutivo

### Puntaje general: 78/100

El proyecto está bastante bien encaminado para un sistema personal/de aprendizaje: tiene separación por capas, auth server-side con Firebase, SQL parametrizado, rate limit en endpoints principales, tests relevantes, modo demo y una arquitectura entendible. La auditoría con código fuente confirma varias buenas decisiones que en la auditoría documental solo podían asumirse.

La principal mejora respecto de la auditoría anterior es que ahora hay evidencia directa de archivos y líneas. El hallazgo más importante no es del runtime de la app sino del proceso de entrega: el ZIP compartido incluyó secretos reales (`.env` y service account de Firebase). Aunque están ignorados por Git, al empaquetar el working tree quedaron dentro del archivo.

### Distribución de hallazgos

- 🔴 Críticos: 1
- 🟠 Altos: 3
- 🟡 Medios: 13
- 🟢 Bajos: 4

### Top 5 prioridades

1. **[H001] Rotar secretos y crear export seguro del proyecto.**
2. **[H002] Agregar rate limit al análisis/importación de CV con IA.**
3. **[H003] Blindar o eliminar endpoint de diagnóstico de persistencia.**
4. **[H008] Ordenar migraciones con runner y control de aplicadas.**
5. **[H012] Agregar paginación/lotes para ofertas y evaluación.**

## Qué cambió al revisar código real

La auditoría documental decía que faltaban certezas sobre SQL injection, auth y estructura. El código confirma que:

- Las queries principales usan parámetros `$1`, `$2`, etc.
- El `ORDER BY` dinámico usa whitelist.
- Firebase JWT se verifica server-side y además se restringe por `EMAIL_AUTORIZADO`.
- Helmet y CORS están configurados.
- Los endpoints costosos principales tienen rate limit.
- Hay tests backend y frontend más completos de lo que sugería una lectura rápida.

Pero también aparecen hallazgos que solo se ven con el código fuente:

- El ZIP incluye secretos ignorados por Git.
- El endpoint de importación de CV quedó fuera del rate limit.
- El diagnóstico de persistencia puede devolver `connectionString` si se habilita por error.
- La tabla de lotes de evaluación se escribe pero no se lee para rehidratar.
- La paginación todavía no existe y el dashboard carga todas las ofertas.
