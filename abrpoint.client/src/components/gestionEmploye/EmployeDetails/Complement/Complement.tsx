import { Grid, Box, Typography, Input, InputLabel, Select, FormControl, MenuItem } from "@mui/material";
import './Complement.css'
import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import Employe from "../../../../models/Employe";
interface EmployeDetailsProps {
  onChange: (data: any) => void;
  empData:Employe
}
export default function Complement({onChange,empData}:EmployeDetailsProps) {
    const { t } = useTranslation();

    const [formData, setFormData] = useState(empData);
    useEffect(() => {
        setFormData(empData);
    }, [empData]);

        const handleChange = (event:any) => {
        const { name, value } = event.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    useEffect(() => {
        onChange(formData);
    }, [formData, onChange]);
    return (
        <>
            <Box sx={{ flexGrow: 1 }}>
            {/* <Typography className="cordonne-arabe-title" variant="h6" component="div" gutterBottom>
                {t('employe.complement.arabicTitle') || 'Cordonées Arabe'}
            </Typography> */}
                <Grid container spacing={2}>
                    {/* <Grid item xs={7}> */}
                            {/* <Grid container spacing={2}> */}
                                {/* <Grid item xs={6}>
                                    <InputLabel shrink>{t('employe.complement.base') || 'S.Base/TH'}</InputLabel>
                                    <Input
                                        fullWidth
                                        size="small"
                                        name="emplibar"
                                        value={formData.emplibar}
                                        onChange={handleChange}
                                        sx={{ direction: 'rtl' }}
                                    />
                                </Grid> */}
                                {/* <Grid item xs={6}>
                                    <InputLabel sx={{ textAlign: 'right' }} shrink>العنوان</InputLabel>
                                    <Input
                                        fullWidth
                                        size="small"
                                        name="empadrar"
                                        value={formData.empadrar}
                                        onChange={handleChange}
                                        sx={{ direction: 'rtl' }}
                                    />
                                </Grid> */}
                                {/* <Grid  item xs={6}>
                                    <FormControl  variant="standard" fullWidth>
                                    <InputLabel  sx={{ textAlign: 'right' }} >الوظيفة</InputLabel>
                                    <Select
                                        fullWidth
                                        size="small"
                                        name="empfoncar"
                                        value={formData.empfoncar}
                                        onChange={handleChange}
                                        sx={{ direction: 'rtl' }}
                                    >
                                        <MenuItem sx={{direction:'rtl'}} value="manager">مدير</MenuItem>
                                        <MenuItem sx={{direction:'rtl'}} value="engineer">مهندس</MenuItem>
                                    </Select>
                                    </FormControl>
                                </Grid> */}
                              
                            {/* </Grid> */}
                    {/* </Grid> */}
                    <Grid item xs={12}>
                            <Grid container spacing={2}>
                                <Grid item xs={2}>
                                    <InputLabel shrink>S.Base/TH</InputLabel>
                                    <Input
                                        fullWidth
                                        size="small"
                                        name="empsbase"
                                        value={formData.empsbase}
                                        onChange={handleChange}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={2}>
                                <InputLabel shrink>{t('employe.complement.category') || 'Catégorie'}</InputLabel>
                                    <Input
                                        fullWidth
                                        size="small"
                                        name="empcat"
                                        value={formData.empcat}
                                        onChange={handleChange}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={1}>
                                <InputLabel shrink>{t('employe.complement.grossSalary') || 'S.Brut'}</InputLabel>
                                    <Input
                                        fullWidth
                                        size="small"
                                        name="empsbrut"
                                        value={formData.empsbrut}
                                        onChange={handleChange}
                                        required
                                    />
                                </Grid>
                                <Grid item xs={1}>
                                <InputLabel shrink>{t('employe.complement.netSalary') || 'S.Net'}</InputLabel>
                                    <Input
                                        fullWidth
                                        size="small"
                                        name="empsnet"
                                        value={formData.empsnet}
                                        onChange={handleChange}
                                    />
                                </Grid>
                                <Grid item xs={1}>
                                <InputLabel shrink>{t('employe.complement.echelon') || 'Echelon'}</InputLabel>
                                    <Input
                                        fullWidth
                                        size="small"
                                        name="empelon"
                                        value={formData.empelon}
                                        onChange={handleChange}
                                    />
                                </Grid>
                                <Grid item xs={1}>
                                <InputLabel shrink>{t('employe.complement.scale') || 'Echelle'}</InputLabel>
                                    <Input
                                        fullWidth
                                        size="small"
                                        name="empech"
                                        value={formData.empech}
                                        onChange={handleChange}
                                    />
                                </Grid>
                                <Grid item xs={2}>
                                <InputLabel shrink>{t('employe.complement.subCategory') || 'S.Catégorie'}</InputLabel>
                                    <Input
                                        fullWidth
                                        size="small"
                                        name="empscat"
                                        value={formData.empscat}
                                        onChange={handleChange}
                                        required
                                    />
                                </Grid>
                            </Grid>
                    </Grid>
                </Grid>
            </Box>
        </>
    );
}
