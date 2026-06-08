"use client"

import { AuthProvider } from "@/features/auth/AuthProvider"

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
