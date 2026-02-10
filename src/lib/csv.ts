export function toCsv(rows: Record<string, any>[]) {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const escape = (v: any) => {
    const s = String(v ?? "")
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(","))
  ]
  return lines.join("\n")
}

export function downloadCsv(filename: string, rows: Record<string, any>[]) {
  const csv = toCsv(rows)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
