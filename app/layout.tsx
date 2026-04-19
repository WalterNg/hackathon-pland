import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { RiskAlertToastProvider } from "./components/ui/risk-alert-toast-provider";

export const metadata: Metadata = {
  title: "Pland",
  description: "Crypto portfolio tracker and trading journal"
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#10131a"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="bg-background text-body">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap"
        />
        <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
        />
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="bg-background text-body antialiased transition-colors duration-200">
        {children}
        <RiskAlertToastProvider />
      </body>
    </html>
  );
}
