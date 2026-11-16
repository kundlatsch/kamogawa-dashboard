from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


def image_file(size=(800, 600), fmt="PNG", name="me.png"):
    buffer = BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buffer, fmt)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=f"image/{fmt.lower()}")


def test_upload_makes_a_square_webp_and_exposes_its_url(make_user, api_as, media_root):
    user = make_user("ana")
    response = api_as(user).post("/api/auth/me/avatar/", {"avatar": image_file()}, format="multipart")
    assert response.status_code == 200
    url = response.json()["avatar_url"]
    assert url.startswith("/media/avatars/") and url.endswith(".webp")
    user.refresh_from_db()
    with Image.open(user.avatar.path) as stored:
        assert stored.size == (256, 256)


def test_replacing_deletes_the_old_file_and_delete_removes_it(make_user, api_as, media_root):
    user = make_user("ana")
    client = api_as(user)
    client.post("/api/auth/me/avatar/", {"avatar": image_file()}, format="multipart")
    user.refresh_from_db()
    first = user.avatar.path
    client.post("/api/auth/me/avatar/", {"avatar": image_file(fmt="JPEG", name="b.jpg")}, format="multipart")
    assert not (media_root / first).exists()
    response = client.delete("/api/auth/me/avatar/")
    assert response.json()["avatar_url"] is None
    assert list((media_root / "avatars").iterdir()) == []


def test_rejects_files_that_are_not_images(make_user, api_as):
    fake = SimpleUploadedFile("x.png", b"not an image", content_type="image/png")
    response = api_as(make_user("ana")).post("/api/auth/me/avatar/", {"avatar": fake}, format="multipart")
    assert response.status_code == 400


def test_coach_sees_student_photo(coach, api_as, make_user):
    student = make_user("ana")
    api_as(student).post("/api/auth/me/avatar/", {"avatar": image_file()}, format="multipart")
    listed = api_as(coach).get("/api/students/").json()
    assert listed[0]["avatar_url"].startswith("/media/avatars/")
