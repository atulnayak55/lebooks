import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "./layouts/MainLayout";
import { ListingsPage } from "./pages/ListingsPage";
import { InboxPage } from "./pages/InboxPage";
import { MyListingsPage } from "./pages/MyListingsPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { getAuthSession, type AuthSession } from "./features/auth/session";
import { useWebSocket, type WebSocketMessage } from "./hooks/useWebSocket";
import { useI18n } from "./i18n/useI18n";
import { viewFromPath, viewPaths, type AppView } from "./types/navigation";
import "./App.css";
import "./pages/ListingsPage.css";
import "./pages/InboxPage.css";

function ContactPage() {
  const { t } = useI18n();

  return (
    <section className="info-page" aria-labelledby="contact-title">
      <div className="info-page-header">
        <p>{t("contact.kicker")}</p>
        <h1 id="contact-title">{t("contact.title")}</h1>
      </div>
      <div className="info-page-body">
        <p>
          {t("contact.body1")}{" "}
          <a href="mailto:info@lebooks.it">info@lebooks.it</a>.
        </p>
        <p>{t("contact.body2")}</p>
        <address>
          {t("contact.addressLabel")}
          <br />
          Via Fulvio Testi, 16
          <br />
          35125 Padova PD
          <br />
          Italy
        </address>
      </div>
    </section>
  );
}

function PrivacyPage() {
  const { t } = useI18n();
  const sections = [
    "controller",
    "data",
    "purposes",
    "legalBases",
    "recipients",
    "retention",
    "rights",
    "security",
    "cookies",
    "automated",
    "complaints",
    "changes",
  ];

  return (
    <section className="info-page" aria-labelledby="privacy-title">
      <div className="info-page-header">
        <p>{t("privacy.updated")}</p>
        <h1 id="privacy-title">{t("privacy.title")}</h1>
      </div>
      <div className="info-page-body">
        <p>{t("privacy.intro")}</p>
        {sections.map((section) => (
          <section className="privacy-section" key={section}>
            <h2>{t(`privacy.${section}.title`)}</h2>
            <p>{t(`privacy.${section}.body`)}</p>
          </section>
        ))}
      </div>
    </section>
  );
}

function AppShell() {
  const [currentView, setCurrentView] = useState<AppView>(() =>
    viewFromPath(window.location.pathname),
  );
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());
  const [readIncomingMessageIds, setReadIncomingMessageIds] = useState<Set<number>>(() => new Set());
  const [authDialogOpen, setAuthDialogOpen] = useState(() => window.location.pathname === "/signin");
  const chatConnection = useWebSocket(session?.userId, session?.token);

  useEffect(() => {
    function handlePopState() {
      setCurrentView(viewFromPath(window.location.pathname));
      setAuthDialogOpen(window.location.pathname === "/signin");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function updateBrowserPath(path: string, replace = false) {
    if (window.location.pathname === path) {
      return;
    }

    const nextUrl = `${path}${window.location.search}`;
    if (replace) {
      window.history.replaceState(null, "", nextUrl);
      return;
    }

    window.history.pushState(null, "", nextUrl);
  }

  const unreadCount = useMemo(() => {
    if (!session || currentView === "inbox") {
      return 0;
    }

    return chatConnection.messages.filter((message) => {
      return (
        message.id !== undefined &&
        message.sender_id !== session.userId &&
        !readIncomingMessageIds.has(message.id)
      );
    }).length;
  }, [chatConnection.messages, currentView, readIncomingMessageIds, session]);

  function markIncomingMessagesRead(messages: WebSocketMessage[]) {
    if (!session) {
      return;
    }

    setReadIncomingMessageIds((currentIds) => {
      const nextIds = new Set(currentIds);
      for (const message of messages) {
        if (message.id !== undefined && message.sender_id !== session.userId) {
          nextIds.add(message.id);
        }
      }
      return nextIds;
    });
  }

  function handleViewChange(view: AppView) {
    if (currentView === "inbox" || view === "inbox") {
      markIncomingMessagesRead(chatConnection.messages);
    }
    setCurrentView(view);
    setAuthDialogOpen(false);
    updateBrowserPath(viewPaths[view]);
  }

  function handleSessionChange(nextSession: AuthSession | null) {
    setSession(nextSession);
    setReadIncomingMessageIds(new Set());
  }

  function handleSignInOpen() {
    setAuthDialogOpen(true);
    updateBrowserPath("/signin");
  }

  function handleAuthDialogClose() {
    setAuthDialogOpen(false);
    if (window.location.pathname === "/signin") {
      updateBrowserPath(viewPaths[currentView], true);
    }
  }

  return (
    <MainLayout
      currentView={currentView}
      onViewChange={handleViewChange}
      session={session}
      onSessionChange={handleSessionChange}
      unreadInboxCount={unreadCount}
      authDialogOpen={authDialogOpen}
      onAuthDialogOpen={handleSignInOpen}
      onAuthDialogClose={handleAuthDialogClose}
    >
      {currentView === "listings" ? (
        <ListingsPage authSession={session} chatConnection={chatConnection} />
      ) : null}
      {currentView === "inbox" ? <InboxPage session={session} chatConnection={chatConnection} /> : null}
      {currentView === "mylistings" ? <MyListingsPage session={session} /> : null}
      {currentView === "contact" ? <ContactPage /> : null}
      {currentView === "privacy" ? <PrivacyPage /> : null}
    </MainLayout>
  );
}

function App() {
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";

  if (currentPath === "/reset-password") {
    return <ResetPasswordPage />;
  }

  return <AppShell />;
}

export default App;
