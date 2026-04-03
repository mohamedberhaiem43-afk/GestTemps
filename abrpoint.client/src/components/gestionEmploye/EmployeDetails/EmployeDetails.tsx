import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Cordonees from './Cordonnee/Cordonee';
import Complement from './Complement/Complement';
import EmployeInfo from './EmployeInfo/EmpoyeInfo';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import InfoBasic from '../ajoutEmploye/InfoBasic/InfoBasic';
import TravailInfo from '../ajoutEmploye/TravailInfo/TravailInfo';
import Employe from '../../../models/Employe';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

interface EmployeDetailsProps {
  onCombinedDataChange: (data: any) => void;
  empData:Employe
}

export default function EmployeDetails({ onCombinedDataChange,empData }: EmployeDetailsProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(0);
  const [combinedData, setCombinedData] = useState<Employe>(empData);
  const [formData, setFormData] = useState(empData || {});
  useEffect(() => {
    setFormData(empData); // Update form when empData changes (e.g., from context)
    setCombinedData(empData);
  }, [empData]);

  const handleFieldChange = (e: any) => {
  const { name, value } = e.target;
  setFormData((prev: any) => ({
    ...prev,
     [name]:value
  }));
  
   // Optional: update combined data immediately
  const newData = { ...combinedData,  ...formData, [e.target.name]: e.target.value };
  setCombinedData(newData);
  onCombinedDataChange(newData);
};
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    event.preventDefault();
    setValue(newValue);
  };

  const handleEmployeInfoChange = (data: any) => {
    const base = combinedData || formData;
    const newData = { ...base, ...data };
    setCombinedData(newData);
    onCombinedDataChange(newData);
  };


  const handleCordoneesChange = (data: any) => {
    const newData = { ...combinedData, ...data };
    setCombinedData(newData);
    onCombinedDataChange(newData);
  };

  const handleComplementChange = (data: any) => {
    const newData = { ...combinedData, ...data };
    setCombinedData(newData);
    onCombinedDataChange(newData);
  };

  return (
    <Box >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={value}
          onChange={handleTabChange}
          aria-label="employee tabs"
          sx={{ minHeight: '36px' }}
        >
          <Tab label={t('employe.tabs.basic') || 'Information de base'} {...a11yProps(0)} sx={{ fontSize: '0.8rem' }} />
          <Tab label={t('employe.tabs.work') || 'Information de travail'} {...a11yProps(1)} sx={{ fontSize: '0.8rem' }} />
          <Tab label={t('employe.tabs.employeeInfo') || 'Information Employé'} {...a11yProps(2)} sx={{ fontSize: '0.8rem' }} />
          <Tab label={t('employe.tabs.contact') || 'Coordonnées'} {...a11yProps(3)} sx={{ fontSize: '0.8rem' }} />
          <Tab label={t('employe.tabs.complement') || 'Complément'} {...a11yProps(4)} sx={{ fontSize: '0.8rem' }} />
        </Tabs>
      </Box>
    
      <CustomTabPanel value={value} index={0}>
        <InfoBasic formData={formData} handleChange={handleFieldChange} />
      </CustomTabPanel>
      <CustomTabPanel value={value} index={1}>
        <TravailInfo formData={formData} handleChange={handleFieldChange} />
      </CustomTabPanel>
      <CustomTabPanel value={value} index={2}>
        <EmployeInfo onChange={handleEmployeInfoChange} empData={empData} />
      </CustomTabPanel>
      <CustomTabPanel value={value} index={3}>
        <Cordonees onChange={handleCordoneesChange} empData={empData} />
      </CustomTabPanel>
      <CustomTabPanel value={value} index={4}>
        <Complement onChange={handleComplementChange} empData={empData} />
      </CustomTabPanel>
    </Box>
  );
}
