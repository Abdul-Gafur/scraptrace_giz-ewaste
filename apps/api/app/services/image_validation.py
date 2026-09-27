"""Secure, in-memory image decoding for model inference."""

from __future__ import annotations

import io
import warnings

from apps.api.app.core.config import Settings
from apps.api.app.core.errors import ApiError
from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


async def read_validated_image(upload: UploadFile, settings: Settings) -> Image.Image:
    if upload.content_type not in ALLOWED_CONTENT_TYPES:
        raise ApiError(
            status_code=415,
            code="VALIDATION_FAILED",
            message="Only JPEG, PNG, and WebP images are supported.",
            field_issues=[{"field": "image", "reason": "unsupported_media_type"}],
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
                    field_issues=[{"field": "image", "reason": "maximum_size_exceeded"}],
                    safe_details={"maximum_upload_bytes": settings.maximum_upload_bytes},
                )
    finally:
        await upload.close()

    if not buffer:
        raise ApiError(
            status_code=422,
            code="VALIDATION_FAILED",
            message="The uploaded image is empty.",
            field_issues=[{"field": "image", "reason": "empty"}],
        )

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
                        field_issues=[{"field": "image", "reason": "unsupported_signature"}],
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
                        field_issues=[{"field": "image", "reason": "maximum_dimensions_exceeded"}],
                    )
                candidate.verify()

            source.seek(0)
            with Image.open(source) as decoded:
                decoded.load()
                oriented = ImageOps.exif_transpose(decoded)
                # Copying RGB pixels removes EXIF and other embedded metadata.
                return oriented.convert("RGB").copy()
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
            field_issues=[{"field": "image", "reason": "invalid_image"}],
        ) from exc
