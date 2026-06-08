from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.utils.naming import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        extra="forbid",
    )


CategoriaProducto = str
UnidadVenta = str
UnidadInsumo = str
CanalVenta = str
MedioPago = str
Turno = str
MovimientoTipo = str
RolEmpleado = str
Horno = str


class ProductoCreate(ApiModel):
    id: str | None = None
    nombre: str
    categoria: CategoriaProducto
    unidad_venta: UnidadVenta
    precio_venta: float = 0
    costo_unitario: float = 0
    activo: bool = True
    receta_id: str | None = None


class ProductoPatch(ApiModel):
    nombre: str | None = None
    categoria: CategoriaProducto | None = None
    unidad_venta: UnidadVenta | None = None
    precio_venta: float | None = None
    costo_unitario: float | None = None
    activo: bool | None = None
    receta_id: str | None = None


class InsumoCreate(ApiModel):
    id: str | None = None
    nombre: str
    unidad: UnidadInsumo
    proveedor: str = ""
    costo_unitario: float = 0
    stock_actual: float = 0
    stock_minimo: float = 0


class InsumoPatch(ApiModel):
    nombre: str | None = None
    unidad: UnidadInsumo | None = None
    proveedor: str | None = None
    costo_unitario: float | None = None
    stock_actual: float | None = None
    stock_minimo: float | None = None


class RecetaIngredienteIn(ApiModel):
    insumo_id: str
    cantidad: float
    unidad: UnidadInsumo


class RecetaCreate(ApiModel):
    id: str | None = None
    product_id: str
    rinde_unidades: float = Field(gt=0)
    ingredientes: list[RecetaIngredienteIn]


class RecetaPatch(ApiModel):
    product_id: str | None = None
    rinde_unidades: float | None = None
    ingredientes: list[RecetaIngredienteIn] | None = None


class TicketItemIn(ApiModel):
    product_id: str
    cantidad: float
    precio_unitario: float


class TicketCreate(ApiModel):
    id: str | None = None
    fecha: datetime | None = None
    canal: CanalVenta
    medio_pago: MedioPago
    descuento: float = 0
    items: list[TicketItemIn]


class ProduccionCreate(ApiModel):
    id: str | None = None
    fecha: datetime | None = None
    turno: Turno
    product_id: str
    planificado: float = 0
    producido: float = 0
    merma: float = 0
    nota: str | None = None


class ProduccionPatch(ApiModel):
    fecha: datetime | None = None
    turno: Turno | None = None
    product_id: str | None = None
    planificado: float | None = None
    producido: float | None = None
    merma: float | None = None
    nota: str | None = None


class MovimientoInventarioCreate(ApiModel):
    id: str | None = None
    fecha: datetime | None = None
    supply_id: str
    tipo: MovimientoTipo
    cantidad: float
    motivo: str = ""
    referencia: str | None = None


class MovimientoInventarioPatch(ApiModel):
    fecha: datetime | None = None
    supply_id: str | None = None
    tipo: MovimientoTipo | None = None
    cantidad: float | None = None
    motivo: str | None = None
    referencia: str | None = None


class EmpleadoCreate(ApiModel):
    id: str | None = None
    nombre: str
    rol: RolEmpleado
    costo_hora: float = 0
    activo: bool = True


class EmpleadoPatch(ApiModel):
    nombre: str | None = None
    rol: RolEmpleado | None = None
    costo_hora: float | None = None
    activo: bool | None = None


class TurnoPersonalCreate(ApiModel):
    id: str | None = None
    fecha: datetime | None = None
    employee_id: str
    horas: float


class EnergiaCreate(ApiModel):
    id: str | None = None
    fecha: datetime | None = None
    horno: Horno
    kwh: float = 0
    costo: float = 0


class EnergiaPatch(ApiModel):
    fecha: datetime | None = None
    horno: Horno | None = None
    kwh: float | None = None
    costo: float | None = None
