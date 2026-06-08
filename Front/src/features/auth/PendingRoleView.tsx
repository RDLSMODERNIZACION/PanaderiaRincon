"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Clock, LogOut, ShieldAlert } from "lucide-react"
import Button from "@/components/ui/Button"
import { Card, CardBody } from "@/components/ui/Card"
import { useAuth } from "@/features/auth/AuthProvider"

export default function PendingRoleView() {
  const router = useRouter()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    router.replace("/login")
    router.refresh()
  }

  return (
    <div className="grid min-h-screen place-items-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-black">
            <Image
              src="/brand/logo-panaderia-rincon.png.jpeg"
              alt="Panadería Rincón"
              width={80}
              height={80}
              className="h-20 w-20 object-contain"
              priority
            />
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">
            Panadería Rincón
          </h1>

          <p className="mt-1 text-sm text-zinc-600">
            Gestión conectada
          </p>
        </div>

        <Card>
          <CardBody className="space-y-5 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-700">
              <Clock className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-zinc-900">
                Usuario pendiente de autorización
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Tu usuario fue registrado correctamente, pero todavía no tiene un rol asignado.
                Esperá a que un administrador te habilite como repartidor, administración o administrador.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />

                <div>
                  <div className="text-sm font-medium text-zinc-900">
                    Usuario actual
                  </div>

                  <div className="mt-1 text-sm text-zinc-600">
                    {user?.nombre || user?.userId || user?.user_id || "Sin nombre"}
                  </div>

                  <div className="mt-1 text-xs text-zinc-500">
                    Rol actual: Consulta
                  </div>
                </div>
              </div>
            </div>

            <Button type="button" variant="secondary" onClick={handleLogout} className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Salir
            </Button>
          </CardBody>
        </Card>

        <p className="text-center text-xs text-zinc-500">
          Contactá a administración si necesitás acceso.
        </p>
      </div>
    </div>
  )
}