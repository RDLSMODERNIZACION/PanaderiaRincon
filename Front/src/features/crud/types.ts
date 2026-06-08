export type TableMeta = {
  table: string
  label: string
  readOnly: boolean
  softDeleteColumn?: string | null
  allowedCreate: string[]
  allowedPatch: string[]
  searchColumns: string[]
  defaultOrderBy?: string | null
}

export type RowData = Record<string, any>
