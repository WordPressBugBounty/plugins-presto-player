import { useState } from "react";
import wpApiFetch from "@wordpress/api-fetch";

const useCompleteOnboarding = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeOnboarding = async (redirectUrl) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await wpApiFetch({
        path: "/presto-player/v1/onboarding/set-status",
        method: "POST",
        data: { completed: "yes" },
      });
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }

    window.location.href = redirectUrl;
  };

  return { completeOnboarding, isSubmitting };
};

export default useCompleteOnboarding;
