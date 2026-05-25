-- Migración 008: Agregar columnas de perfil detallado a preferencias.
--
-- ¿Para qué?
-- Hasta ahora el perfil de tecnologías era una lista plana (stack_tecnologico TEXT[]).
-- Esto no permitía saber el NIVEL de cada tecnología (básico/medio/avanzado/ninguno),
-- ni su categoría, ni penalizar en vez de rechazar ofertas con tecnologías desconocidas.
--
-- Las nuevas columnas JSONB permiten:
-- - tecnologias_detalle: lista de tecnologías con nivel, categoría, aliases e importancia.
-- - roles_objetivo_detalle: lista de roles buscados con prioridad (alta/media/baja).
-- - scoring_config: configuración de penalizaciones y bonificaciones editable desde UI.
-- - preguntas_perfil_pendientes: preguntas sugeridas por la IA al importar CV.
--
-- Ejecutar una sola vez con:
--   sudo -u postgres psql -d busca_empleos -f backend/sql/migracion-008-preferencias-detalladas.sql

ALTER TABLE preferencias
    ADD COLUMN IF NOT EXISTS tecnologias_detalle JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE preferencias
    ADD COLUMN IF NOT EXISTS roles_objetivo_detalle JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE preferencias
    ADD COLUMN IF NOT EXISTS scoring_config JSONB NOT NULL DEFAULT '{
        "umbral_aprobacion": 60,
        "penalizaciones": {
            "semi_senior": 10,
            "senior": 20,
            "sr_director": 30,
            "tecnologia_desconocida_importante": 5,
            "ingles_avanzado": 25
        },
        "bonificaciones": {
            "healthtech": 5,
            "stack_principal_completo": 10,
            "rol_prioridad_alta": 5
        },
        "deepseek": {
            "ajuste_maximo_normal": 15,
            "ajuste_maximo_con_evidencia": 25
        }
    }'::jsonb;

ALTER TABLE preferencias
    ADD COLUMN IF NOT EXISTS preguntas_perfil_pendientes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE preferencias
    ADD COLUMN IF NOT EXISTS fecha_importacion_cv TIMESTAMP DEFAULT NULL;

-- Backfill: cargo el perfil actual de Marcos con niveles por tecnología.
-- Solo se aplica si las columnas están vacías (primer despliegue).
UPDATE preferencias
SET
    tecnologias_detalle = CASE
        WHEN tecnologias_detalle = '[]'::jsonb THEN '[
            {"nombre":"Angular 20","nivel":"avanzado","categoria":"frontend","importancia":"principal","aliases":["angular","angular 20"]},
            {"nombre":"React","nivel":"medio","categoria":"frontend","importancia":"principal","aliases":["react","react.js","reactjs"]},
            {"nombre":"Blazor","nivel":"basico","categoria":"frontend","importancia":"secundaria","aliases":["blazor","blazor webassembly"]},
            {"nombre":"Node.js","nivel":"avanzado","categoria":"backend","importancia":"principal","aliases":["node","node.js","nodejs"]},
            {"nombre":"Express","nivel":"avanzado","categoria":"backend","importancia":"principal","aliases":["express","express.js"]},
            {"nombre":"ASP.NET","nivel":"basico","categoria":"backend","importancia":"secundaria","aliases":["asp.net","asp net",".net","dotnet"]},
            {"nombre":"PostgreSQL","nivel":"avanzado","categoria":"base_de_datos","importancia":"principal","aliases":["postgresql","postgres","pg"]},
            {"nombre":"SQL Server","nivel":"medio","categoria":"base_de_datos","importancia":"secundaria","aliases":["sql server","mssql"]},
            {"nombre":"HTML5","nivel":"avanzado","categoria":"frontend","importancia":"principal","aliases":["html","html5"]},
            {"nombre":"CSS3/SCSS","nivel":"avanzado","categoria":"frontend","importancia":"principal","aliases":["css","css3","scss","sass"]},
            {"nombre":"JavaScript","nivel":"avanzado","categoria":"lenguaje","importancia":"principal","aliases":["javascript","js","ecmascript","es6"]},
            {"nombre":"TypeScript","nivel":"avanzado","categoria":"lenguaje","importancia":"principal","aliases":["typescript","ts"]},
            {"nombre":"C#","nivel":"medio","categoria":"lenguaje","importancia":"secundaria","aliases":["c#","c sharp","csharp"]},
            {"nombre":"Git","nivel":"avanzado","categoria":"herramienta","importancia":"principal","aliases":["git","github"]},
            {"nombre":"Jira","nivel":"avanzado","categoria":"herramienta","importancia":"principal","aliases":["jira","scrum","agile"]},
            {"nombre":"Figma","nivel":"avanzado","categoria":"herramienta","importancia":"principal","aliases":["figma","ui/ux"]},
            {"nombre":"Jest","nivel":"medio","categoria":"testing","importancia":"principal","aliases":["jest","supertest"]},
            {"nombre":"QA Manual","nivel":"avanzado","categoria":"testing","importancia":"principal","aliases":["qa","qa manual","testing funcional","qa testing"]},
            {"nombre":"Java","nivel":"ninguno","categoria":"lenguaje","importancia":"penalizable","aliases":["java"]},
            {"nombre":"Spring Boot","nivel":"ninguno","categoria":"backend","importancia":"penalizable","aliases":["spring boot","springboot","spring"]},
            {"nombre":"Hibernate","nivel":"ninguno","categoria":"backend","importancia":"penalizable","aliases":["hibernate"]},
            {"nombre":"J2EE","nivel":"ninguno","categoria":"backend","importancia":"penalizable","aliases":["j2ee","jee","java ee","jakarta ee"]}
        ]'::jsonb
        ELSE tecnologias_detalle
    END,
    roles_objetivo_detalle = CASE
        WHEN roles_objetivo_detalle = '[]'::jsonb THEN '[
            {"rol":"QA Manual Jr","prioridad":"alta","aliases":["qa manual","qa tester","tester manual","testing funcional","qa analyst"]},
            {"rol":"Frontend Developer Jr","prioridad":"alta","aliases":["frontend","front end","angular developer","react developer"]},
            {"rol":"Full Stack Developer Jr","prioridad":"media","aliases":["full stack","fullstack","node developer","angular node"]},
            {"rol":"Soporte IT","prioridad":"media","aliases":["soporte it","soporte tecnico","soporte de aplicaciones","mesa de ayuda"]}
        ]'::jsonb
        ELSE roles_objetivo_detalle
    END
WHERE id = 1;
