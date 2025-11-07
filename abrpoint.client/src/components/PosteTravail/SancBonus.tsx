import { Grid, Box, Input, Typography } from "@mui/material";

interface SancBonusProps {
  title: string;
  val1: number | undefined;
  val2: number | undefined;
  onChange?: (values: { val1: number; val2: number }) => void;
}

export default function SancBonus({ title, val1, val2, onChange }: SancBonusProps) {
  const handleChange = (field: "val1" | "val2") => 
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value) || 0;
      onChange?.({
        val1: field === "val1" ? value : val1 ?? 0,
        val2: field === "val2" ? value : val2 ?? 0,
      });
    };

  return (
    <Box
      component="fieldset"
      sx={{
        p: 2,
        borderRadius: 2,
        borderColor: "grey.400",
      }}
    >
      <legend>
        <Typography color="error">{title}</Typography>
      </legend>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Input 
            placeholder="mn" 
            value={val1 ?? ""} 
            onChange={handleChange("val1")}
            type="number"
            fullWidth 
          />
        </Grid>
        <Grid item xs={6}>
          <Input 
            type="number"
            placeholder="mn" 
            value={val2 ?? ""} 
            onChange={handleChange("val2")}
            fullWidth 
          />
        </Grid>
      </Grid>
    </Box>
  );
}
