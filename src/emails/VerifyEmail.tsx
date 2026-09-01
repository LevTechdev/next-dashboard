import { Text, Section, Heading, Button } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./EmailLayout";

interface VerifyEmailProps {
  locale?: string;
  otp: string;
}

export default function VerifyEmail({ otp = "000000", locale }: VerifyEmailProps) {
  return (
    <EmailLayout previewText="Verify your email address">
      <Heading className="text-zinc-900 text-[24px] font-bold p-0 my-[30px] mx-0">
        Verify your email
      </Heading>
      <Text className="text-zinc-700 text-[14px] leading-[24px]">
        Thank you for signing up for Next Dashboard. Please enter the following OTP code to verify your email address:
      </Text>
      <Section className="bg-zinc-100 rounded-xl my-[24px] px-[24px] py-[16px] text-center">
        <Text className="text-[32px] font-mono font-bold tracking-widest text-[#F25C38] m-0">
          {otp}
        </Text>
      </Section>
      <Text className="text-zinc-500 text-[14px] leading-[24px]">
        If you didn't request this code, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}
