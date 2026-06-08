import ResourceTabs from "@/features/crud/ResourceTabs"

export default function CuentasView() {
  return (
    <ResourceTabs
      title="Cuentas corrientes"
      subtitle="Saldos en pesos de cada comercio y cuenta en kilos de pan viejo / pan rallado."
      tabs={[
        { table: "customer_account_movements", label: "Cuenta en pesos", description: "Movimientos de debe/haber por ventas, pagos y ajustes." },
        { table: "breadcrumb_account_movements", label: "Pan rallado", description: "Pan viejo recibido, pan rallado entregado y ajustes en kg." },
        { table: "customers", label: "Clientes", description: "Comercios vinculados a cuentas corrientes." },
        { table: "payments", label: "Pagos", description: "Pagos confirmados, pendientes o rechazados." }
      ]}
    />
  )
}
