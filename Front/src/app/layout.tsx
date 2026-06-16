import "./globals.css"
import Providers from "./providers"

export const metadata = {
  title: "Panadería Rincón | Gestión",
  description: "Sistema de gestión conectado al backend de Panadería Rincón"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}