"use client";

import dynamic from "next/dynamic";

const ClientRoot = dynamic(() => import("./client-root"), { ssr: false });

export default function Page() {
  return <ClientRoot />;
}