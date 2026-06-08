import Sidebar from "@/components/layout/Sidebar"
import Topbar from "@/components/layout/Topbar"
import ProtectedShell from "@/features/auth/ProtectedShell"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedShell>
      <div className="min-h-screen">
        <div className="flex">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Topbar />
            <main className="px-4 py-5 md:px-6 md:py-6">{children}</main>
          </div>
        </div>
      </div>
    </ProtectedShell>
  )
}
