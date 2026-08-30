import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../card";

describe("Card", () => {
  it("renders the dashboard-card shell and merges a caller className", () => {
    render(
      <Card aria-label="shell" className="border-2">
        content
      </Card>,
    );
    const el = screen.getByLabelText("shell");

    // `dashboard-card` is the class the e2e specs scope on
    // (`main .dashboard-card`), so pin it with the rest of the base styling;
    // the caller className sits alongside it (nothing is dropped).
    expect(el).toHaveClass("dashboard-card");
    expect(el).toHaveClass("border-2");
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("renders every Card subcomponent with its base class", () => {
    render(
      <Card aria-label="shell">
        <CardHeader aria-label="header">Header</CardHeader>
        <CardTitle aria-label="title">Title</CardTitle>
        <CardDescription aria-label="desc">Description</CardDescription>
        <CardContent aria-label="content">Content</CardContent>
        <CardFooter aria-label="footer">Footer</CardFooter>
      </Card>,
    );

    expect(screen.getByLabelText("header")).toHaveClass("flex", "flex-col", "space-y-1.5", "p-6");
    const title = screen.getByLabelText("title");
    expect(title.tagName).toBe("H3");
    expect(title).toHaveClass("text-lg", "font-semibold", "leading-none", "tracking-tight");
    expect(screen.getByLabelText("desc")).toHaveClass(
      "text-sm",
      "text-gray-500",
      "dark:text-gray-400",
    );
    expect(screen.getByLabelText("content")).toHaveClass("p-6", "pt-0");
    expect(screen.getByLabelText("footer")).toHaveClass("flex", "items-center", "p-6", "pt-0");
  });
});
