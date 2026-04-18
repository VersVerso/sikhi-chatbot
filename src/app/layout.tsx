import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sikhi Learning Chatbot",
  description:
    "MVP SGGS RAG chatbot with Quick/Deep modes, DE/EN output, and mandatory Gurmukhi citations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
