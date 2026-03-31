-- Script de creación de tablas para la base de datos busca_empleos.
-- Se ejecuta una sola vez con:
--   psql -U postgres -d busca_empleos -f backend/sql/crear-tablas.sql
--
-- Uso IF NOT EXISTS para que sea idempotente: si la tabla ya existe, no falla.

CREATE TABLE IF NOT EXISTS ofertas (
    -- Identificador único, se auto-incrementa con cada INSERT.
    id                  SERIAL          PRIMARY KEY,

    -- Datos principales de la oferta.
    titulo              VARCHAR(500)    NOT NULL,
    empresa             VARCHAR(255),
    ubicacion           VARCHAR(255),
    modalidad           VARCHAR(50),
    descripcion         TEXT,

    -- URL única de la oferta. UNIQUE garantiza deduplicación:
    -- si intento insertar la misma URL dos veces, PostgreSQL lo rechaza
    -- (y con ON CONFLICT DO NOTHING en el INSERT, simplemente lo ignora).
    url                 VARCHAR(2048)   UNIQUE NOT NULL,

    -- De qué plataforma vino: 'linkedin' o 'computrabajo'.
    plataforma          VARCHAR(50)     NOT NULL,

    -- Nivel que pide la oferta (trainee, junior, semi-senior, etc.).
    nivel_requerido     VARCHAR(50),

    -- Rango salarial. NUMERIC soporta decimales si vienen.
    -- Pueden ser NULL si la oferta no publica salario.
    salario_min         NUMERIC,
    salario_max         NUMERIC,
    moneda              VARCHAR(10),

    -- Estado de la evaluación por DeepSeek.
    -- Empieza como 'pendiente' hasta que la IA la evalúe.
    estado_evaluacion   VARCHAR(20)     DEFAULT 'pendiente',

    -- Razón que da DeepSeek de por qué aprobó o rechazó la oferta.
    razon_evaluacion    TEXT,

    -- Porcentaje de compatibilidad que asigna DeepSeek (0–100).
    -- Permite ordenar las ofertas por "chance de éxito" en el dashboard.
    -- NULL mientras la oferta esté en estado 'pendiente'.
    porcentaje_match    INTEGER,

    -- Estado de la postulación del usuario.
    -- Arranca en 'no_postulado' y el usuario lo actualiza manualmente desde el dashboard.
    -- Valores posibles: 'no_postulado', 'cv_enviado', 'en_proceso', 'descartada'.
    estado_postulacion  VARCHAR(30)     DEFAULT 'no_postulado',

    -- Fecha en que se publicó la oferta (puede ser NULL si la plataforma no la da).
    fecha_publicacion   TIMESTAMP,

    -- Fecha en que mi sistema extrajo la oferta. Se llena automáticamente.
    fecha_extraccion    TIMESTAMP       DEFAULT NOW(),

    -- JSON original que devuelve Apify, sin procesar.
    -- Uso JSONB (no JSON) porque permite hacer queries dentro del JSON,
    -- y ocupa menos espacio en disco.
    datos_crudos        JSONB
);

-- Índice para buscar ofertas por estado de evaluación rápidamente.
-- Sin este índice, PostgreSQL tendría que recorrer TODA la tabla para filtrar
-- por estado. Con el índice, va directo a las filas que matchean.
CREATE INDEX IF NOT EXISTS idx_ofertas_estado_evaluacion
    ON ofertas (estado_evaluacion);

-- Índice para buscar ofertas por plataforma.
CREATE INDEX IF NOT EXISTS idx_ofertas_plataforma
    ON ofertas (plataforma);

-- Índice para buscar ofertas por estado de postulación (filtramos seguido por esto).
CREATE INDEX IF NOT EXISTS idx_ofertas_estado_postulacion
    ON ofertas (estado_postulacion);

-- Índice para ordenar ofertas por porcentaje de match (ranking de IA).
CREATE INDEX IF NOT EXISTS idx_ofertas_porcentaje_match
    ON ofertas (porcentaje_match DESC NULLS LAST);
