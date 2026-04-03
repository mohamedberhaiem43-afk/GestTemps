import React, { useMemo } from "react";
import { MaterialReactTable, MRT_ColumnDef } from "material-react-table";
import { Button } from "@mui/material";
import { Qualification } from "../../../models/Qualification";
import useGetQualifications from "../../../hooks/QualificationHooks/useGetQualifications";
import { Edit } from "@mui/icons-material";

interface QualificationPropsList {
  onSelectQualification: (qualification: Qualification) => void;
}

export const QualificationList: React.FC<QualificationPropsList> = ({
  onSelectQualification,
}) => {
  const { data = [], isLoading } = useGetQualifications();

  const columns = useMemo<MRT_ColumnDef<Qualification>[]>(
    () => [
      { accessorKey: "quacod", header: "Code", size: 80 },
      { accessorKey: "qualib", header: "Libellé", size: 200 },
      {
        accessorKey: "catcod",
        header: "S/S Irpp",
        size: 80,
        Cell: ({ cell }) => (cell.getValue() == 1 ? "Oui" : "Non"),
      },
      {
        id: "actions",
        header: "Actions",
        Cell: ({ row }) => (
          <Button
            size="small"
            onClick={() => onSelectQualification(row.original)}
          >
            <Edit fontSize="small" />
          </Button>
        ),
      },
    ],
    [onSelectQualification]
  );  

  return (
  <MaterialReactTable
    columns={columns}
    data={data}
    state={{ isLoading }}
    
    enableColumnActions={false}
    enableColumnFilters={false}
    enableSorting={false}

    enablePagination
    initialState={{
      pagination: {
        pageIndex: 0,
        pageSize: 5,
      },
    }}
  />
);
};