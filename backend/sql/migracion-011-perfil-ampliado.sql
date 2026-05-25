-- Migración 011: Agregar campos de perfil ampliado para reducir falsos positivos.
--
-- ¿Para qué?
-- Hasta ahora el scoring solo evaluaba tecnologías. Esto hacía que ofertas
-- como "Ingeniero de Software con arquitecturas de eventos" aprobaran con
-- score alto solo por mencionar TypeScript/React/Node.js.
--
-- Los nuevos campos permiten declarar:
-- - nivel_real_seniority: el nivel honesto del candidato (Junior, no Ingeniero)
-- - conocimientos_ausentes: tecnologías/conceptos que NO maneja
-- - limitaciones_explicitas: descripción libre de lo que no puede hacer
--
-- El scoring previo usará estos campos para penalizar ofertas que pidan
-- seniority incompatible o conocimientos que Marcos no tiene.
--
-- Ejecutar con:
--   psql "TU_URL_RAILWAY" -f backend/sql/migracion-011-perfil-ampliado.sql

ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS nivel_real_seniority VARCHAR(100)
    DEFAULT 'Junior / Junior avanzado en proyectos propios, sin experiencia formal semi-senior o senior';

ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS conocimientos_ausentes TEXT[] DEFAULT '{}';

ALTER TABLE preferencias ADD COLUMN IF NOT EXISTS limitaciones_explicitas TEXT DEFAULT '';

-- Backfill: datos reales del perfil de Marcos (mayo 2026).
UPDATE preferencias
SET
    nivel_real_seniority = COALESCE(
        nivel_real_seniority,
        'Junior / Junior avanzado en proyectos propios, sin experiencia formal semi-senior o senior'
    ),
    conocimientos_ausentes = CASE
        WHEN conocimientos_ausentes = '{}' THEN ARRAY[
            'arquitecturas basadas en eventos',
            'microservicios',
            'Kafka',
            'RabbitMQ',
            'sistemas distribuidos',
            'mensajería asíncrona',
            'Kubernetes avanzado / operador',
            'infraestructura como código (CDK avanzado)',
            'seguridad ofensiva / pentesting',
            'machine learning / IA generativa avanzada',
            'data engineering / pipelines ETL',
            'blockchain / Web3',
            'iOS nativo',
            'Android nativo',
            'sistemas embebidos'
        ]
        ELSE conocimientos_ausentes
    END,
    limitaciones_explicitas = COALESCE(
        limitaciones_explicitas,
        'Soy Junior con experiencia práctica en proyectos propios y colaborativos. No tengo experiencia formal semi-senior o senior. Mi experiencia en backend avanzado (microservicios, sistemas distribuidos, mensajería asíncrona) es limitada. No tengo experiencia en iOS/Android nativo, ciencia de datos, machine learning avanzado ni blockchain. Busco roles de QA Manual, Frontend/Full-Stack Junior y Soporte IT de software.'
    )
WHERE id = 1;
