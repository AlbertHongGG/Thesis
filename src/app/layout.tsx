import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { KnowledgeBaseWorkspaceProvider } from '@/modules/shared/client/KnowledgeBaseWorkspaceProvider';
import "./globals.css";

const interSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfitDisplay = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Transition Thesis Generator",
  description: "Advanced RAG platform and thesis generation using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${interSans.variable} ${outfitDisplay.variable}`}>
      <body suppressHydrationWarning>
        <ToastProvider>
          <KnowledgeBaseWorkspaceProvider>{children}</KnowledgeBaseWorkspaceProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
