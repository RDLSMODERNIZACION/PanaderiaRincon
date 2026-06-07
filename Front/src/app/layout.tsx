import "./globals.css"

export const metadata = {
  title: "Panadería | Admin",
  description: "Dashboard de gestión para panadería (demo hardcodeado)"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
