import { Box, Grid } from "@mui/material";
import SaisiePointeuse from "./SaisiePointeuse";
import PointeuseList from "./ListPointeuse";
import { QueryClientProvider } from "react-query";
import { QueryClient } from "react-query";
import { useState } from "react";
import { Pointeuse as PointeuseModel } from "../../models/PointeuseModel";
import BreadcrumbNavigation from "../helper/BreadcrumbNavigation";

const queryClient = new QueryClient();

export default function Pointeuse() {
  const [selected, setSelected] = useState<PointeuseModel | null>(null);
  return (
    <QueryClientProvider client={queryClient}>
      <Box height={"82vh"} width={"95vw"} >
        <Grid
          container
          spacing={1}
          sx={{
            backgroundColor: "#ffffff",
          }}
        >
          <Grid item xs={12}>
        <BreadcrumbNavigation />
          </Grid>
          <Grid item xs={12}>
            <SaisiePointeuse selected={selected} />
          </Grid>

          <Grid item xs={12}>
            <PointeuseList setSelected={setSelected} />
          </Grid>
        </Grid>
      </Box>
    </QueryClientProvider>
  );
}
