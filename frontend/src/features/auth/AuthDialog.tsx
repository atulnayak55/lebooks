import { useState } from "react";
import { loginWithEmail, registerUser } from "./api";
import type { AuthSession } from "./session";

type AuthDialogProps = {
  open: boolean;
  onClose: () => void;
  onSignedIn: (session: AuthSession) => void;
};

type Mode = "signin" | "signup";

export function AuthDialog({ open, onClose, onSignedIn }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [unipdId, setUnipdId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        await registerUser({
          name,
          email,
          password,
          unipd_id: unipdId || undefined,
        });
      }

      const loginResult = await loginWithEmail(email, password);
      
      // THIS IS THE CRITICAL FIX: Passing the user_id from the backend to the session!
      onSignedIn({ 
        token: loginResult.access_token, 
        email: email,
        userId: loginResult.user_id 
      });

      setPassword("");
      onClose();
    } catch {
      setError(
        mode === "signup"
          ? "Could not sign up. Check your details and try again."
          : "Invalid email or password.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-label="Authentication">
      <div className="auth-dialog">
        <div className="auth-topbar">
          <div className="auth-tabs" role="tablist" aria-label="Auth actions">
            <button
              type="button"
              className={`auth-tab ${mode === "signin" ? "active" : ""}`}
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === "signup" ? "active" : ""}`}
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
            >
              Sign up
            </button>
          </div>
          <button type="button" className="auth-close" onClick={onClose} aria-label="Close dialog">
            x
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <>
              <label>
                <span>Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <label>
                <span>UniPd ID (optional)</span>
                <input value={unipdId} onChange={(event) => setUnipdId(event.target.value)} />
              </label>
            </>
          ) : null}

          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <p className="auth-error">{error}</p> : null}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}