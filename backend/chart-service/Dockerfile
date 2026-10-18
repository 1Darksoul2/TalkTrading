FROM python:3.11-slim

WORKDIR /service

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default to SQLite in dev; override DATABASE_URL in docker-compose for Postgres
ENV DATABASE_URL=sqlite:///./chart.db

EXPOSE 8002

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
