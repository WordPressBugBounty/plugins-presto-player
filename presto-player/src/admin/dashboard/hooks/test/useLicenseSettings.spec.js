import { renderHook, act } from "@testing-library/react-hooks";
import apiFetch from "@wordpress/api-fetch";
import useLicenseSettings from "../useLicenseSettings";

jest.mock("@wordpress/api-fetch");

beforeEach(() => {
  apiFetch.mockReset();
});

// useLicenseSettings holds a module-level `cachedStatus` that survives
// across tests in this file. We sequence tests so the cache evolves
// predictably:
//
//   1. mount-time failure → cache stays null (catch doesn't set it)
//   2. mount-time success → cache becomes {active:true, key:'ABC-123'}
//   3. cache hit on remount → asserts no second /status fetch
//   4. activate / deactivate flows → drive the cache via the hook's API
//
// Tests below MUST run in this order.
describe("useLicenseSettings", () => {
  it("logs and clears loading when the initial /license/status fetch fails", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    apiFetch.mockRejectedValueOnce(new Error("network"));

    const { result, waitForNextUpdate } = renderHook(() =>
      useLicenseSettings()
    );
    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("fetches /license/status on first successful mount and reflects the response", async () => {
    apiFetch.mockResolvedValueOnce({ active: true, key: "ABC-123" });

    const { result, waitForNextUpdate } = renderHook(() =>
      useLicenseSettings()
    );
    expect(result.current.isLoading).toBe(true);
    await waitForNextUpdate();

    expect(apiFetch).toHaveBeenCalledWith({
      path: "/presto-player/v1/license/status",
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isActive).toBe(true);
    expect(result.current.licenseKey).toBe("ABC-123");
  });

  it("does not refetch on a remount within the same module load (cache hit)", () => {
    // cachedStatus is now {active:true, key:'ABC-123'} from the prior test.
    const { result } = renderHook(() => useLicenseSettings());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isActive).toBe(true);
    expect(result.current.licenseKey).toBe("ABC-123");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  describe("activate", () => {
    it("POSTs the key, flips state, and returns the response", async () => {
      const { result } = renderHook(() => useLicenseSettings());

      apiFetch.mockResolvedValueOnce({ key: "NEW-KEY", message: "ok" });

      let activateResult;
      await act(async () => {
        activateResult = await result.current.activate("NEW-KEY");
      });

      expect(apiFetch).toHaveBeenLastCalledWith({
        path: "/presto-player/v1/license/activate",
        method: "POST",
        data: { key: "NEW-KEY" },
      });
      expect(result.current.isActive).toBe(true);
      expect(result.current.licenseKey).toBe("NEW-KEY");
      expect(result.current.isActivating).toBe(false);
      expect(activateResult).toEqual({ key: "NEW-KEY", message: "ok" });
    });

    it("clears isActivating on failure and rethrows", async () => {
      const { result } = renderHook(() => useLicenseSettings());

      apiFetch.mockRejectedValueOnce(new Error("invalid"));

      await act(async () => {
        await expect(result.current.activate("BAD")).rejects.toThrow(
          "invalid"
        );
      });

      expect(result.current.isActivating).toBe(false);
    });
  });

  describe("deactivate", () => {
    it("POSTs to /deactivate and clears state", async () => {
      const { result } = renderHook(() => useLicenseSettings());

      apiFetch.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.deactivate();
      });

      expect(apiFetch).toHaveBeenLastCalledWith({
        path: "/presto-player/v1/license/deactivate",
        method: "POST",
      });
      expect(result.current.isActive).toBe(false);
      expect(result.current.licenseKey).toBe("");
      expect(result.current.isDeactivating).toBe(false);
    });

    it("clears isDeactivating on failure and rethrows", async () => {
      const { result } = renderHook(() => useLicenseSettings());

      apiFetch.mockRejectedValueOnce(new Error("server"));

      await act(async () => {
        await expect(result.current.deactivate()).rejects.toThrow("server");
      });

      expect(result.current.isDeactivating).toBe(false);
    });
  });
});
