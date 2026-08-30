import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutPage from "../about/page";

beforeEach(() => {
  render(<AboutPage />);
});

describe("About Page", () => {
  it("renders the hero badge and headline", () => {
    expect(screen.getByText("Our Story")).toBeInTheDocument();
    expect(screen.getByText("Building the future of")).toBeInTheDocument();
  });

  it("renders the hero subtitle", () => {
    expect(screen.getByText(/We're on a mission to empower every business/)).toBeInTheDocument();
  });

  it("renders hero CTA buttons with accessible links", () => {
    const exploreBtn = screen.getByText("Explore Features");
    expect(exploreBtn).toBeInTheDocument();
    const exploreAnchor = exploreBtn.closest("a");
    expect(exploreAnchor?.getAttribute("href")).toContain("/features");

    const contactBtn = screen.getByText("Get in Touch");
    expect(contactBtn).toBeInTheDocument();
    const contactAnchor = contactBtn.closest("a");
    expect(contactAnchor?.getAttribute("href")).toContain("/contact");
  });

  it("renders the stats strip", () => {
    expect(screen.getByText("Active Users")).toBeInTheDocument();
    expect(screen.getByText("Countries Served")).toBeInTheDocument();
    expect(screen.getByText("Transactions")).toBeInTheDocument();
    expect(screen.getByText("NPS Score")).toBeInTheDocument();
  });

  it("renders the mission section", () => {
    expect(screen.getByText("Our Mission")).toBeInTheDocument();
    expect(screen.getByText("Empowering businesses to")).toBeInTheDocument();
    expect(screen.getByText("achieve more")).toBeInTheDocument();
    expect(screen.getByText(/Dashboard was born from a simple insight/)).toBeInTheDocument();
  });

  it("renders timeline milestones", () => {
    expect(screen.getByText("2020")).toBeInTheDocument();
    expect(screen.getByText("The Beginning")).toBeInTheDocument();
    expect(screen.getByText("2021")).toBeInTheDocument();
    expect(screen.getByText("First 1,000 Users")).toBeInTheDocument();
    expect(screen.getByText("2022")).toBeInTheDocument();
    expect(screen.getByText("Series A Funding")).toBeInTheDocument();
  });

  it("renders the values section", () => {
    expect(screen.getByText("Our Core Values")).toBeInTheDocument();
    expect(screen.getByText("Innovation First")).toBeInTheDocument();
    expect(screen.getByText("Trust & Security")).toBeInTheDocument();
    expect(screen.getByText("Customer Obsessed")).toBeInTheDocument();
    expect(screen.getByText("Global Scale")).toBeInTheDocument();
    expect(screen.getByText("Growth Mindset")).toBeInTheDocument();
    expect(screen.getByText("People First")).toBeInTheDocument();
  });

  it("renders value descriptions", () => {
    expect(screen.getByText(/push the boundaries of what's possible/)).toBeInTheDocument();
    expect(screen.getByText(/enterprise-grade security measures/)).toBeInTheDocument();
    expect(screen.getByText(/Every feature, every decision/)).toBeInTheDocument();
  });

  it("renders the team section", () => {
    expect(screen.getByText("Meet the Team")).toBeInTheDocument();
    expect(screen.getByText("Alex Chen")).toBeInTheDocument();
    expect(screen.getByText("Sarah Mitchell")).toBeInTheDocument();
    expect(screen.getByText("David Park")).toBeInTheDocument();
    expect(screen.getByText("Lisa Ramirez")).toBeInTheDocument();
  });

  it("renders team roles", () => {
    expect(screen.getByText("CEO & Co-Founder")).toBeInTheDocument();
    expect(screen.getByText("CTO & Co-Founder")).toBeInTheDocument();
    expect(screen.getByText("Head of Design")).toBeInTheDocument();
    expect(screen.getByText("VP of Engineering")).toBeInTheDocument();
  });

  it("renders team initials in avatar circles", () => {
    expect(screen.getByText("AC")).toBeInTheDocument();
    expect(screen.getByText("SM")).toBeInTheDocument();
    expect(screen.getByText("DP")).toBeInTheDocument();
    expect(screen.getByText("LR")).toBeInTheDocument();
  });

  it("renders the join our team link", () => {
    expect(screen.getByText("And 40+ more amazing people across 15 countries")).toBeInTheDocument();
    const joinLink = screen.getByText("Join our team");
    const anchor = joinLink.closest("a");
    expect(anchor?.getAttribute("href")).toContain("/contact");
  });

  it("renders the bottom CTA section", () => {
    expect(screen.getByText("Ready to transform your business?")).toBeInTheDocument();
    expect(
      screen.getByText(/Join thousands of businesses already using Dashboard/),
    ).toBeInTheDocument();

    const getStartedBtn = screen.getByText("Get Started Free");
    const anchor = getStartedBtn.closest("a");
    expect(anchor?.getAttribute("href")).toContain("/dashboard");

    const pricingBtn = screen.getByText("View Pricing");
    const pricingAnchor = pricingBtn.closest("a");
    expect(pricingAnchor?.getAttribute("href")).toContain("/pricing");
  });
});
