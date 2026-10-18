"""
TalkTrading Unified Microservices & Frontend Launcher
Starts all backend microservices and frontend in one command with real-time health checks,
multiplexed logs, and clean lifecycle management.
"""

import os
import sys
import time
import socket
import signal
import shutil
import urllib.request
import urllib.error
import glob
import re
import threading
import functools
import subprocess
from dataclasses import dataclass
from typing import List, Dict, Optional

# Force real-time stdout flush across all prints
print = functools.partial(print, flush=True)

# Enable VT100 Escape Sequence Colors in Windows console
if os.name == "nt":
    import ctypes
    kernel32 = ctypes.windll.kernel32
    # STD_OUTPUT_HANDLE = -11
    hStdOut = kernel32.GetStdHandle(-11)
    mode = ctypes.c_ulong()
    kernel32.GetConsoleMode(hStdOut, ctypes.byref(mode))
    # ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
    kernel32.SetConsoleMode(hStdOut, mode.value | 0x0004)
    os.system("")

# Root workspace directory
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# ANSI color codes
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
MAGENTA = "\033[95m"
BLUE = "\033[94m"
WHITE = "\033[97m"
GRAY = "\033[90m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

@dataclass
class ServiceDef:
    name: str
    tag: str
    port: int
    cwd: str
    command: List[str]
    health_url: str
    docs_url: Optional[str]
    color: str
    env_overrides: Dict[str, str]

def find_python_executable() -> str:
    venv_python_win = os.path.join(ROOT_DIR, "venv", "Scripts", "python.exe")
    venv_python_unix = os.path.join(ROOT_DIR, "venv", "bin", "python")
    if os.path.isfile(venv_python_win):
        return venv_python_win
    if os.path.isfile(venv_python_unix):
        return venv_python_unix
    return sys.executable

def find_node_executable() -> Optional[str]:
    node_bin = shutil.which("node.cmd") or shutil.which("node.exe") or shutil.which("node")
    if node_bin:
        return node_bin
    
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    candidates = [
        os.path.join(local_app_data, "ms-playwright-go", "1.57.0", "node.exe"),
        os.path.join(local_app_data, "ms-playwright-go", "1.50.1", "node.exe"),
        os.path.join(local_app_data, "Programs", "nodejs", "node.exe"),
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
    ]
    playwright_dir = os.path.join(local_app_data, "ms-playwright-go")
    if os.path.isdir(playwright_dir):
        for root, dirs, files in os.walk(playwright_dir):
            if "node.exe" in files:
                candidates.insert(0, os.path.join(root, "node.exe"))

    for cand in candidates:
        if cand and os.path.isfile(cand):
            return cand
    return None

def find_npm_executable() -> Optional[str]:
    npm_win = shutil.which("npm.cmd") or shutil.which("npm")
    if npm_win:
        return npm_win
    return None

def java_major_version(java_home: str) -> int:
    """Major version from the JDK's `release` file (0 if unreadable)."""
    try:
        with open(os.path.join(java_home, "release"), encoding="utf-8") as f:
            match = re.search(r'JAVA_VERSION="(?:1\.)?(\d+)', f.read())
        return int(match.group(1)) if match else 0
    except OSError:
        return 0

def find_java_home() -> Optional[str]:
    """The newest installed JDK 17+ (Spring Boot 3 needs 17+), preferring JAVA_HOME when it qualifies."""
    candidates = [os.environ["JAVA_HOME"]] if os.environ.get("JAVA_HOME") else []
    for base in (r"C:\Program Files\Java", r"C:\Program Files\Microsoft", r"C:\Program Files\Eclipse Adoptium", "/usr/lib/jvm"):
        candidates += glob.glob(os.path.join(base, "*jdk*"))
    qualified = [(java_major_version(c), c) for c in candidates]
    qualified = [(v, c) for v, c in qualified if v >= 17]
    if not qualified:
        return None
    env_home = os.environ.get("JAVA_HOME")
    return next((c for v, c in qualified if c == env_home), max(qualified)[1])

