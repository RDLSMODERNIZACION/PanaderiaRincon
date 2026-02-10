"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import OnMinutesArea from "@/components/charts/OnMinutesArea"
import { formatDateTime, formatNumber } from "@/lib/utils"
import { Flame, Save, Power, PowerOff, Trash2 } from "lucide-react"

type HornoEvent = {
  ts: number // epoch ms
  state: "on" | "off"
}

const LS_START_TIME = "panaderia.maquinaria.hornos.start_time"
const LS_EVENTS = "panaderia.maquinaria.hornos.events"

function safeParseEvents(raw: string | null): HornoEvent[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .map((x: any) => ({
        ts: typeof x?.ts === "number" ? x.ts : Number(x?.ts),
        state: x?.state === "on" || x?.state === "off" ? x.state : null
      }))
      .filter((x: any) => Number.isFinite(x.ts) && (x.state === "on" || x.state === "off"))
      .sort((a, b) => a.ts - b.ts)
  } catch {
    return []
  }
}

function computeMinutesOnPerHour(last24hEvents: HornoEvent[], nowMs: number) {
  const startMs = nowMs - 24 * 60 * 60 * 1000

  // Eventos dentro
  const all = last24hEvents
    .filter(e => e.ts >= startMs && e.ts <= nowMs)
    .sort((a, b) => a.ts - b.ts)

  // Estado al inicio (startMs) mirando el último evento <= startMs
  let stateAtStart: "on" | "off" = "off"
  const prev = last24hEvents
    .filter(e => e.ts < startMs)
    .sort((a, b) => b.ts - a.ts)[0]
  if (prev) stateAtStart = prev.state

  // “cortes” desde startMs hasta nowMs
  const cuts: { ts: number; state: "on" | "off" }[] = [{ ts: startMs, state: stateAtStart }, ...all]
  cuts.push({ ts: nowMs, state: cuts[cuts.length - 1]?.state ?? stateAtStart })

  // 24 buckets
  const buckets: { label: string; minutesOn: number }[] = []
  for (let i = 0; i < 24; i++) {
    const bucketStart = startMs + i * 60 * 60 * 1000
    const bucketEnd = bucketStart + 60 * 60 * 1000
    const d = new Date(bucketStart)
    const label = `${String(d.getHours()).padStart(2, "0")}:00`
    buckets.push({ label, minutesOn: 0 })

    for (let j = 0; j < cuts.length - 1; j++) {
      const a = cuts[j]
      const b = cuts[j + 1]
      const segStart = Math.max(a.ts, bucketStart)
      const segEnd = Math.min(b.ts, bucketEnd)
      if (segEnd <= segStart) continue
      if (a.state === "on") buckets[i].minutesOn += (segEnd - segStart) / 60000
    }
  }

  return buckets.map(x => ({
    dia: x.label,
    ventas: Math.round(x.minutesOn) // minutos
  }))
}

export default function HornosView() {
  const [startTime, setStartTime] = useState<string>("06:00")
  const [events, setEvents] = useState<HornoEvent[]>([])
  const [nowTick, setNowTick] = useState<number>(() => Date.now())

  useEffect(() => {
    const st = localStorage.getItem(LS_START_TIME)
    if (st) setStartTime(st)

    const ev = safeParseEvents(localStorage.getItem(LS_EVENTS))
    setEvents(ev)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const currentState: "on" | "off" = useMemo(() => {
    const last = [...events].sort((a, b) => b.ts - a.ts)[0]
    return last?.state ?? "off"
  }, [events])

  const chartData = useMemo(() => {
    return computeMinutesOnPerHour(events, nowTick)
  }, [events, nowTick])

  function saveStartTime() {
    localStorage.setItem(LS_START_TIME, startTime)
  }

  function pushEvent(state: "on" | "off") {
    const next: HornoEvent[] = [...events, { ts: Date.now(), state }].sort((a, b) => a.ts - b.ts)
    setEvents(next)
    localStorage.setItem(LS_EVENTS, JSON.stringify(next))
  }

  function clearEvents() {
    setEvents([])
    localStorage.setItem(LS_EVENTS, JSON.stringify([]))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Hornos</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Configuración de arranque y seguimiento de encendido (últimas 24 hs).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={currentState === "on" ? "success" : "muted"}>
            <span className="inline-flex items-center gap-2">
              <Flame className="h-4 w-4" />
              Estado: {currentState === "on" ? "Prendido" : "Apagado"}
            </span>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Encendido por hora"
            subtitle="Minutos encendido en cada hora (últimas 24 hs)"
          />
          <CardBody>
            <OnMinutesArea data={chartData} />
            <div className="mt-2 text-xs text-zinc-500">
              Nota: por ahora es demo local (se guarda en tu navegador). Después lo conectamos a Node-RED / backend.
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Configuración" subtitle="Hora programada de arranque" />
          <CardBody className="space-y-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Hora de arranque</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-10 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
                <Button onClick={saveStartTime} variant="secondary">
                  <Save className="mr-2 h-4 w-4" />
                  Guardar
                </Button>
              </div>
              <div className="mt-2 text-xs text-zinc-600">
                Guardado actual: <span className="font-semibold">{startTime}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-semibold text-zinc-700">Registrar estado</div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Button onClick={() => pushEvent("on")}>
                  <Power className="mr-2 h-4 w-4" />
                  Marcar ENCENDIDO
                </Button>
                <Button variant="secondary" onClick={() => pushEvent("off")}>
                  <PowerOff className="mr-2 h-4 w-4" />
                  Marcar APAGADO
                </Button>
                <Button variant="secondary" onClick={clearEvents}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Borrar historial
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Historial de eventos" subtitle="Últimos cambios registrados (demo local)" />
        <CardBody className="space-y-2">
          {events.length === 0 ? (
            <div className="text-sm text-zinc-600">Todavía no hay eventos registrados.</div>
          ) : (
            <div className="space-y-2">
              {[...events].sort((a, b) => b.ts - a.ts).slice(0, 20).map((e, idx) => (
                <div
                  key={`${e.ts}-${idx}`}
                  className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                >
                  <div className="text-sm font-medium">{e.state === "on" ? "Encendido" : "Apagado"}</div>
                  <div className="text-sm text-zinc-600">{formatDateTime(new Date(e.ts).toISOString())}</div>
                </div>
              ))}
              <div className="text-xs text-zinc-500">
                Total eventos guardados: <span className="font-semibold">{formatNumber(events.length)}</span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
