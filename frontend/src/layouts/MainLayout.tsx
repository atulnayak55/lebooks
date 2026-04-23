import { useState } from "react";
import type { ReactNode } from "react";
import { AuthDialog } from "../features/auth/AuthDialog";
import {
  clearAuthSession,
  saveAuthSession,
  type AuthSession,
} from "../features/auth/session";

type MainLayoutProps = {
  children: ReactNode;
  currentView: "listings" | "inbox" | "mylistings";
  onViewChange: (view: "listings" | "inbox" | "mylistings") => void;
  session: AuthSession | null;
  onSessionChange: (session: AuthSession | null) => void;
};

export function MainLayout({
  children,
  currentView,
  onViewChange,
  session,
  onSessionChange,
}: MainLayoutProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleSignedIn(nextSession: AuthSession) {
    saveAuthSession(nextSession);
    onSessionChange(nextSession);
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
                <button
                  className="auth-signin"
                  onClick={() => onViewChange("mylistings")}
                  style={{
                    background: currentView === "mylistings" ? "#cbd5e1" : "transparent",
                    color: currentView === "mylistings" ? "#0f172a" : "inherit",
                  }}
                >
                  My Listings
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
        <h1>
          {currentView === "listings" ? "Book Listings" : null}
          {currentView === "inbox" ? "My Inbox" : null}
          {currentView === "mylistings" ? "My Listings" : null}
        </h1>
        <p className="app-subtitle">
          {currentView === "listings"
            ? "Browse books by department, program, and course."
            : null}
          {currentView === "inbox" ? "View and respond to your active chats." : null}
          {currentView === "mylistings" ? "Manage your active book inventory." : null}
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
