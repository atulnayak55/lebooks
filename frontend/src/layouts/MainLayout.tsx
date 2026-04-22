import { useState } from "react";
import type { ReactNode } from "react";
import { AuthDialog } from "../features/auth/AuthDialog";
import {
  clearAuthSession,
  getAuthSession,
  saveAuthSession,
  type AuthSession,
} from "../features/auth/session";

type MainLayoutProps = {
  children: ReactNode;
  currentView: "listings" | "inbox";
  onViewChange: (view: "listings" | "inbox") => void;
};

export function MainLayout({ children, currentView, onViewChange }: MainLayoutProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());

  function handleSignedIn(nextSession: AuthSession) {
    saveAuthSession(nextSession);
    setSession(nextSession);
  }

  function handleSignOut() {
    clearAuthSession();
    setSession(null);
    onViewChange("listings");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-row">
          <p className="app-kicker">UniPd Marketplace</p>
          <div className="auth-area">
            <button
              className="auth-signin"
              onClick={() => onViewChange("listings")}
              style={{
                background: currentView === "listings" ? "#cbd5e1" : "transparent",
                color: currentView === "listings" ? "#0f172a" : "inherit",
              }}
            >
              Marketplace
            </button>

            {session ? (
              <>
                <button
                  className="auth-signin"
                  onClick={() => onViewChange("inbox")}
                  style={{
                    background: currentView === "inbox" ? "#cbd5e1" : "transparent",
                    color: currentView === "inbox" ? "#0f172a" : "inherit",
                  }}
                >
                  Inbox
                </button>
                <span className="auth-email">{session.email}</span>
                <button type="button" className="auth-signout" onClick={handleSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <button type="button" className="auth-signin" onClick={() => setDialogOpen(true)}>
                Sign in
              </button>
            )}
          </div>
        </div>
        <h1>{currentView === "listings" ? "Book Listings" : "My Inbox"}</h1>
        <p className="app-subtitle">
          {currentView === "listings"
            ? "Browse books by department, program, and course."
            : "View and respond to your active chats."}
        </p>
      </header>
      <main className="app-content">{children}</main>
      <AuthDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSignedIn={handleSignedIn}
      />
    </div>
  );
}