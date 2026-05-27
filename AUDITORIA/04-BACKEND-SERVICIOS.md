# 04 — Backend: Servicios (Lógica de Negocio)

## servicio-scraping.js (1254 líneas)

### Plataformas y tecnologías usadas

| Plataforma | Método | Tecnología | Cantidad máx |
|-----------|--------|-----------|-------------|
| LinkedIn | Apify actor | `clienteApify.actor().call()` | 100 |
| Computrabajo | Scraping directo | `fetch()` + Cheerio (SSR HTML) | 50 |
| Indeed | Apify actor | `clienteApify.actor().call()` | 50 |
| Bumeran | Apify puppeteer | Puppeteer + jQuery inject | (todas) |
| Glassdoor | Apify actor | `clienteApify.actor().call()` | 50 |
| GetOnBrd | API REST pública | `fetch()` nativo | 50 |
| Jooble | API REST oficial | POST con API key | 50 |
| Google Jobs | **DESACTIVADO** | Retorna `[]` | — |
| Remotive | API REST pública | `fetch()` | 50 |
| RemoteOK | API REST pública | `fetch()` | 50 |
| InfoJobs | API REST oficial | HTTP Basic Auth | 50 |
| Adzuna | API REST oficial | app_id + app_key | 50 |

### Filtro temporal
Todas las ofertas con fecha pasan por `filtrarPorUltimasDosemanas()`:
- Conserva ofertas con fecha dentro de 14 días
- Conserva ofertas SIN fecha (Bumeran, Computrabajo no siempre la tienen)
- Descarta solo ofertas con fecha conocida y > 14 días

### Headers de scraping directo
```javascript
{
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
}
```

### Funciones exportadas
```javascript
{
    ejecutarScrapingLinkedin,      // opciones: { maxResultados=100, terminos, ubicacion }
    ejecutarScrapingComputrabajo,  // opciones: { maxResultados=50, terminos }
    ejecutarScrapingIndeed,        // opciones: { maxResultados=50, terminos }
    ejecutarScrapingBumeran,       // opciones: { terminos }
    ejecutarScrapingGlassdoor,     // opciones: { maxResultados=50, terminos }
    ejecutarScrapingGetonbrd,      // opciones: { maxResultados=50, terminos }
    ejecutarScrapingJooble,        // opciones: { maxResultados=50, terminos }
    ejecutarScrapingGoogleJobs,    // DESACTIVADO
    ejecutarScrapingRemotive,      // opciones: { maxResultados=50, terminos }
    ejecutarScrapingRemoteOK,      // opciones: { maxResultados=50, terminos }
    ejecutarScrapingInfojobs,      // opciones: { maxResultados=50, terminos }
    ejecutarScrapingAdzuna,        // opciones: { maxResultados=50, terminos }
    _filtrarPorUltimasDosemanas,   // helper testeable
}
```

---

## servicio-normalizacion.js (1295 líneas)

### Propósito
Convertir datos crudos de cada plataforma a un formato canónico uniforme (`Oferta`)
con los campos: `titulo`, `empresa`, `ubicacion`, `modalidad`, `descripcion`,
`url`, `plataforma`, `nivel_requerido`, `salario_min`, `salario_max`, `moneda`,
`fecha_publicacion`, `datos_crudos`.

### Normalizadores por plataforma

