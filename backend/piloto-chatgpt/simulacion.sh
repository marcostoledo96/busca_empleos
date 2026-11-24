#!/bin/sh
set -eu

if [ "$#" -ne 0 ]; then
    printf '%s\n' 'Uso: sh backend/piloto-chatgpt/simulacion.sh' >&2
    exit 2
fi

command -v bwrap >/dev/null || { printf '%s\n' 'Se requiere Bubblewrap (bwrap); no se ejecutó la simulación.' >&2; exit 127; }
command -v node >/dev/null || { printf '%s\n' 'Se requiere Node.js; no se ejecutó la simulación.' >&2; exit 127; }
node_bin=$(realpath -- "$(command -v node)")
directorio=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)

# No monto el checkout completo: solo los módulos y pruebas sintéticas necesarios.
set -- --unshare-all --die-with-parent --new-session --clearenv \
    --setenv HOME /tmp --setenv TMPDIR /tmp \
    --tmpfs /tmp --dev /dev --proc /proc \
    --ro-bind /usr/lib /usr/lib --ro-bind /lib /lib --ro-bind-try /lib64 /lib64 \
    --ro-bind-try /usr/share/nodejs /usr/share/nodejs \
    --ro-bind "$node_bin" /node
for archivo in almacen.js oauth.js responses.js oauth.node-test.js responses.node-test.js; do
    set -- "$@" --ro-bind "$directorio/$archivo" "/piloto/$archivo"
done

exec bwrap "$@" --chdir /piloto -- /node --test oauth.node-test.js responses.node-test.js
