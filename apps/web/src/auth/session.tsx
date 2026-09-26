"use client";

import { UserRoleSchema, type SupportedLanguage, type UserRole } from "@scraptrace/contracts";
import { useLocale } from "next-intl";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

import { useProgrammeMutation, useSession } from "@/services/queries";

interface DevelopmentSession {
  readonly role: UserRole;
  readonly developmentOnly: true;
}

const DevelopmentSessionContext = createContext<DevelopmentSession | null>(null);

/**
 * Holds the role whose workspace is open and keeps the stored session in step with it.
 *
 * Opening a workspace directly adopts its role, as this preview has always done. The stored
 * session exists so work can be attributed to an actor — a record's collector, a decision's
 * reviewer, a card's approver — not to grant access: the backend authorizes every request.
 */
export function DevelopmentSessionProvider({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const validatedRole = UserRoleSchema.parse(role);
  const locale = useLocale() as SupportedLanguage;
  const { data: session, isPending } = useSession();
  const signIn = useProgrammeMutation(
    (services, input: { role: UserRole; language: SupportedLanguage }) =>
      services.authentication.signIn(input.role, input.language),
  );
  const requested = useRef<UserRole | null>(null);

  useEffect(() => {
    if (isPending || session?.role === validatedRole || requested.current === validatedRole) return;
    requested.current = validatedRole;
    signIn.mutate({ role: validatedRole, language: locale });
  }, [isPending, locale, session?.role, signIn, validatedRole]);

  return (
    <DevelopmentSessionContext.Provider value={{ role: validatedRole, developmentOnly: true }}>
      {children}
    </DevelopmentSessionContext.Provider>
  );
}

export function useDevelopmentSession(): DevelopmentSession {
  const session = useContext(DevelopmentSessionContext);
  if (!session) throw new Error("DevelopmentSessionProvider is missing.");
  return session;
}

/** Short operator label used where a person must be named, for example a card approver. */
export function useActorLabel(prefix: string): string {
  const { data: session } = useSession();
  return `${prefix}-${(session?.actorId ?? "000000").slice(-2).toUpperCase()}`;
}
