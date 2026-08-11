import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  /**
   * auth.me answers `null` when nobody is signed in, so a *failed* request is
   * a different thing entirely: it means we could not ask, not that the answer
   * was no. It used to be `retry: false`, and every caller treated "no user"
   * as "signed out" - so one dropped request on a phone logged people out.
   *
   * Transient failures are retried; an explicit UNAUTHORIZED is not, because
   * repeating it would only get the same answer more slowly.
   */
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: (failureCount, error) => {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return false;
      }
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      return;
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        utils.auth.me.setData(undefined, null);
        await utils.auth.me.invalidate();
        return;
      }
      throw error;
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    // The query answered, and the answer was "nobody". Anything else - still
    // loading, or errored - is not evidence that the visitor is signed out,
    // and callers must not turn it into one.
    const answeredSignedOut =
      meQuery.isSuccess && (meQuery.data ?? null) === null;

    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
      isSignedOut: answeredSignedOut,
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    meQuery.isSuccess,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (logoutMutation.isPending) return;
    // Only on a definite "signed out". A request that is still in flight, or
    // that failed, must not throw anyone back to the login page.
    if (!state.isSignedOut) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    state.isSignedOut,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
