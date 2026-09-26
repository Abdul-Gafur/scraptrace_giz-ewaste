"use client";

import { UserRoleSchema, type UserRole } from "@scraptrace/contracts";
import { createContext, useContext, type ReactNode } from "react";

interface DevelopmentSession {
  readonly role: UserRole;
  readonly developmentOnly: true;
}

const DevelopmentSessionContext = createContext<DevelopmentSession | null>(null);

export function DevelopmentSessionProvider({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const validatedRole = UserRoleSchema.parse(role);
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
