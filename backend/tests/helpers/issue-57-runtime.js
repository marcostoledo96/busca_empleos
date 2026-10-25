const { validarEntorno } = require('./issue-57-entorno');

async function prepararControles(pool, esquema) {
    validarEntorno(process.env, esquema);
    await pool.query(`CREATE TABLE issue57_fallo (modo TEXT NOT NULL);
        INSERT INTO issue57_fallo VALUES ('ninguno');
        CREATE FUNCTION issue57_inyectar_fallo() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE modo TEXT;
        BEGIN
            SELECT f.modo INTO modo FROM issue57_fallo f;
            IF TG_TABLE_NAME = 'ofertas' THEN
                IF modo = 'persistencia' OR (modo = 'persistencia_parcial' AND NEW.titulo LIKE '% 2') THEN
                    RAISE EXCEPTION 'Fallo sintético issue57: %', modo;
                END IF;
            ELSIF (modo = 'historial_inicio' AND TG_OP = 'INSERT') OR (modo = 'historial_fin' AND TG_OP = 'UPDATE') THEN
                RAISE EXCEPTION 'Fallo sintético issue57: %', modo;
            END IF;
            RETURN NEW;
        END $$;
        CREATE TRIGGER issue57_ofertas BEFORE INSERT OR UPDATE ON ofertas FOR EACH ROW EXECUTE FUNCTION issue57_inyectar_fallo();
        CREATE TRIGGER issue57_historial BEFORE INSERT OR UPDATE ON ejecuciones_busqueda FOR EACH ROW EXECUTE FUNCTION issue57_inyectar_fallo();`);
    const fallo = async modo => {
        validarEntorno(process.env, esquema);
        if (!['ninguno', 'persistencia', 'persistencia_parcial', 'historial_inicio', 'historial_fin'].includes(modo)) {
            throw new Error('Fallo sintético desconocido.');
        }
        await pool.query('UPDATE issue57_fallo SET modo=$1', [modo]);
    };
    const evidencia = async () => ({
        esquema: (await pool.query('SELECT current_schema() AS nombre, current_database() AS base')).rows[0],
        ofertas: (await pool.query(`SELECT id, titulo, identidad_canonica, fecha_extraccion, fecha_ultima_extraccion,
            estado_postulacion, fecha_postulacion, nota_postulacion FROM ofertas ORDER BY id`)).rows,
        historial: (await pool.query('SELECT id, tipo, estado, fin, resumen FROM ejecuciones_busqueda ORDER BY id')).rows,
        cron: (await pool.query('SELECT * FROM configuracion_cron')).rows,
    });
    const reset = async () => {
        validarEntorno(process.env, esquema);
        await fallo('ninguno');
        await pool.query('TRUNCATE ofertas, ejecuciones_busqueda, evaluaciones_cache, evaluacion_lotes RESTART IDENTITY CASCADE');
    };
    return { fallo, evidencia, reset };
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
