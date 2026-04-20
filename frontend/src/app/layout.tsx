import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { CommandPalette } from "@/components/ui/command-palette";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Monitor — Admin Dashboard",
  description: "Internal monitoring & health endpoint platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("theme")||"dark";document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t})()`,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen`}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <ConfirmProvider>
                {children}
                <CommandPalette />
              </ConfirmProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
