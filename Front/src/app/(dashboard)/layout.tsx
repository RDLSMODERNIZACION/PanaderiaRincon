import Sidebar from "@/components/layout/Sidebar"
import Topbar from "@/components/layout/Topbar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="flex">
        <Sidebar />
        <div className="flex-1">
          <Topbar />
          <main className="px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
