import type { ReactNode } from "react";
import { AuthDialog } from "../features/auth/AuthDialog";
import lebooksLogo from "../assets/lebooks.png";
import { useI18n } from "../i18n/useI18n";
import type { AppView } from "../types/navigation";
import {
  clearAuthSession,
  saveAuthSession,
  type AuthSession,
} from "../features/auth/session";

type MainLayoutProps = {
  children: ReactNode;
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  session: AuthSession | null;
  onSessionChange: (session: AuthSession | null) => void;
  unreadInboxCount: number;
  authDialogOpen: boolean;
  onAuthDialogOpen: () => void;
  onAuthDialogClose: () => void;
};

export function MainLayout({
  children,
  currentView,
  onViewChange,
  session,
  onSessionChange,
  unreadInboxCount,
  authDialogOpen,
  onAuthDialogOpen,
  onAuthDialogClose,
}: MainLayoutProps) {
  const { language, setLanguage, t } = useI18n();

  function handleSignedIn(nextSession: AuthSession) {
    saveAuthSession(nextSession);
    onSessionChange(nextSession);
    onAuthDialogClose();
  }

  function handleSignOut() {
    clearAuthSession();
    onSessionChange(null);
    onViewChange("listings");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-row">
          <button
            type="button"
            className="brand-lockup"
            onClick={() => onViewChange("listings")}
            aria-label={t("nav.marketplace")}
          >
            <div className="brand-logo-shell">
              <img src={lebooksLogo} alt="lebooks logo" className="brand-logo" />
            </div>
          </button>
          <nav className="auth-area" aria-label="Primary navigation">
            <button
              className={`nav-link ${currentView === "listings" ? "active" : ""}`}
              onClick={() => onViewChange("listings")}
            >
              {t("nav.marketplace")}
            </button>

            {session ? (
              <>
                <button
                  className={`nav-link ${currentView === "inbox" ? "active" : ""}`}
                  onClick={() => onViewChange("inbox")}
                >
                  <span className="nav-button-label">{t("nav.inbox")}</span>
                  {unreadInboxCount > 0 ? (
                    <span
                      className="inbox-badge"
                      aria-label={t("nav.unreadMessages", { count: unreadInboxCount })}
                    >
                      {unreadInboxCount > 99 ? "99+" : unreadInboxCount}
                    </span>
                  ) : null}
                </button>
                <button
                  className={`nav-link ${currentView === "mylistings" ? "active" : ""}`}
                  onClick={() => onViewChange("mylistings")}
                >
                  {t("nav.myListings")}
                </button>
              </>
            ) : null}
          </nav>
          <div className="header-actions">
            <div className="language-switcher" role="group" aria-label={t("language.label")}>
              <button
                type="button"
                className={`language-button ${language === "en" ? "active" : ""}`}
                onClick={() => setLanguage("en")}
              >
                {t("language.english")}
              </button>
              <button
                type="button"
                className={`language-button ${language === "it" ? "active" : ""}`}
                onClick={() => setLanguage("it")}
              >
                {t("language.italian")}
              </button>
            </div>
            {session ? (
              <>
                <span className="auth-email">{session.email}</span>
                <button type="button" className="auth-signout" onClick={handleSignOut}>
                  {t("nav.signOut")}
                </button>
              </>
            ) : (
              <button type="button" className="auth-signin" onClick={onAuthDialogOpen}>
                {t("nav.signIn")}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="app-content">{children}</main>
      <footer className="app-footer">
        <button type="button" onClick={() => onViewChange("contact")}>
          {t("footer.contact")}
        </button>
        <button type="button" onClick={() => onViewChange("privacy")}>
          {t("footer.privacy")}
        </button>
        <span>{t("footer.pilot")}</span>
      </footer>
      <AuthDialog
        open={authDialogOpen}
        onClose={onAuthDialogClose}
        onSignedIn={handleSignedIn}
      />
    </div>
  );
}
