import type { Metadata } from "next";
import "./globals.css";
import FeedbackButton from "@/components/FeedbackButton";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Video Tool",
  description: "AI-powered Remotion video scene generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground">
        {/* Toasts replace the native alert()s and the "Loading" strings. The host
            is mounted once here so any screen can raise one. */}
        <ToastProvider>
          {children}
          <FeedbackButton />
        </ToastProvider>
      </body>
    </html>
  );
}
