import { Text, Section, Heading, Button } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./EmailLayout";

interface ResetPasswordEmailProps {
  url?: string;
  locale?: string;
  resetLink?: string;
}

export default function ResetPasswordEmail({ resetLink = "https://example.com", url }: ResetPasswordEmailProps) {
  return (
    <EmailLayout previewText="Reset your password">
      <Heading className="text-zinc-900 text-[24px] font-bold p-0 my-[30px] mx-0">
        Reset Password
      </Heading>
      <Text className="text-zinc-700 text-[14px] leading-[24px]">
        We received a request to reset your password. Click the button below to choose a new password.
      </Text>
      <Section className="mt-[32px] mb-[32px]">
        <Button
          className="bg-[#F25C38] rounded-xl text-white text-[14px] font-semibold no-underline text-center px-6 py-3"
          href={url || resetLink}
        >
          Reset Password
        </Button>
      </Section>
      <Text className="text-zinc-500 text-[14px] leading-[24px]">
        If you didn't request a password reset, you can safely ignore this email. The link will expire in 1 hour.
      </Text>
    </EmailLayout>
  );
}
