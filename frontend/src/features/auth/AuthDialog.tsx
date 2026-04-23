import { useState } from "react";
import axios from "axios";
import { useI18n } from "../../i18n/I18nProvider";
import {
  loginWithEmail,
  requestPasswordReset,
  resendVerification,
  startSignup,
  verifySignupOtp,
} from "./api";
import type { AuthSession } from "./session";

type AuthDialogProps = {
  open: boolean;
  onClose: () => void;
  onSignedIn: (session: AuthSession) => void;
};

type Mode = "signin" | "signup" | "forgotPassword";

export function AuthDialog({ open, onClose, onSignedIn }: AuthDialogProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [unipdId, setUnipdId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupComplete, setSignupComplete] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "signup") {
        if (!signupComplete) {
          const response = await startSignup({
            name,
            email,
            password,
            unipd_id: unipdId || undefined,
          });
          setSignupComplete(true);
          setSuccess(`${t("auth.signUpSuccess")} ${response.message}`);
          return;
        }

        await verifySignupOtp({
          email,
          otp_code: otpCode,
        });
        const loginResult = await loginWithEmail(email, password);
        onSignedIn({
          token: loginResult.access_token,
          email,
          userId: loginResult.user_id,
        });
        setOtpCode("");
        setPassword("");
        setSignupComplete(false);
        onClose();
        return;
      }

      if (mode === "forgotPassword") {
        const response = await requestPasswordReset(email);
        setSuccess(response.message);
        return;
      }

      const loginResult = await loginWithEmail(email, password);
      onSignedIn({ 
        token: loginResult.access_token, 
        email: email,
        userId: loginResult.user_id 
      });

      setPassword("");
      onClose();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = typeof error.response?.data?.detail === "string"
          ? error.response.data.detail
          : null;

        if (mode === "signin" && error.response?.status === 403) {
          setError(detail ?? t("auth.verifyRequired"));
          return;
        }

        if (mode === "forgotPassword") {
          setError(detail ?? t("auth.passwordResetError"));
          return;
        }

        if (mode === "signup") {
          setError(detail ?? t("auth.signUpError"));
          return;
        }
      }

      setError(mode === "signin" ? t("auth.signInError") : t("auth.signUpError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!email) {
      setError(t("auth.enterEmailFirst"));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await resendVerification(email);
      setSuccess(response.message);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = typeof error.response?.data?.detail === "string"
          ? error.response.data.detail
          : null;
        setError(detail ?? t("auth.resendVerificationError"));
      } else {
        setError(t("auth.resendVerificationError"));
      }
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
                setSuccess(null);
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
                setSuccess(null);
                setSignupComplete(false);
                setOtpCode("");
              }}
            >
              {t("auth.signUp")}
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === "forgotPassword" ? "active" : ""}`}
              onClick={() => {
                setMode("forgotPassword");
                setError(null);
                setSuccess(null);
              }}
            >
              {t("auth.forgotPassword")}
            </button>
          </div>
          <button type="button" className="auth-close" onClick={onClose} aria-label={t("auth.close")}>
            x
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <>
              {!signupComplete ? (
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
            </>
          ) : null}

          <label>
            <span>{t("auth.email")}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={mode === "signup" && signupComplete}
            />
          </label>

          {mode !== "forgotPassword" && !(mode === "signup" && signupComplete) ? (
            <label>
              <span>{t("auth.password")}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
          ) : null}

          {mode === "signup" && signupComplete ? (
            <label>
              <span>{t("auth.otpCode")}</span>
              <input
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder={t("auth.otpPlaceholder")}
                required
              />
            </label>
          ) : null}

          {error ? <p className="auth-error">{error}</p> : null}
          {success ? <p className="auth-success">{success}</p> : null}

          {mode === "signin" ? (
            <button
              type="button"
              className="auth-link-button"
              onClick={() => {
                setMode("forgotPassword");
                setError(null);
                setSuccess(null);
              }}
            >
              {t("auth.forgotPassword")}
            </button>
          ) : null}

          {mode === "signup" && signupComplete ? (
            <button type="button" className="auth-link-button" onClick={handleResendVerification}>
              {t("auth.resendOtp")}
            </button>
          ) : null}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? t("auth.pleaseWait")
              : mode === "signup"
                ? signupComplete
                  ? t("auth.verifyOtpButton")
                  : t("auth.createAccount")
                : mode === "forgotPassword"
                  ? t("auth.sendResetLink")
                  : t("auth.signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}
