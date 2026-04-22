import { useState } from "react";
import { MainLayout } from "./layouts/MainLayout";
import { ListingsPage } from "./pages/ListingsPage";
import { InboxPage } from "./pages/InboxPage"; // <-- Import it
import "./App.css";
import "./pages/ListingsPage.css";
import "./pages/InboxPage.css"; // <-- Import styles

function App() {
  const [currentView, setCurrentView] = useState<"listings" | "inbox">("listings");

  return (
    <MainLayout currentView={currentView} onViewChange={setCurrentView}>
      {currentView === "listings" ? <ListingsPage /> : <InboxPage />}
    </MainLayout>
  );
}

export default App;