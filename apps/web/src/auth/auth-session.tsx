"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createContext, useContext } from "react";

import { SESSION_EXPIRED_EVENT } from "@/services/http/http-client";
import type { AuthenticationService, Session, SignInInput } from "@/services/ports/service-ports";

type AuthenticationStatus = "loading" | "authenticated" | "anonymous" | "error";

interface AuthenticationContextValue {
  readonly session: Session | null;
  readonly status: AuthenticationStatus;
  readonly error: unknown;
  readonly refresh: () => Promise<Session | null>;
  readonly signIn: (input: SignInInput) => Promise<Session>;
  readonly signOut: () => Promise<void>;
}

const AuthenticationContext = createContext<AuthenticationContextValue | null>(null);

export function AuthenticationProvider({
  authentication,
  children,
}: {
  readonly authentication: AuthenticationService;
  readonly children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthenticationStatus>("loading");
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const restored = await authentication.getSession();
      setSession(restored);
      setStatus(restored ? "authenticated" : "anonymous");
      return restored;
    } catch (failure) {
      setSession(null);
      setError(failure);
      setStatus("error");
      return null;
    }
  }, [authentication]);

  useEffect(() => {
    let active = true;
    void authentication
      .getSession()
      .then((restored) => {
        if (!active) return;
        setSession(restored);
        setStatus(restored ? "authenticated" : "anonymous");
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setSession(null);
        setError(failure);
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [authentication]);

  useEffect(() => {
    const expire = () => {
      setSession(null);
      setStatus("anonymous");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, []);

  const value = useMemo<AuthenticationContextValue>(
    () => ({
      session,
      status,
      error,
      refresh,
      async signIn(input) {
        setError(null);
        const authenticated = await authentication.signIn(input);
        setSession(authenticated);
        setStatus("authenticated");
        return authenticated;
      },
      async signOut() {
        await authentication.signOut();
        setSession(null);
        setStatus("anonymous");
      },
    }),
    [authentication, error, refresh, session, status],
  );

  return <AuthenticationContext.Provider value={value}>{children}</AuthenticationContext.Provider>;
}

export function useAuthentication(): AuthenticationContextValue {
  const value = useContext(AuthenticationContext);
  if (!value) throw new Error("AuthenticationProvider is missing.");
  return value;
}

export function useAuthenticationOptional(): AuthenticationContextValue | null {
  return useContext(AuthenticationContext);
}
