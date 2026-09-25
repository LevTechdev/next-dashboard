import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { CodeSlots } from "../code-slots";

/**
 * CodeSlots (reactbits "code-slots" port) — the app's OTP input.
 *
 * These contracts are the ones the 2FA/OTP surfaces depend on and that
 * e2e/2fa-modal-mobile.spec.ts asserts at the DOM level:
 *   • one slot per digit, first empty slot active, single gliding caret;
 *   • colours come from the design tokens unless a prop overrides them;
 *   • typing fills left-to-right, Backspace clears-then-steps-back;
 *   • paste fills the row; a full row fires onComplete exactly once;
 *   • disabled blocks input, success locks the row in.
 */

const row = () => document.querySelector(".code-slots__row") as HTMLElement;
const slots = () => [...document.querySelectorAll(".code-slots__slot")];
const filled = () => slots().filter((s) => s.hasAttribute("data-filled"));
const activeIndex = () => slots().findIndex((s) => s.hasAttribute("data-active"));
const input = () => document.querySelector(".code-slots__input") as HTMLInputElement;

/** Controlled harness mirroring the real login/2FA usage. */
function Harness({
  onComplete,
  status = "idle",
  disabled = false,
  mask = false,
}: {
  onComplete?: (code: string) => void;
  status?: "idle" | "error" | "success";
  disabled?: boolean;
  mask?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <CodeSlots
      value={value}
      onChange={setValue}
      onComplete={onComplete}
      status={status}
      disabled={disabled}
      mask={mask}
      autoFocus
      ariaLabel="One-time code"
    />
  );
}

describe("CodeSlots", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders six slots with the first one active and a single caret", () => {
    render(<CodeSlots autoFocus />);
    expect(slots()).toHaveLength(6);
    expect(activeIndex()).toBe(0);
    expect(slots()[1]).not.toHaveAttribute("data-active");
    expect(document.querySelectorAll(".code-slots__caret[data-show]")).toHaveLength(1);
    expect(filled()).toHaveLength(0);
  });

  it("inherits the design tokens unless a colour prop overrides one", () => {
    const { unmount } = render(<CodeSlots />);
    // No inline custom property → the stylesheet's token defaults win.
    expect(row().parentElement?.getAttribute("style") ?? "").not.toContain("--cs-accent");
    expect(row().parentElement?.getAttribute("style") ?? "").not.toContain("--cs-digit");
    unmount();

    render(<CodeSlots accentColor="hsl(var(--primary))" digitColor="#18181b" />);
    const style = row().parentElement?.getAttribute("style") ?? "";
    expect(style).toContain("--cs-accent");
    expect(style).toContain("--cs-digit");
    // Untouched colours stay token-driven.
    expect(style).not.toContain("--cs-slot");
  });

  it("fills slots left to right and reports the code as it grows", () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    function Spy() {
      const [value, setValue] = useState("");
      return (
        <CodeSlots
          value={value}
          onChange={(code) => {
            onChange(code);
            setValue(code);
          }}
          onComplete={onComplete}
          autoFocus
        />
      );
    }
    render(<Spy />);

    fireEvent.keyDown(input(), { key: "4" });
    fireEvent.keyDown(input(), { key: "2" });
    expect(onChange).toHaveBeenLastCalledWith("42");
    expect(onComplete).not.toHaveBeenCalled();
    expect(filled()).toHaveLength(2);
    expect(activeIndex()).toBe(2);

    for (const key of ["7", "9", "0", "1"]) fireEvent.keyDown(input(), { key });
    expect(onChange).toHaveBeenLastCalledWith("427901");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("427901");

    // Extra digits past the last slot are ignored — no second completion.
    fireEvent.keyDown(input(), { key: "5" });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("ignores non-digit keys", () => {
    const onChange = vi.fn();
    render(<CodeSlots onChange={onChange} autoFocus />);
    for (const key of ["a", "-", "Enter", " "]) fireEvent.keyDown(input(), { key });
    expect(onChange).not.toHaveBeenCalled();
    expect(filled()).toHaveLength(0);
  });

  it("Backspace clears the filled neighbour then steps back", () => {
    function Spy() {
      const [value, setValue] = useState("12");
      return <CodeSlots value={value} onChange={setValue} autoFocus />;
    }
    render(<Spy />);
    expect(filled()).toHaveLength(2);
    expect(activeIndex()).toBe(2);

    // Active slot is empty → Backspace steps back and clears slot 1.
    fireEvent.keyDown(input(), { key: "Backspace" });
    expect(filled()).toHaveLength(1);
    expect(activeIndex()).toBe(1);

    // Now the active slot holds a digit → it is cleared in place.
    fireEvent.keyDown(input(), { key: "Backspace" });
    expect(filled()).toHaveLength(0);
    expect(activeIndex()).toBe(0);
  });

  it("fills the whole row from a pasted code", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const paste = new Event("paste", { bubbles: true }) as Event & {
      clipboardData: { getData: () => string };
    };
    paste.clipboardData = { getData: () => "987654" };
    fireEvent(input(), paste);

    expect(filled()).toHaveLength(6);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("987654");
  });

  it("masks the digits when asked", () => {
    render(<Harness mask />);
    fireEvent.keyDown(input(), { key: "7" });
    const digit = document.querySelector(".code-slots__digit");
    expect(digit?.textContent).toBe("•");
  });

  it("blocks every interaction while disabled", () => {
    const onChange = vi.fn();
    render(<CodeSlots disabled onChange={onChange} autoFocus />);
    expect(row()).toHaveAttribute("data-disabled");
    expect(input()).toBeDisabled();
    fireEvent.keyDown(input(), { key: "5" });
    expect(onChange).not.toHaveBeenCalled();
    expect(filled()).toHaveLength(0);
  });

  it("locks the row read-only on success", () => {
    render(<CodeSlots defaultValue="123456" status="success" caret />);
    expect(input()).toHaveAttribute("readonly");
    expect(row()).toHaveAttribute("data-status", "success");
    // The success wash and its check mark are mounted for the transition.
    expect(document.querySelector(".code-slots__wash")).not.toBeNull();
    expect(document.querySelector(".code-slots__check")).not.toBeNull();
  });

  it("drains the row and reports an empty code on error", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<CodeSlots value="123456" status="error" onChange={onChange} />);
    expect(row()).toHaveAttribute("data-status", "error");
    expect(input()).toHaveAttribute("aria-invalid", "true");

    // After the drain choreography the component commits an empty code so the
    // caller can reset its rejected flag and accept a fresh attempt.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onChange).toHaveBeenCalledWith("");
    expect(filled()).toHaveLength(0);
  });
});

