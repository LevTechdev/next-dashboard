import { Text, Section, Heading, Button } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./EmailLayout";

interface WelcomeEmailProps {
  name?: string;
}

export default function WelcomeEmail({ name = "User" }: WelcomeEmailProps) {
  return (
    <EmailLayout previewText="Welcome to Next Dashboard">
      <Heading className="text-zinc-900 text-[24px] font-bold p-0 my-[30px] mx-0">
        Welcome, {name}!
      </Heading>
      <Text className="text-zinc-700 text-[14px] leading-[24px]">
        We're excited to have you on board. Next Dashboard helps you manage your projects, users, and subscriptions in one beautiful interface.
      </Text>
      <Section className="mt-[32px] mb-[32px]">
        <Button
          className="bg-[#F25C38] rounded-xl text-white text-[14px] font-semibold no-underline text-center px-6 py-3"
          href="https://example.com/login"
        >
          Go to Dashboard
        </Button>
      </Section>
    </EmailLayout>
  );
}
