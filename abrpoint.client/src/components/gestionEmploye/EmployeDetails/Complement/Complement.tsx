
import { Grid, Box, Input, InputLabel } from "@mui/material";
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
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <Grid container spacing={2}>
                            {/* Salary Card - Rémunération */}
                            <Grid item xs={12}>
                                <Box sx={{
                                    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
                                    borderRadius: '12px',
                                    padding: '32px',
                                    color: '#fff',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: '0 8px 32px rgba(15, 39, 68, 0.3)',
                                    '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        top: 0,
                                        right: 0,
                                        width: '160px',
                                        height: '160px',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '50%',
                                        transform: 'translate(50%, -50%)',
                                    }
                                }}>
                                    {/* Header */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', position: 'relative', zIndex: 1 }}>
                                        <Box sx={{
                                            background: 'rgba(255,255,255,0.1)',
                                            borderRadius: '8px',
                                            padding: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#93b4e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="2" y="6" width="20" height="12" rx="2"/>
                                                <circle cx="12" cy="12" r="2"/>
                                                <path d="M6 12h.01M18 12h.01"/>
                                            </svg>
                                        </Box>
                                        <Box sx={{ 
                                            fontSize: '18px', 
                                            fontWeight: 700, 
                                            fontFamily: '"Manrope", sans-serif',
                                            letterSpacing: '-0.02em'
                                        }}>
                                            {t('employe.complement.remuneration') || 'Rémunération & Compléments'}
                                        </Box>
                                    </Box>

                                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                                        {/* Salaire de Base - Large display */}
                                        <Box sx={{ marginBottom: '24px' }}>
                                            <Box sx={{
                                                fontSize: '10px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '2px',
                                                fontWeight: 700,
                                                color: 'rgba(147, 180, 232, 0.6)',
                                                marginBottom: '8px'
                                            }}>
                                                {t('employe.complement.baseSalary') || 'Salaire de Base'}
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                <Input
                                                    name="empsbase"
                                                    value={formData.empsbase || ''}
                                                    onChange={handleChange}
                                                    sx={{
                                                        fontSize: '32px',
                                                        fontWeight: 800,
                                                        fontFamily: '"Manrope", sans-serif',
                                                        color: '#fff',
                                                        letterSpacing: '-0.02em',
                                                        '&:before': { display: 'none' },
                                                        '&:after': { borderBottomColor: '#93b4e8' },
                                                        input: { color: '#fff' }
                                                    }}
                                                    inputProps={{ style: { color: '#fff' } }}
                                                />
                                                <Box sx={{
                                                    fontSize: '14px',
                                                    fontWeight: 500,
                                                    color: '#93b4e8',
                                                }}>
                                                    MAD
                                                </Box>
                                            </Box>
                                        </Box>

                                        {/* Brut & Net side by side */}
                                        <Grid container spacing={2}>
                                            <Grid item xs={6}>
                                                <Box sx={{
                                                    fontSize: '10px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '2px',
                                                    fontWeight: 700,
                                                    color: 'rgba(147, 180, 232, 0.6)',
                                                    marginBottom: '4px'
                                                }}>
                                                    {t('employe.complement.grossSalary') || 'Salaire Brut'}
                                                </Box>
                                                <Input
                                                    name="empsbrut"
                                                    value={formData.empsbrut || ''}
                                                    onChange={handleChange}
                                                    sx={{
                                                        fontSize: '20px',
                                                        fontWeight: 700,
                                                        color: '#fff',
                                                        '&:before': { display: 'none' },
                                                        '&:after': { borderBottomColor: '#93b4e8' },
                                                        input: { color: '#fff' }
                                                    }}
                                                    inputProps={{ style: { color: '#fff' } }}
                                                />
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Box sx={{
                                                    fontSize: '10px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '2px',
                                                    fontWeight: 700,
                                                    color: 'rgba(147, 180, 232, 0.6)',
                                                    marginBottom: '4px'
                                                }}>
                                                    {t('employe.complement.netSalary') || 'Net à Payer'}
                                                </Box>
                                                <Input
                                                    name="empsnet"
                                                    value={formData.empsnet || ''}
                                                    onChange={handleChange}
                                                    sx={{
                                                        fontSize: '20px',
                                                        fontWeight: 700,
                                                        color: '#4edea3',
                                                        '&:before': { display: 'none' },
                                                        '&:after': { borderBottomColor: '#4edea3' },
                                                        input: { color: '#4edea3' }
                                                    }}
                                                    inputProps={{ style: { color: '#4edea3' } }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Box>
                            </Grid>

                            {/* Other complement fields */}
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