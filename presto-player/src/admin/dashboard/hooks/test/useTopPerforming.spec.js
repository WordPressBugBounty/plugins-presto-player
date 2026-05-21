import { renderHook, act } from "@testing-library/react-hooks";
import apiFetch from "@wordpress/api-fetch";
import useTopVideosPaginated from "../useTopVideosPaginated";
import useTopPerforming from "../useTopPerforming";

jest.mock("@wordpress/api-fetch");
jest.mock("../useTopVideosPaginated", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockMediaSetPage = jest.fn();

const mediaStub = (overrides = {}) => ({
  topMedia: [],
  isLoading: false,
  error: null,
  page: 1,
  setPage: mockMediaSetPage,
  pagination: { totalItems: 0, totalPages: 0 },
  ...overrides,
});

const mockUsersResponse = ({ items = [], total = 0, totalPages = 0 } = {}) => ({
  headers: {
    get: (h) =>
      h === "X-WP-Total"
        ? String(total)
        : h === "X-WP-TotalPages"
        ? String(totalPages)
        : null,
  },
  json: async () => items,
});

const mockUserItem = (id, name) => ({
  user: { id, name },
  stats: [{ data: "9 views" }, { data: "30s" }],
});

beforeEach(() => {
  apiFetch.mockReset();
  useTopVideosPaginated.mockReset();
  mockMediaSetPage.mockReset();
  global.window.prestoPlayer = {
    isPremium: true,
    api: { analyticsTopUsers: "/presto-player/v1/analytics/top-users" },
  };
});

afterEach(() => {
  delete global.window.prestoPlayer;
});

describe("useTopPerforming", () => {
  describe("free tier (isPremium=false)", () => {
    beforeEach(() => {
      window.prestoPlayer.isPremium = false;
      useTopVideosPaginated.mockReturnValue(mediaStub());
    });

    it("does NOT call apiFetch for users", async () => {
      renderHook(() => useTopPerforming());
      await act(async () => {});
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it("disables the media hook by setting enabled=false", () => {
      renderHook(() => useTopPerforming());
      expect(useTopVideosPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

  });

  describe("premium tier", () => {
    beforeEach(() => {
      useTopVideosPaginated.mockReturnValue(mediaStub());
    });

    it("fetches users with the all-time fallback when selectedDates is empty", async () => {
      apiFetch.mockResolvedValue(
        mockUsersResponse({
          items: [mockUserItem(1, "Ada"), mockUserItem(2, "Bob")],
          total: 2,
          totalPages: 1,
        })
      );

      const { result, waitForNextUpdate } = renderHook(() =>
        useTopPerforming()
      );

      await waitForNextUpdate();

      expect(result.current.data.topUsers).toHaveLength(2);
      expect(result.current.data.topUsers[0]).toMatchObject({
        id: 1,
        name: "Ada",
      });
      expect(result.current.usersPagination).toEqual({
        totalItems: 2,
        totalPages: 1,
      });

      // The all-time path uses start=ALL_TIME_START — the dateUtils sentinel
      // currently in use. Easier to assert via "starts with the year 2020"
      // than to import the constant here, since we just want to verify the
      // hook took the fallback branch.
      const lastCall = apiFetch.mock.calls.at(-1)[0];
      expect(lastCall.path).toContain("start=2020-01-01");
      expect(lastCall.path).toContain("page=1");
    });

    it("uses provided selectedDates when both ends are set", async () => {
      apiFetch.mockResolvedValue(mockUsersResponse());

      const selectedDates = {
        from: new Date(Date.UTC(2026, 0, 5)),
        to: new Date(Date.UTC(2026, 0, 10)),
      };
      renderHook(() => useTopPerforming({ selectedDates }));
      await act(async () => {});

      const lastCall = apiFetch.mock.calls.at(-1)[0];
      expect(lastCall.path).toContain("start=2026-01-05");
      expect(lastCall.path).toContain("end=2026-01-10");
    });

    it("respects usersPerPage in the request", async () => {
      apiFetch.mockResolvedValue(mockUsersResponse());

      renderHook(() => useTopPerforming({ usersPerPage: 7 }));
      await act(async () => {});

      const lastCall = apiFetch.mock.calls.at(-1)[0];
      expect(lastCall.path).toContain("per_page=7");
    });

    it("setUsersPage triggers a refetch on the new page", async () => {
      apiFetch.mockResolvedValue(mockUsersResponse());

      const { result, waitForNextUpdate } = renderHook(() =>
        useTopPerforming()
      );
      await waitForNextUpdate();

      await act(async () => {
        result.current.setUsersPage(3);
      });

      const lastCall = apiFetch.mock.calls.at(-1)[0];
      expect(lastCall.path).toContain("page=3");
    });

    it("resets usersPage to 1 when selectedDates change", async () => {
      apiFetch.mockResolvedValue(mockUsersResponse());

      const { result, rerender, waitForNextUpdate } = renderHook(
        ({ selectedDates }) => useTopPerforming({ selectedDates }),
        {
          initialProps: {
            selectedDates: {
              from: new Date(Date.UTC(2026, 0, 1)),
              to: new Date(Date.UTC(2026, 0, 7)),
            },
          },
        }
      );
      await waitForNextUpdate();

      await act(async () => {
        result.current.setUsersPage(2);
      });
      expect(result.current.usersPage).toBe(2);

      await act(async () => {
        rerender({
          selectedDates: {
            from: new Date(Date.UTC(2026, 1, 1)),
            to: new Date(Date.UTC(2026, 1, 7)),
          },
        });
      });
      expect(result.current.usersPage).toBe(1);
    });

    it("surfaces non-abort fetch errors and clears the user list", async () => {
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      apiFetch.mockRejectedValueOnce(new Error("503"));

      const { result, waitForNextUpdate } = renderHook(() =>
        useTopPerforming()
      );
      await waitForNextUpdate();

      expect(result.current.error).toBe("503");
      expect(result.current.data.topUsers).toEqual([]);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

  });
});
