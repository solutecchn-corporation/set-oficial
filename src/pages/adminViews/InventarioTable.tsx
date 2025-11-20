import React from "react";
import SupabaseTable from "../../components/SupabaseTable";

export default function InventarioTable() {
  return (
    <SupabaseTable
      table="inventario"
      select="id, nombre, sku, codigo_barras, categoria, marca, descripcion, modelo, publicacion_web, exento, creado_en,imagen"
      title="Inventario (tabla `inventario`)"
      columns={[
        "imagen",
        "sku",
        "nombre",
       
        "marca",
         "modelo",
         "categoria",
        "descripcion",
       
        "publicacion_web",
        "exento",
        "creado_en",
      ]}
      searchColumns={[
        "nombre",
        "sku",
        "descripcion",
        "codigo_barras",
        "modelo",
      ]}
      formExclude={["codigo_barras", "creado_en"]}
      allowAdd={true}
      allowEdit={true}
      allowDelete={true}
    />
  );
}
