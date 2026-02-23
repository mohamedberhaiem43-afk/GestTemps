import { useMaterialReactTable, MaterialReactTable } from "material-react-table";
import { Box, IconButton } from "@mui/material";
import { Refresh } from "@mui/icons-material";

type DataListProps = {
  data: any[];
  columns: any[];
  pageSize: number;
  onRowClick?: (row: any) => void;
  onSelectionChange?: (ips: string[]) => void; // triggered only on Refresh
};

// ✅ Build full IP: ip1.ip2.ip3.ip4:port
const buildIp = (row: any) =>
  `${row.poicod}`;

export default function PointeusesList({
  data,
  columns,
  pageSize,
  onRowClick,
  onSelectionChange,
}: DataListProps) {
  const table = useMaterialReactTable({
    columns,
    data: Array.isArray(data) ? data : [],
    enableRowSelection: true,
    initialState: {
      pagination: { pageIndex: 0, pageSize },
    },
    muiTableBodyRowProps: ({ row }) => {
      const isSelected = row.getIsSelected();

      return {
        onClick: (event: React.MouseEvent) => {
          if (event.ctrlKey) {
            // ctrl+click → toggle selection
            row.toggleSelected();
          } else {
            // normal click → single select
            table.resetRowSelection();
            row.toggleSelected(true);
          }

          if (onRowClick) {
            onRowClick(row.original); // pass clicked row to parent
          }
        },
        sx: {
          cursor: "pointer",
          backgroundColor: isSelected ? "rgba(173, 216, 230, 0.5)" : "inherit",
          "&:hover": {
            backgroundColor: isSelected
              ? "rgba(173, 216, 230, 0.7)"
              : "#f5f5f5",
          },
        },
      };
    },
    muiTableBodyCellProps: {
      sx: { padding: "2px 4px", fontSize: "0.75rem" },
    },
    muiTableHeadCellProps: {
      sx: { padding: "2px 4px", fontSize: "0.7rem", fontWeight: 600 },
    },
    renderTopToolbar: ({ table }) => (
      <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
        <IconButton
          color="primary"
          onClick={() => {
            const selectedRows = table.getSelectedRowModel().flatRows;
            const ipList = selectedRows.map((r) => buildIp(r.original));


            if (onSelectionChange) {
              onSelectionChange(ipList);
            }
          }}
        >
          <Refresh />
        </IconButton>
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
