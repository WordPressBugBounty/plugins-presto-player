import { useState } from "react";
import { Button, Container } from "@bsf/force-ui";
import { X as XIcon } from "lucide-react";
import { useHistory } from "../router/router";
import useUpgradeCTA from "../hooks/useUpgradeCTA";

const { __ } = wp.i18n;

const COOKIE_NAME = "presto_player_upgrade_notice_seen";
const COOKIE_DAYS = 10;

const getCookie = (name) => {
  const match = document.cookie.match(
    new RegExp(
      "(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"
    )
  );
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

const setCookie = (name, value, days) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${secure}`;
};

const UpgradeNotice = () => {
  const [showNotice, setShowNotice] = useState(() => !getCookie(COOKIE_NAME));
  const history = useHistory();
  const {
    label,
    onClick,
    isProUnlicensed,
    isLicenseInvalid,
    isPremium,
    renewLink,
  } = useUpgradeCTA(history);

  if (isPremium) {
    return null;
  }

  if (!showNotice) {
    return null;
  }

  const handleClose = () => {
    setShowNotice(false);
    setCookie(COOKIE_NAME, "true", COOKIE_DAYS);
  };

  let lead;
  if (isLicenseInvalid) {
    lead = __(
      "Your Presto Player Pro license has expired. Please renew to restore Pro Features, Premium Support & Automatic Plugin Updates.",
      "presto-player"
    );
  } else if (isProUnlicensed) {
    lead = __("Your Pro license isn't activated yet.", "presto-player");
  } else {
    lead = __("Ready to go beyond free plan?", "presto-player");
  }

  // The shared hook's defaults send unlicensed users to the in-app license tab.
  // For an *invalid* key we instead want the primary CTA to renew (external)
  // and surface a secondary "Buy Subscription" link as an alternative path.
  const primaryLabel = isLicenseInvalid
    ? __("Renew Now", "presto-player")
    : label;
  const primaryOnClick = isLicenseInvalid
    ? (e) => {
        e?.preventDefault?.();
        window.open(renewLink, "_blank", "noopener noreferrer");
      }
    : onClick;

  return (
    <Container
      className="relative bg-brand-background-hover-100 p-2 text-xs text-center gap-1"
      align="center"
    >
      <p className="text-text-primary w-full lg:mx-0 m-0 p-0">
        <span className="font-semibold text-xs">{lead}</span>{" "}
        <Button
          variant="link"
          className="p-0 [&>span]:p-0 underline underline-offset-2 font-normal"
          size="xs"
          onClick={primaryOnClick}
        >
          {primaryLabel}
        </Button>
        {!isProUnlicensed && (
          <span className="font-normal text-xs">
            {" " +
              __("and unlock the full power of", "presto-player") +
              " Presto Player!"}
          </span>
        )}
      </p>
      <Container.Item className="absolute right-2 inset-y-0 inline-flex items-center">
        <Button
          variant="ghost"
          size="xs"
          className="p-1 hover:bg-transparent"
          icon={<XIcon className="size-4" />}
          onClick={handleClose}
          aria-label={__("Dismiss upgrade notice", "presto-player")}
        />
      </Container.Item>
    </Container>
  );
};

export default UpgradeNotice;
