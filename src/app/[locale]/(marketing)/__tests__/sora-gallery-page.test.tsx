import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SoraGalleryPage from "../ui/alert-dialog/page";

const params = {
  status: "fulfilled",
  value: { locale: "en" },
  then: () => {},
} as unknown as Promise<{ locale: string }>;

beforeEach(() => {
  render(<SoraGalleryPage params={params} />);
});

describe("Sora AlertDialog Gallery", () => {
  it("renders the hero with badge, title, and subtitle", () => {
    expect(screen.getByText("Sora UI")).toBeInTheDocument();
    expect(screen.getByText("Alert dialog gallery")).toBeInTheDocument();
    expect(screen.getByText(/open each one, feel the motion/)).toBeInTheDocument();
  });

  it("links back to the documentation", () => {
    const back = screen.getByText("Back to documentation");
    expect(back.closest("a")).toHaveAttribute("href", "/docs");
  });

  it("renders the usage rules strip", () => {
    expect(screen.getByText("When to use")).toBeInTheDocument();
    expect(screen.getByText("Deleting records")).toBeInTheDocument();
    expect(screen.getByText("Revoking credentials")).toBeInTheDocument();
    expect(screen.getByText("Irreversible actions")).toBeInTheDocument();
  });

  it("renders all 6 variant rows", () => {
    expect(screen.getByText("Record deletion")).toBeInTheDocument();
    expect(screen.getByText("Credential revocation")).toBeInTheDocument();
    expect(screen.getByText("Irreversible warning")).toBeInTheDocument();
    expect(screen.getByText("Neutral confirmation")).toBeInTheDocument();
    expect(screen.getByText("Session sign-out")).toBeInTheDocument();
    expect(screen.getByText("Soft deactivation")).toBeInTheDocument();
  });

  it("opens the delete dialog and shows the trash-tile copy", async () => {
    fireEvent.click(screen.getByRole("button", { name: "Delete customer" }));

    const dialog = await waitFor(() => screen.getByRole("alertdialog"));
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Delete this customer?")).toBeInTheDocument();
    expect(screen.getByText(/deactivated, not erased/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("cancel closes the dialog without acting", async () => {
    fireEvent.click(screen.getByRole("button", { name: "Delete customer" }));
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("the revoke variant opens with the destructive-red key tile (ConfirmProvider contract)", async () => {
    fireEvent.click(screen.getByRole("button", { name: "Revoke passkey" }));

    const dialog = await waitFor(() => screen.getByRole("alertdialog"));
    expect(screen.getByText("Revoke this passkey?")).toBeInTheDocument();

    // The media tile must carry the destructive tone — the gallery teaches
    // the same contract the ConfirmProvider enforces: glyph says WHAT is
    // lost (credential), tint says HOW BAD (red = access is gone).
    const media = dialog.querySelector('[data-slot="alert-dialog-media"]');
    expect(media).not.toBeNull();
    expect(media?.className).toContain("bg-destructive/10");
    expect(media?.className).not.toContain("amber");
  });

  it("the warning variant opens with its irreversible copy", async () => {
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument());
    expect(screen.getByText("Are you absolutely sure?")).toBeInTheDocument();
    expect(screen.getByText(/all API keys are permanently removed/)).toBeInTheDocument();
  });

  it("every variant row exposes a JSX snippet toggle", () => {
    const toggles = screen.getAllByRole("button", { name: /JSX/ });
    expect(toggles).toHaveLength(6);

    fireEvent.click(toggles[0]);
    expect(document.querySelector("pre code")?.textContent).toContain("AlertDialogContent");
  });
});
