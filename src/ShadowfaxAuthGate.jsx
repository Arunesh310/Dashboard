import { useCallback, useEffect, useState } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  getFirebaseAuth,
  getGoogleAuthProvider,
  isAllowedShadowfaxEmail,
  isCloudSnapshotConfigured,
  requiresShadowfaxGate,
  resolveAuthUserEmail,
} from "./lib/firebaseClient.js";
import { ShadowfaxSessionContext } from "./shadowfaxSession.jsx";

export function ShadowfaxAuthGate({ children }) {
  const gateOn = requiresShadowfaxGate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(gateOn);
  const [error, setError] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!gateOn) {
      setLoading(false);
      return;
    }
    if (!isCloudSnapshotConfigured()) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    let unsub = () => {};

    (async () => {
      try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user) {
          const em = await resolveAuthUserEmail(redirectResult.user);
          if (!em || !isAllowedShadowfaxEmail(em)) {
            await signOut(auth).catch(() => {});
            setError(
              em
                ? "Only @shadowfax.in accounts can access this dashboard."
                : "Could not read your email from Google."
            );
            setLoading(false);
          }
        }
      } catch {
        /* ignore invalid/expired redirect */
      }

      unsub = onAuthStateChanged(auth, async (u) => {
        if (!u) {
          setUser(null);
          setLoading(false);
          return;
        }
        const resolved = await resolveAuthUserEmail(u);
        if (!resolved || !isAllowedShadowfaxEmail(resolved)) {
          try {
            await signOut(auth);
          } catch {
            /* ignore */
          }
          setUser(null);
          setError(
            resolved
              ? "Only @shadowfax.in accounts can access this dashboard."
              : "Could not read your email from Google."
          );
          setLoading(false);
          return;
        }
        setError("");
        setUser(u);
        setLoading(false);
      });
    })();

    return () => unsub();
  }, [gateOn]);

  async function handleGoogleSignIn() {
    setError("");
    if (!isCloudSnapshotConfigured()) {
      setError("Firebase is not configured. Set VITE_FIREBASE_* in your environment.");
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) return;
    setGoogleBusy(true);
    try {
      const cred = await signInWithPopup(auth, getGoogleAuthProvider());
      const resolved = await resolveAuthUserEmail(cred.user);
      if (!resolved || !isAllowedShadowfaxEmail(resolved)) {
        await signOut(auth).catch(() => {});
        setError(
          resolved
            ? "Only @shadowfax.in accounts can access this dashboard."
            : "Could not read your email from Google."
        );
        return;
      }
      setError("");
      setUser(cred.user);
      setLoading(false);
    } catch (err) {
      const code = err?.code;
      if (code === "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled.");
      } else if (code === "auth/popup-blocked") {
        setError("Pop-up was blocked. Allow pop-ups for this site and try again.");
      } else if (code === "auth/cancelled-popup-request") {
        /* another popup already open */
      } else if (code === "auth/account-exists-with-different-credential") {
        setError(
          "This account was created with a different sign-in method. Ask an admin to reset your auth or use the same method you used before."
        );
      } else {
        setError(err.message || "Google sign-in failed.");
      }
    } finally {
      setGoogleBusy(false);
    }
  }

  const handleSignOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  }, []);

  if (!gateOn) return children;

  if (!isCloudSnapshotConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sfx-soft/80 px-4 dark:bg-slate-950">
        <div className="surface-card w-full max-w-md border-amber-200/80 dark:border-amber-900/50">
          <h1 className="text-lg font-bold text-sfx-ink dark:text-slate-100">Sign-in not available</h1>
          <p className="mt-2 text-sm text-sfx-muted dark:text-slate-400">
            <code className="text-xs">VITE_SHADOWFAX_AUTH</code> is enabled but Firebase web config is missing. Add
            all <code className="text-xs">VITE_FIREBASE_*</code> variables from <code className="text-xs">.env.example</code>.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sfx-soft/80 text-sfx-muted dark:bg-slate-950 dark:text-slate-400">
        <p className="text-sm font-medium">Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sfx-soft/80 px-4 dark:bg-slate-950">
        <div className="surface-card w-full max-w-md border-sfx/20 text-center motion-safe:animate-sfx-scale-in motion-reduce:animate-none">
          <h1 className="text-lg font-bold text-sfx-ink dark:text-slate-100">Shadowfax sign in</h1>
          <p className="mt-1.5 text-sm text-sfx-muted dark:text-slate-400">
            for shadowfax employees only
          </p>
          <button
            type="button"
            disabled={googleBusy}
            onClick={handleGoogleSignIn}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200/90 bg-white py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-300 ease-sfx-smooth hover:border-sfx/30 hover:bg-sfx-soft/80 hover:shadow-md motion-safe:active:scale-[0.99] disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sfx/40 dark:hover:bg-slate-800 dark:hover:shadow-sfx-glow-dark"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {googleBusy ? "Opening Google…" : "Continue with Google"}
          </button>
          {error ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const displayEmail = user.email || user.providerData?.find((p) => p.email)?.email || "";

  return (
    <ShadowfaxSessionContext.Provider value={{ email: displayEmail, signOut: handleSignOut }}>
      {children}
    </ShadowfaxSessionContext.Provider>
  );
}
