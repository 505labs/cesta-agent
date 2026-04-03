import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import AppKitProvider from "@/lib/appkit";

export const metadata: Metadata = {
  title: "RoadTrip Co-Pilot",
  description: "Give your car a wallet. Voice-first AI road trip agent with group USDC treasury.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const cookies = headersList.get("cookie");

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--bg-primary)] antialiased">
        <AppKitProvider cookies={cookies}>
          {children}
        </AppKitProvider>
      </body>
    </html>
  );
}
