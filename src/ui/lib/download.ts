/** Save a file through the browser's download flow. */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Save text as a file through the browser's download flow. */
export function downloadText(name: string, content: string, type: string): void {
  downloadBlob(name, new Blob([content], { type }));
}
