import { renderHook } from "@testing-library/react-hooks";

const mockPush = jest.fn();
const mockUseHistory = jest.fn(() => ({ push: mockPush }));
const mockRunNavGuards = jest.fn();

jest.mock("../../router/router", () => ({
  useHistory: () => mockUseHistory(),
}));

jest.mock("../../pages/settings/shared/navigationGuard", () => ({
  runNavGuards: (...args) => mockRunNavGuards(...args),
}));

import useLink from "../useLink";

describe("useLink", () => {
  let originalLocation;

  beforeEach(() => {
    mockPush.mockReset();
    mockRunNavGuards.mockReset().mockReturnValue(false);
    originalLocation = window.location;
    delete window.location;
    window.location = { pathname: "/wp-admin/admin.php" };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it("computes href by appending params to the current pathname", () => {
    const { result } = renderHook(() =>
      useLink({ tab: "Analytics", section: "Top" })
    );
    expect(result.current.href).toBe(
      "/wp-admin/admin.php?tab=Analytics&section=Top"
    );
  });

  it("onClick prevents default and calls history.push when no guard blocks", () => {
    const params = { tab: "Settings" };
    const { result } = renderHook(() => useLink(params));

    const event = { preventDefault: jest.fn() };
    result.current.onClick(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockRunNavGuards).toHaveBeenCalledWith(params);
    expect(mockPush).toHaveBeenCalledWith(params);
  });

  it("onClick does NOT call history.push when a nav guard returns true", () => {
    mockRunNavGuards.mockReturnValue(true);
    const { result } = renderHook(() => useLink({ tab: "Settings" }));

    const event = { preventDefault: jest.fn() };
    result.current.onClick(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
