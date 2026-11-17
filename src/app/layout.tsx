import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SNGCE Library Print Queue | Sree Narayana Gurukulam College of Engineering",
  description: "Central Library automated document printing queue and student portal.",
  icons: {
    icon: [
      { url: "/sngce-logo.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/sngce-logo.png",
    apple: "/sngce-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col font-sans">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4">
              <p className="font-medium text-slate-700">
                Sree Narayana Gurukulam College of Engineering
              </p>
              <p className="mt-1 text-slate-400">
                Kadayiruppu, Kolenchery • Automated Document Queue Management System • Stage 3
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