def find_maven() -> Optional[str]:
    """mvn on PATH, MAVEN_HOME/M2_HOME, or a copy unpacked under .tools/ next to this script."""
    exe = "mvn.cmd" if os.name == "nt" else "mvn"
    on_path = shutil.which("mvn")
    if on_path:
        return on_path
    candidates = [os.path.join(os.environ[v], "bin", exe) for v in ("MAVEN_HOME", "M2_HOME") if os.environ.get(v)]
    candidates += glob.glob(os.path.join(ROOT_DIR, ".tools", "apache-maven-*", "bin", exe))
    return next((c for c in candidates if os.path.isfile(c)), None)

def java_service_defs(mvn: str, java_home: str) -> List["ServiceDef"]:
    """Community (8080) and Explore (8083) run natively through Maven with in-memory H2 databases.

    The unixdomain tmpdir flag is needed on Windows: without a short, existing directory the JDK
    cannot open its NIO Selector ("Unable to establish loopback connection").
    """
    jvm_tmp = os.path.join(os.environ.get("SystemDrive", "C:") + os.sep, "jtmp")
    os.makedirs(jvm_tmp, exist_ok=True)
    jvm_args = f"-Dspring-boot.run.jvmArguments=-Djdk.net.unixdomain.tmpdir={jvm_tmp}"
    env = {"JAVA_HOME": java_home}
    explore_args = " ".join([
        "--server.port=8083",
        "--spring.datasource.url=jdbc:h2:mem:explore;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "--spring.datasource.driver-class-name=org.h2.Driver",
        "--spring.datasource.username=sa",
        "--spring.datasource.password=",
        "--spring.flyway.enabled=false",
        "--spring.jpa.hibernate.ddl-auto=create-drop",
        "--spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "--app.clients.post-service.url=http://127.0.0.1:8004",
    ])
    return [
        ServiceDef(
            name="Community Service",
            tag="COMMUNITY",
            port=8080,
            cwd=os.path.join(ROOT_DIR, "community-main"),
            command=[mvn, "-q", "spring-boot:run", "-Dspring-boot.run.profiles=dev", jvm_args],
            health_url="http://127.0.0.1:8080/api/v1/health",
            docs_url="http://127.0.0.1:8080/swagger-ui.html",
            color=GRAY,
            env_overrides=env,
        ),
        ServiceDef(
            name="Explore Service",
            tag="EXPLORE",
            port=8083,
            cwd=os.path.join(ROOT_DIR, "Explore-main"),
            # H2 lives on Explore's test classpath, hence useTestClasspath. No Redis needed: it fails open.
            command=[mvn, "-q", "spring-boot:run", "-Dspring-boot.run.useTestClasspath=true", jvm_args,
                     f"-Dspring-boot.run.arguments={explore_args}"],
            health_url="http://127.0.0.1:8083/actuator/health/liveness",
            docs_url="http://127.0.0.1:8083/swagger-ui.html",
            color=MAGENTA,
            env_overrides=env,
        ),
    ]

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0

def kill_process_on_port(port: int):
    try:
        output = subprocess.check_output(
            ["netstat", "-ano", "-p", "tcp"],
            universal_newlines=True,
            stderr=subprocess.DEVNULL
        )
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 5 and parts[0].upper() == "TCP":
                local_addr = parts[1]
                state = parts[3]
                pid = parts[4]
                if local_addr.endswith(f":{port}") and state.upper() == "LISTENING":
                    try:
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", pid],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                            check=False
                        )
                    except Exception:
                        pass
    except Exception:
        pass

