import React from "react";
const { __ } = wp.i18n;
import { Container, Label, Text } from "@bsf/force-ui";
import { HelpCircle, Star, Headphones, Crown, Sparkles } from "lucide-react";
import useUpgradeCTA from "../hooks/useUpgradeCTA";
import { useHistory } from "../router/router";

const QuickAccess = () => {
  // Plugin status data from WordPress
  const prestoPlayerData = window.prestoPlayer || {};
  const history = useHistory();
  const upgrade = useUpgradeCTA(history);

  const quickAccessItems = [
    {
      id: "1",
      icon: <Sparkles className="w-4 h-4" />,
      label: __("Guided Onboarding", "presto-player"),
      link: prestoPlayerData?.onboardingUrl || "#",
      internal: true,
    },
    {
      id: "2",
      icon: <HelpCircle className="w-4 h-4" />,
      label: __("Help Center", "presto-player"),
      link: "https://prestoplayer.com/docs/",
    },
    {
      id: "3",
      icon: <Headphones className="w-4 h-4" />,
      label: __("Open Support Ticket", "presto-player"),
      link: "https://prestoplayer.com/contact/",
    },
    {
      id: "4",
      icon: <Star className="w-4 h-4" />,
      label: __("Leave Us a Review", "presto-player"),
      link: "https://wordpress.org/support/plugin/presto-player/reviews/#new-post",
    },
    {
      id: "5",
      icon: <Crown className="w-4 h-4" />,
      label: upgrade.label,
      link: upgrade.href,
      internal: upgrade.isProUnlicensed,
      onClick: upgrade.onClick,
      condition: !upgrade.isPremium,
    },
  ];

  return (
    <Container
      containerType="flex"
      direction="column"
      className="p-3 border-0.5 border-solid rounded-xl shadow-sm bg-background-primary border-border-subtle"
      gap="xs"
    >
      <Container.Item className="p-1 md:w-full lg:w-full">
        <Label className="font-semibold">
          {__("Quick Access", "presto-player")}
        </Label>
      </Container.Item>
      <Container.Item className="flex flex-col gap-1 p-1 rounded-lg md:w-full lg:w-full bg-field-primary-background">
        {quickAccessItems.map(
          (button) =>
            button?.condition !== false && (
              <Text
                key={button.id}
                as="a"
                href={button.link}
                target={button.internal ? "_self" : "_blank"}
                rel={button.internal ? undefined : "noreferrer"}
                onClick={button.onClick}
                aria-label={button.label}
                className="flex items-center gap-1 p-2 rounded-md bg-background-primary shadow-soft-shadow-inner no-underline hover:no-underline cursor-pointer"
              >
                <Container
                  containerType="flex"
                  direction="row"
                  className="items-center gap-1 p-1"
                  align="center"
                >
                  <Container.Item className="flex items-center justify-center text-text-primary">
                    {button.icon}
                  </Container.Item>
                  <Container.Item className="flex items-center">
                    <Text className="px-1 py-0 text-sm font-medium text-text-primary">
                      {button.label}
                    </Text>
                  </Container.Item>
                </Container>
              </Text>
            )
        )}
      </Container.Item>
    </Container>
  );
};

export default QuickAccess;