| Plataforma | Campos clave mapeados | Detalles especiales |
|-----------|----------------------|---------------------|
| LinkedIn | `jobUrl/link` → url, `jobTitle/title` → titulo, `jobDescription/descriptionText` → descripcion, `experienceLevel/seniorityLevel` → nivel, `publishedAt/postedAt` → fecha, `salary` → salario | Canoniza URL (remueve query params y fragments) |
| Computrabajo | `url` → url, `title` → titulo, `company` → empresa, `location` → ubicacion, `descriptionText` → descripcion, `modalidadDetalle` → modalidad, `postedDate` → fecha | Modalidad viene del detalle HTML |
| Indeed | `url` → url, `title` → titulo, `employer.name` → empresa, `location.city+countryName` → ubicacion, `description.text` → descripcion, `attributes` → modalidad/nivel, `baseSalary` → salario | "Desde casa" = remoto |
| Bumeran | `url`, `titulo`, `empresa`, `ubicacion`, `modalidad`, `descripcion` | Mapea modalidad de español a minúscula |
| Glassdoor | `jobUrl` → url, `title` → titulo, `company.companyName` → empresa, `location_city+state` → ubicacion, `description_text` → descripcion, `remoteWorkTypes` → modalidad | `experienceRequired` no se mapea |
| GetOnBrd | `links.public_url` → url, `attributes.title` → titulo, `attributes.countries` → ubicacion, `attributes.remote_modality` → modalidad, `attributes.description` → descripcion, `relationships.seniority.data.id` → nivel | IDs: 1=trainee, 2=junior, 3=semi-senior |
| Jooble | `link` → url, `title` → titulo, `company` → empresa, `location`, `type` → modalidad, `snippet` → descripcion, `salary`, `updated` → fecha | Modalidad desde `type` (Remote/Hybrid) |
| Remotive | `url`, `title`, `company_name`, `candidate_required_location`, `description`, `salary`, `publication_date` | Modalidad SIEMPRE = 'remoto' |
| RemoteOK | `url`, `position`, `company`, `location`, `description`, `salary_min/max`, `date` | Modalidad SIEMPRE = 'remoto' |
| InfoJobs | `link` → url, `title`, `company.name/author.name`, `city/province`, `teleworking` → modalidad, `description` | **Capa 2**: rechaza si teleworking ≠ 'solo-teletrabajo' |
| Adzuna | `redirect_url`, `title`, `company.display_name`, `location.display_name`, `description` | **Capa 2**: rechaza si no contiene indicadores de remoto |

### Funciones auxiliares exportadas (testeables)
`_parsearSalario`, `_mapearNivelGetonbrd`, `_detectarModalidadGetonbrd`, `_detectarModalidad`,
`_mapearNivelLinkedin`, `_detectarModalidadIndeed`, `_detectarNivelIndeed`,
`_mapearModalidadBumeran`, `_detectarModalidadGlassdoor`, `_detectarModalidadJooble`,
`_detectarModalidadGoogleJobs`, `_canonizarUrlLinkedin`, `detectarIdioma`

### Detección de idioma (`detectarIdioma`)
Algoritmo conservador basado en frases características:
- **Inglés**: "we are looking", "responsibilities", "requirements", "years of experience", etc.
- **Español**: "buscamos", "requisitos", "postulate", "experiencia laboral", etc.
- Solo marca como inglés si `puntosIngles >= 2 && puntosIngles > puntosEspanol`
- **Propósito**: descartar ofertas globales (USA/UK) que no aplican al perfil

---

## servicio-scoring-previo.js (513 líneas)

### Propósito
Calcular un score determinístico (0-100) antes de llamar a DeepSeek, para:
1. Filtrar ofertas claramente no compatibles (ahorra llamadas a IA)
2. Identificar ofertas claramente compatibles (también ahorra IA)
3. Proveer contexto estructurado al refinador DeepSeek

### Catálogo de tecnologías (56 entradas)
Angular, React, Blazor, Node.js, Express, ASP.NET, PostgreSQL, SQL Server,
HTML5, CSS3, JavaScript, TypeScript, C#, Java, Spring Boot, Hibernate, J2EE,
Git, Jira, Figma, Jest, QA Manual, Docker, AWS, Kotlin, Go, Python, PHP,
Ruby, Swift, GraphQL, MongoDB, Firebase, Terraform, Kubernetes, y más.

### Sistema de puntaje

| Categoría | Regla | Puntaje |
|-----------|------|---------|
| Tecnología nivel avanzado | Detectada en oferta | +8 |
| Tecnología nivel medio | Detectada en oferta | +5 |
| Tecnología nivel básico | Detectada en oferta | +2 |
| Tecnología nivel ninguno | Detectada en oferta | -5 |
| Seniority: "senior" / "sr." | Detectado en título/desc | -30 |
| Seniority: "semi senior" / "ssr" | Detectado | -10 |
| Seniority: "junior" / "trainee" | Detectado | 0 |
| Inglés avanzado explícito | "fluent", "bilingual", "reuniones en inglés" | -50 |
| Inglés sin exigir fluidez | Texto en inglés | -20 |
| Portugués como idioma principal | — | -60 |
| Rol objetivo alta prioridad | Detectado | +5 |
| HealthTech (sector salud) | Detectado | +5 |
| Stack principal completo | ≥70% de tecnologías "principal" | +10 |
| Conocimiento ausente | Tecnología que no maneja | -5 c/u |
| Años experiencia | Oferta pide más que `anios_experiencia_reales` | -10 por año extra |
| Señal de rol senior | "ingeniero de software" | -15 |
| Señal de rol senior | "senior software" | -20 |
| Señal de rol senior | "amplia/sólida/vasta experiencia" | -10 |
| Señal de rol senior | "mínimo 3/4/5 años" | -15 |
| Señal de rol senior | "lead/staff/principal" | -20 |

