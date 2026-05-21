import { renderHook, act } from "@testing-library/react-hooks";

const mockUseSettingOption = jest.fn();
const mockUseRegisterActivePage = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock("../useSettingOption", () => ({
  __esModule: true,
  default: (...args) => mockUseSettingOption(...args),
}));

jest.mock("../useRegisterActivePage", () => ({
  __esModule: true,
  default: (...args) => mockUseRegisterActivePage(...args),
}));

jest.mock("@bsf/force-ui", () => ({
  toast: {
    success: (...args) => mockToastSuccess(...args),
    error: (...args) => mockToastError(...args),
  },
}));

import useSimpleSettingsPage from "../useSimpleSettingsPage";

const stub = (overrides = {}) => ({
  data: null,
  setData: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn(),
  isDirty: false,
  isSaving: false,
  isLoading: false,
  ...overrides,
});

beforeEach(() => {
  mockUseSettingOption.mockReset();
  mockUseRegisterActivePage.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
});

describe("useSimpleSettingsPage", () => {
  describe("update", () => {
    it("merges a patch on top of the previous value", () => {
      const setData = jest.fn();
      mockUseSettingOption.mockReturnValue(stub({ data: { a: 1, b: 2 }, setData }));

      const { result } = renderHook(() =>
        useSimpleSettingsPage("foo", { a: 0, b: 0 }, jest.fn())
      );

      act(() => {
        result.current.update({ b: 9 });
      });

      // setData receives an updater; invoke it to verify the merge.
      const updater = setData.mock.calls[0][0];
      expect(updater({ a: 1, b: 2 })).toEqual({ a: 1, b: 9 });
    });

    it("falls back to defaults when prev is null/undefined", () => {
      const setData = jest.fn();
      mockUseSettingOption.mockReturnValue(stub({ data: null, setData }));

      const { result } = renderHook(() =>
        useSimpleSettingsPage("foo", { a: 0, b: 0 }, jest.fn())
      );

      act(() => {
        result.current.update({ b: 9 });
      });

      const updater = setData.mock.calls[0][0];
      expect(updater(null)).toEqual({ a: 0, b: 9 });
      expect(updater(undefined)).toEqual({ a: 0, b: 9 });
    });
  });

  describe("handleSave", () => {
    it("calls save() and shows a success toast", async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      mockUseSettingOption.mockReturnValue(stub({ save }));

      const { result } = renderHook(() =>
        useSimpleSettingsPage("foo", {}, jest.fn())
      );

      await act(async () => {
        await result.current.handleSave();
      });

      expect(save).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Settings saved.",
        expect.objectContaining({ autoDismiss: 3000 })
      );
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("swallows save() failures and shows an error toast", async () => {
      const save = jest.fn().mockRejectedValue(new Error("server"));
      mockUseSettingOption.mockReturnValue(stub({ save }));

      const { result } = renderHook(() =>
        useSimpleSettingsPage("foo", {}, jest.fn())
      );

      // handleSave should NOT throw — it converts failures to a toast.
      await act(async () => {
        await expect(result.current.handleSave()).resolves.toBeUndefined();
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "Could not save settings.",
        expect.objectContaining({ autoDismiss: 5000 })
      );
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  describe("nav-guard registration", () => {
    it("hands isDirty + handleSave + reset to useRegisterActivePage", () => {
      const reset = jest.fn();
      mockUseSettingOption.mockReturnValue(stub({ isDirty: true, reset }));
      const registerActivePage = jest.fn();

      renderHook(() =>
        useSimpleSettingsPage("foo", {}, registerActivePage)
      );

      expect(mockUseRegisterActivePage).toHaveBeenCalledWith(
        registerActivePage,
        expect.objectContaining({
          isDirty: true,
          save: expect.any(Function),
          discard: reset,
        })
      );
    });
  });
});
