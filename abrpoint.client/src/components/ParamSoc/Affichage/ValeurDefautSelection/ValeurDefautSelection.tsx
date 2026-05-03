import { FormControl, FormControlLabel, InputLabel, MenuItem, Radio, RadioGroup, Select } from "@mui/material";
import './ValeurDefautSelection.css';
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Parametre } from "../../../../models/Parametre";



interface AffichageProps {
  parmetres?: Parametre | undefined;
  onChange?: (data: Partial<Parametre>) => void;
}

const ValeurDefautSelection: React.FC<AffichageProps> = ({ parmetres, onChange }) => {
    const { t } = useTranslation();
    const [nbhtr1M, setNbhtr1M] = React.useState(parmetres?.nbhtr1M);
    const [tauxtr1M, setTauxtr1M] = React.useState(parmetres?.tauxtr1M);
    const [tauxtr4, setTauxtr4] = React.useState(parmetres?.tauxtr4);
    const [nbhtr2M, setNbhtr2M] = React.useState(parmetres?.nbhtr2M);
        useEffect(() => {
            if (onChange) {
            onChange({
                nbhtr1M,
                tauxtr1M,
                tauxtr4,
                nbhtr2M,
            });
            }
        }, [nbhtr1M, tauxtr1M, tauxtr4, nbhtr2M]);
    return (
        <>
            <div className="selects">
                <div className="select">
                    <InputLabel shrink={true}>{t('paramSoc.affichage.valeurDefaut.regime')}</InputLabel>
                    <Select
                        variant="standard"
                        size='small'
                        labelId="intpaie-label"
                        label={t('paramSoc.affichage.valeurDefaut.regime')}
                        sx={{ width: '200px' }}  // Adjust width here
                        value={nbhtr1M}
                        onChange={(e)=>setNbhtr1M(Number(e.target.value))}
                    >
                        <MenuItem value={0}> {t('paramSoc.affichage.valeurDefaut.regime0')}</MenuItem>
                        <MenuItem value={1}> {t('paramSoc.affichage.valeurDefaut.regime1')}</MenuItem>
                        <MenuItem value={2}> {t('paramSoc.affichage.valeurDefaut.regime2')}</MenuItem>
                    </Select>
                </div>
                <div className="select">
                    <InputLabel shrink={true}>{t('paramSoc.affichage.valeurDefaut.presence')}</InputLabel>
                    <Select
                        variant="standard"
                        size='small'
                        label={t('paramSoc.affichage.valeurDefaut.presence')}
                        sx={{ width: '200px' }}
                        value={tauxtr1M}
                        onChange={(e)=>setTauxtr1M(Number(e.target.value))}
                    >
                        <MenuItem value={0}> {t('paramSoc.affichage.valeurDefaut.presence0')}</MenuItem>
                        <MenuItem value={1}> {t('paramSoc.affichage.valeurDefaut.presence1')}</MenuItem>
                        <MenuItem value={2}> {t('paramSoc.affichage.valeurDefaut.presence2')}</MenuItem>
                        <MenuItem value={3}> {t('paramSoc.affichage.valeurDefaut.presence3')}</MenuItem>
                        <MenuItem value={4}> {t('paramSoc.affichage.valeurDefaut.presence4')}</MenuItem>
                    </Select>
                </div>
                <FormControl component="fieldset">
                    <RadioGroup aria-label="gender" name="gender1" value={nbhtr2M} onChange={(e)=>setNbhtr2M(Number(e.target.value))}>
                        <FormControlLabel value={0} control={<Radio size="small" />} label={t('paramSoc.affichage.valeurDefaut.directe')} />
                        <FormControlLabel value={1} control={<Radio size="small" />} label={t('paramSoc.affichage.valeurDefaut.indirecte')} />
                        <FormControlLabel value={2} control={<Radio size="small" />} label={t('paramSoc.affichage.valeurDefaut.tous')} />
                    </RadioGroup>
                </FormControl>
                <div className="select">
                    <InputLabel shrink={true}>{t('paramSoc.affichage.valeurDefaut.modelePresence')}</InputLabel>
                    <Select
                        variant="standard"
                        size='small'
                        label={t('paramSoc.affichage.valeurDefaut.modelePresence')}
                        sx={{ width: '200px' }}
                        value={tauxtr4}
                        onChange={(e)=>setTauxtr4(Number(e.target.value))}
                    >
                        <MenuItem value={0}> {t('paramSoc.affichage.valeurDefaut.normal')}</MenuItem>
                        <MenuItem value={1}> {t('paramSoc.affichage.valeurDefaut.hebdomadaire')}</MenuItem>
                        <MenuItem value={2}> {t('paramSoc.affichage.valeurDefaut.septJourSemaine')}</MenuItem>
                    </Select>
                </div>
            </div>
        </>
    );
}
export default ValeurDefautSelection;