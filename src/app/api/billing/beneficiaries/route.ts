import { NextResponse } from "next/server";
import { listBeneficiaries } from "@/lib/beneficiary-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const beneficiaries = listBeneficiaries(search);
    return NextResponse.json({ success: true, beneficiaries });
  } catch (error) {
    console.error("Error fetching beneficiaries:", error);
    return NextResponse.json({ error: "Failed to fetch beneficiaries" }, { status: 500 });
  }
}
