#!/bin/sh
set -eu

ROOT_FOLDER="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
COMMANDS_FOLDER="${ROOT_FOLDER}/packages/apps/desktop_tauri/target/release/bundled_commands"

(cd "${ROOT_FOLDER}/packages/auxiliary/heidrun_code_ctrl" && cargo build --release)
(cd "${ROOT_FOLDER}/packages/data_layers/heidrun_code_data" && cargo build --release)

mkdir -p "${COMMANDS_FOLDER}"
cp "${ROOT_FOLDER}/packages/apps/desktop_tauri/target/release/heidrun_code_ctrl" "${COMMANDS_FOLDER}/heidrun_code_ctrl"
cp "${ROOT_FOLDER}/packages/apps/desktop_tauri/target/release/heidrun_code_data" "${COMMANDS_FOLDER}/heidrun_code_data"
