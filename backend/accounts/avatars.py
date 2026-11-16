"""Profile photo processing: any common image becomes a small square WebP."""
import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
SIZE = 256


class InvalidImage(ValueError):
    pass


def process_avatar(upload) -> ContentFile:
    if upload.size > MAX_UPLOAD_BYTES:
        raise InvalidImage("The image must be at most 5 MB.")
    try:
        image = Image.open(upload)
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise InvalidImage("Upload a JPG, PNG or WebP image.")
    image = ImageOps.exif_transpose(image).convert("RGB")  # respect phone camera rotation
    image = ImageOps.fit(image, (SIZE, SIZE), Image.LANCZOS)
    buffer = BytesIO()
    image.save(buffer, "WEBP", quality=85)
    return ContentFile(buffer.getvalue(), name=f"{uuid.uuid4().hex}.webp")


def replace_avatar(user, upload) -> None:
    content = process_avatar(upload)
    old = user.avatar.name if user.avatar else None
    user.avatar.save(content.name, content, save=True)
    if old:
        user.avatar.storage.delete(old)


def remove_avatar(user) -> None:
    if user.avatar:
        user.avatar.delete(save=True)
