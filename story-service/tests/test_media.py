import io
import os

from PIL import Image

from app import media
from app.config import settings
from tests.conftest import fake_mp4, jpeg_with_exif, png_bytes


def test_png_upload_is_accepted_and_returns_signed_url(world):
    r = world.upload("alex")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["media_type"] == "image" and body["width"] == 8 and body["height"] == 8
    assert body["url"].startswith("/media/") and "?t=" in body["url"]
    fetched = world.client.get(body["url"])
    assert fetched.status_code == 200 and fetched.headers["content-type"] == "image/png"
    assert fetched.headers["x-content-type-options"] == "nosniff"


def test_upload_requires_login(world):
    r = world.client.post("/stories/media", files={"file": ("a.png", png_bytes(), "image/png")})
    assert r.status_code == 401


def test_exif_metadata_is_stripped(world):
    r = world.upload("alex", jpeg_with_exif(), "photo.jpg", "image/jpeg")
    assert r.status_code == 201, r.text
    stored = world.client.get(r.json()["url"]).content
    assert len(Image.open(io.BytesIO(stored)).getexif()) == 0
    assert b"SecretCameraMaker" not in stored


def test_large_image_is_downscaled(world, monkeypatch):
    monkeypatch.setattr(settings, "max_image_side", 32)
    r = world.upload("alex", png_bytes((100, 50)))
    assert r.status_code == 201
    assert max(r.json()["width"], r.json()["height"]) == 32


def test_type_is_detected_from_bytes_not_from_name_or_mime(world):
    text = world.upload("alex", b"just some text pretending to be a picture", "evil.png", "image/png")
    assert text.status_code == 415
    html = world.upload("alex", b"<html><script>alert(1)</script></html>", "x.jpg", "image/jpeg")
    assert html.status_code == 415
    renamed = world.upload("alex", png_bytes(), "photo.exe", "application/octet-stream")
    assert renamed.status_code == 201  # real PNG: the name and declared type do not matter


def test_corrupt_image_is_rejected(world):
    broken = png_bytes()[:40]  # valid signature, truncated body
    assert world.upload("alex", broken).status_code == 400


def test_empty_file_is_rejected(world):
    assert world.upload("alex", b"").status_code == 400


def test_oversized_image_is_rejected(world, monkeypatch):
    monkeypatch.setattr(settings, "max_image_bytes", 50)
    assert world.upload("alex", png_bytes((64, 64))).status_code == 413


def test_decompression_bomb_is_rejected(world, monkeypatch):
    monkeypatch.setattr(settings, "max_image_pixels", 100)
    assert world.upload("alex", png_bytes((50, 50))).status_code == 400


def test_video_needs_a_readable_duration_and_a_sane_length(world, monkeypatch):
    unreadable = world.upload("alex", fake_mp4(), "clip.mp4", "video/mp4")
    assert unreadable.status_code == 400

    monkeypatch.setattr(media, "_video_duration", lambda data, ext: 12.5)
    ok = world.upload("alex", fake_mp4(), "clip.mp4", "video/mp4")
    assert ok.status_code == 201 and ok.json()["media_type"] == "video" and ok.json()["duration"] == 12.5

    monkeypatch.setattr(media, "_video_duration", lambda data, ext: 90.0)
    too_long = world.upload("alex", fake_mp4(), "clip.mp4", "video/mp4")
    assert too_long.status_code == 400 and "too long" in too_long.json()["detail"]


def test_oversized_video_is_rejected(world, monkeypatch):
    monkeypatch.setattr(settings, "max_video_bytes", 20)
    monkeypatch.setattr(media, "_video_duration", lambda data, ext: 5.0)
    assert world.upload("alex", fake_mp4(), "clip.mp4", "video/mp4").status_code == 413


def test_signed_url_must_be_valid_and_unexpired(world, monkeypatch):
    url = world.upload("alex").json()["url"]
    key = url.split("/media/")[1].split("?")[0]

    assert world.client.get(f"/media/{key}").status_code == 422  # no token at all
    assert world.client.get(f"/media/{key}?t=garbage").status_code == 403
    other = world.upload("alex").json()["url"].split("/media/")[1]
    other_key, other_token = other.split("?t=")
    assert world.client.get(f"/media/{key}?t={other_token}").status_code == 403  # token for a different file

    monkeypatch.setattr(settings, "media_url_ttl_seconds", -10)
    expired = media.signed_path(key)
    assert world.client.get(expired).status_code == 403


def test_media_route_cannot_reach_outside_the_media_folder(world):
    token = media.signed_path("a" * 32 + ".png").split("?t=")[1]
    for sneaky in ("..%2F..%2Fapp%2Fconfig.py", "..%5C..%5Cconfig.py", "config.py"):
        assert world.client.get(f"/media/{sneaky}?t={token}").status_code in (403, 404)


def test_files_are_stored_outside_any_public_static_mount(world):
    world.upload("alex")
    assert os.listdir(settings.media_dir)
    assert not any(getattr(r, "path", "").startswith("/static") for r in world.client.app.routes)
