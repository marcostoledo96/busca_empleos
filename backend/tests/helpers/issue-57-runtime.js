const { validarEntorno } = require('./issue-57-entorno');

async function prepararControles(pool, esquema) {
    validarEntorno(process.env, esquema);
    await pool.query(`CREATE TABLE issue57_fallo (modo TEXT NOT NULL);
        INSERT INTO issue57_fallo VALUES ('ninguno');
        CREATE FUNCTION issue57_inyectar_fallo() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE modo TEXT;
        BEGIN
            SELECT f.modo INTO modo FROM issue57_fallo f;
            IF TG_TABLE_NAME IN ('preferencias', 'cv_base') THEN
                IF modo = 'preferencias_cv' THEN
                    RAISE EXCEPTION 'Fallo sintético issue57: %', modo;
                END IF;
            ELSIF TG_TABLE_NAME = 'ofertas' THEN
                IF modo = 'postulacion_parcial' AND TG_OP = 'UPDATE' AND NEW.titulo LIKE '% 2' THEN
                    RETURN NULL;
                END IF;
                IF modo = 'persistencia' OR (modo = 'persistencia_parcial' AND NEW.titulo LIKE '% 2') THEN
                    RAISE EXCEPTION 'Fallo sintético issue57: %', modo;
                END IF;
            ELSIF (modo = 'historial_inicio' AND TG_OP = 'INSERT') OR (modo = 'historial_fin' AND TG_OP = 'UPDATE') THEN
                RAISE EXCEPTION 'Fallo sintético issue57: %', modo;
            END IF;
            RETURN NEW;
        END $$;
        CREATE TRIGGER issue57_preferencias BEFORE INSERT OR UPDATE ON preferencias FOR EACH ROW EXECUTE FUNCTION issue57_inyectar_fallo();
        CREATE TRIGGER issue57_cv BEFORE INSERT OR UPDATE ON cv_base FOR EACH ROW EXECUTE FUNCTION issue57_inyectar_fallo();
        CREATE TRIGGER issue57_ofertas BEFORE INSERT OR UPDATE ON ofertas FOR EACH ROW EXECUTE FUNCTION issue57_inyectar_fallo();
        CREATE TRIGGER issue57_historial BEFORE INSERT OR UPDATE ON ejecuciones_busqueda FOR EACH ROW EXECUTE FUNCTION issue57_inyectar_fallo();`);
    const fallo = async modo => {
        validarEntorno(process.env, esquema);
        if (!['ninguno', 'persistencia', 'persistencia_parcial', 'historial_inicio', 'historial_fin', 'postulacion_parcial', 'previsualizacion_lectura', 'previsualizacion_429', 'historial_lectura', 'preferencias_cv'].includes(modo)) {
            throw new Error('Fallo sintético desconocido.');
        }
        await pool.query('UPDATE issue57_fallo SET modo=$1', [modo]);
    };
    const evidencia = async () => ({
        esquema: (await pool.query('SELECT current_schema() AS nombre, current_database() AS base')).rows[0],
        ofertas: (await pool.query(`SELECT id, titulo, identidad_canonica, fecha_extraccion, fecha_ultima_extraccion,
            estado_postulacion, to_char(fecha_postulacion, 'YYYY-MM-DD') AS fecha_postulacion, nota_postulacion FROM ofertas ORDER BY id`)).rows,
        evaluaciones: (await pool.query(`SELECT id, estado_evaluacion, porcentaje_match, razon_evaluacion,
            firma_criterios_evaluacion, evaluacion_error_mensaje FROM ofertas ORDER BY id`)).rows,
        historial: (await pool.query('SELECT id, tipo, estado, fin, resumen FROM ejecuciones_busqueda ORDER BY id')).rows,
        cron: (await pool.query('SELECT * FROM configuracion_cron')).rows,
        preferencias: (await pool.query('SELECT * FROM preferencias ORDER BY id')).rows,
        cvBase: (await pool.query('SELECT * FROM cv_base ORDER BY id')).rows,
    });
    const reset = async () => {
        validarEntorno(process.env, esquema);
        await fallo('ninguno');
        await pool.query('TRUNCATE ofertas, ejecuciones_busqueda, evaluaciones_cache, evaluacion_lotes RESTART IDENTITY CASCADE');
    };
    const falloLectura = async ruta => {
        const modo = (await pool.query('SELECT modo FROM issue57_fallo')).rows[0].modo;
        if (modo === 'previsualizacion_429' && ruta === '/api/scraping/previsualizacion') return 429;
        return ((modo === 'previsualizacion_lectura' && ruta === '/api/scraping/previsualizacion')
            || (modo === 'historial_lectura' && ruta === '/api/automatizacion/historial')) ? 503 : 0;
    };
    return { fallo, evidencia, reset, falloLectura };
}

async function esperarTerminal(consultar, timeoutMs = 10000) {
    const limite = Date.now() + timeoutMs;
    while (Date.now() < limite) {
        const respuesta = await consultar();
        if (respuesta.status !== 200 || respuesta.body.exito !== true) throw new Error('Falló el polling de progreso.');
        if (respuesta.body.datos.activo === false) return respuesta.body.datos;
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('El ciclo no alcanzó un estado terminal dentro del límite.');
}

module.exports = { prepararControles, esperarTerminal };
