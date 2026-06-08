import ResourceTabs from "@/features/crud/ResourceTabs"

export default function RepartoView() {
  return (
    <ResourceTabs
      title="Reparto y rendición"
      subtitle="Control de repartidores, stock cargado, visitas, ventas, pagos, devoluciones y cierres."
      tabs={[
        { table: "delivery_runs", label: "Repartos", description: "Día, repartidor, recorrido y estado del reparto." },
        { table: "delivery_run_stock", label: "Stock", description: "Mercadería cargada, devuelta y diferencias por producto." },
        { table: "delivery_visits", label: "Visitas", description: "Cada parada en comercio con GPS, bloqueo y observaciones." },
        { table: "delivery_visit_items", label: "Mercadería", description: "Productos vendidos, bonificados, devueltos o ajustados en cada visita." },
        { table: "payments", label: "Pagos", description: "Efectivo, transferencia, Mercado Pago, QR y pagos pendientes." },
        { table: "delivery_run_closures", label: "Cierres", description: "Resumen final del repartidor y diferencias de efectivo/stock." },
        { table: "delivery_routes", label: "Recorridos", description: "Recorridos habilitados." },
        { table: "delivery_route_customers", label: "Locales por recorrido", description: "Orden de visita de cada comercio." }
      ]}
    />
  )
}
