import { Grid } from "@mui/material";
import { useEffect, useState } from "react";
import SancBonus from "./SancBonus";

interface SancBonusLegendProps {
  retsanc?: number;
  retmin?: number;
  avabon?: number;
  avamn?: number;
  retsancam?: number;
  retminam?: number;
  onChange?: (data: {
    retsanc: number;
    retmin: number;
    avabon: number;
    avamn: number;
    retsancam: number;
    retminam: number;
  }) => void;
}

export default function SancBonusLegend(props: SancBonusLegendProps) {
  const [values, setValues] = useState({
    retsanc: props.retsanc ?? 0,
    retmin: props.retmin ?? 0,
    avabon: props.avabon ?? 0,
    avamn: props.avamn ?? 0,
    retsancam: props.retsancam ?? 0,
    retminam: props.retminam ?? 0,
  });
  useEffect(() => {
    setValues({
      retsanc: props.retsanc ?? 0,
      retmin: props.retmin ?? 0,
      avabon: props.avabon ?? 0,
      avamn: props.avamn ?? 0,
      retsancam: props.retsancam ?? 0,
      retminam: props.retminam ?? 0,
    });
  }, [props.retsanc, props.retmin, props.avabon, props.avamn, props.retsancam, props.retminam]);

  useEffect(() => {
    props.onChange?.(values);
  }, [values, props]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={4}>
        <SancBonus
          title="Sanction Retard pour retard dépassant"
          val1={values.retsanc}
          val2={values.retmin}
          onChange={({ val1, val2 }) =>
            setValues((prev) => ({ ...prev, retsanc: val1, retmin: val2 }))
          }
        />
      </Grid>
      <Grid item xs={4}>
        <SancBonus
          title="Sanction Sortie pour tout avance"
          val1={values.avabon}
          val2={values.avamn}
          onChange={({ val1, val2 }) =>
            setValues((prev) => ({ ...prev, avabon: val1, avamn: val2 }))
          }
        />
      </Grid>
      <Grid item xs={4}>
        <SancBonus
          title="Bonus présence pour avance dépassant"
          val1={values.retsancam}
          val2={values.retminam}
          onChange={({ val1, val2 }) =>
            setValues((prev) => ({ ...prev, retsancam: val1, retminam: val2 }))
          }
        />
      </Grid>
    </Grid>
  );
}
