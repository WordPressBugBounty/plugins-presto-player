import { useEffect, useState } from "react";
import wpApiFetch from "@wordpress/api-fetch";

// Shared across hook instances so the topbar Exit can't race a step's own
// finish request (e.g. Activate License on the premium step), and so every
// instance's `isSubmitting` tracks the real guard — the topbar Exit disables
// while ANY step's request is in flight, not just its own.
// INVARIANT: every submit path below ends in a navigation, so the guard
// never resets in the browser. If you add a submit that doesn't navigate,
// reset the guard in its finally — otherwise it latches and blocks forever.
let inFlight = false;
const listeners = new Set();

const setInFlight = (value) => {
  inFlight = value;
  listeners.forEach((notify) => notify());
};

// jsdom doesn't unload pages, so specs reset the guard between cases.
export const __resetInFlightForTests = () => {
  setInFlight(false);
};

const useCompleteOnboarding = () => {
  const [isSubmitting, setIsSubmitting] = useState(inFlight);

  // Track the shared guard so isSubmitting reflects any instance's request,
  // keeping the topbar Exit disabled while another step is mid-submit.
  useEffect(() => {
    const notify = () => setIsSubmitting(inFlight);
    listeners.add(notify);
    notify();
    return () => {
      listeners.delete(notify);
    };
  }, []);

  const setStatus = async (data, redirectUrl) => {
    if (inFlight) return;
    setInFlight(true);

    try {
      await wpApiFetch({
        path: "/presto-player/v1/onboarding/set-status",
        method: "POST",
        data,
      });
    } catch (error) {
      console.error("Error saving onboarding status:", error);
    }

    window.location.href = redirectUrl;
  };

  const completeOnboarding = (redirectUrl) =>
    setStatus({ status: "completed" }, redirectUrl);

  // Pass the step id the user bailed on, or null when exiting from the
  // done step (that's a completion, not a skip).
  const exitOnboarding = (skippedOnStep) =>
    setStatus(
      skippedOnStep
        ? { status: "skipped", skipped_on_step: skippedOnStep }
        : { status: "completed" },
      window.prestoPlayer?.dashboardUrl || "admin.php?page=presto-dashboard"
    );

  return { completeOnboarding, exitOnboarding, isSubmitting };
};

export default useCompleteOnboarding;
