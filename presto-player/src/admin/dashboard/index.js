import { createRoot } from "@wordpress/element";

/**
 * App
 */
import App from "./App";

/**
 * styles
 */
import "./main.scss";

/**
 * Render
 */
const container = document.getElementById("presto-admin-dashboard");
if (container) {
  createRoot(container).render(<App />);
}