def check_service_health(health_url: str, timeout: float = 1.0) -> bool:
    try:
        req = urllib.request.Request(
            health_url,
            headers={"User-Agent": "TalkTrading-HealthCheck"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status in [200, 204, 304]
    except Exception:
        return False

class Orchestrator:
    def __init__(self, services: List[ServiceDef], windowed_mode: bool = False):
        self.services = services
        self.windowed_mode = windowed_mode
        self.processes: Dict[str, subprocess.Popen] = {}
        self.healthy_status: Dict[str, bool] = {s.tag: False for s in self.services}
        self.running = True
        self.lock = threading.Lock()

    def log(self, tag: str, color: str, message: str):
        print(f"{color}[{tag:^10}]{RESET} {message}")

    def stream_process_output(self, service: ServiceDef, proc: subprocess.Popen):
        try:
            for line in iter(proc.stdout.readline, ""):
                if not self.running:
                    break
                stripped = line.rstrip()
                if stripped:
                    self.log(service.tag, service.color, stripped)
        except Exception:
            pass

    def start_unified(self):
        print(f"\n{BOLD}{CYAN}================================================================================{RESET}")
        print(f"{BOLD}{CYAN}         TalkTrading Unified System Orchestrator — Starting Services            {RESET}")
        print(f"{BOLD}{CYAN}================================================================================{RESET}\n")

        for service in self.services:
            svc_env = os.environ.copy()
            svc_env.update(service.env_overrides)
            svc_env["PYTHONUNBUFFERED"] = "1"

            self.log("START", service.color, f"Launching {BOLD}{service.name}{RESET} on port {service.port}...")
            
            cmd_to_run = service.command
            if os.name == "nt":
                # On Windows, converting list to properly quoted string ensures .cmd / .bat wrappers work smoothly
                cmd_to_run = " ".join(f'"{c}"' if " " in c else c for c in service.command)

            try:
                proc = subprocess.Popen(
                    cmd_to_run,
                    cwd=service.cwd,
                    env=svc_env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    shell=(os.name == "nt"),
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
                )
                self.processes[service.tag] = proc

                # Start log consumer thread
                t = threading.Thread(
                    target=self.stream_process_output,
                    args=(service, proc),
                    daemon=True
                )
                t.start()
            except Exception as e:
                self.log("ERROR", RED, f"Failed to start {service.name}: {e}")

        # Start health check monitor
        health_thread = threading.Thread(target=self.poll_health_checks, daemon=True)
        health_thread.start()

        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()

    def start_windowed(self):
        print(f"\n{BOLD}{CYAN}================================================================================{RESET}")
        print(f"{BOLD}{CYAN}          TalkTrading Windowed Launcher — Opening Separate Consoles             {RESET}")
        print(f"{BOLD}{CYAN}================================================================================{RESET}\n")

        for service in self.services:
            svc_env = os.environ.copy()
            svc_env.update(service.env_overrides)

            cmd_str = " ".join(f'"{c}"' if " " in c else c for c in service.command)
            win_title = f"TalkTrading - {service.name} (Port {service.port})"
            
            full_cmd = f'cmd.exe /c start "{win_title}" cmd.exe /k "cd /d "{service.cwd}" && {cmd_str}"'
            print(f"[LAUNCH] {service.color}{service.name:<22}{RESET} -> New Console Window (Port {service.port})")
            subprocess.Popen(full_cmd, shell=True, env=svc_env)

        print("\nAll service windows launched! Polling health check status...\n")
        self.poll_health_checks(single_pass_wait=True)
        print(f"\n{BOLD}{GREEN}All microservice windows are active. Press Enter to exit this launcher.{RESET}")
        try:
            input()
        except KeyboardInterrupt:
            pass

    def poll_health_checks(self, single_pass_wait: bool = False):
        start_time = time.time()
        timeout = 150  # seconds to wait for initial readiness (the Java services compile on first start)
        dashboard_printed = False

        while self.running and (time.time() - start_time < timeout):
            all_ready = True
            for service in self.services:
                if not self.healthy_status[service.tag]:
                    is_ok = check_service_health(service.health_url)
                    if is_ok:
                        self.healthy_status[service.tag] = True
                        self.log("READY", GREEN, f"{BOLD}{service.name}{RESET} is online and healthy!")
                    else:
                        all_ready = False

            if all_ready and not dashboard_printed:
                self.print_dashboard()
                dashboard_printed = True
                if single_pass_wait:
                    return

            time.sleep(1.2)

        if not dashboard_printed:
            self.print_dashboard()

    def print_dashboard(self):
        with self.lock:
            print(f"\n{BOLD}{CYAN}+-----------------------------------------------------------------------------------------+{RESET}")
            print(f"{BOLD}{CYAN}|                          TALKTRADING SYSTEM - ALL SERVICES STATUS                       |{RESET}")
            print(f"{BOLD}{CYAN}+----------------------+------+---------+-------------------------------------------------+{RESET}")
            print(f"{BOLD}{CYAN}| Service Name         | Port | Status  | Endpoint / Documentation                        |{RESET}")
            print(f"{BOLD}{CYAN}+----------------------+------+---------+-------------------------------------------------+{RESET}")

            for s in self.services:
                status_str = f"{GREEN}ONLINE{RESET}" if self.healthy_status.get(s.tag) else f"{YELLOW}WAITING{RESET}"
                docs_or_url = s.docs_url if s.docs_url else s.health_url
                print(f"| {s.name:<20} | {s.port:<4} | {status_str:<16} | {docs_or_url:<47} |")

            print(f"{BOLD}{CYAN}+----------------------+------+---------+-------------------------------------------------+{RESET}")
            print(f"{BOLD}{GREEN}  >>> Frontend Web App     : http://localhost:5173{RESET}")
            print(f"{BOLD}{WHITE}  >>> Stop Entire System   : Press Ctrl+C in this terminal{RESET}")
            print(f"{BOLD}{CYAN}+-----------------------------------------------------------------------------------------+{RESET}\n")

    def stop(self):
        if not self.running:
            return
        self.running = False
        print(f"\n\n{BOLD}{YELLOW}Shutting down all TalkTrading services gracefully...{RESET}")

        for tag, proc in self.processes.items():
            try:
                if os.name == "nt":
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        check=False
                    )
                else:
                    proc.terminate()
            except Exception:
                pass

        # Second-pass sweep on ports to ensure child uvicorn/node processes are released
        for service in self.services:
            kill_process_on_port(service.port)

        print(f"{BOLD}{GREEN}All TalkTrading microservices and frontend stopped successfully.{RESET}\n")
        sys.exit(0)

def main():
    import argparse
    parser = argparse.ArgumentParser(description="TalkTrading Complete Microservices System Launcher")
    parser.add_argument("-w", "--windows", action="store_true", help="Open each service in a separate Windows console window")
    parser.add_argument("--no-frontend", "--backend-only", action="store_true", help="Start only backend microservices, skip frontend")
    parser.add_argument("--check-only", action="store_true", help="Verify ports and dependencies without starting services")
    parser.add_argument("--kill-existing", action="store_true", help="Automatically kill any existing processes on required ports before starting")
    args = parser.parse_args()

    python_bin = find_python_executable()
    npm_bin = find_npm_executable()
    node_bin = find_node_executable()

    print(f"{GRAY}[CONFIG] Python runtime   : {python_bin}{RESET}")
    print(f"{GRAY}[CONFIG] Frontend runtime : {npm_bin or node_bin or 'npm'}{RESET}")

    # Define all system services
    services: List[ServiceDef] = [
        ServiceDef(
            name="News Service",
            tag="NEWS",
            port=8000,
            cwd=os.path.join(ROOT_DIR, "news-service"),
            command=[python_bin, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
            health_url="http://127.0.0.1:8000/health",
            docs_url="http://127.0.0.1:8000/docs",
            color=CYAN,
            env_overrides={
                "DATABASE_URL": "sqlite:///./news.db",
                # Verifies the tokens Post Service issues at login (bookmarks are per user).
                "JWT_SECRET": os.environ.get("SECRET_KEY", "super_secret_jwt_key_change_in_production"),
            }
        ),
        ServiceDef(
            name="Story Service",
            tag="STORY",
            port=8001,
            cwd=os.path.join(ROOT_DIR, "story-service"),
            command=[python_bin, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
            health_url="http://127.0.0.1:8001/health",
            docs_url="http://127.0.0.1:8001/docs",
            color=GREEN,
            env_overrides={
                "DATABASE_URL": "sqlite:///./stories.db",
                # Verifies the tokens Post Service issues at login (same secret, HS256).
                "AUTH_ENABLED": "true",
                "JWT_SECRET": os.environ.get("SECRET_KEY", "super_secret_jwt_key_change_in_production"),
                # Reads who follows whom through the Post Service's public API.
                "POST_SERVICE_URL": "http://127.0.0.1:8004",
            }
        ),
        ServiceDef(
            name="Chart Service",
            tag="CHART",
            port=8002,
            cwd=os.path.join(ROOT_DIR, "chart-service"),
            command=[python_bin, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8002"],
            health_url="http://127.0.0.1:8002/health",
            docs_url="http://127.0.0.1:8002/docs",
            color=YELLOW,
            env_overrides={"DATABASE_URL": "sqlite:///./chart.db"}
        ),
        ServiceDef(
            name="E2EE Identity Svc",
            tag="E2EE",
            port=8003,
            cwd=os.path.join(ROOT_DIR, "E2E-main"),
            command=[python_bin, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8003"],
            health_url="http://127.0.0.1:8003/health",
            docs_url="http://127.0.0.1:8003/docs",
            color=MAGENTA,
            env_overrides={
                "DATABASE_URL": "sqlite+aiosqlite:///e2e.db",
                # Verifies the tokens Post Service issues at login (same secret, HS256).
                "JWT_SECRET_KEY": os.environ.get("SECRET_KEY", "super_secret_jwt_key_change_in_production"),
            }
        ),
        ServiceDef(
            name="Post Service",
            tag="POST",
            port=8004,
            cwd=os.path.join(ROOT_DIR, "post-service-feature-post-module"),
            command=[python_bin, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8004"],
            health_url="http://127.0.0.1:8004/health",
            docs_url="http://127.0.0.1:8004/docs",
            color=BLUE,
            env_overrides={
                "PORT": "8004",
                "HOST_PORT": "8004",
                "POSTGRES_HOST": "",
                "DATABASE_URL": "sqlite:///./post.db"
            }
        ),
    ]

    # Community and Explore are Java/Spring Boot services, started natively through Maven.
    mvn, java_home = find_maven(), find_java_home()
    if mvn and java_home:
        services.extend(java_service_defs(mvn, java_home))
    else:
        print(f"{YELLOW}[NOTICE] Skipping Community and Explore: "
              f"{'Maven' if not mvn else 'JDK 17+'} not found. Install it, or set "
              f"{'MAVEN_HOME (or unpack Maven into .tools/)' if not mvn else 'JAVA_HOME'}.{RESET}")

    if not args.no_frontend:
        frontend_dir = os.path.join(ROOT_DIR, "talktrading-frontend")
        vite_script = os.path.join(frontend_dir, "node_modules", "vite", "bin", "vite.js")
        
        if npm_bin:
            fe_command = [npm_bin, "run", "dev", "--", "--host", "127.0.0.1"]
        elif node_bin and os.path.isfile(vite_script):
            fe_command = [node_bin, vite_script, "--host", "127.0.0.1"]
        elif node_bin:
            fe_command = [node_bin, os.path.join("node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1"]
        else:
            fe_command = ["npm", "run", "dev", "--", "--host", "127.0.0.1"]

        services.append(
            ServiceDef(
                name="Frontend Web App",
                tag="FRONTEND",
                port=5173,
                cwd=frontend_dir,
                command=fe_command,
                health_url="http://127.0.0.1:5173",
                docs_url=None,
                color=WHITE,
                env_overrides={}
            )
        )

    # Pre-flight port checks
    busy_ports = []
    for s in services:
        if is_port_in_use(s.port):
            busy_ports.append(s.port)

    if busy_ports:
        print(f"\n{YELLOW}[NOTICE] Port(s) currently in use: {busy_ports}{RESET}")
        if args.kill_existing or not sys.stdin.isatty():
            print(f"[CLEANUP] Automatically clearing occupied ports...")
            for p in busy_ports:
                kill_process_on_port(p)
            time.sleep(1)
        else:
            choice = input("Do you want to terminate existing processes on these ports? [y/N]: ").strip().lower()
            if choice == "y":
                for p in busy_ports:
                    kill_process_on_port(p)
                time.sleep(1)
            else:
                print(f"{RED}Cannot proceed with occupied ports. Aborting.{RESET}")
                sys.exit(1)

    if args.check_only:
        print(f"\n{GREEN}[CHECK PASSED] All required ports ({', '.join(str(s.port) for s in services)}) are available!{RESET}\n")
        sys.exit(0)

    orchestrator = Orchestrator(services, windowed_mode=args.windows)

    def handle_sigint(signum, frame):
        orchestrator.stop()

    signal.signal(signal.SIGINT, handle_sigint)
    signal.signal(signal.SIGTERM, handle_sigint)

    if args.windows:
        orchestrator.start_windowed()
    else:
        orchestrator.start_unified()

if __name__ == "__main__":
    main()
