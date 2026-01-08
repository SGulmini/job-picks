import { NextResponse } from "next/server";

export async function GET() {
  const jobs = [
    {
      id: "1",
      title: "Data Analyst",
      company: "Acme",
      location: "Remote",
      url: "https://example.com/job/1",
    },
    {
      id: "2",
      title: "Frontend Developer (Next.js)",
      company: "Beta",
      location: "Milano (ibrido)",
      url: "https://example.com/job/2",
    },
    {
      id: "3",
      title: "Product Ops",
      company: "Gamma",
      location: "Zurigo",
      url: "https://example.com/job/3",
    },
  ];

  return NextResponse.json({ jobs });
}
