export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 p-6">
      <div className="max-w-md rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <div className="text-sm font-semibold text-zinc-500">404</div>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900">Página no encontrada</h1>
        <p className="mt-2 text-sm text-zinc-600">
          La sección que intentaste abrir no existe o ya no está disponible.
        </p>
        <a
          href="/login"
          className="mt-5 inline-flex rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Ir al login
        </a>
      </div>
    </main>
  )
}
