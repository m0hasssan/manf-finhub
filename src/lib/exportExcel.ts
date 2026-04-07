import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface ExportOptions {
  title?: string;
  subtitle?: string;
  showTotalsRow?: boolean;
}

/**
 * Export data to a professionally formatted Excel file with Arabic RTL support.
 */
export async function exportToExcel(
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  options?: ExportOptions
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "نظام المحاسبة";
  workbook.created = new Date();

  // Sanitize worksheet name – Excel forbids: * ? : \ / [ ]
  const rawName = options?.title || "تقرير";
  const safeName = rawName.replace(/[*?:\\/\[\]]/g, "-").substring(0, 31);

  const sheet = workbook.addWorksheet(safeName, {
    views: [{ rightToLeft: true }],
    properties: { defaultColWidth: 18 },
  });

  // ── Colors ──
  const primaryColor = "1B4F72";
  const headerBg = "2C3E50";
  const headerFont = "FFFFFF";
  const altRowBg = "F8F9FA";
  const totalsBg = "D5F5E3";
  const totalsBorder = "27AE60";
  const borderColor = "BDC3C7";

  // ── Title row (if provided) ──
  let startRow = 1;
  if (options?.title) {
    const titleRow = sheet.addRow([options.title]);
    sheet.mergeCells(startRow, 1, startRow, headers.length);
    const titleCell = titleRow.getCell(1);
    titleCell.font = { name: "Cairo", size: 16, bold: true, color: { argb: primaryColor } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleRow.height = 35;
    startRow++;
  }

  if (options?.subtitle) {
    const subRow = sheet.addRow([options.subtitle]);
    sheet.mergeCells(startRow, 1, startRow, headers.length);
    const subCell = subRow.getCell(1);
    subCell.font = { name: "Cairo", size: 11, color: { argb: "7F8C8D" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    subRow.height = 22;
    startRow++;
  }

  if (options?.title || options?.subtitle) {
    sheet.addRow([]); // spacer
    startRow++;
  }

  // ── Header row ──
  const headerRow = sheet.addRow(headers);
  headerRow.height = 30;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Cairo", size: 11, bold: true, color: { argb: headerFont } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: headerBg },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: headerBg } },
      bottom: { style: "medium", color: { argb: primaryColor } },
      left: { style: "thin", color: { argb: headerBg } },
      right: { style: "thin", color: { argb: headerBg } },
    };
  });

  // ── Data rows ──
  rows.forEach((row, rowIndex) => {
    const dataRow = sheet.addRow(row);
    dataRow.height = 24;

    const isSectionHeader = typeof row[0] === "string" && (row[0] as string).startsWith("---");
    const isTotalsRow = options?.showTotalsRow !== false && rowIndex === rows.length - 1 && rows.length > 1;

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      // Base font
      cell.font = { name: "Cairo", size: 10.5 };
      cell.alignment = { horizontal: "center", vertical: "middle" };

      // Section header styling
      if (isSectionHeader) {
        cell.font = { name: "Cairo", size: 10.5, bold: true, color: { argb: primaryColor } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "EBF5FB" },
        };
        // Clean the "---" markers
        if (typeof cell.value === "string" && (cell.value as string).startsWith("---")) {
          cell.value = (cell.value as string).replace(/^-+\s*/, "").replace(/\s*-+$/, "");
        }
        return;
      }

      // Totals row
      if (isTotalsRow) {
        cell.font = { name: "Cairo", size: 11, bold: true, color: { argb: "1B7A43" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: totalsBg },
        };
        cell.border = {
          top: { style: "medium", color: { argb: totalsBorder } },
          bottom: { style: "double", color: { argb: totalsBorder } },
          left: { style: "thin", color: { argb: borderColor } },
          right: { style: "thin", color: { argb: borderColor } },
        };
        return;
      }

      // Alternating row colors
      if (rowIndex % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: altRowBg },
        };
      }

      // Borders
      cell.border = {
        top: { style: "thin", color: { argb: borderColor } },
        bottom: { style: "thin", color: { argb: borderColor } },
        left: { style: "thin", color: { argb: borderColor } },
        right: { style: "thin", color: { argb: borderColor } },
      };

      // Number formatting
      if (typeof cell.value === "number") {
        cell.numFmt = '#,##0.00';
        if ((cell.value as number) < 0) {
          cell.font = { ...cell.font, color: { argb: "E74C3C" } };
        }
      }

      // First column (labels) left-aligned
      if (colNumber === 1 && typeof cell.value === "string") {
        cell.alignment = { horizontal: "right", vertical: "middle" };
      }
    });
  });

  // ── Auto-fit column widths ──
  sheet.columns.forEach((column, i) => {
    let maxLength = headers[i]?.length || 10;
    rows.forEach((row) => {
      const val = row[i];
      const len = val != null ? String(val).length : 0;
      if (len > maxLength) maxLength = len;
    });
    column.width = Math.min(Math.max(maxLength + 4, 12), 40);
  });

  // ── Print setup ──
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9, // A4
  };

  // ── Generate and download ──
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${filename}.xlsx`);
}
