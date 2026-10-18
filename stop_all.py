"""
TalkTrading - Stop All Microservices & Frontend
Finds and terminates any processes listening on ports 8000-8004, 8080, 8083 and 5173.
"""

import os
import sys
import subprocess

PORTS = [8000, 8001, 8002, 8003, 8004, 8080, 8083, 5173]

def get_pids_for_port_windows(port: int):
    pids = set()
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
            # Look for lines with TCP, local address ending in :port, and LISTENING
            if len(parts) >= 5 and parts[0].upper() == "TCP":
                local_addr = parts[1]
                state = parts[3]
                pid = parts[4]
                if local_addr.endswith(f":{port}") and state.upper() == "LISTENING":
                    try:
                        pids.add(int(pid))
                    except ValueError:
                        pass
    except Exception as e:
        print(f"Error checking port {port}: {e}")
    return pids

def kill_pid_windows(pid: int):
    try:
        # /F = force, /T = tree (kill child processes as well)
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False
        )
        return True
    except Exception:
        return False

def stop_all():
    print("=========================================================")
    print("      TalkTrading - Stopping All Running Services        ")
    print("=========================================================")
    killed_any = False

    for port in PORTS:
        pids = get_pids_for_port_windows(port)
        if pids:
            for pid in pids:
                print(f"[KILL] Port {port} is held by PID {pid}. Terminating process tree...")
                if kill_pid_windows(pid):
                    print(f"       -> Successfully stopped PID {pid} on port {port}.")
                    killed_any = True
                else:
                    print(f"       -> Failed to stop PID {pid}.")
        else:
            print(f"[OK]   Port {port} is free.")

    print("---------------------------------------------------------")
    if killed_any:
        print("All matching services stopped successfully.")
    else:
        print("No conflicting services were running.")
    print("=========================================================")

if __name__ == "__main__":
    stop_all()
