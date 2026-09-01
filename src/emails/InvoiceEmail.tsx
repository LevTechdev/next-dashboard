import { Text, Section, Heading, Row, Column } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./EmailLayout";

interface InvoiceEmailProps {
  invoiceNumber?: string;
  url?: string;
  invoiceId?: string;
  amount: string;
  date: string;
  planName?: string;
}

export default function InvoiceEmail({ 
  invoiceId = "INV-123", invoiceNumber, url, 
  amount = "$49.00", 
  date = new Date().toLocaleDateString(),
  planName = "Professional Plan"
}: InvoiceEmailProps) {
  return (
    <EmailLayout previewText={`Your invoice ${invoiceNumber || invoiceId} is ready`}>
      <Heading className="text-zinc-900 text-[24px] font-bold p-0 my-[30px] mx-0">
        Invoice Receipt
      </Heading>
      <Text className="text-zinc-700 text-[14px] leading-[24px]">
        Thank you for your purchase! We've received your payment.
      </Text>
      
      <Section className="bg-zinc-50 rounded-xl my-[24px] p-[24px] border border-solid border-zinc-200">
        <Row className="mb-[12px]">
          <Column align="left"><Text className="m-0 text-zinc-500 text-[14px]">Invoice Number</Text></Column>
          <Column align="right"><Text className="m-0 font-medium text-zinc-900 text-[14px]">{invoiceNumber || invoiceId}</Text></Column>
        </Row>
        <Row className="mb-[12px]">
          <Column align="left"><Text className="m-0 text-zinc-500 text-[14px]">Date</Text></Column>
          <Column align="right"><Text className="m-0 font-medium text-zinc-900 text-[14px]">{date}</Text></Column>
        </Row>
        <Row className="mb-[12px]">
          <Column align="left"><Text className="m-0 text-zinc-500 text-[14px]">Plan</Text></Column>
          <Column align="right"><Text className="m-0 font-medium text-zinc-900 text-[14px]">{planName}</Text></Column>
        </Row>
        <Row className="border-t border-solid border-zinc-200 pt-[12px] mt-[12px]">
          <Column align="left"><Text className="m-0 text-zinc-900 font-bold text-[16px]">Total Paid</Text></Column>
          <Column align="right"><Text className="m-0 text-[#F25C38] font-bold text-[16px]">{amount}</Text></Column>
        </Row>
      </Section>
    </EmailLayout>
  );
}