### Fórmula del score
```
score = 50
  + bonificacion_tecnologias
  - penalizacion_tecnologias
  - penalizacion_seniority
  - penalizacion_idioma
  - penalizacion_conocimientos_ausentes
  - penalizacion_rol_senior
  - penalizacion_anios_experiencia
  + bonificacion_rol_objetivo
  + bonificacion_healthtech
  + bonificacion_stack_completo
```

### Umbral de aprobación
Default: **60** (configurable en `scoring_config.umbral_aprobacion`)

---

## servicio-evaluacion.js (796 líneas)

### Flujo completo de evaluación

```
Para cada oferta pendiente:
│
├─ 1. Scoring previo (servicio-scoring-previo)
│
├─ 2. Defensa programática: ¿presencial fuera de zona?
│     └─ Sí → rechazo inmediato (score 0), NO llama a IA
│
├─ 3. Corte de extremos:
│     ├─ Score < 30 → RECHAZO AUTOMÁTICO (sin DeepSeek)
│     ├─ Score ≥ 85 → APROBACIÓN AUTOMÁTICA (sin DeepSeek)
│     └─ 30 ≤ Score < 85 → DeepSeek refina (±15 puntos, ±25 con evidencia)
│
├─ 4. Cache: ¿existe resultado para (hashOferta, hashPreferencias, modeloIa)?
│     └─ Sí → reutiliza sin llamar a DeepSeek
│
├─ 5. DeepSeek: prompt corto con análisis previo resumido
│
└─ 6. Guardado en BD: score + análisis + resultado evaluación
```

### Prompt de sistema (DeepSeek refinador)
```
Sos un refinador de scores de ofertas laborales. Recibís un análisis previo
ya calculado y tenés que ajustarlo solo si encontrás evidencia clara en la
descripción.

Reglas:
- No rechaces automáticamente por Java, Spring, seniority alto ni tecnologías
  desconocidas. El score previo ya penalizó esas cosas.
- Ajuste normal máximo: ±15 puntos.
- Ajuste excepcional: ±25 solo si hay evidencia textual MUY clara.
- Inglés avanzado, fluido o bilingüe BAJA el score.
- Si la oferta está principalmente en inglés o portugués, el score debe bajar fuerte.
- HealthTech suma valor.
- Red flags: horas extra no pagas, disponibilidad 24/7, sueldo 100% variable.
```

### Progreso en memoria
```javascript
let progresoEvaluacion = {
    activo: false,
    total: 0, evaluadas: 0, aprobadas: 0, rechazadas: 0,
    errores: 0, porcentaje: 0
};
```

### Lotes persistentes
- Crea lote en tabla `evaluacion_lotes` al inicio
- Actualiza progreso cada 5 ofertas
- Finaliza lote al terminar (estado: 'completado' o 'cancelado')
- Permite rehidratar estado tras reinicio del servidor

### Cancelación
- Bandera `_cancelarEvaluacion` (boolean)
- El loop chequea la bandera entre ofertas (no corta a mitad de una evaluación)
- Limpia el intervalo de polling

---

## servicio-automatizacion.js (507 líneas)

### Expresión cron
- **Default**: `"0 8 * * 3"` → Miércoles 8:00 AM Argentina (ART)
- **Timezone**: `America/Argentina/Buenos_Aires`

### Ciclo completo (`ejecutarCicloCompleto`)
1. Scrapea 10 plataformas (InfoJobs desactivado, Google Jobs desactivado)
2. Filtro de idioma: descarta ofertas en inglés
3. Guarda ofertas en BD (deduplicación por URL)
4. Evalúa ofertas pendientes con IA
5. Registra duración, errores y resultado

### Pesos del progreso (para la barra de progreso)

| Paso | Peso |
|------|------|
| linkedin | 5.2% |
| computrabajo | 5.2% |
| indeed | 5.2% |
| bumeran | 5.2% |
| glassdoor | 5.2% |
| getonbrd | 5.2% |
| jooble | 5.2% |
| google_jobs | 5.2% |
| remotive | 5.2% |
| remoteok | 5.2% |
| adzuna | 5.2% |
| guardado | 26% |
| evaluacion | 15% |

### Resiliencia
Si una plataforma falla, sigue con la siguiente. Nunca un error parcial tira el ciclo.
Cada plataforma tiene try/catch independiente.
