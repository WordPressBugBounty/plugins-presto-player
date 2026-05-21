import { useState, useEffect } from "react";
import { RouterProvider } from "./router/router";
import { Toaster } from "@bsf/force-ui";
import Routes from "./Routes";
import Onboarding from "./pages/Onboarding";

// Single Toaster config for every tab. Pin to the extreme top-right just
// under the WP admin bar so the toast lands on the navbar corner, and keep
// the z-index above every Dialog overlay (999999) so it's never hidden
// behind a backdrop. The admin-bar CSS var automatically shifts to 46px on
// screens ≤782px, so the offset stays correct on small screens too.
const AppToaster = () => (
  <Toaster
    position="top-right"
    dismissAfter={3000}
    className="!top-[var(--presto-admin-bar-h)] !p-4 !z-[1000050]"
  />
);

export default () => {
  const prestoData = window.prestoPlayer || {};
  const shouldShowOnboarding =
    !prestoData.onboarding_completed || prestoData.onboarding_redirect;

  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);

  useEffect(() => {
    if (showOnboarding) {
      document.body.classList.add("presto-player-onboarding-page");
    }
    return () => {
      document.body.classList.remove("presto-player-onboarding-page");
    };
  }, [showOnboarding]);

  if (showOnboarding) {
    return (
      <RouterProvider>
        <AppToaster />
        <Onboarding />
      </RouterProvider>
    );
  }

  return (
    <RouterProvider>
      <AppToaster />
      <Routes />
    </RouterProvider>
  );
};
