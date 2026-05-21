import { renderHook, act } from "@testing-library/react-hooks";
import apiFetch from "@wordpress/api-fetch";
import usePerformanceSettings from "../usePerformanceSettings";

jest.mock("@wordpress/api-fetch");

const settle = () => act(async () => {});

beforeEach(() => {
  apiFetch.mockReset();
});

describe("usePerformanceSettings", () => {
  it("hydrates `performance` from /wp/v2/settings on mount", async () => {
    apiFetch.mockResolvedValueOnce({
      presto_player_performance: {
        module_enabled: true,
        automations: false,
      },
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      usePerformanceSettings()
    );
    await waitForNextUpdate();
    await settle();

    expect(apiFetch).toHaveBeenCalledWith({ path: "/wp/v2/settings" });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.performance).toEqual({
      module_enabled: true,
      automations: false,
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("keeps the defaults when the response has no performance key", async () => {
    apiFetch.mockResolvedValueOnce({});

    const { result, waitForNextUpdate } = renderHook(() =>
      usePerformanceSettings()
    );
    await waitForNextUpdate();
    await settle();

    expect(result.current.performance).toEqual({
      module_enabled: false,
      automations: true,
    });
  });

  it("logs and clears loading when the fetch fails", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    apiFetch.mockRejectedValueOnce(new Error("network"));

    const { result, waitForNextUpdate } = renderHook(() =>
      usePerformanceSettings()
    );
    await waitForNextUpdate();
    await settle();

    expect(result.current.isLoading).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("setPerformance flips isDirty true and updates state", async () => {
    apiFetch.mockResolvedValueOnce({});
    const { result, waitForNextUpdate } = renderHook(() =>
      usePerformanceSettings()
    );
    await waitForNextUpdate();
    await settle();

    act(() => {
      result.current.setPerformance({ module_enabled: true, automations: false });
    });

    expect(result.current.isDirty).toBe(true);
    expect(result.current.performance).toEqual({
      module_enabled: true,
      automations: false,
    });
  });

  it("save POSTs the current performance state and clears isDirty", async () => {
    apiFetch.mockResolvedValueOnce({});
    const { result, waitForNextUpdate } = renderHook(() =>
      usePerformanceSettings()
    );
    await waitForNextUpdate();
    await settle();

    act(() => {
      result.current.setPerformance({ module_enabled: true, automations: false });
    });

    apiFetch.mockResolvedValueOnce({ ok: true });

    await act(async () => {
      await result.current.save();
    });

    expect(apiFetch).toHaveBeenLastCalledWith({
      path: "/wp/v2/settings",
      method: "POST",
      data: {
        presto_player_performance: {
          module_enabled: true,
          automations: false,
        },
      },
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isSaving).toBe(false);
  });

  it("save clears isSaving and rethrows on failure", async () => {
    apiFetch.mockResolvedValueOnce({});
    const { result, waitForNextUpdate } = renderHook(() =>
      usePerformanceSettings()
    );
    await waitForNextUpdate();
    await settle();

    act(() => {
      result.current.setPerformance({ module_enabled: true, automations: true });
    });

    apiFetch.mockRejectedValueOnce(new Error("server"));

    await act(async () => {
      await expect(result.current.save()).rejects.toThrow("server");
    });

    expect(result.current.isSaving).toBe(false);
    // Failure leaves isDirty true so the user can retry.
    expect(result.current.isDirty).toBe(true);
  });
});
