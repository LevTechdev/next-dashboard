import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const push = vi.fn();
let search = "?token=live-token";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
}));

import SecurityAlertPage from "../page";

/**
 * The confirmation page behind the "this wasn't me" email link.
 *
 * It exists so that *reading* the link and *using* it are separate actions: the
 * page only peeks at the token, and the single use is claimed when the button
 * is pressed. These tests pin that split, because collapsing it back into a
 * direct action is exactly the bug that let a mailbox scanner burn the link.
 */
describe("SecurityAlertPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = "?token=live-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = (handlers: {
    peek?: { valid: boolean };
    revoke?: { ok: boolean; body: unknown };
  }) =>
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const r = handlers.revoke ?? { ok: true, body: { payload: undefined } };
        return Promise.resolve({
          ok: r.ok,
          json: () => Promise.resolve(r.body),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(handlers.peek ?? { valid: true, state: "VALID" }),
      } as unknown as Response);
    });

  it("only PEEKS on load — reading the link never claims it", async () => {
    const fetchMock = stubFetch({ peek: { valid: true } });
    vi.stubGlobal("fetch", fetchMock);
    render(<SecurityAlertPage />);

    await waitFor(() => expect(screen.getByTestId("security-alert-confirm")).toBeInTheDocument());
    // Exactly one request, and it is a read: nothing mutated the account.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/auth/security-alert?token=");
    expect(fetchMock.mock.calls[0][1]).toBeUndefined();
  });

  it("says what the action does before anyone presses it", async () => {
    vi.stubGlobal("fetch", stubFetch({ peek: { valid: true } }));
    render(<SecurityAlertPage />);

    await waitFor(() => expect(screen.getByText("Secure this account?")).toBeInTheDocument());
    expect(screen.getByText(/signs out every device using it/i)).toBeInTheDocument();
    expect(screen.getByText(/requires a new password/i)).toBeInTheDocument();
  });

  it("claims the link by POST on a button press, then lands on the reset form", async () => {
    const fetchMock = stubFetch({
      peek: { valid: true },
      revoke: {
        ok: true,
        body: { secured: true, resetUrl: "/en/reset-password?token=x&alert=reverted" },
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SecurityAlertPage />);

    await waitFor(() => expect(screen.getByTestId("security-alert-confirm")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("security-alert-confirm"));

    await waitFor(() => expect(push).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "POST")!;
    expect(String(url)).toContain("/api/auth/security-alert/revoke");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      token: "live-token",
      locale: "en",
    });
    expect(push).toHaveBeenCalledWith("/en/reset-password?token=x&alert=reverted");
  });

  it("explains an unusable link instead of offering a dead button", async () => {
    vi.stubGlobal("fetch", stubFetch({ peek: { valid: false } }));
    render(<SecurityAlertPage />);

    await waitFor(() =>
      expect(screen.getByText("That link is no longer usable")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("security-alert-confirm")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to login/i })).toBeInTheDocument();
  });

  it("reports a failed claim rather than pretending the account is safe", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({ peek: { valid: true }, revoke: { ok: false, body: { error: "USED" } } }),
    );
    render(<SecurityAlertPage />);

    await waitFor(() => expect(screen.getByTestId("security-alert-confirm")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("security-alert-confirm"));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/could not secure the account/i),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("treats a missing token as unusable without asking the server", async () => {
    search = "";
    const fetchMock = stubFetch({});
    vi.stubGlobal("fetch", fetchMock);
    render(<SecurityAlertPage />);

    await waitFor(() =>
      expect(screen.getByText("That link is no longer usable")).toBeInTheDocument(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
