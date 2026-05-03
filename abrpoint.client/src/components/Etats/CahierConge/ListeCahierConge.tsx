import { Box, Skeleton } from "@mui/material";
import { MRT_ColumnDef } from "material-react-table";
import DataList from "../../lists/list";
import { useDateRange } from "../../Pointeuse/EtatPeriodique/FilterContext";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import CahierConge from "../../../models/CahierConge";
import useGetCahierConge from "../../../hooks/congeHooks/useGetCahierConge";

function ListeCahierConge() {
  const { t } = useTranslation();
  const round4 = (num: number) => Math.round(num * 10000) / 10000;
  const { dateRange } = useDateRange();

  // Assuming your hook returns { data, isLoading }
  const { data = [], isLoading } = useGetCahierConge(
    dateRange.dateDebut,
    dateRange.dateFin,
    dateRange.empcods
  );

  const columns = useMemo<MRT_ColumnDef<CahierConge>[]>(() => [
    {
      id: "cahier-conge",
      header: "",
      columns: [
        { accessorKey: "empmat", header: t('cahierConge.list.headers.matricule'), size: 60 },
        { accessorKey: "emplib", header: t('cahierConge.list.headers.name'), size: 180 },
        { accessorKey: "empdnais", header: t('cahierConge.list.headers.birthDate'), size: 60 },
        {
          accessorFn: (row: CahierConge) => {
            if (!row.empemb) return "";
            const date = new Date(row.empemb);
            return !isNaN(date.getTime()) ? date.toISOString().split("T")[0] : "";
          },
          accessorKey: "empemb",
          header: t('cahierConge.list.headers.hireDate'),
          size: 60,
        },
        { accessorKey: "empreg", header: t('cahierConge.list.headers.regime'), size: 60 },
        {
          accessorKey: "saljou",
          header: t('cahierConge.list.headers.salaryDaily'),
          size: 60,
          Cell: ({ cell }) => {
            const val = cell.getValue<number>();
            return val != null ? round4(val).toFixed(4) : "";
          },
        },
        {
          accessorKey: "somper",
          header: t('cahierConge.list.headers.sumReceived'),
          size: 60,
          Cell: ({ cell }) => {
            const val = cell.getValue<number>();
            return val != null ? round4(val).toFixed(4) : "";
          },
        },
        {
          accessorKey: "pretemps",
          header: t('cahierConge.list.headers.presenceTime'),
          size: 10,
          Cell: ({ cell }) => {
            const val = cell.getValue<number>();
            return val != null ? round4(val).toFixed(4) : "";
          },
        },
        { accessorKey: "soldini", header: t('cahierConge.list.headers.initialBalance'), size: 10 },
        { accessorKey: "congedu", header: t('cahierConge.list.headers.leaveDueDays'), size: 10 },
        { accessorKey: "indemdu", header: t('cahierConge.list.headers.leaveDueIndemnity'), size: 10 },
        { accessorKey: "jouanc", header: t('cahierConge.list.headers.seniorityDays'), size: 10 },
        { accessorKey: "montanc", header: t('cahierConge.list.headers.seniorityAmount'), size: 10 },
        { accessorKey: "conjeutrv", header: t('cahierConge.list.headers.youngWorkerLeave'), size: 10 },
        { accessorKey: "montjeutrv", header: t('cahierConge.list.headers.youngWorkerLeaveAmount'), size: 10 },
        { accessorKey: "jourjeutrv", header: t('cahierConge.list.headers.youngWorkerDays'), size: 10 },
        { accessorKey: "montjourjeutrv", header: t('cahierConge.list.headers.youngWorkerDaysAmount'), size: 10 },
        { accessorKey: "totdupres", header: t('cahierConge.list.headers.totalDuePresence'), size: 10 },
        { accessorKey: "indemcong", header: t('cahierConge.list.headers.leaveIndemnity'), size: 10 },
        {
          accessorFn: (row: CahierConge) => {
            if (!row.datdep) return "";
            const date = new Date(row.datdep);
            return !isNaN(date.getTime()) ? date.toISOString().split("T")[0] : "";
          },
          accessorKey: "datdep",
          header: t('cahierConge.list.headers.departureDate'),
          size: 60,
        },
        { accessorKey: "depam", header: t('cahierConge.list.headers.am'), size: 10 },
        {
          accessorFn: (row: CahierConge) => {
            if (!row.datret) return "";
            const date = new Date(row.datret);
            return !isNaN(date.getTime()) ? date.toISOString().split("T")[0] : "";
          },
          accessorKey: "datret",
          header: t('cahierConge.list.headers.returnDate'),
          size: 60,
        },
        { accessorKey: "retam", header: t('cahierConge.list.headers.am'), size: 10 },
      ],
    },
  ], [t]);

  // 🦴 Skeleton loading view
  if (isLoading) {
    return (
      
      <Box sx={{ p: 2 }}>
         <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" height={40} style={{ marginTop: 10 }} />
          <Skeleton variant="rectangular" height={40} style={{ marginTop: 10 }} />
      </Box>
    );
  }

  // ✅ Normal table view
  return (
    <DataList
      data={data}
      columns={columns}
      message={undefined}
      deleteMethod={undefined}
      idKey={"empmat"}
      refetchMethod={undefined}
      reportGeneration1={undefined}
      reportGeneration2={undefined}
      reportGeneration3={undefined}
      reportGeneration4={undefined}
      empHoraires={undefined}
      setData={undefined}
      pageSize={5}
      purge={undefined}
    />
  );
}

export default ListeCahierConge;
