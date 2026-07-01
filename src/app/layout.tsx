import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Provider } from "@/components/ui/provider";
import { CLUB_NAME } from "@/lib/constants";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: CLUB_NAME ? `Kabinen-Bar · ${CLUB_NAME}` : "Kabinen-Bar",
  description: "Getränke-Tracker für die Kabinen-Bar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Provider>{children}</Provider>
        <Analytics />
      </body>
    </html>
  );
}
