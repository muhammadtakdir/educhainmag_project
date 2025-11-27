import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";

export const metadata: Metadata = {
  title: "EduChainMag - Learn Web3 on Cardano",
  description: "An interactive educational platform to learn about blockchain, Aiken smart contracts, and the Cardano ecosystem.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-900 text-white antialiased flex flex-col min-h-screen">
        <Providers>
          <Header />
          <main className="flex-grow">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
