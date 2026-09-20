import { Geist_Mono, Public_Sans } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StaffHub",
  description: "Internal staffing operations for Technical Trading Agency",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
