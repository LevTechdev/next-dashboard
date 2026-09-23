import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
  Row,
  Column,
} from "@react-email/components";
import * as React from "react";

/**
 * Brand base URL — real marketing routes for the footer links. Override with
 * APP_URL / NEXT_PUBLIC_APP_URL in production; defaults match the deployed
 * marketing site.
 */
export const EMAIL_APP_URL =
  process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://nextdashboards.id";

/** Brand constants — lime/green identity per the product style guide. */
export const BRAND_NAME = "Next Dashboards";
export const BRAND_LOGO_URL = `${EMAIL_APP_URL}/logo.svg`;
export const BRAND_PRIMARY = "#16a34a"; // green-600
export const BRAND_LIME = "#84cc16"; // lime-500

interface EmailLayoutProps {
  previewText: string;
  children: React.ReactNode;
}

/**
 * Shared email shell: lime/green brand header with the product wordmark,
 * content slot, real-link footer (Features / Pricing / Changelog), and the
 * compliance footer. Rendered through @react-email/components so it works in
 * every major client (Outlook, Gmail, Apple Mail).
 */
export default function EmailLayout({ previewText, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-zinc-50 my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-zinc-200 rounded-2xl my-[40px] mx-auto p-[20px] max-w-[600px] bg-white shadow-sm">
            {/* Header — brand mark + wordmark */}
            <Section className="mt-[8px] mb-[24px]">
              <Row>
                <Column align="left">
                  <Row>
                    <Column className="w-10">
                      <Img
                        src={BRAND_LOGO_URL}
                        width={36}
                        height={36}
                        alt={BRAND_NAME}
                        className="rounded-lg align-middle"
                      />
                    </Column>
                    <Column className="pl-3 align-middle">
                      <Text className="text-2xl font-bold m-0 tracking-tight text-[#16a34a]">
                        Next <span className="text-[#84cc16]">Dashboards</span>
                      </Text>
                    </Column>
                  </Row>
                </Column>
              </Row>
            </Section>

            {/* Content */}
            {children}

            <Hr className="border border-solid border-zinc-200 my-[26px] mx-0 w-full" />

            {/* Footer — real marketing links */}
            <Section className="text-center pb-4">
              <Text className="text-zinc-500 text-[12px] leading-[24px]">
                You received this email because you are a registered user of {BRAND_NAME}.
              </Text>

              <Row className="mt-4">
                <Column align="center">
                  <Link
                    href={`${EMAIL_APP_URL}/features`}
                    className="text-[#16a34a] text-[12px] px-2 font-medium"
                  >
                    Features
                  </Link>
                  <span className="text-zinc-300">|</span>
                  <Link
                    href={`${EMAIL_APP_URL}/pricing`}
                    className="text-[#16a34a] text-[12px] px-2 font-medium"
                  >
                    Pricing
                  </Link>
                  <span className="text-zinc-300">|</span>
                  <Link
                    href={`${EMAIL_APP_URL}/changelog`}
                    className="text-[#16a34a] text-[12px] px-2 font-medium"
                  >
                    Changelog
                  </Link>
                </Column>
              </Row>
              <Text className="text-zinc-400 text-[12px] leading-[24px] mt-4">
                © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

/** Shared heading style for email bodies — keeps every template consistent. */
export function EmailHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading className="text-zinc-900 text-[24px] font-bold p-0 my-[24px] mx-0">{children}</Heading>
  );
}

/** Highlighted panel used for codes, URLs, and key details. */
export function EmailHighlight({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Section className={`bg-zinc-100 rounded-xl my-[24px] px-[24px] py-[16px] ${className}`}>
      {children}
    </Section>
  );
}

/** Muted helper line under a CTA or code. */
export function EmailNote({ children }: { children: React.ReactNode }) {
  return <Text className="text-zinc-500 text-[14px] leading-[24px]">{children}</Text>;
}
