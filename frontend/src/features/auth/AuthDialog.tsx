import { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { loginWithEmail, registerUser } from "./api";
import type { AuthSession } from "./session";

type AuthDialogProps = {
  open: boolean;
  onClose: () => void;
  onSignedIn: (session: AuthSession) => void;
};

type Mode = "signin" | "signup";

export function AuthDialog({ open, onClose, onSignedIn }: AuthDialogProps) {
  const { t } = useI18n();
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
          ? t("auth.signUpError")
          : t("auth.signInError"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-label={t("auth.dialog")}>
      <div className="auth-dialog">
        <div className="auth-topbar">
          <div className="auth-tabs" role="tablist" aria-label={t("auth.actions")}>
            <button
              type="button"
              className={`auth-tab ${mode === "signin" ? "active" : ""}`}
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
            >
              {t("auth.signIn")}
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === "signup" ? "active" : ""}`}
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
            >
              {t("auth.signUp")}
            </button>
          </div>
          <button type="button" className="auth-close" onClick={onClose} aria-label={t("auth.close")}>
            x
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <>
              <label>
                <span>{t("auth.name")}</span>
                <input value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <label>
                <span>{t("auth.unipdId")}</span>
                <input value={unipdId} onChange={(event) => setUnipdId(event.target.value)} />
              </label>
            </>
          ) : null}

          <label>
            <span>{t("auth.email")}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            <span>{t("auth.password")}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <p className="auth-error">{error}</p> : null}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? t("auth.pleaseWait")
              : mode === "signup"
                ? t("auth.createAccount")
                : t("auth.signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}
