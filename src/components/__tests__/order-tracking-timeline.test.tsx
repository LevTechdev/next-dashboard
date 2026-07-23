import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderTrackingTimeline, getTrackingEventsFromOrder } from "../order-tracking-timeline";

describe("OrderTrackingTimeline", () => {
  it("renders all status steps for PENDING order", () => {
    render(<OrderTrackingTimeline currentStatus="PENDING" />);
    expect(screen.getByText("Order Placed")).toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("Shipped")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
  });

  it("renders all status steps for DELIVERED order", () => {
    render(<OrderTrackingTimeline currentStatus="DELIVERED" />);
    expect(screen.getByText("Order Placed")).toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("Shipped")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
  });

  it("renders cancelled state for CANCELLED order", () => {
    render(<OrderTrackingTimeline currentStatus="CANCELLED" />);
    expect(screen.getByText("Order Cancelled")).toBeInTheDocument();
    expect(
      screen.getByText("This order has been cancelled and will not be processed further."),
    ).toBeInTheDocument();
  });

  it("renders status history events", () => {
    const events = [
      { status: "PENDING", timestamp: "2024-07-01T10:00:00Z", note: "Order received" },
      { status: "PROCESSING", timestamp: "2024-07-01T11:00:00Z" },
      { status: "SHIPPED", timestamp: "2024-07-02T10:00:00Z" },
      { status: "DELIVERED", timestamp: "2024-07-03T10:00:00Z" },
    ];
    render(<OrderTrackingTimeline currentStatus="DELIVERED" events={events} />);
    expect(screen.getByText("Status History")).toBeInTheDocument();
    expect(screen.getByText("Order received")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <OrderTrackingTimeline currentStatus="PENDING" className="custom-class" />,
    );
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });
});

describe("getTrackingEventsFromOrder", () => {
  it("generates PENDING event from createdAt", () => {
    const order = {
      createdAt: "2024-07-01T10:00:00Z",
      status: "PENDING",
      updatedAt: "2024-07-01T10:00:00Z",
    };
    const events = getTrackingEventsFromOrder(order);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].status).toBe("PENDING");
  });

  it("includes note from order", () => {
    const order = {
      createdAt: "2024-07-01T10:00:00Z",
      status: "PENDING",
      updatedAt: "2024-07-01T10:00:00Z",
      notes: "Handle with care",
    };
    const events = getTrackingEventsFromOrder(order);
    expect(events[0].note).toBe("Handle with care");
  });

  it("generates events for DELIVERED orders", () => {
    const order = {
      createdAt: "2024-07-01T10:00:00Z",
      status: "DELIVERED",
      updatedAt: "2024-07-03T10:00:00Z",
    };
    const events = getTrackingEventsFromOrder(order);
    expect(events.length).toBeGreaterThan(1);
    const statuses = events.map((e) => e.status);
    expect(statuses).toContain("PENDING");
    expect(statuses).toContain("DELIVERED");
  });
});
