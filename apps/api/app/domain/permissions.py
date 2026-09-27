"""Role permissions and scoped authorisation (ADR-006).

A line-for-line port of `packages/contracts/src/auth/permissions.ts`. `tests/test_contract_parity`
evaluates the TypeScript `isPermissionAllowed` over every role, permission and context
combination and requires this function to agree on all of them. Deny by default: a permission
absent from the matrix is never allowed, and scope is always required.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

_BASE_PERMISSIONS: Final[dict[str, tuple[str, ...]]] = {
    "collector": (
        "recovery_record:create",
        "recovery_record:correct_own",
        "recovery_record:view_own",
    ),
    "recycler": (
        "recovery_record:view_operational",
        "handoff:record",
        "handoff:accept",
        "processing:record",
        "processing:complete",
    ),
    "programme_reviewer": (
        "recovery_record:view_operational",
        "review:flag",
        "review:evidence",
        "review:approve",
        "review:reject",
        "review:request_correction",
        "personal_data:view",
    ),
    "programme_manager": (
        "recovery_record:view_operational",
        "programme_report:view",
        "programme_data:export",
        "personal_data:view",
    ),
    "safety_content_administrator": ("safety_content:manage",),
    "data_ml_reviewer": ("model_correction:review", "model_performance:view"),
}

ROLE_PERMISSIONS: Final[dict[str, frozenset[str]]] = {
    role: frozenset(permissions) for role, permissions in _BASE_PERMISSIONS.items()
}


@dataclass(frozen=True)
class AuthorizationContext:
    owns_resource: bool = False
    assigned_programme: bool = False
    assigned_facility: bool = False
    assigned_review: bool = False
    personal_data_required: bool = False


def role_has_permission(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, frozenset())


def _has_required_scope(role: str, permission: str, context: AuthorizationContext) -> bool:
    if permission in ("recovery_record:view_own", "recovery_record:correct_own"):
        return role == "collector" and context.owns_resource
    if role == "recycler":
        return context.assigned_facility
    if role == "programme_reviewer":
        return context.assigned_programme and context.assigned_review
    if role == "programme_manager":
        return context.assigned_programme
    return True


def is_permission_allowed(role: str, permission: str, context: AuthorizationContext) -> bool:
    if not role_has_permission(role, permission):
        return False
    if context.personal_data_required and not role_has_permission(role, "personal_data:view"):
        return False
    return _has_required_scope(role, permission, context)
