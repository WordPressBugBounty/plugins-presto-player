import { renderHook } from "@testing-library/react-hooks";
import useRegisterActivePage from "../useRegisterActivePage";

describe("useRegisterActivePage", () => {
  it("registers a descriptor on mount that proxies isDirty / save / discard", () => {
    const registerActivePage = jest.fn();
    const save = jest.fn();
    const discard = jest.fn();

    renderHook(() =>
      useRegisterActivePage(registerActivePage, {
        isDirty: true,
        save,
        discard,
      })
    );

    expect(registerActivePage).toHaveBeenCalledTimes(1);
    const descriptor = registerActivePage.mock.calls[0][0];
    expect(descriptor.isDirty).toBe(true);
    expect(typeof descriptor.save).toBe("function");
    expect(typeof descriptor.discard).toBe("function");

    descriptor.save();
    descriptor.discard();
    expect(save).toHaveBeenCalledTimes(1);
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it("the registered isDirty getter reads the LATEST value across re-renders", () => {
    const registerActivePage = jest.fn();

    const { rerender } = renderHook(
      ({ isDirty }) =>
        useRegisterActivePage(registerActivePage, {
          isDirty,
          save: jest.fn(),
          discard: jest.fn(),
        }),
      { initialProps: { isDirty: false } }
    );

    const descriptor = registerActivePage.mock.calls[0][0];
    expect(descriptor.isDirty).toBe(false);

    // Re-render with a new isDirty — the same descriptor should reflect it.
    rerender({ isDirty: true });
    expect(descriptor.isDirty).toBe(true);

    // The effect MUST NOT re-fire just because props changed (registering on
    // every keystroke would defeat the whole ref-based design).
    expect(registerActivePage).toHaveBeenCalledTimes(1);
  });

  it("the registered save/discard callbacks delegate to the LATEST closures", () => {
    const registerActivePage = jest.fn();
    const firstSave = jest.fn();
    const firstDiscard = jest.fn();

    const { rerender } = renderHook(
      ({ save, discard }) =>
        useRegisterActivePage(registerActivePage, {
          isDirty: false,
          save,
          discard,
        }),
      { initialProps: { save: firstSave, discard: firstDiscard } }
    );

    const descriptor = registerActivePage.mock.calls[0][0];

    // Replace save/discard via re-render. The descriptor's wrappers should
    // call the new closures, not the captured originals.
    const secondSave = jest.fn();
    const secondDiscard = jest.fn();
    rerender({ save: secondSave, discard: secondDiscard });

    descriptor.save();
    descriptor.discard();

    expect(firstSave).not.toHaveBeenCalled();
    expect(firstDiscard).not.toHaveBeenCalled();
    expect(secondSave).toHaveBeenCalledTimes(1);
    expect(secondDiscard).toHaveBeenCalledTimes(1);
  });

  it("clears the registration on unmount so Settings.js doesn't keep stale handlers", () => {
    const registerActivePage = jest.fn();
    const { unmount } = renderHook(() =>
      useRegisterActivePage(registerActivePage, {
        isDirty: false,
        save: jest.fn(),
        discard: jest.fn(),
      })
    );

    unmount();
    expect(registerActivePage).toHaveBeenCalledTimes(2);
    expect(registerActivePage).toHaveBeenLastCalledWith(null);
  });

  it("no-ops cleanly when registerActivePage is undefined", () => {
    expect(() =>
      renderHook(() =>
        useRegisterActivePage(undefined, {
          isDirty: false,
          save: jest.fn(),
          discard: jest.fn(),
        })
      ).unmount()
    ).not.toThrow();
  });

  it("re-registers when the registerActivePage prop reference changes", () => {
    const firstRegister = jest.fn();
    const { rerender } = renderHook(
      ({ register }) =>
        useRegisterActivePage(register, {
          isDirty: false,
          save: jest.fn(),
          discard: jest.fn(),
        }),
      { initialProps: { register: firstRegister } }
    );

    expect(firstRegister).toHaveBeenCalledTimes(1);

    const secondRegister = jest.fn();
    rerender({ register: secondRegister });

    // Cleanup of the prior effect calls firstRegister(null), then the new
    // effect runs and calls secondRegister(descriptor).
    expect(firstRegister).toHaveBeenCalledTimes(2);
    expect(firstRegister).toHaveBeenLastCalledWith(null);
    expect(secondRegister).toHaveBeenCalledTimes(1);
  });

  it("descriptor.save / .discard are no-ops if the user passed undefined for them", () => {
    const registerActivePage = jest.fn();
    renderHook(() =>
      useRegisterActivePage(registerActivePage, {
        isDirty: false,
        save: undefined,
        discard: undefined,
      })
    );
    const descriptor = registerActivePage.mock.calls[0][0];
    expect(() => descriptor.save()).not.toThrow();
    expect(() => descriptor.discard()).not.toThrow();
  });
});
