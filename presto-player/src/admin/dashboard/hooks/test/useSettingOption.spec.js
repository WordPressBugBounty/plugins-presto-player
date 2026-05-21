import { renderHook, act } from "@testing-library/react-hooks";

const mockUseSettingsData = jest.fn();

jest.mock("../../pages/settings/shared/SettingsDataProvider", () => ({
  useSettingsData: () => mockUseSettingsData(),
}));

import useSettingOption from "../useSettingOption";

const stubData = (overrides = {}) => ({
  settings: {},
  lastSaved: {},
  isLoading: false,
  savingKeys: new Set(),
  updateLocal: jest.fn(),
  resetKey: jest.fn(),
  saveSlice: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  mockUseSettingsData.mockReset();
});

describe("useSettingOption", () => {
  it("returns the stored value when present", () => {
    mockUseSettingsData.mockReturnValue(
      stubData({
        settings: { presto_branding: { logo: "x.png" } },
        lastSaved: { presto_branding: { logo: "x.png" } },
      })
    );

    const { result } = renderHook(() =>
      useSettingOption("presto_branding", { logo: "" })
    );
    expect(result.current.data).toEqual({ logo: "x.png" });
    expect(result.current.isDirty).toBe(false);
  });

  it("falls back to defaultValue when the stored option is undefined", () => {
    mockUseSettingsData.mockReturnValue(stubData());
    const { result } = renderHook(() =>
      useSettingOption("missing_key", { fallback: true })
    );
    expect(result.current.data).toEqual({ fallback: true });
  });

  it("falls back to defaultValue when the stored option is null (WP schema-rejected)", () => {
    mockUseSettingsData.mockReturnValue(
      stubData({ settings: { foo: null } })
    );
    const { result } = renderHook(() => useSettingOption("foo", "default"));
    expect(result.current.data).toBe("default");
  });

  it("treats null in lastSaved as defaultValue when computing isDirty", () => {
    mockUseSettingsData.mockReturnValue(
      stubData({
        settings: { foo: "default" },
        lastSaved: { foo: null },
      })
    );
    const { result } = renderHook(() => useSettingOption("foo", "default"));
    // data === defaultValue ("default") and effectiveSaved === defaultValue
    // → not dirty.
    expect(result.current.isDirty).toBe(false);
  });

  it("flags isDirty=true when local data differs from lastSaved", () => {
    mockUseSettingsData.mockReturnValue(
      stubData({
        settings: { foo: { a: 1 } },
        lastSaved: { foo: { a: 2 } },
      })
    );
    const { result } = renderHook(() => useSettingOption("foo", {}));
    expect(result.current.isDirty).toBe(true);
  });

  it("uses deep equality so identical-shape objects are not dirty", () => {
    mockUseSettingsData.mockReturnValue(
      stubData({
        settings: { foo: { a: 1, b: { c: 2 } } },
        lastSaved: { foo: { a: 1, b: { c: 2 } } },
      })
    );
    const { result } = renderHook(() => useSettingOption("foo", {}));
    expect(result.current.isDirty).toBe(false);
  });

  it("flags isSaving=true when the option key is in savingKeys", () => {
    mockUseSettingsData.mockReturnValue(
      stubData({
        settings: { foo: "x" },
        lastSaved: { foo: "x" },
        savingKeys: new Set(["foo"]),
      })
    );
    const { result } = renderHook(() => useSettingOption("foo", ""));
    expect(result.current.isSaving).toBe(true);
  });

  it("setData delegates to updateLocal(optionKey, next)", () => {
    const updateLocal = jest.fn();
    mockUseSettingsData.mockReturnValue(stubData({ updateLocal }));

    const { result } = renderHook(() => useSettingOption("foo", ""));
    act(() => {
      result.current.setData("new-value");
    });
    expect(updateLocal).toHaveBeenCalledWith("foo", "new-value");
  });

  it("save delegates to saveSlice([optionKey])", () => {
    const saveSlice = jest.fn();
    mockUseSettingsData.mockReturnValue(stubData({ saveSlice }));

    const { result } = renderHook(() => useSettingOption("foo", ""));
    act(() => {
      result.current.save();
    });
    expect(saveSlice).toHaveBeenCalledWith(["foo"]);
  });

});
