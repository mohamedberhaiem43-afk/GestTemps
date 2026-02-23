import { Box, Grid, Input, InputLabel, Typography } from "@mui/material";
import { useTranslation } from 'react-i18next';
import './SaisiePoste.css';
import { useContext, useEffect, useState } from "react";
import { PosteContext } from "../helper/PostProvider/PostContext";
import useGetLPoste from "../../hooks/posteHooks/useGetLPoste";
import { Poste } from "../../models/Poste";
import SancBonusLegend from "./SancBonusLegend";
import ForbiddenMessage from "../AlertModal/ForbiddenMessage";

// Define interface for the form data
export interface PosteFormData {
  soccod: string;
  codposte: string;
  libposte: string;
  avantent: number;
  apresent: number;
  avantsort: number;
  apressort: number;
  reposAvant: string;
  reposApres: string;
}
interface SaisiePosteProps {
  onFormChange?: (data: PosteFormData) => void;
}

export default function SaisiePoste({ onFormChange }: SaisiePosteProps) {
  const posteContext = useContext(PosteContext);
  const selectedPoste = posteContext?.selectedPoste;
  const { t } = useTranslation();
  
  const [_postes, setPostes] = useState<{ poste?: Poste }>({});
  const { data: lposte = {} as Poste, error, isError } = useGetLPoste(selectedPoste?.codposte);
  
  // Initialize form state
  const [formData, setFormData] = useState<PosteFormData>({
    soccod: '',
    codposte: '',
    libposte: '',
    avantent: 0,
    apresent: 0,
    avantsort: 0,
    apressort: 0,
    reposAvant: '0',
    reposApres: '0'
  });
  useEffect(() => {
    if (onFormChange) {
      onFormChange(formData);
    }
  }, [formData, onFormChange]);
  // Update form when selectedPoste or lposte changes
  useEffect(() => {
    if (selectedPoste) {
      setPostes({ poste: selectedPoste });
      setFormData(prev => ({
        ...prev,
        codposte: selectedPoste.codposte || '',
        libposte: selectedPoste.libposte || ''
      }));
    }
  }, [selectedPoste]);
  // Reset form when no poste is selected
  useEffect(() => {
    if (!selectedPoste) {
      setFormData({
        soccod: '',
        codposte: '',
        libposte: '',
        avantent: 0,
        apresent: 0,
        avantsort: 0,
        apressort: 0,
        reposAvant: '0',
        reposApres: '0'
      });
    }
  }, [selectedPoste]);

  // Update form when lposte data is loaded
  useEffect(() => {
    if (lposte) {
      setFormData(prev => ({
        ...prev,
        avantent: lposte.avantent || 0,
        apresent: lposte.apresent || 0,
        avantsort: lposte.avantsort || 0,
        apressort: lposte.apressort || 0,
        // Set default values for selects if needed
      }));
    }
  }, [lposte]);

  // Handle input changes
  const handleInputChange = (field: keyof PosteFormData) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  // Handle select changes
  // const handleSelectChange = (field: keyof PosteFormData) => (event: any) => {
  //   setFormData(prev => ({
  //     ...prev,
  //     [field]: event.target.value
  //   }));
  // };
  return (
    <>
      <Box p={2} sx={{ width: '100%' }} mt={-2}>
        <Grid container>
          {/* Ligne avec Code, Libellé et PosteTable */}
          <Grid item xs={12} display={"flex"} spacing={1} justifyContent={"space-around"}>
            <Grid item xs={3}>
              <InputLabel shrink>{t('common.code')}</InputLabel>
              <Input 
                size="small" 
                value={formData.codposte} 
                onChange={handleInputChange('codposte')}
                fullWidth 
              />
            </Grid>
            <Grid item xs={6}>
              <InputLabel shrink>{t('common.label')}</InputLabel>
              <Input 
                size="small" 
                value={formData.libposte} 
                onChange={handleInputChange('libposte')}
                fullWidth 
              />
            </Grid>
          </Grid>
          
          {/* Ligne avec SancBonusLegend et Repos Auto */}
          <Grid item xs={12} mt={2}>
            <Grid item xs={12} mb={1}>
              <Grid container spacing={1}>
                {/* Tolérance Entrée */}
                <Grid item xs={2}>
                  <Box
                    component="fieldset"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      borderColor: 'grey.400',
                    }}
                  >
                    <legend>
                      <Typography color="error">{t('post.toleranceEntry')}</Typography>
                    </legend>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <InputLabel shrink>{t('common.before')}</InputLabel>
                        <Input 
                          size="small" 
                          type="number" 
                          value={formData.avantent}
                          onChange={handleInputChange('avantent')}
                          fullWidth 
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <InputLabel shrink>Après</InputLabel>
                        <Input 
                          size="small" 
                          type="number" 
                          value={formData.apresent} 
                          onChange={handleInputChange('apresent')}
                          fullWidth 
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>

                {/* Tolérance Sortie */}
                <Grid item xs={2}>
                  <Box
                    component="fieldset"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      borderColor: 'grey.400',
                    }}
                  >
                    <legend>
                      <Typography color="error">{t('post.toleranceExit')}</Typography>
                    </legend>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <InputLabel shrink>{t('common.before')}</InputLabel>
                        <Input 
                          size="small" 
                          type="number" 
                          value={formData.avantsort} 
                          onChange={handleInputChange('avantsort')}
                          fullWidth 
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <InputLabel shrink>Après</InputLabel>
                        <Input 
                          size="small" 
                          type="number" 
                          value={formData.apressort} 
                          onChange={handleInputChange('apressort')}
                          fullWidth 
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
                <Grid item xs={8}>
                  <SancBonusLegend
                    retsanc={lposte.retsanc}
                    retmin={lposte.retmin}
                    avabon={lposte.avabon}
                    avamn={lposte.avamn}
                    retsancam={lposte.retsancam}
                    retminam={lposte.retminam}
                    onChange={(sancData) => {
                      // Fusionner les données de sanction avec formData
                      if (onFormChange) {
                        onFormChange({
                          ...formData,
                          ...sancData
                        } as any);
                      }
                    }}
                  />
                </Grid>


                {/* Repos Automatique */}
                {/* <Grid item xs={4}>
                  <Box
                    component="fieldset"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      borderColor: 'grey.400',
                    }}
                  >
                    <legend>
                      <Typography color="error">{t('post.autoRest')}</Typography>
                    </legend>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <InputLabel shrink>Avant</InputLabel>
                        <FormControl variant="standard" fullWidth>
                          <Select
                            value={formData.reposAvant}
                            onChange={handleSelectChange('reposAvant')}
                          >
                            <MenuItem value="0">{`0-${t('common.before')}`}</MenuItem>
                            <MenuItem value="1">{`1-${t('common.after')}`}</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={6}>
                        <InputLabel shrink>Après</InputLabel>
                        <FormControl variant="standard" fullWidth>
                          <Select
                            value={formData.reposApres}
                            onChange={handleSelectChange('reposApres')}
                          >
                            <MenuItem value="0">{`0-${t('common.after')}`}</MenuItem>
                            <MenuItem value="1">{`1-${t('common.before')}`}</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid> */}
              </Grid>
            </Grid>
          </Grid>
        </Grid>
        {isError &&(error as any)?.response?.status === 403 && (<ForbiddenMessage message="Accès interdit à la saisie de ce poste." />)}
      </Box>
    </>
  );
}