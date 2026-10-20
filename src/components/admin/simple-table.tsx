import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyRow } from "@/components/admin/page-header";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

/** Server-rendered table where the first column links to the row's editor. */
export function SimpleTable<T extends { id: string }>({ rows, columns, href, empty = "Nothing here yet." }: { rows: T[]; columns: Column<T>[]; href: (row: T) => string; empty?: string }) {
  return (
    <div className="rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow>{columns.map((c) => <TableHead key={c.header} className={c.className}>{c.header}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? <EmptyRow colSpan={columns.length}>{empty}</EmptyRow> : null}
          {rows.map((row) => (
            <TableRow key={row.id}>
              {columns.map((c, i) => (
                <TableCell key={c.header} className={c.className}>
                  {i === 0 ? <Link href={href(row)} className="font-medium hover:underline">{c.cell(row)}</Link> : c.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
