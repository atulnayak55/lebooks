import { useState } from "react";
import { MainLayout } from "./layouts/MainLayout";
import { ListingsPage } from "./pages/ListingsPage";
import { InboxPage } from "./pages/InboxPage"; // <-- Import it
import { MyListingsPage } from "./pages/MyListingsPage";
import { getAuthSession, type AuthSession } from "./features/auth/session";
import "./App.css";
import "./pages/ListingsPage.css";
import "./pages/InboxPage.css"; // <-- Import styles

function App() {
  const [currentView, setCurrentView] = useState<"listings" | "inbox" | "mylistings">("listings");
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());

  return (
    <MainLayout
      currentView={currentView}
      onViewChange={setCurrentView}
      session={session}
      onSessionChange={setSession}
    >
      {currentView === "listings" ? <ListingsPage authSession={session} /> : null}
      {currentView === "inbox" ? <InboxPage session={session} /> : null}
      {currentView === "mylistings" ? <MyListingsPage session={session} /> : null}
    </MainLayout>
  );
}

export default App;
