/**
 * A visually hidden data table that provides an accessible text alternative
 * for chart visualizations. Screen readers can convey the underlying data
 * values and labels through this table structure.
 *
 * Validates: Requirements 12.4
 */

export interface ChartTableColumn {
  header: string;
  /** Key or accessor function to get the cell value from a data row */
  accessor: string | ((row: Record<string, unknown>) => string | number);
}

export interface AccessibleChartTableProps {
  /** Descriptive caption for the table, read by screen readers */
  caption: string;
  /** Column definitions */
  columns: ChartTableColumn[];
  /** Data rows */
  data: Record<string, unknown>[];
  /** Optional aria-label override for the table element */
  ariaLabel?: string;
}

/**
 * Renders a screen-reader-only (sr-only) HTML table with chart data.
 * This ensures WCAG 2.1 compliance by providing structured text alternatives
 * for visual chart elements.
 */
export function AccessibleChartTable({
  caption,
  columns,
  data,
  ariaLabel,
}: AccessibleChartTableProps) {
  if (data.length === 0) return null;

  const getCellValue = (row: Record<string, unknown>, column: ChartTableColumn): string => {
    if (typeof column.accessor === 'function') {
      return String(column.accessor(row));
    }
    return String(row[column.accessor] ?? '');
  };

  return (
    <table className="sr-only" aria-label={ariaLabel || caption}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.header} scope="col">
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((col) => (
              <td key={col.header}>{getCellValue(row, col)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
