// src/lib/export.ts
// CSV/Excel export helpers — Bengali friendly (UTF-8 BOM)

/**
 * CSV download with UTF-8 BOM (Excel এ বাংলা ঠিক দেখাবে)
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  // Escape cell values
  const escape = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];

  // UTF-8 BOM for Excel
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * JSON download
 */
export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Print a specific HTML element — uses hidden iframe
 */
export function printElement(elementId: string, title = "Report"): void {
  const element = document.getElementById(elementId);
  if (!element) {
    alert("Element পাওয়া যায়নি");
    return;
  }

  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) {
    alert("Popup blocked — please allow popups");
    return;
  }

  // Copy styles + content
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join("");

  printWindow.document.write(`
    <!doctype html>
    <html lang="bn">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      ${styles}
      <style>
        body { background: white; padding: 20px; }
        .no-print { display: none !important; }
        @page { size: A4; margin: 12mm 10mm; }
      </style>
    </head>
    <body>${element.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    // Auto close after print (optional)
    setTimeout(() => printWindow.close(), 500);
  }, 300);
}

/**
 * Format date for filename: 2026-10-05
 */
export function todayForFile(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
