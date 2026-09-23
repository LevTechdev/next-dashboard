import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmProvider, useConfirm } from "@/components/ui/confirm-provider";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (({ confirm: "Confirm", cancel: "Cancel" }) as Record<string, string>)[key] ?? key,
}));

function Trigger({
  opts,
  onResult,
}: {
  opts: {
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    icon?: "warning" | "trash" | "key";
  };
  onResult: (v: boolean) => void;
}) {
  const confirm = useConfirm();
  return <button onClick={() => confirm(opts).then(onResult)}>open</button>;
}

function Harness(props: Omit<Parameters<typeof Trigger>[0], never>) {
  return (
    <ConfirmProvider>
      {/* The consumer must render *inside* the provider to read its context */}
      <Trigger {...props} />
    </ConfirmProvider>
  );
}

const baseOpts = {
  title: "Delete product",
  description: "This action cannot be undone.",
  confirmLabel: "Delete",
  destructive: true,
};

describe("ConfirmProvider (Sora AlertDialog)", () => {
  it("renders the Sora media tile, title, and description when opened", async () => {
    const onResult = vi.fn();
    render(<Harness opts={baseOpts} onResult={onResult} />);

    fireEvent.click(screen.getByText("open"));

    expect(await screen.findByText("Delete product")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    // Sora media tile carries the destructive warning icon (decorative, aria-hidden)
    expect(document.querySelector("[data-slot='alert-dialog-media']")).toBeInTheDocument();
  });

  it("resolves true when the destructive action is clicked", async () => {
    const onResult = vi.fn();
    render(<Harness opts={baseOpts} onResult={onResult} />);

    fireEvent.click(screen.getByText("open"));
    await screen.findByText("Delete product");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it("resolves false when Cancel is clicked", async () => {
    const onResult = vi.fn();
    render(<Harness opts={baseOpts} onResult={onResult} />);

    fireEvent.click(screen.getByText("open"));
    await screen.findByText("Delete product");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("resolves false when dismissed with Escape", async () => {
    const onResult = vi.fn();
    render(<Harness opts={baseOpts} onResult={onResult} />);

    fireEvent.click(screen.getByText("open"));
    await screen.findByText("Delete product");
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("supports sequential confirmations with fresh options each time", async () => {
    const onResult = vi.fn();
    const { rerender } = render(<Harness opts={baseOpts} onResult={onResult} />);

    // First flow: confirm → resolves true, dialog closes
    fireEvent.click(screen.getByText("open"));
    await screen.findByText("Delete product");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.queryByText("Delete product")).not.toBeInTheDocument());

    // Second flow with new options: title swaps in and resolves independently
    onResult.mockClear();
    rerender(
      <Harness
        opts={{ ...baseOpts, title: "Revoke sessions", confirmLabel: "Revoke all" }}
        onResult={onResult}
      />,
    );
    fireEvent.click(screen.getByText("open"));
    expect(await screen.findByText("Revoke sessions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke all" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it.each([
    [undefined, "icon-alerttriangle"],
    ["warning", "icon-alerttriangle"],
    ["trash", "icon-trash2"],
    ["key", "icon-keyround"],
  ] as const)("icon=%s renders the %s media glyph", async (icon, testId) => {
    render(<Harness opts={{ ...baseOpts, icon }} onResult={vi.fn()} />);

    fireEvent.click(screen.getByText("open"));
    await screen.findByText("Delete product");

    const media = document.querySelector("[data-slot='alert-dialog-media']");
    expect(media).toBeInTheDocument();
    expect(media?.querySelector(`[data-testid='${testId}']`)).not.toBeNull();
  });
});
