#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.local-runtime"
LOG_DIR="$RUNTIME_DIR/logs"
WEB_PID_FILE="$RUNTIME_DIR/web.pid"
WORKER_PID_FILE="$RUNTIME_DIR/worker.pid"
WEB_LOG_FILE="$LOG_DIR/web.log"
WORKER_LOG_FILE="$LOG_DIR/worker.log"
APP_HOST="127.0.0.1"
APP_PORT="3001"
APP_BASE_URL="http://${APP_HOST}:${APP_PORT}"
DASHBOARD_URL="${APP_BASE_URL}/dashboard"
HEALTHCHECK_URL="${APP_BASE_URL}/login"

mkdir -p "$LOG_DIR"

function print_line() {
  printf '%s\n' "$1"
}

function read_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    tr -d '[:space:]' < "$pid_file"
  fi
}

function is_pid_running() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

function clear_stale_pid() {
  local pid_file="$1"
  local pid
  pid="$(read_pid "$pid_file")"

  if [[ -n "$pid" ]] && ! is_pid_running "$pid"; then
    rm -f "$pid_file"
  fi
}

function port_listener_pid() {
  lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1
}

function ensure_node_modules() {
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    print_line "未检测到 node_modules，请先运行一次: npm install"
    exit 1
  fi
}

function ensure_port_available() {
  local web_pid listener_pid
  web_pid="$(read_pid "$WEB_PID_FILE")"
  listener_pid="$(port_listener_pid)"

  if [[ -z "$listener_pid" ]]; then
    return
  fi

  if [[ -n "$web_pid" ]] && [[ "$listener_pid" == "$web_pid" ]]; then
    return
  fi

  print_line "端口 ${APP_PORT} 已被其他进程占用，无法自动启动。"
  print_line "占用进程 PID: ${listener_pid}"
  print_line "如果这是旧实例，先双击“停止后台.command”再重试。"
  exit 1
}

function wait_for_web() {
  local attempts=0
  local max_attempts=120

  while (( attempts < max_attempts )); do
    if curl -sS -o /dev/null "$HEALTHCHECK_URL"; then
      return 0
    fi

    sleep 1
    attempts=$((attempts + 1))
  done

  print_line "后台启动超时，请查看日志："
  print_line "$WEB_LOG_FILE"
  exit 1
}

function stop_pid_file() {
  local pid_file="$1"
  local name="$2"
  local pid
  pid="$(read_pid "$pid_file")"

  if [[ -z "$pid" ]]; then
    return
  fi

  if ! is_pid_running "$pid"; then
    rm -f "$pid_file"
    return
  fi

  print_line "正在停止 ${name}..."
  kill "$pid" >/dev/null 2>&1 || true

  local attempts=0
  while is_pid_running "$pid" && (( attempts < 10 )); do
    sleep 1
    attempts=$((attempts + 1))
  done

  if is_pid_running "$pid"; then
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi

  rm -f "$pid_file"
}

function build_app() {
  print_line "正在构建本地后台..."
  (
    cd "$ROOT_DIR"
    npm run build
  )
}

function start_web() {
  local existing_pid
  existing_pid="$(read_pid "$WEB_PID_FILE")"

  if is_pid_running "$existing_pid"; then
    print_line "Web 后台已在运行，PID: ${existing_pid}"
    return
  fi

  ensure_port_available

  print_line "正在启动 Web 后台..."
  (
    cd "$ROOT_DIR"
    nohup node node_modules/next/dist/bin/next start --hostname "$APP_HOST" --port "$APP_PORT" \
      > "$WEB_LOG_FILE" 2>&1 &
    echo $! > "$WEB_PID_FILE"
  )

  wait_for_web
}

function start_worker() {
  local existing_pid
  existing_pid="$(read_pid "$WORKER_PID_FILE")"

  if is_pid_running "$existing_pid"; then
    print_line "自动刷新 Worker 已在运行，PID: ${existing_pid}"
    return
  fi

  print_line "正在启动自动刷新 Worker..."
  (
    cd "$ROOT_DIR"
    nohup node scripts/run-refresh-due-worker.mjs > "$WORKER_LOG_FILE" 2>&1 &
    echo $! > "$WORKER_PID_FILE"
  )

  sleep 2

  existing_pid="$(read_pid "$WORKER_PID_FILE")"
  if ! is_pid_running "$existing_pid"; then
    print_line "自动刷新 Worker 启动失败，请查看日志："
    print_line "$WORKER_LOG_FILE"
    exit 1
  fi
}

function open_dashboard() {
  if [[ "${ADX_SKIP_OPEN:-0}" == "1" ]]; then
    return
  fi

  open "$DASHBOARD_URL" >/dev/null 2>&1 || true
}

function show_status() {
  clear_stale_pid "$WEB_PID_FILE"
  clear_stale_pid "$WORKER_PID_FILE"

  local web_pid worker_pid
  web_pid="$(read_pid "$WEB_PID_FILE")"
  worker_pid="$(read_pid "$WORKER_PID_FILE")"

  print_line "后台地址: ${DASHBOARD_URL}"

  if is_pid_running "$web_pid"; then
    print_line "Web 后台: 运行中 (PID ${web_pid})"
  else
    print_line "Web 后台: 未运行"
  fi

  if is_pid_running "$worker_pid"; then
    print_line "自动刷新 Worker: 运行中 (PID ${worker_pid})"
  else
    print_line "自动刷新 Worker: 未运行"
  fi

  print_line "Web 日志: ${WEB_LOG_FILE}"
  print_line "Worker 日志: ${WORKER_LOG_FILE}"
}

function show_logs() {
  print_line "========== Web 日志 =========="
  if [[ -f "$WEB_LOG_FILE" ]]; then
    tail -n 40 "$WEB_LOG_FILE"
  else
    print_line "暂无 Web 日志"
  fi

  print_line ""
  print_line "======= Worker 日志 ======="
  if [[ -f "$WORKER_LOG_FILE" ]]; then
    tail -n 40 "$WORKER_LOG_FILE"
  else
    print_line "暂无 Worker 日志"
  fi
}

function start_all() {
  clear_stale_pid "$WEB_PID_FILE"
  clear_stale_pid "$WORKER_PID_FILE"
  ensure_node_modules
  build_app
  start_web
  start_worker
  open_dashboard

  print_line ""
  print_line "本地后台已启动。"
  show_status
}

function stop_all() {
  stop_pid_file "$WORKER_PID_FILE" "自动刷新 Worker"
  stop_pid_file "$WEB_PID_FILE" "Web 后台"
  print_line "本地后台已停止。"
}

function restart_all() {
  stop_all
  print_line ""
  start_all
}

COMMAND="${1:-status}"

case "$COMMAND" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  restart)
    restart_all
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  *)
    print_line "用法: scripts/local-app-manager.sh [start|stop|restart|status|logs]"
    exit 1
    ;;
esac
