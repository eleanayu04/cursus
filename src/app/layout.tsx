import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

// Public Sans: the same typeface Evidation uses.
const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cursus",
  description: "Rank the Duke courses you've taken and see what your friends thought.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${publicSans.variable} antialiased`}>
        <div className="mx-auto min-h-dvh max-w-md bg-bg">{children}</div>
      </body>
    </html>
  );
}
