import { useMemo, useState } from "react";
import axios from "axios";

import { resetPassword } from "../features/auth/api";
import { useI18n } from "../i18n/I18nProvider";

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
      if (axios.isAxiosError(error)) {
        const detail = typeof error.response?.data?.detail === "string"
          ? error.response.data.detail
          : null;
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
              required
            />
          </label>

          <label>
            <span>{t("auth.confirmPassword")}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
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
