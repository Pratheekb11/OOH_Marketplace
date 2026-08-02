import type { Metadata } from "next";
import { Epilogue, Manrope, Inter, Syne } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

// next/font drives the CSS variables consumed by tailwind.config.ts'
// fontFamily.{headline,body,label,epilogue,manrope,inter,syne} keys.
const epilogue = Epilogue({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-epilogue",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AdSpace",
  description: "one stop for your OOH needs",
};

// Server component — must never become 'use client'. Auth/theme state that
// needs the client lives in <Providers>, not here.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${epilogue.variable} ${manrope.variable} ${inter.variable} ${syne.variable}`}
    >
      <head>
        {/* Material Symbols is a variable icon font (wght,FILL axes) whose
            axis support under next/font is fragile — loaded as a plain
            stylesheet link instead, per the build spec. `no-page-custom-font`
            assumes this is a per-page font in the pages/ router (where it
            would only load on one route); this is the app/ router's single
            root layout, so it already loads for every page — the warning
            doesn't apply here. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
