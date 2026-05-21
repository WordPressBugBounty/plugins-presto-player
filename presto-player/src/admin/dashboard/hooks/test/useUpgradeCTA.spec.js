import { renderHook } from "@testing-library/react-hooks";
import useUpgradeCTA from "../useUpgradeCTA";

const setPrestoPlayer = (overrides = {}) => {
  global.window.prestoPlayer = {
    isProPluginActive: false,
    isPremium: false,
    hasLicenseKey: false,
    upgradeLink: "https://prestoplayer.com/pricing/",
    renewLink: "https://my.prestomade.com/my-account/",
    dashboardUrl: "admin.php?page=presto-dashboard",
    ...overrides,
  };
};

describe("useUpgradeCTA", () => {
  let originalLocation;
  let originalOpen;

  beforeEach(() => {
    originalLocation = window.location;
    originalOpen = window.open;
    // jsdom's window.location.href is read-only via assignment in some
    // node versions; replace the whole object to make it observable.
    delete window.location;
    window.location = { href: "" };
    window.open = jest.fn();
  });

  afterEach(() => {
    window.location = originalLocation;
    window.open = originalOpen;
    delete global.window.prestoPlayer;
  });

  describe('"Upgrade Now" state (no Pro plugin)', () => {
    it("returns the external upgrade label and href", () => {
      setPrestoPlayer();
      const { result } = renderHook(() => useUpgradeCTA());
      expect(result.current.label).toBe("Upgrade Now");
      expect(result.current.href).toBe("https://prestoplayer.com/pricing/");
      expect(result.current.isProUnlicensed).toBe(false);
      expect(result.current.isLicenseInvalid).toBe(false);
    });

    it("opens the pricing page in a new tab on click", () => {
      setPrestoPlayer();
      const { result } = renderHook(() => useUpgradeCTA());
      result.current.onClick({ currentTarget: { tagName: "BUTTON" } });
      expect(window.open).toHaveBeenCalledWith(
        "https://prestoplayer.com/pricing/",
        "_blank",
        "noopener noreferrer"
      );
    });

    it("does NOT call window.open when clicked element is an <a target=_blank>", () => {
      setPrestoPlayer();
      const { result } = renderHook(() => useUpgradeCTA());
      result.current.onClick({
        currentTarget: { tagName: "A", target: "_blank" },
      });
      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe('"Activate License" state (Pro plugin active, no premium)', () => {
    it("returns the in-app license tab label and href", () => {
      setPrestoPlayer({ isProPluginActive: true });
      const { result } = renderHook(() => useUpgradeCTA());
      expect(result.current.label).toBe("Activate License");
      expect(result.current.href).toBe(
        "admin.php?page=presto-dashboard&tab=Settings&section=license"
      );
      expect(result.current.isProUnlicensed).toBe(true);
    });

    it("uses history.push when a SPA history is provided", () => {
      setPrestoPlayer({ isProPluginActive: true });
      const history = { push: jest.fn() };
      const { result } = renderHook(() => useUpgradeCTA(history));

      const e = { preventDefault: jest.fn() };
      result.current.onClick(e);

      expect(e.preventDefault).toHaveBeenCalled();
      expect(history.push).toHaveBeenCalledWith({
        tab: "Settings",
        section: "license",
      });
      expect(window.location.href).toBe("");
      expect(window.open).not.toHaveBeenCalled();
    });

    it("falls back to window.location when no history is provided", () => {
      setPrestoPlayer({ isProPluginActive: true });
      const { result } = renderHook(() => useUpgradeCTA());

      result.current.onClick({ preventDefault: jest.fn() });
      expect(window.location.href).toBe(
        "admin.php?page=presto-dashboard&tab=Settings&section=license"
      );
    });

    it("flags isLicenseInvalid only when a key exists but premium is still false", () => {
      setPrestoPlayer({ isProPluginActive: true, hasLicenseKey: true });
      const { result } = renderHook(() => useUpgradeCTA());
      expect(result.current.isLicenseInvalid).toBe(true);
      expect(result.current.isProUnlicensed).toBe(true);
    });
  });

  describe("licensed state (premium)", () => {
    it("still exposes flags so callers can hide the CTA", () => {
      setPrestoPlayer({ isProPluginActive: true, isPremium: true });
      const { result } = renderHook(() => useUpgradeCTA());
      expect(result.current.isProUnlicensed).toBe(false);
      expect(result.current.isLicenseInvalid).toBe(false);
      expect(result.current.isPremium).toBe(true);
    });
  });

  describe("link defaults", () => {
    it("falls back to the canonical pricing page when no upgrade URL is configured", () => {
      // Empty config — upgradeLink/upgrade_link both missing.
      global.window.prestoPlayer = {};
      const { result } = renderHook(() => useUpgradeCTA());
      expect(result.current.externalUpgradeLink).toBe(
        "https://prestoplayer.com/pricing/"
      );
      expect(result.current.renewLink).toBe(
        "https://my.prestomade.com/my-account/"
      );
    });

    it("prefers `upgradeLink` over `upgrade_link` when both are set", () => {
      setPrestoPlayer({
        upgradeLink: "https://example.com/a",
        upgrade_link: "https://example.com/b",
      });
      const { result } = renderHook(() => useUpgradeCTA());
      expect(result.current.externalUpgradeLink).toBe(
        "https://example.com/a"
      );
    });
  });
});
