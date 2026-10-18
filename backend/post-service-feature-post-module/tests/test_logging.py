import logging


def test_many_requests_do_not_grow_the_log_record_factory(client):
    # Each request used to wrap the global factory again, until logging hit RecursionError.
    before = logging.getLogRecordFactory()
    for _ in range(1200):
        assert client.get("/health/live").status_code == 200
    assert logging.getLogRecordFactory() is before
    logging.getLogger("post_service").info("still logging fine")


def test_response_echoes_the_correlation_id(client):
    res = client.get("/health/live", headers={"X-Correlation-ID": "abc-123"})
    assert res.headers["X-Correlation-ID"] == "abc-123"
