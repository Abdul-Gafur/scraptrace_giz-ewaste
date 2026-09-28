"use client";

import { useAuthenticationOptional } from "@/auth/auth-session";
import { demoActorFor, toActorReference } from "@/auth/actors";
import { useDevelopmentSession } from "@/auth/session";
import type { Session } from "@/services/ports/service-ports";

/**
 * The acting identity for display: the authenticated session in HTTP mode, or the development
 * actor of the current workspace in mock mode. Authorisation never relies on this value.
 */
export function useActingIdentity(): Pick<
  Session,
  "actorId" | "actorReference" | "facilityIds" | "receivingLocationIds"
> {
  const session = useAuthenticationOptional()?.session ?? null;
  const { role } = useDevelopmentSession();
  if (session && session.role === role) return session;
  const actor = demoActorFor(role);
  return {
    actorId: actor.actorId,
    actorReference: toActorReference(actor),
    facilityIds: actor.facilityId ? [actor.facilityId] : [],
    receivingLocationIds: actor.locationIds,
  };
}
