import { useState } from "react";
import { Button, Text, Topbar, ProgressSteps, Container } from "@bsf/force-ui";
import { X } from "lucide-react";
import wpApiFetch from "@wordpress/api-fetch";
import PrestoPlayerIcon from "../components/PrestoPlayerIcon";
import Welcome from "../components/Onboarding/Welcome";
import PremiumFeatures from "../components/Onboarding/PremiumFeatures";
import Integrations from "../components/Onboarding/Integrations";
import Done from "../components/Onboarding/Done";
import UserInfo from "../components/Onboarding/UserInfo";

const { __ } = wp.i18n;

const onboardingSteps = [
  { component: Welcome, maxWidth: "max-w-xl" },
  { component: UserInfo, maxWidth: "max-w-2xl" },
  { component: PremiumFeatures, maxWidth: "max-w-2xl" },
  { component: Integrations, maxWidth: "max-w-2xl" },
  { component: Done, maxWidth: "max-w-2xl" },
];

const VISIBLE_STEPS = 4;

const Onboarding = () => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const prestoData = window.prestoPlayer || {};
  const currentUser = prestoData.currentUser || {};
  const [userInfoData, setUserInfoData] = useState({
    firstName: currentUser.first_name || "",
    lastName: currentUser.last_name || "",
    email: currentUser.user_email || "",
    optIn: true,
  });

  const goToNextStep = () => {
    if (currentStepIndex < onboardingSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const exitOnboarding = async () => {
    try {
      await wpApiFetch({
        path: "/presto-player/v1/onboarding/set-status",
        method: "POST",
        data: { completed: "yes" },
      });
    } catch (error) {
      console.error("Error exiting onboarding:", error);
    }
    window.location.href =
      window.prestoPlayer?.dashboardUrl || "admin.php?page=presto-dashboard";
  };

  const isDoneStep = currentStepIndex >= VISIBLE_STEPS;
  const currentStep = onboardingSteps[currentStepIndex];
  const CurrentStepComponent = currentStep.component;

  return (
    <Container
      direction="column"
      gap="none"
      className="bg-background-secondary min-h-screen overflow-x-hidden"
    >
      {/* Sticky Topbar */}
      <div className="presto-onboarding-topbar">
      <Topbar className="bg-background-secondary">
        <Topbar.Left>
          <Topbar.Item>
            <PrestoPlayerIcon />
            <Text size={14} weight={600} className="ml-2">
              {__("Presto Player", "presto-player")}
            </Text>
          </Topbar.Item>
        </Topbar.Left>
        <Topbar.Middle>
          <Topbar.Item>
            <ProgressSteps
              currentStep={isDoneStep ? VISIBLE_STEPS + 1 : currentStepIndex + 1}
              variant="number"
              type="inline"
              completedVariant="number"
            >
              {Array.from({ length: VISIBLE_STEPS }).map((_, index) => (
                <ProgressSteps.Step key={index} />
              ))}
            </ProgressSteps>
          </Topbar.Item>
        </Topbar.Middle>
        <Topbar.Right>
          <Topbar.Item>
            <Button
              icon={<X className="size-4" />}
              iconPosition="right"
              size="xs"
              variant="ghost"
              onClick={exitOnboarding}
              className="align-middle"
            >
              {__("Exit Guided Setup", "presto-player")}
            </Button>
          </Topbar.Item>
        </Topbar.Right>
      </Topbar>
      </div>

      {/* Scrollable content area */}
      <Container className="p-7 w-full mt-7">
        <Container
          direction="column"
          className={`w-full border-0.5 border-solid border-border-subtle bg-background-primary shadow-sm rounded-xl mx-auto p-7 ${currentStep.maxWidth}`}
        >
          <CurrentStepComponent
            goToNextStep={goToNextStep}
            goToPreviousStep={goToPreviousStep}
            exitOnboarding={exitOnboarding}
            currentStepIndex={currentStepIndex}
            totalSteps={onboardingSteps.length}
            userInfoData={userInfoData}
            setUserInfoData={setUserInfoData}
          />
        </Container>
      </Container>
    </Container>
  );
};

export default Onboarding;
