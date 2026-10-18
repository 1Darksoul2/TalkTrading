# TalkTrading System

Full-stack microservices trading and social platform featuring News, Stories, Trading Charts, End-to-End Encrypted (E2EE) Chat, Social Posts, and Communities, with a React 18 + Vite frontend.

## 🚀 One-Command Quick Start

Start all 6 backend microservices and the frontend in a single command:

```cmd
:: Windows Command Prompt / Double-click
start.bat
```

```powershell
# Windows PowerShell
.\start.ps1
```

```bash
# Python
python start_all.py
```

### 🛑 Stop All Services

To cleanly stop all background microservices and free all ports:

```cmd
stop.bat
```
*(or `.\stop.ps1` / `python stop_all.py`)*

---

## 📡 Microservices & Endpoints

| Microservice | Port | Database | Health Check | Interactive Docs / UI |
| :--- | :--- | :--- | :--- | :--- |
| **News Service** | `8000` | SQLite (`news.db`) | [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) | [Swagger UI](http://127.0.0.1:8000/docs) |
| **Story Service** | `8001` | SQLite (`stories.db`) | [http://127.0.0.1:8001/health](http://127.0.0.1:8001/health) | [Swagger UI](http://127.0.0.1:8001/docs) |
| **Chart Service** | `8002` | SQLite (`chart.db`) | [http://127.0.0.1:8002/health](http://127.0.0.1:8002/health) | [Swagger UI](http://127.0.0.1:8002/docs) |
| **E2EE Identity Service** | `8003` | SQLite (`e2e.db`) | [http://127.0.0.1:8003/health](http://127.0.0.1:8003/health) | [Swagger UI](http://127.0.0.1:8003/docs) |
| **Post Service** | `8004` | SQLite (`post.db`) | [http://127.0.0.1:8004/health](http://127.0.0.1:8004/health) | [Swagger UI](http://127.0.0.1:8004/docs) |
| **Community Service** | `8080` | PostgreSQL (Docker) | [http://127.0.0.1:8080/api/v1/health](http://127.0.0.1:8080/api/v1/health) | [Swagger UI](http://127.0.0.1:8080/swagger-ui.html) |
| **Frontend Web App** | `5173` | React 18 + Vite | [http://127.0.0.1:5173](http://127.0.0.1:5173) | [App Home](http://localhost:5173) |

> **Note**: Community Service is a Java/Spring Boot microservice, unlike the other five (Python/FastAPI). It runs via Docker (`docker compose up`, from `community-main/`) rather than a plain process, and requires Docker Desktop to be running. `start_all.py` launches it automatically; see Section 11 of [PROJECT_DOCUMENTATION.md](file:///PROJECT_DOCUMENTATION.md) for why (a JDK 17+ on Windows NIO/AF_UNIX incompatibility was found — Docker is not just a deployment preference here, it's the only environment where the service's underlying web server can actually bind a port on some Windows machines).

---

## 🛠 Advanced Startup Options

- `start.bat --windows` (or `-w`): Opens each service in its own dedicated, titled Windows console window.
- `start.bat --backend-only` (or `--no-frontend`): Launches only the 6 backend microservices without starting Vite.
- `start.bat --check-only`: Verifies that Python virtualenv, Node/npm, and all ports are available.
- `start.bat --kill-existing`: Automatically terminates any processes occupying ports 8000-8004, 8080, 5173 before launching.

For full system documentation and architecture specifications, see [PROJECT_DOCUMENTATION.md](file:///PROJECT_DOCUMENTATION.md).
