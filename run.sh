#!/usr/bin/env bash
# Ejecuta una o varias suites, opcionalmente solo algunos tests (la reserva y el reset del staging
# los hace global-setup.ts).
#   SUITE=a-auth[,b-eventos...]  GREP='TC-A01 Jugador…|TC-B02 …' (opcional, regex de títulos)  ./run.sh
# SUITE y GREP llegan de la web (lo que elige un visitante): SUITE se limpia a caracteres de slug y
# GREP se pasa como un único argumento entre comillas, nunca se interpola en el shell.
set -euo pipefail
cd "$(dirname "$0")"
suites=$(printf %s "${SUITE:?Falta SUITE}" | tr -cd 'a-z0-9,-')
args=()
IFS=',' read -ra list <<< "$suites"
for s in "${list[@]}"; do [ -n "$s" ] && args+=("tests/$s"); done
[ -n "${GREP:-}" ] && args+=(--grep "$GREP")
exec npx playwright test "${args[@]}"
