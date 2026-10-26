# Runtime sintético T1

- Worktree base: `7cdc6bc62898b3b5f9d1b8b090e3ee571249c439`.
- Docker Engine observado: `29.1.3`.
- Verifiqué puerto libre con un servidor TCP temporal en loopback antes de provisionar.
- Contenedor exclusivo: `busca-empleos-issue61-7cdc6bc-20261026`.
- ID: `3ed45dd1f59aca0c368786e9154c7aada64b1b6afb28be07c430f35f7039e6b2`.
- Imagen pública: `postgres:15`, digest `sha256:baa22e6286bf832cb147b8bb5aa9d8bc999846d69c21d11bf63f58fbeed1fa48`.
- Único puerto publicado: `127.0.0.1:55457` → `5432/tcp`.
- Base exclusivamente sintética: `busca_empleos_issue57_test`, para reutilizar sin modificar las guardas #57.
- Credenciales exclusivamente ficticias: `busca_empleos_test` / `sintetica_issue57`.
- El fixture confirma nombre de base, rol y PostgreSQL 15 antes del primer CREATE.
- Cada ejecución conserva esquemas `issue61_<pid>_<fecha>_*` y un rol lector no privilegiado exclusivo.
- No hay mounts del workspace ni de otros servicios. Los datos viven en el almacenamiento Docker del contenedor.
- Dejo el contenedor en ejecución para T2/T3. El padre es responsable de detener/eliminar **solamente este ID** y su volumen anónimo al terminar, con autorización correspondiente. No toqué otros contenedores, servicios ni puertos.
- `sql11.json`, cachés y fixtures SQL futuros son generados e ignorados dentro de este directorio. El fixture futuro nunca toca `backend/sql` ni `backend/migrations`.
