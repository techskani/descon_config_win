import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { Providers } from './providers'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Descon",
  description: "For managing and monitoring Descon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${inter.className} overflow-x-hidden`}>
        <Providers>
          <div className="fixed top-0 left-0 w-full z-50">
            <Header />
          </div>
          <main className="pt-16 w-full">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
