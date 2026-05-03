import { FormGroup, FormControlLabel, Checkbox, Input } from "@mui/material";
import './Part4.css'
import React from "react";
import { useTranslation } from "react-i18next";
import AffichageProps from "../../../../models/AffichageProps";

const Part4: React.FC<AffichageProps> = () => {
    const { t } = useTranslation();
    return(
        <>
         <FormGroup>
            <FormControlLabel control={<Checkbox defaultChecked />} label={t('paramSoc.general.part4.enregistrementAuto')} />
            <FormControlLabel control={<Checkbox  />} label={t('paramSoc.general.part4.importAuto')} />
            <FormControlLabel control={<Checkbox  />} label={t('paramSoc.general.part4.modeleEtat')} />
            <FormControlLabel control={<Input  />} label={t('paramSoc.general.part4.etatMois')} />
            <FormControlLabel control={<Input />} label={t('paramSoc.general.part4.badgeUnique')} />
            <div className="leftpart">
                <FormControlLabel control={<Checkbox  />} label={t('paramSoc.general.part4.siteUnique')} />
                <FormControlLabel control={<Checkbox  />} label={t('paramSoc.general.part4.genererBillet')} />
                <FormControlLabel control={<Checkbox  />} label={t('paramSoc.general.part4.separationZone')} />
                <FormControlLabel control={<Checkbox  />} label={t('paramSoc.general.part4.gererCentrePaie')} />
            </div>
        </FormGroup>
        </>
    )
}

export default Part4;