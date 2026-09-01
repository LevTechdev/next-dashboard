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

interface EmailLayoutProps {
  previewText: string;
  children: React.ReactNode;
}

export default function EmailLayout({ previewText, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-zinc-50 my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-zinc-200 rounded-2xl my-[40px] mx-auto p-[20px] max-w-[600px] bg-white shadow-sm">
            {/* Header */}
            <Section className="mt-[8px] mb-[24px]">
              <Row>
                <Column align="left">
                  <Row>
                    <Column className="w-8">
                      <div className="bg-[#F25C38] w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold">
                        <span className="text-xl">✧</span>
                      </div>
                    </Column>
                    <Column className="pl-3">
                      <Text className="text-2xl font-bold text-zinc-900 m-0 tracking-tight">
                        Next Dashboard
                      </Text>
                    </Column>
                  </Row>
                </Column>
              </Row>
            </Section>

            {/* Content */}
            {children}

            <Hr className="border border-solid border-zinc-200 my-[26px] mx-0 w-full" />

            {/* Footer / Features Section */}
            <Section className="text-center pb-4">
              <Text className="text-zinc-500 text-[12px] leading-[24px]">
                You received this email because you are a registered user of Next Dashboard.
              </Text>
              
              <Row className="mt-4">
                <Column align="center">
                  <Link href="https://example.com" className="text-[#F25C38] text-[12px] px-2 font-medium">
                    Features
                  </Link>
                  <span className="text-zinc-300">|</span>
                  <Link href="https://example.com/pricing" className="text-[#F25C38] text-[12px] px-2 font-medium">
                    Pricing
                  </Link>
                  <span className="text-zinc-300">|</span>
                  <Link href="https://example.com/changelog" className="text-[#F25C38] text-[12px] px-2 font-medium">
                    Changelog
                  </Link>
                </Column>
              </Row>
              <Text className="text-zinc-400 text-[12px] leading-[24px] mt-4">
                © {new Date().getFullYear()} Next Dashboard. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
