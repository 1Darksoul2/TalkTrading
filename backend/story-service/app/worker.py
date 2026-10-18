"""
Expiry worker for the Story Service.

Run on a schedule — NOT part of the API process:
  - Kubernetes:  CronJob every 15 minutes
  - Celery beat: periodic task
  - Plain cron:  */15 * * * * python -m app.worker

Behaviour:
  1. Reclaims storage: deletes expired stories that are not archived (or are past the archive
     retention period) and never touches stories that belong to a Highlight; removes unpublished uploads.
     (Expiry itself is enforced in every read query; the API also runs this job periodically.)
  2. Publishes a story.expired event to the configured broker so downstream
     services (Notification, Explore) can react without Story service needing
     to know they exist.

Broker selection (BROKER_TYPE env var):
  - "rabbitmq"  → uses pika (default, amqp)
  - "kafka"     → uses kafka-python
"""
import json
import logging

from .config import settings
from .database import SessionLocal
from .purge import purge_expired

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


# ── RabbitMQ publisher ────────────────────────────────────────────────────────

def _publish_rabbitmq(payload: dict) -> None:
    import pika  # optional dependency when using RabbitMQ

    params = pika.URLParameters(settings.rabbitmq_url)
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue=settings.story_expiry_topic, durable=True)
    channel.basic_publish(
        exchange="",
        routing_key=settings.story_expiry_topic,
        body=json.dumps(payload),
        properties=pika.BasicProperties(delivery_mode=2),  # persistent
    )
    connection.close()
    logger.info("Published to RabbitMQ: %s", payload)


# ── Kafka publisher ───────────────────────────────────────────────────────────

def _publish_kafka(payload: dict) -> None:
    from kafka import KafkaProducer  # optional dependency when using Kafka

    producer = KafkaProducer(
        bootstrap_servers=settings.kafka_bootstrap_servers.split(","),
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
    )
    producer.send(settings.story_expiry_topic, value=payload)
    producer.flush()
    producer.close()
    logger.info("Published to Kafka: %s", payload)


# ── Dispatch ──────────────────────────────────────────────────────────────────

def publish_expiry_event(count: int) -> None:
    if count == 0:
        return
    payload = {"event": "story.expired", "deleted_count": count}
    if settings.broker_type == "kafka":
        _publish_kafka(payload)
    else:
        _publish_rabbitmq(payload)


# ── Entry point ───────────────────────────────────────────────────────────────

def run() -> None:
    db = SessionLocal()
    try:
        result = purge_expired(db)
        logger.info("Purged %s", result)
        publish_expiry_event(result["stories"])
    finally:
        db.close()


if __name__ == "__main__":
    run()
