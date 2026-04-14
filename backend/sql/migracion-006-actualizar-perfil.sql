-- Migración 006: Actualizar perfil profesional y stack tecnológico en preferencias.
--
-- Ejecutar una sola vez sobre una BD existente con:
--   psql -U postgres -d busca_empleos -f backend/sql/migracion-006-actualizar-perfil.sql
--
-- ¿Por qué esta migración?
-- La tabla preferencias ya existe con datos (no se puede recrear con los defaults
-- del código porque ON CONFLICT DO NOTHING la deja intacta).
-- Esta migración actualiza los campos de perfil para que DeepSeek evalúe
-- las ofertas contra el CV actualizado a abril 2026:
--   - Nuevo perfil_profesional con datos reales (+80 bugs, Angular 20, etc.)
--   - Stack ampliado con Blazor, Jest, xUnit, Moq
--   - Idioma con descripción más precisa

UPDATE preferencias
SET
    perfil_profesional = 'QA Tester, Desarrollador Full Stack y Soporte IT. Estudiante en el último cuatrimestre de la Tecnicatura Superior en Desarrollo de Software (IFTS 16, promedio 9.19). Perfil híbrido con experiencia real en HealthTech (AeroTest): documenté +80 bugs críticos, desarrollé app de historias clínicas (Angular 20, Node.js, PostgreSQL) y automaticé flujos con chatbots reduciendo tiempos de atención un 80%. Dirigente Scout +15 años. Busco roles técnicos de Desarrollo, Testing o Soporte IT en Buenos Aires, Argentina.',

    idioma_candidato = 'Español nativo. Inglés: Reading A2 (lectura técnica elemental — documentación, código, APIs), Listening/Speaking A1 (básico, no conversacional)',

    stack_tecnologico = ARRAY[
        'HTML', 'CSS', 'JavaScript', 'TypeScript', 'C#', 'SQL',
        'Angular 20', 'React', 'React Native',
        'Node.js', 'Express', 'ASP.NET', 'Blazor',
        'PostgreSQL', 'SQL Server',
        'Git', 'API REST', 'Figma',
        'Jest', 'xUnit', 'Moq'
    ]
WHERE id = 1;
