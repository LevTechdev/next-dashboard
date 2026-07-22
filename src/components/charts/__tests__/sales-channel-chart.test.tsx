import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SalesChannelChart } from "../sales-channel-chart";

// Mock recharts
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ children }: { children: React.ReactNode }) => <div data-testid="bar">{children}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Cell: () => <div data-testid="cell" />,
}));

describe("SalesChannelChart", () => {
  it("renders a message when no data is provided", () => {
    render(<SalesChannelChart data={[]} />);
    expect(screen.getByText("No channel data available")).toBeInTheDocument();
  });

  it("renders a message when data is null", () => {
    render(<SalesChannelChart data={null as any} />);
    expect(screen.getByText("No channel data available")).toBeInTheDocument();
  });

  it("renders the chart when data is provided", () => {
    const mockData = [
      { name: "Online Store", value: 65000, color: "#6366f1" },
      { name: "Shopify", value: 35000, color: "#22c55e" },
    ];
    render(<SalesChannelChart data={mockData} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("applies custom height", () => {
    const mockData = [{ name: "Online Store", value: 65000, color: "#6366f1" }];
    render(<SalesChannelChart data={mockData} height={400} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });
});
