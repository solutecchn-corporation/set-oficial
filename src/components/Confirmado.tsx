import React from "react";

type Props = {
  open: boolean;
  title?: string;
  message?: string;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
};

export default function Confirmado({
  open,
  title = "Confirmado",
  message = "",
  onClose,
  onCancel,
  onConfirm,
  confirmLabel = "Aceptar",
  cancelLabel = "Cancelar",
}: Props) {
  if (!open) return null;

  const handleConfirm = async () => {
    try {
      if (onConfirm) await onConfirm();
    } catch (e) {
      console.warn("Confirmado:onConfirm error", e);
    }
    try {
      if (onClose) onClose();
    } catch (e) {}
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 420,
          background: "#fff",
          borderRadius: 8,
          padding: 18,
          boxShadow: "0 4px 20px rgba(2,6,23,0.2)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <div style={{ marginTop: 8, color: "#334155" }}>{message}</div>
        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            className="btn-opaque"
            onClick={onCancel ?? onClose}
            style={{ width: "auto" }}
          >
            {cancelLabel}
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            style={{ width: "auto" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
