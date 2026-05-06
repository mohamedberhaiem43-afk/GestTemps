import { Box, Grid } from "@mui/material"
import { useTranslation } from "react-i18next"
import InputComponent from "../../Inputs/Input"


function PeriodeShortcut() {
  const { t } = useTranslation();
  return (
<Box >
        <Grid container direction="row" spacing={2} alignItems="end" >
        <Grid item xs={3}>
            <p>{t('i18nFix.periodeShortcut.f2Hint')}</p>
        </Grid>
        <Grid item xs={0.5}>
        <InputComponent type='text' label='E0.5 ' value={undefined} setValue={undefined} />
        </Grid>
        <Grid item xs={0.5}>
        <InputComponent type='text' label='S0.5 ' value={undefined} setValue={undefined} />

        </Grid>
        <Grid item xs={0.5}>
        <InputComponent type='text' label='E2 ' value={undefined} setValue={undefined} />
        </Grid>
        <Grid item xs={0.5}>
            <InputComponent type='text' label='S2 ' value={undefined} setValue={undefined} />
        </Grid>
        <Grid item xs={0.8}>
            <InputComponent type='text' label='Total ' value={undefined} setValue={undefined} />
        </Grid>
        <Grid item xs={6} textAlign={'start'}>
            <p>F2 : Abs, F3 : Congé F4 : Aut.S, F5 : Organiser, F6 : Compenser, F10 : Choix Pointeuse
            
            </p>
        </Grid>
        </Grid>
    </Box>  )
}

export default PeriodeShortcut