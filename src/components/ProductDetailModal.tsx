import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  data: any;
  title?: string;
  onClose: () => void;
  onEdit: (row: any) => void;
  onDeleteClick: (id: any) => void;
};

export default function ProductDetailModal({
  open,
  data,
  title = "Detalle",
  onClose,
  onEdit,
  onDeleteClick,
}: Props) {
  if (!open) return null;

  const rows = data || {};
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const resolve = async () => {
      const src = typeof rows.imagen === "string" ? rows.imagen : null;
      if (!src) {
        if (mounted) setImgSrc(null);
        return;
      }
      // If already a full URL, use it
      if (src.startsWith("http")) {
        if (mounted) setImgSrc(src);
        return;
      }
      try {
        const sup = (await import("../lib/supabaseClient")).default;
        const BUCKET = (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string) || "inventario";
        const publicRes = await sup.storage.from(BUCKET).getPublicUrl(src);
        const publicUrl = (publicRes as any)?.data?.publicUrl || (publicRes as any)?.data?.publicURL || null;
        if (publicUrl) {
          if (mounted) setImgSrc(publicUrl);
          return;
        }
        const signed = await sup.storage.from(BUCKET).createSignedUrl(src, 60 * 60 * 24 * 7);
        if (signed.error) {
          console.warn("ProductDetailModal createSignedUrl error", signed.error);
          if (mounted) setImgSrc(null);
          return;
        }
        const url = (signed.data as any)?.signedUrl ?? null;
        if (mounted) setImgSrc(url);
      } catch (err) {
        console.error("ProductDetailModal resolve error", err);
        if (mounted) setImgSrc(null);
      }
    };
    resolve();
    return () => {
      mounted = false;
    };
  }, [rows]);

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 18,
          borderRadius: 8,
          width: 760,
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <h3 style={{ marginTop: 0 }}>{title}</h3>

        <div style={{ display: "flex", gap: 18 }}>
          <div style={{ flex: 1 }}>
            <table style={{ width: "100%" }}>
              <tbody>
                {Object.keys(rows).map((k) => {
                  const v = rows[k];
                  if (k === "imagen" && typeof v === "string") return null;
                  return (
                    <tr key={k}>
                      <td style={{ fontWeight: 700, padding: 6, width: 160 }}>
                        {String(k).replace(/_/g, " ").toUpperCase()}
                      </td>
                      <td style={{ padding: 6 }}>{String(v ?? "-")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ width: 280, textAlign: "center" }}>
            {imgSrc ? (
              <img
                src={encodeURI(imgSrc)}
                alt="imagen"
                style={{ maxWidth: 260, maxHeight: 260, objectFit: "contain" }}
                onError={(e) => {
                  console.warn("Image load failed for", imgSrc);
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div
                style={{
                  width: 260,
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f3f4f6",
                  color: "#6b7280",
                }}
              >
                Sin imagen
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn-opaque"
            onClick={() => onEdit(rows)}
          >
            Editar
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => onDeleteClick(rows.id)}
          >
            Eliminar
          </button>
          <button type="button" className="btn-opaque" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    (typeof document !== "undefined" && document.body) || document.createElement("div")
  );
}
