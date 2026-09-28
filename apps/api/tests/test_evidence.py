"""Evidence: validated storage, metadata stripping, provenance, retry safety and access."""

from __future__ import annotations

import io
from pathlib import Path

import pytest
import sqlalchemy as sa
from apps.api.app.contracts.transport import REGISTRY
from apps.api.app.core.config import Settings
from apps.api.app.db.models import AuditEvent, Evidence
from apps.api.app.domain.identifiers import uuid7
from apps.api.app.domain.integrity import sha256_bytes
from apps.api.app.services.evidence_storage import (
    EvidenceStorageError,
    LocalEvidenceStorage,
)
from apps.api.tests.support.api import auth, query
from apps.api.tests.support.records import (
    created_record,
    photo,
    submitted_record,
    upload_evidence,
)
from fastapi.testclient import TestClient
from PIL import Image


def test_collector_adds_a_photograph_to_a_draft(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    response = upload_evidence(
        api, headers, record["record_id"], "additional_item_photo", capture_source="in_app_camera"
    )
    assert response.status_code == 201, response.text
    data = response.json()["data"]
    REGISTRY.check_response("evidence_metadata", data)
    assert data["evidence_type"] == "additional_item_photo"
    assert data["mime_type"] == "image/jpeg"
    # The private storage reference never leaves the server.
    assert "storage_reference" not in data and record["record_id"] + "/" not in response.text
    assert data["storage_transform"] == "reencoded_without_metadata"
    assert data["provenance"]["captured_by"]["actor_id"] == record["collector"]["actor_id"]
    assert data["provenance"]["server_received_at"]

    content = api.get(f"/v1/evidence/{data['evidence_id']}/content", headers=headers)
    assert content.status_code == 200
    assert sha256_bytes(content.content) == data["content_digest"]
    assert data["file_size_bytes"] == len(content.content)
    assert content.headers["content-type"] == "image/jpeg"
    assert content.headers["cache-control"] == "private, no-store"
    assert content.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in content.headers["content-security-policy"]


def test_embedded_metadata_is_removed(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    source = photo(5, exif=True)
    assert Image.open(io.BytesIO(source)).getexif()
    uploaded = upload_evidence(
        api,
        headers,
        record["record_id"],
        "additional_item_photo",
        image=source,
        capture_source="in_app_camera",
    ).json()["data"]
    stored = api.get(f"/v1/evidence/{uploaded['evidence_id']}/content", headers=headers).content
    assert not Image.open(io.BytesIO(stored)).getexif()
    assert uploaded["content_digest"] != sha256_bytes(source)


def test_png_text_exif_and_colour_profile_metadata_are_removed(api: TestClient) -> None:
    from PIL import ImageCms, PngImagePlugin

    source_image = Image.new("RGB", (40, 30), color=(10, 200, 30))
    text = PngImagePlugin.PngInfo()
    text.add_text("Comment", "location: somewhere private")
    exif = Image.Exif()
    exif[0x010F] = "Synthetic Camera Maker"
    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    buffer = io.BytesIO()
    source_image.save(buffer, format="PNG", pnginfo=text, exif=exif.tobytes(), icc_profile=profile)
    source = buffer.getvalue()
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    uploaded = upload_evidence(
        api,
        headers,
        record["record_id"],
        "additional_item_photo",
        image=source,
        capture_source="in_app_camera",
        content_type="image/png",
    ).json()["data"]
    stored = Image.open(
        io.BytesIO(
            api.get(f"/v1/evidence/{uploaded['evidence_id']}/content", headers=headers).content
        )
    )
    assert not stored.getexif()
    assert "icc_profile" not in stored.info
    assert "Comment" not in stored.info


def test_client_evidence_id_makes_uploads_retry_safe(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    evidence_id = str(uuid7())
    arguments = (api, headers, record["record_id"], "additional_item_photo")
    first = upload_evidence(
        *arguments, image=photo(11), capture_source="in_app_camera", evidence_id=evidence_id
    )
    again = upload_evidence(
        *arguments, image=photo(11), capture_source="in_app_camera", evidence_id=evidence_id
    )
    assert (first.status_code, again.status_code) == (201, 200)
    assert again.json()["data"] == first.json()["data"]
    conflict = upload_evidence(
        *arguments, image=photo(12), capture_source="in_app_camera", evidence_id=evidence_id
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"


@pytest.mark.parametrize(
    ("evidence_type", "source", "status"),
    [
        ("handoff_photo", "in_app_camera", 422),
        ("additional_item_photo", "recycler_camera", 422),
        ("original_item_photo", "in_app_camera", 422),
        ("reviewer_decision", "in_app_camera", 422),
    ],
)
def test_collectors_add_only_their_own_evidence_types(
    api: TestClient, evidence_type: str, source: str, status: int
) -> None:
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    response = upload_evidence(
        api, headers, record["record_id"], evidence_type, capture_source=source
    )
    assert response.status_code == status


def test_photographs_cannot_be_added_after_submission_by_the_collector(api: TestClient) -> None:
    headers = auth(api, "collector.demo")
    record = submitted_record(api, headers)
    response = upload_evidence(
        api, headers, record["record_id"], "additional_item_photo", capture_source="in_app_camera"
    )
    assert response.status_code == 409


@pytest.mark.parametrize(
    ("username", "status"),
    [("recycler.demo", 201), ("recycler-ashanti.demo", 404), ("reviewer.demo", 403)],
)
def test_recycler_handoff_evidence_is_facility_scoped(
    api: TestClient, username: str, status: int
) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    response = upload_evidence(api, auth(api, username), record["record_id"], "handoff_photo")
    assert response.status_code == status


@pytest.mark.parametrize(
    ("username", "status"),
    [
        ("collector.demo", 200),
        ("collector-two.demo", 404),
        ("recycler.demo", 200),
        ("recycler-ashanti.demo", 404),
        ("reviewer.demo", 200),
        ("safety-admin.demo", 403),
    ],
)
def test_evidence_access_follows_record_access(
    api: TestClient, api_settings: Settings, username: str, status: int
) -> None:
    record = submitted_record(api, auth(api, "collector.demo"))
    evidence_id = record["original_image_evidence_id"]
    headers = auth(api, username)
    assert api.get(f"/v1/evidence/{evidence_id}", headers=headers).status_code == status
    assert api.get(f"/v1/evidence/{evidence_id}/content", headers=headers).status_code == status
    if status == 200:

        async def accessed(session: sa.ext.asyncio.AsyncSession) -> int:
            return int(
                await session.scalar(
                    sa.select(sa.func.count())
                    .select_from(AuditEvent)
                    .where(AuditEvent.action == "evidence.content-accessed")
                )
            )

        assert query(api_settings, accessed) >= 1


@pytest.mark.parametrize(
    ("image", "content_type", "status"),
    [
        (b"\x89PNG not really", "image/png", 422),
        (b"<svg xmlns='http://www.w3.org/2000/svg'/>", "image/svg+xml", 415),
        (photo(3, fmt="PNG"), "image/jpeg", 201),
    ],
)
def test_upload_content_is_validated_by_signature(
    api: TestClient, image: bytes, content_type: str, status: int
) -> None:
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    response = upload_evidence(
        api,
        headers,
        record["record_id"],
        "additional_item_photo",
        image=image,
        capture_source="in_app_camera",
        content_type=content_type,
    )
    assert response.status_code == status
    if status == 201:
        # The stored type follows the decoded content, not the declared type.
        assert response.json()["data"]["mime_type"] == "image/png"


def test_oversized_and_overscaled_uploads_are_rejected(
    api_settings: Settings, database_url: str
) -> None:
    from apps.api.app.main import create_app
    from apps.api.tests.conftest import FakePredictor, build_settings
    from apps.api.tests.support.api import seed_database

    constrained = build_settings(
        database_url,
        maximum_upload_bytes=4096,
        maximum_image_width=256,
        evidence_storage_root=api_settings.evidence_storage_root,
    )
    seed_database(constrained)
    with TestClient(create_app(settings=constrained, predictor=FakePredictor())) as client:
        headers = auth(client, "collector.demo")
        record = created_record(client, headers)
        arguments = (client, headers, record["record_id"], "additional_item_photo")
        big = upload_evidence(*arguments, image=b"\xff" * 5000, capture_source="in_app_camera")
        assert big.status_code == 413
        wide = upload_evidence(
            *arguments,
            image=photo(4, fmt="PNG", size=(300, 10)),
            capture_source="in_app_camera",
            content_type="image/png",
        )
        assert wide.status_code == 422
        assert wide.json()["error"]["field_issues"][0]["reason"] == "maximum_dimensions_exceeded"


def test_storage_failure_records_nothing(
    api: TestClient, api_settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)

    async def unavailable(*_: object, **__: object) -> None:
        raise EvidenceStorageError("simulated outage")

    monkeypatch.setattr(LocalEvidenceStorage, "put", unavailable)
    response = upload_evidence(
        api, headers, record["record_id"], "additional_item_photo", capture_source="in_app_camera"
    )
    assert response.status_code == 503
    assert response.json()["error"]["retryable"] is True

    async def count(session: sa.ext.asyncio.AsyncSession) -> int:
        return int(await session.scalar(sa.select(sa.func.count()).select_from(Evidence)))

    assert query(api_settings, count) == 1  # only the original photograph


def test_failed_metadata_transaction_removes_the_stored_object(
    api: TestClient, evidence_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from apps.api.app.services import evidence as evidence_module

    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    before = {path for path in evidence_root.rglob("*") if path.is_file()}

    def explode(*_: object, **__: object) -> dict[str, object]:
        raise RuntimeError("simulated failure after storage")

    monkeypatch.setattr(evidence_module.EvidenceService, "represent", explode)
    with pytest.raises(RuntimeError):
        upload_evidence(
            api,
            headers,
            record["record_id"],
            "additional_item_photo",
            capture_source="in_app_camera",
        )
    after = {path for path in evidence_root.rglob("*") if path.is_file()}
    assert after == before


def test_tampered_content_fails_integrity_verification(
    api: TestClient, evidence_root: Path
) -> None:
    headers = auth(api, "collector.demo")
    record = created_record(api, headers)
    evidence_id = record["original_image_evidence_id"]
    stored = evidence_root / "evidence" / record["record_id"] / evidence_id
    stored.chmod(0o600)
    stored.write_bytes(stored.read_bytes() + b"tampered")
    response = api.get(f"/v1/evidence/{evidence_id}/content", headers=headers)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INTEGRITY_FAILURE"


@pytest.mark.parametrize(
    "key",
    [
        "../outside",
        "evidence/../../etc/passwd",
        "evidence/0199c001-0001-7001-8001-000000000001/../../x",
        "/absolute/path",
        "evidence/not-a-uuid/also-not",
    ],
)
async def test_local_storage_refuses_unsafe_keys(tmp_path: Path, key: str) -> None:
    storage = LocalEvidenceStorage(tmp_path)
    with pytest.raises(EvidenceStorageError):
        await storage.put(key, b"x", "image/jpeg")
    with pytest.raises(EvidenceStorageError):
        await storage.read(key)


async def test_local_storage_objects_are_immutable(tmp_path: Path) -> None:
    storage = LocalEvidenceStorage(tmp_path)
    key = f"evidence/{uuid7()}/{uuid7()}"
    stored = await storage.put(key, b"first", "image/jpeg")
    assert stored.size_bytes == 5
    assert await storage.read(key) == b"first"
    with pytest.raises(EvidenceStorageError):
        await storage.put(key, b"second", "image/jpeg")
    assert oct((tmp_path / key).stat().st_mode & 0o777) == "0o600"
