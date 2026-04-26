import { useMemo, useState } from "react";
import axios from "axios";

import { resetPassword } from "../features/auth/api";
import { useI18n } from "../i18n/useI18n";

function getErrorDetail(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const detail = error.response?.data?.detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        return "msg" in item && typeof item.msg === "string" ? item.msg : null;
      })
      .filter((message): message is string => Boolean(message));

    return messages.length > 0 ? messages.join(" ") : null;
  }

  return null;
}

export function ResetPasswordPage() {
  const { t } = useI18n();
  const token = useMemo(() => {
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError(t("auth.resetMissingToken"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const response = await resetPassword(token, password);
      setSuccess(response.message);
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } catch (error) {
      const detail = getErrorDetail(error);
      if (detail || axios.isAxiosError(error)) {
        setError(detail ?? t("auth.resetPasswordError"));
      } else {
        setError(t("auth.resetPasswordError"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="reset-password-shell">
      <div className="reset-password-card">
        <h1>{t("auth.resetPasswordTitle")}</h1>
        <p className="reset-password-copy">{t("auth.resetPasswordSubtitle")}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>{t("auth.newPassword")}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>

          <label>
            <span>{t("auth.confirmPassword")}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>

          {error ? <p className="auth-error">{error}</p> : null}
          {success ? <p className="auth-success">{success}</p> : null}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? t("auth.pleaseWait") : t("auth.resetPasswordButton")}
          </button>
        </form>
      </div>
    </section>
  );
}
