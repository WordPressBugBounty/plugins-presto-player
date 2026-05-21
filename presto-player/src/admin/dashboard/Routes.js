const { __ } = wp.i18n;

import { useLocation } from "./router/router";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Emails from "./pages/Emails";
import MediaHub from "./pages/MediaHub";
import Analytics from "./pages/Analytics";
import AnalyticsDetail from "./pages/AnalyticsDetail";
import UserAnalyticsDetail from "./pages/UserAnalyticsDetail";
import Settings from "./pages/Settings";
import Learn from "./pages/Learn";
import AdminMenuSync from "./components/AdminMenuSync";

const Routes = () => {
  const location = useLocation();
  const currentTab = location.params?.tab || "dashboard";
  const detail = location.params?.detail;
  const id = location.params?.id;

  const render = () => {
    switch (currentTab) {
      case "dashboard":
      case "Dashboard":
        return <Dashboard />;
      case "Emails":
        return <Emails />;
      case "MediaHub":
        return <MediaHub />;
      case "Analytics":
        if (detail === "user" && id) {
          return <UserAnalyticsDetail />;
        }
        if (detail === "media" && id) {
          return <AnalyticsDetail />;
        }
        return <Analytics />;
      case "Settings":
        return <Settings />;
      case "Learn":
        return <Learn />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="presto-dashboard flex flex-col flex-1 min-h-0">
      <AdminMenuSync />
      <Navbar />
      {render()}
    </div>
  );
};

export default Routes;
