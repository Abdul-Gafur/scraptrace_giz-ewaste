"""Validated environment configuration for the ScrapTrace API."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseModel):
    model_config = ConfigDict(frozen=True)

    environment: str = Field(default="development", pattern=r"^[a-z][a-z0-9_-]{1,31}$")
    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)
    allowed_origins: tuple[str, ...] = ("http://localhost:3000",)
    checkpoint_path: Path = REPOSITORY_ROOT / "services/vision/checkpoints/best_model.pth"
    model_manifest_path: Path = REPOSITORY_ROOT / "services/vision/checkpoints/model_manifest.json"
    vision_response_schema_path: Path = (
        REPOSITORY_ROOT / "packages/contracts/schemas/vision_appraisal_response.schema.json"
    )
    error_schema_path: Path = (
        REPOSITORY_ROOT / "packages/contracts/schemas/error_envelope.schema.json"
    )
    runtime_device: str = Field(default="cpu", pattern=r"^(cpu|auto|cuda|mps)$")
    maximum_upload_bytes: int = Field(default=5 * 1024 * 1024, ge=1024, le=25 * 1024 * 1024)
    maximum_image_width: int = Field(default=8192, ge=224, le=20000)
    maximum_image_height: int = Field(default=8192, ge=224, le=20000)
    maximum_image_pixels: int = Field(default=25_000_000, ge=224 * 224, le=100_000_000)
    confidence_threshold: float = Field(default=0.40, ge=0.0, le=1.0)
    ambiguity_margin: float = Field(default=0.05, ge=0.0, le=1.0)
    inference_timeout_seconds: float = Field(default=15.0, gt=0.0, le=120.0)
    maximum_concurrent_inferences: int = Field(default=2, ge=1, le=32)
    log_level: str = Field(default="INFO", pattern=r"^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")

    @field_validator("allowed_origins")
    @classmethod
    def validate_origins(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        return tuple(origin.rstrip("/") for origin in value if origin.strip())

    @model_validator(mode="after")
    def validate_production_cors(self) -> Settings:
        if self.environment == "production" and (
            not self.allowed_origins or "*" in self.allowed_origins
        ):
            raise ValueError("Production CORS origins must be explicit.")
        return self


def _integer(name: str, default: int) -> int:
    value = os.getenv(name)
    return default if value is None else int(value)


def _float(name: str, default: float) -> float:
    value = os.getenv(name)
    return default if value is None else float(value)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    defaults = Settings()
    origins = tuple(
        part.strip()
        for part in os.getenv("SCRAPTRACE_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    )
    return Settings(
        environment=os.getenv("SCRAPTRACE_ENVIRONMENT", defaults.environment),
        host=os.getenv("SCRAPTRACE_HOST", defaults.host),
        port=_integer("SCRAPTRACE_PORT", defaults.port),
        allowed_origins=origins,
        checkpoint_path=Path(
            os.getenv("SCRAPTRACE_CHECKPOINT_PATH", str(defaults.checkpoint_path))
        ),
        model_manifest_path=Path(
            os.getenv("SCRAPTRACE_MODEL_MANIFEST_PATH", str(defaults.model_manifest_path))
        ),
        runtime_device=os.getenv("SCRAPTRACE_RUNTIME_DEVICE", defaults.runtime_device),
        maximum_upload_bytes=_integer(
            "SCRAPTRACE_MAXIMUM_UPLOAD_BYTES", defaults.maximum_upload_bytes
        ),
        maximum_image_width=_integer(
            "SCRAPTRACE_MAXIMUM_IMAGE_WIDTH", defaults.maximum_image_width
        ),
        maximum_image_height=_integer(
            "SCRAPTRACE_MAXIMUM_IMAGE_HEIGHT", defaults.maximum_image_height
        ),
        maximum_image_pixels=_integer(
            "SCRAPTRACE_MAXIMUM_IMAGE_PIXELS", defaults.maximum_image_pixels
        ),
        confidence_threshold=_float(
            "SCRAPTRACE_CONFIDENCE_THRESHOLD", defaults.confidence_threshold
        ),
        ambiguity_margin=_float("SCRAPTRACE_AMBIGUITY_MARGIN", defaults.ambiguity_margin),
        inference_timeout_seconds=_float(
            "SCRAPTRACE_INFERENCE_TIMEOUT_SECONDS", defaults.inference_timeout_seconds
        ),
        maximum_concurrent_inferences=_integer(
            "SCRAPTRACE_MAXIMUM_CONCURRENT_INFERENCES", defaults.maximum_concurrent_inferences
        ),
        log_level=os.getenv("SCRAPTRACE_LOG_LEVEL", defaults.log_level).upper(),
    )
