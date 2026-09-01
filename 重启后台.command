#!/bin/zsh

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$ROOT_DIR/scripts/local-app-manager.sh" restart
