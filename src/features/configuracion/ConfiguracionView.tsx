"use client"

import { useState } from "react"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Select from "@/components/ui/Select"
import Input from "@/components/ui/Input"
import { Save } from "lucide-react"

export default function ConfiguracionView() {
  const [nombre, setNombre] = useState("Panadería Rincon")
  const [moneda, setMoneda] = useState("ARS")
  const [alertas, setAlertas] = useState(true)
  const [mermaMax, setMermaMax] = useState("0.06")

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
          <p className="mt-1 text-sm text-zinc-600">Pantalla demo para completar el “formato admin”.</p>
        </div>
        <Button>
          <Save className="mr-2 h-4 w-4" /> Guardar (demo)
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Negocio" subtitle="Preferencias generales" />
          <CardBody className="space-y-4">
            <div>
              <div className="text-xs text-zinc-500">Nombre</div>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-zinc-500">Moneda</div>
                <Select value={moneda} onChange={e => setMoneda(e.target.value)}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Merma máxima (alerta)</div>
                <Input value={mermaMax} onChange={e => setMermaMax(e.target.value)} />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Alertas operativas</div>
                  <div className="text-xs text-zinc-600">Stock bajo, merma alta, etc.</div>
                </div>
                <button
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100"
                  onClick={() => setAlertas(v => !v)}
                >
                  {alertas ? "Activadas" : "Desactivadas"}
                </button>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Estado" subtitle="Info rápida" />
          <CardBody className="space-y-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Ambiente</div>
              <div className="mt-1 text-sm font-semibold">Demo local</div>
              <div className="mt-2">
                <Badge variant="muted">Sin DB</Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Sugerencia</div>
              <div className="mt-1 text-sm text-zinc-700">
                Próximo paso: conectar endpoints de Node/Express o Node-RED para reemplazar{" "}
                <code className="rounded bg-zinc-100 px-1">seed.ts</code>.
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
