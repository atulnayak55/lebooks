import { useMemo, useState } from "react";
import { MainLayout } from "./layouts/MainLayout";
import { ListingsPage } from "./pages/ListingsPage";
import { InboxPage } from "./pages/InboxPage"; // <-- Import it
import { MyListingsPage } from "./pages/MyListingsPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { getAuthSession, type AuthSession } from "./features/auth/session";
import { useWebSocket, type WebSocketMessage } from "./hooks/useWebSocket";
import "./App.css";
import "./pages/ListingsPage.css";
import "./pages/InboxPage.css"; // <-- Import styles

function App() {
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
  const [currentView, setCurrentView] = useState<"listings" | "inbox" | "mylistings">("listings");
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());
  const [readIncomingMessageIds, setReadIncomingMessageIds] = useState<Set<number>>(() => new Set());
  const chatConnection = useWebSocket(session?.userId, session?.token);

  if (currentPath === "/reset-password") {
    return <ResetPasswordPage />;
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

  function handleViewChange(view: "listings" | "inbox" | "mylistings") {
    if (currentView === "inbox" || view === "inbox") {
      markIncomingMessagesRead(chatConnection.messages);
    }
    setCurrentView(view);
  }

  function handleSessionChange(nextSession: AuthSession | null) {
    setSession(nextSession);
    setReadIncomingMessageIds(new Set());
  }

  return (
    <MainLayout
      currentView={currentView}
      onViewChange={handleViewChange}
      session={session}
      onSessionChange={handleSessionChange}
      unreadInboxCount={unreadCount}
    >
      {currentView === "listings" ? (
        <ListingsPage authSession={session} chatConnection={chatConnection} />
      ) : null}
      {currentView === "inbox" ? <InboxPage session={session} chatConnection={chatConnection} /> : null}
      {currentView === "mylistings" ? <MyListingsPage session={session} /> : null}
    </MainLayout>
  );
}

export default App;
