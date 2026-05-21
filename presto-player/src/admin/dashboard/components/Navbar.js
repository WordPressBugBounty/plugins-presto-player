const { __ } = wp.i18n;
const { sprintf } = wp.i18n;
import {
  Button,
  Topbar,
  Badge,
  Tabs,
  Tooltip,
  DropdownMenu,
} from "@bsf/force-ui";
import { CircleHelp, Book, Ticket, Youtube, Info } from "lucide-react";
import { useLocation } from "../router/router";
import Link from "./Link";
import PrestoPlayerIcon from "./PrestoPlayerIcon";
import WhatsNewRSS from "./WhatsNew";
import UpgradeNotice from "./UpgradeNotice";

const NAV_ITEMS_ALL = [
  { slug: "Dashboard", text: "Dashboard" },
  { slug: "MediaHub", text: "Media Hub" },
  { slug: "Analytics", text: "Analytics" },
  { slug: "Emails", text: "Emails", requireManageOptions: true },
  { slug: "Settings", text: "Settings" },
  { slug: "Learn", text: "Learn" },
];

const getNavItems = () => {
  const canManageEmails = !!window?.prestoPlayer?.canManageEmailSubmissions;
  return NAV_ITEMS_ALL.filter((item) => {
    if (item.requireManageOptions && !canManageEmails) return false;
    return true;
  });
};

const HeaderItem = ({ icon: Icon, onClick, markup, isActive = false }) => {
  if (markup) {
    return markup;
  }

  return (
    <Button
      className={`${
        isActive ? "text-brand-primary-600 bg-button-tertiary-hover" : ""
      }`}
      icon={<Icon aria-label="icon" role="img" />}
      iconPosition="left"
      size="sm"
      tag="button"
      type="button"
      variant="ghost"
      onClick={onClick}
    ></Button>
  );
};

const Navbar = () => {
  const location = useLocation();
  const currentTab = location.params?.tab || "Dashboard";

  const VERSION = window?.prestoPlayer?.version
    ? sprintf(__("v%s", "presto-player"), window.prestoPlayer.version)
    : false;

  const PRO_VERSION = window?.prestoPlayer?.proVersion
    ? sprintf(__("v%s", "presto-player"), window.prestoPlayer.proVersion)
    : false;

  const premiumVersionName = __("Pro", "presto-player");

  const topHeaderRightItems = [
    {
      icon: CircleHelp,
      label: "Circle",
      markup: (
        <DropdownMenu placement="bottom-end">
          <DropdownMenu.Trigger>
            <Button
              icon={<CircleHelp aria-label="icon" role="img" />}
              iconPosition="left"
              size="sm"
              tag="button"
              type="button"
              variant="ghost"
            />
          </DropdownMenu.Trigger>
          <DropdownMenu.ContentWrapper>
            <DropdownMenu.Content className="w-60">
              <DropdownMenu.List>
                <DropdownMenu.Item
                  onClick={() => window.open("https://prestoplayer.com/docs/")}
                >
                  <Book aria-label="icon" role="img" />
                  <span>{__("Knowledge base", "presto-player")}</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() =>
                    window.open("https://prestoplayer.com/support/")
                  }
                >
                  <Ticket aria-label="icon" role="img" />
                  <span>{__("Support ticket", "presto-player")}</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() =>
                    window.open(
                      "https://www.youtube.com/playlist?list=PLiEQfBIWdTTLiE6ch4DsqlsfRIrJ1emLV"
                    )
                  }
                >
                  <Youtube aria-label="icon" role="img" />
                  <span>{__("Video tutorials", "presto-player")}</span>
                </DropdownMenu.Item>
              </DropdownMenu.List>
            </DropdownMenu.Content>
          </DropdownMenu.ContentWrapper>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <UpgradeNotice />
      <Topbar
        className={`py-0 min-h-fit max-h-14 z-10 shadow-sm sticky top-[var(--presto-admin-bar-h)] bg-background-primary`}
      >
        <Topbar.Left>
          <Topbar.Item>
            <Link
              params={{
                page: "presto-dashboard",
                tab: "Dashboard",
              }}
            >
              <PrestoPlayerIcon />
            </Link>
          </Topbar.Item>
        </Topbar.Left>

        <Topbar.Middle align="left">
          <Tabs.Group
            activeItem={currentTab}
            iconPosition="left"
            orientation="horizontal"
            size="sm"
            variant="underline"
            width="auto"
          >
            {getNavItems().map((item) => (
              <Link
                key={item.slug}
                params={{
                  page: "presto-dashboard",
                  tab: item.slug,
                }}
              >
                <Tabs.Tab
                  slug={item.slug}
                  text={__(item.text, "presto-player")}
                  className="h-14 text-sm"
                />
              </Link>
            ))}
          </Tabs.Group>
        </Topbar.Middle>

        <Topbar.Right gap="xs">
          <Topbar.Item className="gap-2">
            <Tooltip
              arrow
              placement="bottom"
              title={__("Core", "presto-player")}
              triggers={["hover", "focus"]}
              variant="dark"
            >
              <Badge
                label={VERSION}
                className="cursor-default"
                size="sm"
                variant="neutral"
                closable={false}
              />
            </Tooltip>

            {window?.prestoPlayer?.license_status === "licensed" &&
              PRO_VERSION && (
                <Tooltip
                  arrow
                  placement="bottom"
                  className=""
                  title={premiumVersionName}
                  triggers={["hover", "focus"]}
                  variant="dark"
                >
                  <Badge
                    label={PRO_VERSION}
                    className="cursor-default !text-[#991ef7] !bg-[#991ef7]/10 !border-[#991ef7]/20"
                    size="sm"
                    variant="neutral"
                    closable={false}
                  />
                </Tooltip>
              )}

            {window?.prestoPlayer?.license_status === "unlicensed" && (
              <Tooltip
                arrow
                placement="bottom"
                className=""
                title={__("Unlicensed", "presto-player")}
                triggers={["hover", "focus"]}
                variant="dark"
              >
                <Badge
                  label={__("Unlicensed", "presto-player")}
                  className="cursor-default"
                  size="sm"
                  variant="red"
                  closable={false}
                  icon={<Info />}
                />
              </Tooltip>
            )}
          </Topbar.Item>

          <Topbar.Item className="gap-2">
            {topHeaderRightItems.map((item, index) => (
              <HeaderItem
                key={`${item.label}-${index}`}
                {...item}
                isCollapsed={true}
              />
            ))}
            <Tooltip
              arrow
              placement="bottom"
              className=""
              title={__("What's New?", "presto-player")}
              triggers={["hover", "focus"]}
              variant="dark"
            >
              <div>
                <WhatsNewRSS />
              </div>
            </Tooltip>
          </Topbar.Item>
        </Topbar.Right>
      </Topbar>
    </>
  );
};

export default Navbar;
