"""Process-wide collaborators, composed once per application instance."""

from __future__ import annotations

from dataclasses import dataclass

from apps.api.app.contracts.validation import ContractRegistry
from apps.api.app.core.config import Settings
from apps.api.app.core.passwords import PasswordService
from apps.api.app.db.session import Database
from apps.api.app.domain.time import Clock, utc_now


@dataclass
class AppServices:
    settings: Settings
    database: Database
    contracts: ContractRegistry
    passwords: PasswordService
    clock: Clock


def build_services(settings: Settings, clock: Clock | None = None) -> AppServices:
    return AppServices(
        settings=settings,
        database=Database(settings),
        contracts=ContractRegistry(settings.contract_schema_directory),
        passwords=PasswordService(settings),
        clock=clock or utc_now,
    )