/**
 * Recovery-code mode: the login page's backup-code step reuses this control
 * with `alphabet="alphanumeric"` and `groupSize={4}` (xxxx-xxxx). The digit-only
 * sanitizer would swallow every letter, so these contracts matter: letters must
 * survive, the grouping must be purely visual, and the reported value must be
 * the 8 raw characters the server hashes.
 */
describe("CodeSlots — alphanumeric recovery codes", () => {
  function RecoveryHarness({ onComplete }: { onComplete?: (code: string) => void }) {
    const [value, setValue] = useState("");
    return (
      <CodeSlots
        length={8}
        alphabet="alphanumeric"
        groupSize={4}
        value={value}
        onChange={setValue}
        onComplete={onComplete}
        placeholder="xxxx-xxxx"
        autoFocus
        ariaLabel="Backup code"
      />
    );
  }

  it("accepts letters, lowercases them, and keeps the raw 8 characters", () => {
    render(<RecoveryHarness />);
    for (const ch of "A1B2C3D4") {
      fireEvent.keyDown(input(), { key: ch });
    }
    expect(filled()).toHaveLength(8);
    expect(row()).toHaveAttribute("data-value", "a1b2c3d4");
  });

  it("draws the group separator without folding it into the value", () => {
    render(<RecoveryHarness />);
    // 8 slots + one divider between the two groups of four.
    expect(slots()).toHaveLength(8);
    expect(document.querySelectorAll(".code-slots__sep")).toHaveLength(1);
    expect(document.querySelectorAll(".code-slots__sep + .code-slots__slot")).toHaveLength(1);
  });

  it("normalises a pasted dashed code and fires onComplete once", () => {
    const onComplete = vi.fn();
    render(<RecoveryHarness onComplete={onComplete} />);
    fireEvent.paste(input(), {
      clipboardData: { getData: () => "AB12-CD34" },
    });
    expect(row()).toHaveAttribute("data-value", "ab12cd34");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("ab12cd34");
  });

  it("still rejects punctuation and whitespace", () => {
    render(<RecoveryHarness />);
    for (const ch of "a-! 1") {
      fireEvent.keyDown(input(), { key: ch });
    }
    expect(row()).toHaveAttribute("data-value", "a1");
  });
});
