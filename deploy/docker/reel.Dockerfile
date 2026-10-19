# The Reel service (backend/Reels-main) ships without a Dockerfile; this one is kept here so its folder stays
# untouched, and is paired with reel.Dockerfile.dockerignore.
FROM python:3.12-slim

WORKDIR /service

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8005

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005"]
