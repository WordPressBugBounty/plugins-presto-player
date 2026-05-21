import { useEffect } from "react";
import { useLocation } from "../router/router";

/**
 * Syncs the WordPress admin sidebar submenu highlight with the active
 * dashboard tab. When the user navigates via the in-app Navbar tabs,
 * the URL changes via pushState but the server-rendered sidebar doesn't
 * update. This component listens for tab changes and toggles the
 * 'current' CSS class on the matching sidebar <li>.
 *
 * Follows the same pattern as SureDash's AdminMenuSync component.
 */
const AdminMenuSync = () => {
  const location = useLocation();
  const currentTab = location.params?.tab;

  useEffect(() => {
    const pageSlug = "presto-dashboard";
    // The Dashboard submenu's href has no `tab` param, so treat the
    // "Dashboard" tab (and the bare URL) as the same target.
    const pageUrl = currentTab && currentTab !== "Dashboard"
      ? `admin.php?page=${pageSlug}&tab=${currentTab}`
      : `admin.php?page=${pageSlug}`;

    // Find matching sidebar link by href suffix.
    const matchingLinks = document.querySelectorAll(
      `.wp-submenu-wrap li > a[href$="${pageUrl}"]`
    );

    // Remove 'current' from all submenu items under our menu.
    document
      .querySelectorAll("#toplevel_page_presto-dashboard .wp-submenu li")
      .forEach((li) => li.classList.remove("current"));

    // Add 'current' to matching item(s).
    matchingLinks.forEach((a) => {
      a.parentElement.classList.add("current");
    });
  }, [currentTab]);

  return null;
};

export default AdminMenuSync;
