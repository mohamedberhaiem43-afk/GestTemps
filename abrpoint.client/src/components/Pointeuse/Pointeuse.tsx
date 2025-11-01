import { Box, Grid, Typography } from "@mui/material";
import SaisiePointeuse from "./SaisiePointeuse";
import PointeuseList from "./ListPointeuse";
import { QueryClientProvider } from "react-query";
import { QueryClient } from "react-query";
import { useState } from "react";
import { Pointeuse as PointeuseModel } from "../../models/PointeuseModel";

const queryClient = new QueryClient();

export default function Pointeuse() {
  const [selected, setSelected] = useState<PointeuseModel | null>(null);
  return (
    <QueryClientProvider client={queryClient}>
      <Box height={"80vh"} width={"95vw"} mt={3} ml={2}>
        <Grid
          container
          spacing={1}
          sx={{
            backgroundColor: "#ffffff",
          }}
        >
          <Grid item xs={12}>
            <Typography
              variant="h6"
              mt={-2}
              sx={{
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: "17px",
                fontFamily:
                  "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
              }}
              color={"primary"}
            >
              Gestion des pointeuses
            </Typography>
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
