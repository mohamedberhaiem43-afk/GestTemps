import { useState, useEffect } from "react";
import { Grid } from "@mui/material";
import InputComponent from "../../../Inputs/Input";
import SelectInputComponent from "../../../SelectInputComponent/SelectInputComponent";
import { useTranslation } from 'react-i18next';
import useGetVillesLibs from "../../../../hooks/villeHooks/useGetVillesLibs";
import useGetPaysLibs from "../../../../hooks/paysHooks/useGetPaysLibs";
import Employe from "../../../../models/Employe";

interface EmployeDetailsProps {
  onChange: (data: any) => void;
  empData: Employe;
}

export default function Cordonees({ onChange, empData }: EmployeDetailsProps) {
  const { t } = useTranslation();
  const etatCivile = {
    "C": t('employe.contact.single') || 'Célibataire(e)',
    "M": t('employe.contact.married') || 'Marié(e)',
    "D": t('employe.contact.divorced') || 'Divorcé(e)'
  };

  const { data: villes = [] } = useGetVillesLibs();
  const { data: nations = [] } = useGetPaysLibs();

  const [formData, setFormData] = useState(empData);

  useEffect(() => {
    setFormData(empData);
  }, [empData]);

  const handleChange = (event: any) => {
    const { name, value } = event.target;
    const updatedData = {
      ...formData,
      [name]: value,
    };
    setFormData(updatedData);
    onChange({ [name]: value }); // Notify parent with field update
  };

  useEffect(() => {
    onChange(formData); // Notify parent with full form data on any update
  }, [formData, onChange]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={4}>
        <InputComponent
          type='text'
          label={t('employe.contact.address') || 'Adresse'}
          value={formData.empadr}
          setValue={(value: any) => handleChange({ target: { name: 'empadr', value } })}
        />
      </Grid>
      <Grid item xs={3} mt={1}>
        <SelectInputComponent
          label={t('employe.contact.nationality') || 'Nationalité'}
          value={formData.natcod}
          setValue={(value) => handleChange({ target: { name: 'natcod', value } })}
          maplist={nations}
        />
      </Grid>
      <Grid item xs={3} mt={1}>
        <SelectInputComponent
          label={t('employe.contact.city') || 'Ville'}
          value={formData.vilcod}
          setValue={(value) => handleChange({ target: { name: 'vilcod', value } })}
          maplist={villes}
        />
      </Grid>
      <Grid item xs={3}>
        <InputComponent
          type='tel'
          label={t('employe.contact.tel') || 'Tél'}
          value={formData.emptel}
          setValue={(value: any) => handleChange({ target: { name: 'emptel', value } })}
        />
      </Grid>
      <Grid item xs={3}>
        <InputComponent
          type='number'
          label={t('employe.contact.mobile') || 'Mobile'}
          value={formData.empmob}
          setValue={(value: any) => handleChange({ target: { name: 'empmob', value } })}
        />
      </Grid>
      <Grid item xs={3}>
        <InputComponent
          type='email'
          label={t('employe.contact.email') || 'Email'}
          value={formData.empemail}
          setValue={(value: any) => handleChange({ target: { name: 'empemail', value } })}
        />
      </Grid>
      <Grid item xs={3}>
        <SelectInputComponent
          label={t('employe.contact.civilStatus') || 'Etat Civil'}
          value={formData.empsitfam}
          setValue={(value) => handleChange({ target: { name: 'empsitfam', value } })}
          maplist={etatCivile}
        />
      </Grid>
    </Grid>
  );
}
