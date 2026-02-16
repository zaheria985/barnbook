import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "@/components/Providers";
import ThemeProvider from "@/components/ThemeProvider";
import Sidebar from "@/components/Sidebar";
import BottomTabs from "@/components/BottomTabs";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Barnbook",
  description: "Equestrian management: budget tracking, ride logging, and more",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("barnbook-theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <ThemeProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto p-6 pb-20 md:p-8 md:pb-8">
                {children}
              </main>
            </div>
            <BottomTabs />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
