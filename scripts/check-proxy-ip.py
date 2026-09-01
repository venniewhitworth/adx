#!/usr/bin/env python3

import argparse
import os
import random
import string
import sys
import time
from typing import Any
from urllib.parse import quote

import requests

IP_CHECK_URL = "https://ipv4.icanhazip.com"
IP_INFO_URL = "https://ipinfo.io/json"


def load_env_file(path: str) -> None:
    try:
        with open(path, "r", encoding="utf-8") as file:
            for raw_line in file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except FileNotFoundError:
        return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="通过 IPRoyal 代理主动更换 SESSION_ID，并输出出口 IP 与归属信息。"
    )
    parser.add_argument("--proxy-host", help="代理地址，例如 geo.iproyal.com:12321")
    parser.add_argument("--proxy-user", help="代理用户名")
    parser.add_argument(
        "--proxy-pass-base",
        help="基础密码或带地区参数的密码片段，例如 xxx_country-us_state-california_streaming-1",
    )
    parser.add_argument(
        "--env-file",
        default=".env.local",
        help="环境变量文件路径，默认读取 .env.local。",
    )
    parser.add_argument(
        "--attempts",
        type=int,
        default=1,
        help="请求次数。每次都会生成新的 SESSION_ID。默认 1 次。",
    )
    parser.add_argument(
        "--lifetime",
        default="10m",
        help="会话生命周期，例如 10m、30m、1h。默认 10m。",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=20,
        help="单次请求超时时间，单位秒。默认 20 秒。",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1,
        help="多次请求之间的等待时间，单位秒。默认 1 秒。",
    )
    return parser.parse_args()


def generate_session_id(length: int = 8) -> str:
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choices(chars, k=length))


def build_proxies(
    proxy_host: str,
    proxy_user: str,
    proxy_pass_base: str,
    session_id: str,
    lifetime: str,
) -> dict[str, str]:
    proxy_pass = f"{proxy_pass_base}_session-{session_id}_lifetime-{lifetime}"
    auth = f"{quote(proxy_user, safe='')}:{quote(proxy_pass, safe='')}"
    proxy_url = f"http://{auth}@{proxy_host}"
    return {
        "http": proxy_url,
        "https": proxy_url,
    }


def get_exit_ip(proxies: dict[str, str], timeout: int) -> str:
    response = requests.get(IP_CHECK_URL, proxies=proxies, timeout=timeout)
    response.raise_for_status()
    return response.text.strip()


def get_ip_info(proxies: dict[str, str], timeout: int) -> dict[str, Any]:
    response = requests.get(IP_INFO_URL, proxies=proxies, timeout=timeout)
    response.raise_for_status()
    return response.json()


def print_result(index: int, session_id: str, exit_ip: str, ip_info: dict[str, Any]) -> None:
    print(f"[{index}] session={session_id}")
    print(f"出口 IP: {exit_ip}")
    print(f"IPInfo IP: {ip_info.get('ip', '')}")
    print(f"城市: {ip_info.get('city', '')}")
    print(f"州/地区: {ip_info.get('region', '')}")
    print(f"国家: {ip_info.get('country', '')}")
    print(f"坐标: {ip_info.get('loc', '')}")
    print(f"运营商: {ip_info.get('org', '')}")
    print(f"时区: {ip_info.get('timezone', '')}")
    print("")


def main() -> int:
    args = parse_args()
    load_env_file(args.env_file)

    proxy_host = args.proxy_host or os.environ.get("IPROYAL_PROXY_HOST", "").strip()
    proxy_user = args.proxy_user or os.environ.get("IPROYAL_PROXY_USER", "").strip()
    proxy_pass_base = args.proxy_pass_base or os.environ.get("IPROYAL_PROXY_PASSWORD_BASE", "").strip()
    lifetime = args.lifetime or os.environ.get("IPROYAL_PROXY_SESSION_LIFETIME", "10m").strip()

    if args.attempts < 1:
        print("--attempts 必须大于 0", file=sys.stderr)
        return 1

    if not proxy_host or not proxy_user or not proxy_pass_base:
        print(
            "缺少 IPRoyal 配置。请在 .env.local 里设置 IPROYAL_PROXY_HOST / IPROYAL_PROXY_USER / IPROYAL_PROXY_PASSWORD_BASE，或通过命令行传入。",
            file=sys.stderr,
        )
        return 1

    for index in range(1, args.attempts + 1):
        session_id = generate_session_id()
        proxies = build_proxies(
            proxy_host=proxy_host,
            proxy_user=proxy_user,
            proxy_pass_base=proxy_pass_base,
            session_id=session_id,
            lifetime=lifetime,
        )

        try:
            exit_ip = get_exit_ip(proxies, args.timeout)
            ip_info = get_ip_info(proxies, args.timeout)
            print_result(index, session_id, exit_ip, ip_info)
        except requests.RequestException as exc:
            print(f"[{index}] session={session_id} 请求失败: {exc}", file=sys.stderr)

        if index < args.attempts:
            time.sleep(args.delay)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
