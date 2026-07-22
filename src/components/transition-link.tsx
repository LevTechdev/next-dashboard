"use client";

import Link from "next/link";
import { forwardRef, type ReactNode, type ComponentProps } from "react";

type NextLinkProps = ComponentProps<typeof Link>;

interface TransitionLinkProps extends NextLinkProps {
  /**
   * A unique name that identifies this element as a shared element
   * across page navigations. Elements with the same name on the old
   * and new page will smoothly morph between each other.
   *
   * The target page must have an element with the same viewTransitionName
   * applied via CSS or inline style.
   *
   * @example
   * ```tsx
   * // Source page
   * <TransitionLink href="/features" viewTransitionName="nav-logo">
   *   <Logo />
   * </TransitionLink>
   *
   * // Target page (e.g. layout.tsx)
   * <div style={{ viewTransitionName: "nav-logo" }}>
   *   <Logo />
   * </div>
   * ```
   */
  viewTransitionName?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A Next.js <Link> wrapper that enables View Transition API shared-element
 * morphing animations. When clicked, the `viewTransitionName` is applied to
 * the anchor before the view transition captures the old page state, allowing
 * the browser to smoothly morph this element to its counterpart on the new page.
 *
 * The counterpart on the target page must have the SAME `viewTransitionName`
 * value applied either via CSS (`view-transition-name: my-name`) or inline
 * `style={{ viewTransitionName: "my-name" }}`.
 */
const TransitionLink = forwardRef<HTMLAnchorElement, TransitionLinkProps>(
  ({ viewTransitionName, children, ...props }, ref) => {
    return (
      <Link
        ref={ref}
        data-view-transition-name={viewTransitionName}
        {...props}
      >
        {children}
      </Link>
    );
  }
);

TransitionLink.displayName = "TransitionLink";

export { TransitionLink };
export type { TransitionLinkProps };
