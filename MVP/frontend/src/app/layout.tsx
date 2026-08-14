import type { Metadata } from "next";
import localFont from "next/font/local";
import Providers from "./providers";
import "./globals.css";

// Fonts are self-hosted rather than pulled through `next/font/google`.
// next/font/google downloads the woff2 files during `next build`, so a build
// machine that cannot reach fonts.gstatic.com fails the whole build — that is
// exactly how the Vercel deploy broke ("Failed to fetch `Inter` from Google
// Fonts"). These are the same Google-served latin variable faces, committed
// under src/app/fonts, so the build has no network dependency at all and the
// browser never calls out to a third-party origin at runtime.
//
// Each file is the variable font, so one file covers the full weight range the
// design uses. Refresh them from
// https://fonts.googleapis.com/css2?family=<Family>:wght@<range> if a family
// changes. All four are licensed under the SIL Open Font License 1.1.
const epilogue = localFont({
  src: "./fonts/Epilogue.woff2",
  weight: "300 900",
  variable: "--font-epilogue",
  display: "swap",
});

const manrope = localFont({
  src: "./fonts/Manrope.woff2",
  weight: "300 700",
  variable: "--font-manrope",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/Inter.woff2",
  weight: "300 700",
  variable: "--font-inter",
  display: "swap",
});

const syne = localFont({
  src: "./fonts/Syne.woff2",
  weight: "400 800",
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
