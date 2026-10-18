import pytest


def test_hashtag_extraction_and_search(client, user1_headers):
    # 1. Create post with hashtag
    client.post("/api/v1/posts/", json={"caption": "Learning #Python and #FastAPI today!"}, headers=user1_headers)
    client.post("/api/v1/posts/", json={"caption": "Another #Python post!"}, headers=user1_headers)

    # 2. Query posts by hashtag 'python'
    res_python = client.get("/api/v1/hashtags/python/posts")
    assert res_python.status_code == 200
    data = res_python.json()
    assert data["hashtag"] == "python"
    assert data["total"] == 2

    # 3. Query posts by hashtag 'fastapi'
    res_fastapi = client.get("/api/v1/hashtags/fastapi/posts")
    assert res_fastapi.status_code == 200
    assert res_fastapi.json()["total"] == 1
