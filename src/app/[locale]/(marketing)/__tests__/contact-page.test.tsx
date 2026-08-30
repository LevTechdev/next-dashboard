import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ContactPage from "../contact/page";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  render(<ContactPage />);
});

describe("Contact Page", () => {
  it("renders the hero badge and headline", () => {
    expect(screen.getByText("Get in Touch")).toBeInTheDocument();
    expect(screen.getByText("Let's")).toBeInTheDocument();
  });

  it("renders the hero subtitle", () => {
    expect(screen.getByText(/Have a question, idea, or just want to say hi/)).toBeInTheDocument();
  });

  it("renders the contact form", () => {
    expect(screen.getByText("Send us a message")).toBeInTheDocument();
    expect(
      screen.getByText(/Fill out the form and our team will get back to you/),
    ).toBeInTheDocument();
    // Form has name, email, subject, message fields via placeholders
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("What's this about?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tell us what's on your mind...")).toBeInTheDocument();
  });

  it("renders form placeholders", () => {
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("What's this about?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tell us what's on your mind...")).toBeInTheDocument();
  });

  it("renders the send button", () => {
    expect(screen.getByText("Send Message")).toBeInTheDocument();
  });

  it("disables submit when required fields are empty", () => {
    const submitBtn = screen.getByText("Send Message").closest("button");
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit when all required fields are filled", () => {
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Tell us what's on your mind..."), {
      target: { value: "Hello there!" },
    });
    const submitBtn = screen.getByText("Send Message").closest("button");
    expect(submitBtn).not.toBeDisabled();
  });

  it("shows sending state after form submission", async () => {
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Tell us what's on your mind..."), {
      target: { value: "Hello there!" },
    });

    fireEvent.click(screen.getByText("Send Message"));

    await waitFor(() => {
      expect(screen.getByText("Sending...")).toBeInTheDocument();
    });
  });

  it("shows success screen after form submission completes", async () => {
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Tell us what's on your mind..."), {
      target: { value: "Hello there!" },
    });

    fireEvent.click(screen.getByText("Send Message"));

    await waitFor(
      () => {
        expect(screen.getByText(/Message Sent!/)).toBeInTheDocument();
        expect(screen.getByText(/Thanks for reaching out!/)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("renders contact info cards", () => {
    expect(screen.getByText("hello@dashboard.com")).toBeInTheDocument();
    expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
    expect(screen.getByText("+1 (555) 123-4567")).toBeInTheDocument();
  });

  it("renders contact info labels and descriptions", () => {
    // Use getAllByText for labels that appear in both form and info cards
    const emailLabels = screen.getAllByText("Email");
    expect(emailLabels.length).toBeGreaterThanOrEqual(2); // form label + info card
    expect(screen.getByText("We reply within 24 hours")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("HQ in SoMa district")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("Mon-Fri 9AM-6PM PST")).toBeInTheDocument();
  });

  it("renders social links", () => {
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Twitter / X")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("Follow Us")).toBeInTheDocument();
  });

  it("renders the bottom CTA section", () => {
    expect(screen.getByText("Prefer a live demo?")).toBeInTheDocument();
    expect(
      screen.getByText(/See Dashboard in action with a personalized walkthrough/),
    ).toBeInTheDocument();
    const ctaBtn = screen.getByText("Start Free Trial");
    const anchor = ctaBtn.closest("a");
    expect(anchor?.getAttribute("href")).toContain("/dashboard");
  });
});
