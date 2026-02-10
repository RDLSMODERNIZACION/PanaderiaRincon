"use client"

import { Card, CardBody, CardHeader } from "@/components/ui/Card"

export default function CamarasFrigorificasView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cámaras frigoríficas</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Acá vamos a ver temperaturas, alarmas y consumo (lo armamos después).
        </p>
      </div>

      <Card>
        <CardHeader title="Próximo paso" subtitle="Qué vamos a medir" />
        <CardBody className="space-y-2 text-sm text-zinc-700">
          <div>• Temperatura actual (°C) y gráfica 24/7</div>
          <div>• Estado compresor (on/off) + horas de uso</div>
          <div>• Alarmas: puerta abierta, alta/baja temperatura</div>
        </CardBody>
      </Card>
    </div>
  )
}
