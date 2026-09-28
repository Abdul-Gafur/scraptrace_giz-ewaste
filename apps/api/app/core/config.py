"""Validated environment configuration for the ScrapTrace API."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
API_ROOT = REPOSITORY_ROOT / "apps/api"
CONTRACT_SCHEMA_DIRECTORY = REPOSITORY_ROOT / "packages/contracts/schemas"

SUPPORTED_DATABASE_SCHEMES = ("postgresql+asyncpg://", "sqlite+aiosqlite://")
MINIMUM_SECRET_LENGTH = 32
_PLACEHOLDER_SECRET_MARKERS = ("change-me", "changeme", "replace-me", "placeholder", "example")


class ConfigurationError(RuntimeError):
    """Raised at startup when required configuration is missing. Messages name variables only
    and never include a configured value."""


def _validate_secret(name: str, value: SecretStr | None) -> SecretStr | None:
    if value is None:
        return None
    raw = value.get_secret_value()
    if len(raw) < MINIMUM_SECRET_LENGTH:
        raise ValueError(f"{name} must contain at least {MINIMUM_SECRET_LENGTH} characters.")
    if any(marker in raw.lower() for marker in _PLACEHOLDER_SECRET_MARKERS):
        raise ValueError(f"{name} looks like a placeholder; generate a random value.")
    return value


class Settings(BaseModel):
    model_config = ConfigDict(frozen=True)

    environment: str = Field(default="development", pattern=r"^[a-z][a-z0-9_-]{1,31}$")
    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)
    allowed_origins: tuple[str, ...] = ("http://localhost:3000",)
    checkpoint_path: Path = REPOSITORY_ROOT / "services/vision/checkpoints/best_model.pth"
    model_manifest_path: Path = REPOSITORY_ROOT / "services/vision/checkpoints/model_manifest.json"
    vision_response_schema_path: Path = (
        CONTRACT_SCHEMA_DIRECTORY / "vision_appraisal_response.schema.json"
    )
    error_schema_path: Path = CONTRACT_SCHEMA_DIRECTORY / "error_envelope.schema.json"
    contract_schema_directory: Path = CONTRACT_SCHEMA_DIRECTORY
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

    # Persistence
    database_url: SecretStr | None = None
    database_pool_size: int = Field(default=5, ge=1, le=50)
    database_max_overflow: int = Field(default=5, ge=0, le=50)
    database_pool_timeout_seconds: float = Field(default=10.0, gt=0.0, le=60.0)
    database_statement_timeout_seconds: float = Field(default=15.0, gt=0.0, le=120.0)

    # Authentication
    auth_token_secret: SecretStr | None = None
    auth_token_ttl_seconds: int = Field(default=1800, ge=60, le=7200)
    auth_token_issuer: str = Field(default="scraptrace-api", min_length=3, max_length=120)
    auth_token_audience: str = Field(default="scraptrace-web", min_length=3, max_length=120)
    auth_cookie_secure: bool | None = None
    password_hash_time_cost: int = Field(default=3, ge=1, le=10)
    password_hash_memory_cost_kib: int = Field(default=65536, ge=8, le=1_048_576)
    password_hash_parallelism: int = Field(default=2, ge=1, le=16)
    sign_in_rate_limit_attempts: int = Field(default=5, ge=1, le=100)
    sign_in_rate_limit_window_seconds: int = Field(default=900, ge=10, le=86_400)
    lookup_rate_limit_attempts: int = Field(default=30, ge=1, le=1000)
    lookup_rate_limit_window_seconds: int = Field(default=60, ge=1, le=3600)
    enable_demo_account_discovery: bool = False
    vision_requires_authentication: bool = True

    # QR lookup tokens and evidence
    qr_token_secret: SecretStr | None = None
    qr_token_ttl_days: int = Field(default=30, ge=1, le=365)
    evidence_storage_backend: str = Field(default="local", pattern=r"^local$")
    evidence_storage_root: Path = API_ROOT / ".data/evidence"
    idempotency_retention_days: int = Field(default=30, ge=1, le=365)
    clock_skew_seconds: int = Field(default=300, ge=0, le=3600)

    @field_validator("allowed_origins")
    @classmethod
    def validate_origins(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        origins = tuple(origin.strip().rstrip("/") for origin in value if origin.strip())
        if "*" in origins:
            # Cookie authentication uses credentialed CORS, which must never be wildcarded.
            raise ValueError("CORS origins must be explicit; '*' is not allowed.")
        return origins

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None:
            return None
        if not value.get_secret_value().startswith(SUPPORTED_DATABASE_SCHEMES):
            raise ValueError(
                "SCRAPTRACE_DATABASE_URL must use postgresql+asyncpg:// "
                "(or sqlite+aiosqlite:// for isolated tests)."
            )
        return value

    @field_validator("auth_token_secret")
    @classmethod
    def validate_auth_secret(cls, value: SecretStr | None) -> SecretStr | None:
        return _validate_secret("SCRAPTRACE_AUTH_TOKEN_SECRET", value)

    @field_validator("qr_token_secret")
    @classmethod
    def validate_qr_secret(cls, value: SecretStr | None) -> SecretStr | None:
        return _validate_secret("SCRAPTRACE_QR_TOKEN_SECRET", value)

    @model_validator(mode="after")
    def validate_environment_rules(self) -> Settings:
        if self.database_url is not None and self.uses_sqlite and self.environment != "test":
            raise ValueError("SQLite is only permitted as an isolated test database.")
        if self.environment == "production":
            if not self.allowed_origins:
                raise ValueError("Production CORS origins must be explicit.")
            if self.auth_cookie_secure is False:
                raise ValueError("Production session cookies must be Secure.")
            if self.enable_demo_account_discovery:
                raise ValueError("Demo-account discovery is not allowed in production.")
            if not self.vision_requires_authentication:
                raise ValueError("Production vision appraisal must require authentication.")
        if (
            self.auth_token_secret is not None
            and self.qr_token_secret is not None
            and self.auth_token_secret.get_secret_value() == self.qr_token_secret.get_secret_value()
        ):
            raise ValueError("The QR token secret and the auth token secret must differ.")
        return self

    @property
    def uses_sqlite(self) -> bool:
        return self.database_url is not None and self.database_url.get_secret_value().startswith(
            "sqlite+aiosqlite://"
        )

    @property
    def cookie_secure(self) -> bool:
        if self.auth_cookie_secure is not None:
            return self.auth_cookie_secure
        return self.environment == "production"

    @property
    def demo_account_discovery_enabled(self) -> bool:
        return self.enable_demo_account_discovery and self.environment in {"development", "test"}

    def require_runtime_configuration(self) -> None:
        """Fails startup clearly, naming each missing variable without echoing values."""
        missing = [
            name
            for name, value in (
                ("SCRAPTRACE_DATABASE_URL", self.database_url),
                ("SCRAPTRACE_AUTH_TOKEN_SECRET", self.auth_token_secret),
                ("SCRAPTRACE_QR_TOKEN_SECRET", self.qr_token_secret),
            )
            if value is None
        ]
        if missing:
            raise ConfigurationError(
                "Missing required configuration: "
                + ", ".join(missing)
                + ". See apps/api/.env.example."
            )


def _integer(name: str, default: int) -> int:
    value = os.getenv(name)
    return default if value is None else int(value)


def _float(name: str, default: float) -> float:
    value = os.getenv(name)
    return default if value is None else float(value)


def _boolean(name: str, default: bool | None) -> bool | None:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be true or false.")


def _secret(name: str) -> SecretStr | None:
    value = os.getenv(name)
    return None if value is None or value.strip() == "" else SecretStr(value.strip())


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
        database_url=_secret("SCRAPTRACE_DATABASE_URL"),
        database_pool_size=_integer("SCRAPTRACE_DATABASE_POOL_SIZE", defaults.database_pool_size),
        database_max_overflow=_integer(
            "SCRAPTRACE_DATABASE_MAX_OVERFLOW", defaults.database_max_overflow
        ),
        database_pool_timeout_seconds=_float(
            "SCRAPTRACE_DATABASE_POOL_TIMEOUT_SECONDS", defaults.database_pool_timeout_seconds
        ),
        database_statement_timeout_seconds=_float(
            "SCRAPTRACE_DATABASE_STATEMENT_TIMEOUT_SECONDS",
            defaults.database_statement_timeout_seconds,
        ),
        auth_token_secret=_secret("SCRAPTRACE_AUTH_TOKEN_SECRET"),
        auth_token_ttl_seconds=_integer(
            "SCRAPTRACE_AUTH_TOKEN_TTL_SECONDS", defaults.auth_token_ttl_seconds
        ),
        auth_cookie_secure=_boolean("SCRAPTRACE_AUTH_COOKIE_SECURE", None),
        password_hash_time_cost=_integer(
            "SCRAPTRACE_PASSWORD_HASH_TIME_COST", defaults.password_hash_time_cost
        ),
        password_hash_memory_cost_kib=_integer(
            "SCRAPTRACE_PASSWORD_HASH_MEMORY_COST_KIB", defaults.password_hash_memory_cost_kib
        ),
        password_hash_parallelism=_integer(
            "SCRAPTRACE_PASSWORD_HASH_PARALLELISM", defaults.password_hash_parallelism
        ),
        sign_in_rate_limit_attempts=_integer(
            "SCRAPTRACE_SIGN_IN_RATE_LIMIT_ATTEMPTS", defaults.sign_in_rate_limit_attempts
        ),
        sign_in_rate_limit_window_seconds=_integer(
            "SCRAPTRACE_SIGN_IN_RATE_LIMIT_WINDOW_SECONDS",
            defaults.sign_in_rate_limit_window_seconds,
        ),
        lookup_rate_limit_attempts=_integer(
            "SCRAPTRACE_LOOKUP_RATE_LIMIT_ATTEMPTS", defaults.lookup_rate_limit_attempts
        ),
        lookup_rate_limit_window_seconds=_integer(
            "SCRAPTRACE_LOOKUP_RATE_LIMIT_WINDOW_SECONDS",
            defaults.lookup_rate_limit_window_seconds,
        ),
        enable_demo_account_discovery=bool(
            _boolean("SCRAPTRACE_ENABLE_DEMO_ACCOUNT_DISCOVERY", False)
        ),
        vision_requires_authentication=bool(
            _boolean("SCRAPTRACE_VISION_REQUIRES_AUTHENTICATION", True)
        ),
        qr_token_secret=_secret("SCRAPTRACE_QR_TOKEN_SECRET"),
        qr_token_ttl_days=_integer("SCRAPTRACE_QR_TOKEN_TTL_DAYS", defaults.qr_token_ttl_days),
        evidence_storage_root=Path(
            os.getenv("SCRAPTRACE_EVIDENCE_STORAGE_ROOT", str(defaults.evidence_storage_root))
        ),
        idempotency_retention_days=_integer(
            "SCRAPTRACE_IDEMPOTENCY_RETENTION_DAYS", defaults.idempotency_retention_days
        ),
        clock_skew_seconds=_integer("SCRAPTRACE_CLOCK_SKEW_SECONDS", defaults.clock_skew_seconds),
    )
