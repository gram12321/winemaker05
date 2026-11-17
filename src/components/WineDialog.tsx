import { useEffect, useRef } from "react";
import { Icon } from "../Icon";

interface WineDialogProps {
  open: boolean;
  onClose: () => void;
}

export function WineDialog({ open, onClose }: WineDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function closeDialog() {
    dialogRef.current?.close();
    onClose();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className="wine-dialog"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeDialog();
        }
      }}
      aria-labelledby="wine-dialog-title"
      aria-describedby="wine-dialog-description"
    >
      <div className="wine-dialog-header">
        <div className="wine-dialog-title"><span className="wine-dialog-icon"><Icon name="bottle" /></span><div><span className="eyebrow">FROM THE CELLAR</span><h2 id="wine-dialog-title">Wine details</h2></div></div>
        <button className="icon-button" type="button" aria-label="Close wine details" onClick={closeDialog}><Icon name="close" /></button>
      </div>
      <p id="wine-dialog-description" className="wine-dialog-intro">A place for the whole story of a wine, from its origins to its life in the cellar.</p>
      <div className="wine-dialog-grid">
        <section className="wine-identity"><span className="wine-identity-icon"><Icon name="bottle" /></span><span className="eyebrow">THE WINE</span><h3>Identity & origin</h3><p>Wine identity, origin, and material history will appear here.</p><div className="wine-empty-line" /><div className="wine-empty-line short" /></section>
        <div className="wine-sections">
          <section><span className="eyebrow">WHERE IT BEGINS</span><h3>Raw material potential</h3><p>The possibilities established by the vineyard and harvest.</p></section>
          <section><span className="eyebrow">THROUGH TIME</span><h3>Development & storage</h3><p>The wine's changing state, processes, and conditions.</p></section>
          <section><span className="eyebrow">THE EXPERIENCE</span><h3>Sensory expression & evaluation</h3><p>Structure and taste, presented with their evaluation context.</p></section>
          <section><span className="eyebrow">BEYOND THE CELLAR</span><h3>Commercial context</h3><p>Inventory, origin prestige, and market context have their own place.</p></section>
        </div>
      </div>
      <div className="wine-dialog-footer"><span>Every wine has a story.</span><button className="secondary-button" type="button" onClick={closeDialog}>Close</button></div>
    </dialog>
  );
}
