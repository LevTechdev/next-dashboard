import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthTestimonial } from "../auth-testimonial";

const { motion, slides } = vi.hoisted(() => ({
  motion: { reduced: false },
  slides: [
    {
      quote: "First customer story about faster reconciliation.",
      name: "Sara Bright",
      role: "Finance Lead",
      badges: ["Finance teams"],
    },
    {
      quote: "Second customer story about stockout protection.",
      name: "Daniel Reyes",
      role: "Head of Operations",
      badges: ["Retail operations"],
    },
    {
      quote: "Third customer story about enterprise access.",
      name: "Amara Okafor",
      role: "IT Manager",
      badges: ["Security"],
    },
  ],
}));

vi.mock("next-intl", () => {
  const messages: Record<string, string> = {
    testimonialHeading: "Customer stories",
    testimonialPrev: "Previous review",
    testimonialNext: "Next review",
    testimonialGoTo: "Go to review {index}",
    testimonialPosition: "Review {current} of {total}",
  };
  const t = (key: string, values?: Record<string, unknown>) => {
    const value = (messages[key] ?? key).replace(/\{(\w+)\}/g, (_match, name: string) =>
      String(values?.[name] ?? ""),
    );
    return value;
  };
  (t as typeof t & { raw: (key: string) => unknown }).raw = (key: string) =>
    key === "testimonials" ? slides : undefined;
  return { useTranslations: () => t };
});

vi.mock("@/hooks/use-prefers-reduced-motion", () => ({
  usePrefersReducedMotion: () => motion.reduced,
}));

const quote = (text: string) => screen.getByText((content) => content.includes(text));

beforeEach(() => {
  vi.clearAllMocks();
  motion.reduced = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AuthTestimonial", () => {
  it("moves between reviews with the next and previous controls", async () => {
    const user = userEvent.setup();
    render(<AuthTestimonial />);

    expect(quote(slides[0].quote)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next review" }));
    expect(quote(slides[1].quote)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous review" }));
    expect(quote(slides[0].quote)).toBeInTheDocument();
  });

  it("auto-advances after the review dwell time", () => {
    vi.useFakeTimers();
    render(<AuthTestimonial />);
    expect(quote(slides[0].quote)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(quote(slides[1].quote)).toBeInTheDocument();
  });

  it("does not auto-advance when reduced motion is requested", () => {
    motion.reduced = true;
    vi.useFakeTimers();
    render(<AuthTestimonial />);

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(quote(slides[0].quote)).toBeInTheDocument();
  });
});
