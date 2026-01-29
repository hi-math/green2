"use client";

import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";

const PdfClient = nextDynamic(() => import("./PdfClient"), { ssr: false });

export default function PreviewPage() {
  return <PdfClient />;
}
