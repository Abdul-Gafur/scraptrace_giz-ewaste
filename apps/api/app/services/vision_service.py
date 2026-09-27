"""Application service boundary for synchronous model inference."""

from __future__ import annotations

import asyncio
from typing import Any, Protocol

import anyio
from apps.api.app.contracts.validation import ContractValidator
from apps.api.app.core.errors import ApiError
from PIL import Image
from services.vision.predictor import InferenceError, ModelLoadError


class Predictor(Protocol):
    load_error: str | None

    def load(self) -> None: ...

    def is_ready(self) -> bool: ...

    def appraise(
        self, image: Image.Image, confidence_threshold: float, ambiguity_margin: float
    ) -> dict[str, Any]: ...


class VisionService:
    def __init__(
        self,
        predictor: Predictor,
        validator: ContractValidator,
        confidence_threshold: float,
        ambiguity_margin: float,
        inference_timeout_seconds: float,
        maximum_concurrent_inferences: int,
    ) -> None:
        self.predictor = predictor
        self.validator = validator
        self.confidence_threshold = confidence_threshold
        self.ambiguity_margin = ambiguity_margin
        self.inference_timeout_seconds = inference_timeout_seconds
        self.capacity = asyncio.Semaphore(maximum_concurrent_inferences)

    async def appraise(self, image: Image.Image) -> dict[str, Any]:
        if not self.predictor.is_ready():
            raise ApiError(
                status_code=503,
                code="DEPENDENCY_UNAVAILABLE",
                message="The vision model is unavailable.",
                retryable=True,
            )
        try:
            await asyncio.wait_for(self.capacity.acquire(), timeout=0.01)
        except asyncio.TimeoutError as exc:
            raise ApiError(
                status_code=429,
                code="RATE_LIMIT_REACHED",
                message="The vision service is busy. Try again shortly.",
                retryable=True,
            ) from exc
        release_on_return = True
        try:
            operation = asyncio.create_task(
                anyio.to_thread.run_sync(
                    lambda: self.predictor.appraise(
                        image,
                        confidence_threshold=self.confidence_threshold,
                        ambiguity_margin=self.ambiguity_margin,
                    ),
                    abandon_on_cancel=True,
                )
            )
            try:
                result = await asyncio.wait_for(
                    asyncio.shield(operation), timeout=self.inference_timeout_seconds
                )
            except asyncio.TimeoutError as exc:
                release_on_return = False

                def release_capacity(completed: asyncio.Task[dict[str, Any]]) -> None:
                    try:
                        completed.exception()
                    finally:
                        self.capacity.release()

                operation.add_done_callback(release_capacity)
                raise ApiError(
                    status_code=504,
                    code="DEPENDENCY_UNAVAILABLE",
                    message="Vision inference timed out.",
                    retryable=True,
                ) from exc
            self.validator.validate(result)
            return result
        except ApiError:
            raise
        except (InferenceError, ModelLoadError) as exc:
            raise ApiError(
                status_code=503,
                code="DEPENDENCY_UNAVAILABLE",
                message="The vision model could not complete inference.",
                retryable=True,
            ) from exc
        except Exception as exc:
            raise ApiError(
                status_code=500,
                code="INTERNAL_FAILURE",
                message="The appraisal response could not be validated.",
            ) from exc
        finally:
            if release_on_return:
                self.capacity.release()
