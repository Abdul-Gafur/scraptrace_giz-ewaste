"""Secure, in-memory image decoding for model inference and evidence storage."""

from __future__ import annotations

import io
import warnings
from dataclasses import dataclass

from apps.api.app.core.config import Settings
from apps.api.app.core.errors import ApiError
from apps.api.app.domain.integrity import sha256_bytes
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.datastructures import UploadFile

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MIME_TYPES = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


@dataclass(frozen=True)
class SanitizedImage:
    """Evidence bytes re-encoded from decoded pixels: EXIF (including GPS), text chunks and
    other embedded metadata are gone, and orientation is applied to the pixels."""

    content: bytes
    mime_type: str
    width: int
    height: int
    original_size_bytes: int
    original_digest: str


async def _read_bounded(upload: UploadFile, settings: Settings, field: str) -> bytes:
    if upload.content_type not in ALLOWED_CONTENT_TYPES:
        raise ApiError(
            status_code=415,
            code="VALIDATION_FAILED",
            message="Only JPEG, PNG, and WebP images are supported.",
            field_issues=[{"field": field, "reason": "unsupported_media_type"}],
        )

    buffer = bytearray()
    try:
        while True:
            chunk = await upload.read(min(64 * 1024, settings.maximum_upload_bytes + 1))
            if not chunk:
                break
            buffer.extend(chunk)
            if len(buffer) > settings.maximum_upload_bytes:
                raise ApiError(
                    status_code=413,
                    code="VALIDATION_FAILED",
                    message="The uploaded image is too large.",
                    field_issues=[{"field": field, "reason": "maximum_size_exceeded"}],
                    safe_details={"maximum_upload_bytes": settings.maximum_upload_bytes},
                )
    finally:
        await upload.close()

    if not buffer:
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="The uploaded image is empty.",
            field_issues=[{"field": field, "reason": "empty"}],
        )
    return bytes(buffer)


def _decode(buffer: bytes, settings: Settings, field: str) -> tuple[Image.Image, str]:
    """Verifies the real signature, bounds and integrity, then returns oriented RGB pixels."""
    source = io.BytesIO(buffer)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(source) as candidate:
                detected_format = candidate.format
                width, height = candidate.size
                if detected_format not in ALLOWED_FORMATS:
                    raise ApiError(
                        status_code=415,
                        code="VALIDATION_FAILED",
                        message="The image data uses an unsupported format.",
                        field_issues=[{"field": field, "reason": "unsupported_signature"}],
                    )
                if (
                    width > settings.maximum_image_width
                    or height > settings.maximum_image_height
                    or width * height > settings.maximum_image_pixels
                ):
                    raise ApiError(
                        status_code=422,
                        code="VALIDATION_FAILED",
                        message="The image dimensions are too large.",
                        field_issues=[{"field": field, "reason": "maximum_dimensions_exceeded"}],
                    )
                candidate.verify()

            source.seek(0)
            with Image.open(source) as decoded:
                decoded.load()
                oriented = ImageOps.exif_transpose(decoded)
                # Copying RGB pixels removes EXIF and other embedded metadata.
                return oriented.convert("RGB").copy(), str(detected_format)
    except ApiError:
        raise
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
        ValueError,
    ) as exc:
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="The uploaded file is not a valid image.",
            field_issues=[{"field": field, "reason": "invalid_image"}],
        ) from exc


async def read_validated_image(upload: UploadFile, settings: Settings) -> Image.Image:
    """Vision input: decoded, oriented RGB pixels. Nothing is retained."""
    buffer = await _read_bounded(upload, settings, "image")
    image, _ = _decode(buffer, settings, "image")
    return image


def _encode(image: Image.Image, image_format: str) -> bytes:
    # Pillow can carry EXIF, ICC and text chunks through `info` into some encoders (PNG in
    # particular), so the metadata dictionary is emptied before encoding.
    image.info.clear()
    output = io.BytesIO()
    if image_format == "PNG":
        image.save(output, format="PNG", optimize=True)
    elif image_format == "WEBP":
        image.save(output, format="WEBP", quality=92, method=4)
    else:
        image.save(output, format="JPEG", quality=92, optimize=True)
    return output.getvalue()


async def read_sanitized_evidence(
    upload: UploadFile, settings: Settings, field: str
) -> SanitizedImage:
    """Evidence input: validated like vision input, then re-encoded in its original format
    without metadata. Identical uploads produce identical bytes, so the content digest still
    detects exact reuse (FR-REC-007)."""
    return sanitize_image_bytes(await _read_bounded(upload, settings, field), settings, field)


def sanitize_image_bytes(buffer: bytes, settings: Settings, field: str) -> SanitizedImage:
    if len(buffer) > settings.maximum_upload_bytes:
        raise ApiError(
            status_code=413,
            code="VALIDATION_FAILED",
            message="The uploaded image is too large.",
            field_issues=[{"field": field, "reason": "maximum_size_exceeded"}],
        )
    image, image_format = _decode(buffer, settings, field)
    content = _encode(image, image_format)
    return SanitizedImage(
        content=content,
        mime_type=MIME_TYPES[image_format],
        width=image.width,
        height=image.height,
        original_size_bytes=len(buffer),
        original_digest=sha256_bytes(buffer),
    )
