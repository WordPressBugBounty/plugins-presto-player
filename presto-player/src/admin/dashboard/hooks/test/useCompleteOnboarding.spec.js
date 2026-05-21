import { renderHook, act } from "@testing-library/react-hooks";
import apiFetch from "@wordpress/api-fetch";
import useCompleteOnboarding from "../useCompleteOnboarding";

jest.mock("@wordpress/api-fetch");

let originalLocation;

beforeEach(() => {
  apiFetch.mockReset();
  originalLocation = window.location;
  delete window.location;
  window.location = { href: "" };
});

afterEach(() => {
  window.location = originalLocation;
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
      data: { completed: "yes" },
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
});
