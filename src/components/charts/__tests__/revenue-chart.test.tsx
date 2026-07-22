import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RevenueChart } from "../revenue-chart";

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
}));

describe("RevenueChart", () => {
  it("renders a message when no data is provided", () => {
    render(<RevenueChart data={[]} />);
    expect(screen.getByText("No revenue data available")).toBeInTheDocument();
  });

  it("renders a message when data is null", () => {
    render(<RevenueChart data={null as any} />);
    expect(screen.getByText("No revenue data available")).toBeInTheDocument();
  });

  it("renders the chart when data is provided", () => {
    const mockData = [
      { month: "Jan", revenue: 10000 },
      { month: "Feb", revenue: 15000 },
    ];
    render(<RevenueChart data={mockData} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("bar")).toBeInTheDocument();
  });

  it("applies custom height and renders the chart", () => {
    const mockData = [{ month: "Jan", revenue: 10000 }];
    render(<RevenueChart data={mockData} height={400} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("applies default height when not specified", () => {
    const mockData = [{ month: "Jan", revenue: 10000 }];
    render(<RevenueChart data={mockData} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });
});
