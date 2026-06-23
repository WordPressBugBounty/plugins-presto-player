import { renderHook, act } from "@testing-library/react-hooks";
import apiFetch from "@wordpress/api-fetch";
import useCompleteOnboarding, {
  __resetInFlightForTests,
} from "../useCompleteOnboarding";

jest.mock("@wordpress/api-fetch");

let originalLocation;

beforeEach(() => {
  apiFetch.mockReset();
  __resetInFlightForTests();

  originalLocation = window.location;
  delete window.location;
  window.location = { href: "" };
});

afterEach(() => {
  window.location = originalLocation;
  delete window.prestoPlayer;
});

describe("useCompleteOnboarding", () => {
  it("POSTs the completed status and redirects on success", async () => {
    apiFetch.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useCompleteOnboarding());
    await act(async () => {
      await result.current.completeOnboarding("admin.php?page=done");
    });

    expect(apiFetch).toHaveBeenCalledWith({
      path: "/presto-player/v1/onboarding/set-status",
      method: "POST",
      data: { status: "completed" },
    });
    expect(window.location.href).toBe("admin.php?page=done");
  });

  it("redirects even when the API call fails (best-effort completion)", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    apiFetch.mockRejectedValueOnce(new Error("server"));

    const { result } = renderHook(() => useCompleteOnboarding());
    await act(async () => {
      await result.current.completeOnboarding("admin.php?page=done");
    });

    expect(window.location.href).toBe("admin.php?page=done");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("ignores re-entrant calls while a submission is in flight", async () => {
    let resolveFetch;
    apiFetch.mockReturnValueOnce(
      new Promise((res) => {
        resolveFetch = res;
      })
    );

    const { result } = renderHook(() => useCompleteOnboarding());

    let firstPending;
    act(() => {
      firstPending = result.current.completeOnboarding("first");
    });

    await act(async () => {
      // Second call should short-circuit (no second apiFetch).
      await result.current.completeOnboarding("second");
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch({ ok: true });
      await firstPending;
    });

    expect(window.location.href).toBe("first");
  });

  it("blocks exit from another hook instance while a completion is in flight", async () => {
    let resolveFetch;
    apiFetch.mockReturnValueOnce(
      new Promise((res) => {
        resolveFetch = res;
      })
    );

    // Two instances, like the premium step's button and the topbar Exit.
    const first = renderHook(() => useCompleteOnboarding());
    const second = renderHook(() => useCompleteOnboarding());

    let completePending;
    act(() => {
      completePending = first.result.current.completeOnboarding("license-page");
    });

    await act(async () => {
      await second.result.current.exitOnboarding("premium_features");
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch({ ok: true });
      await completePending;
    });

    expect(window.location.href).toBe("license-page");
  });

  describe("exitOnboarding", () => {
    it("POSTs a skip with the step id and redirects to the dashboard", async () => {
      window.prestoPlayer = { dashboardUrl: "admin.php?page=presto-dashboard&custom" };
      apiFetch.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useCompleteOnboarding());
      await act(async () => {
        await result.current.exitOnboarding("premium_features");
      });

      expect(apiFetch).toHaveBeenCalledWith({
        path: "/presto-player/v1/onboarding/set-status",
        method: "POST",
        data: { status: "skipped", skipped_on_step: "premium_features" },
      });
      expect(window.location.href).toBe("admin.php?page=presto-dashboard&custom");
    });

    it("records a completion when exiting from the done step", async () => {
      apiFetch.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useCompleteOnboarding());
      await act(async () => {
        await result.current.exitOnboarding(null);
      });

      expect(apiFetch).toHaveBeenCalledWith({
        path: "/presto-player/v1/onboarding/set-status",
        method: "POST",
        data: { status: "completed" },
      });
      expect(window.location.href).toBe("admin.php?page=presto-dashboard");
    });

    it("redirects even when the API call fails", async () => {
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      apiFetch.mockRejectedValueOnce(new Error("server"));

      const { result } = renderHook(() => useCompleteOnboarding());
      await act(async () => {
        await result.current.exitOnboarding("welcome");
      });

      expect(window.location.href).toBe("admin.php?page=presto-dashboard");
      errorSpy.mockRestore();
    });
  });
});
