import React, { useState } from 'react';
import { FormControl, InputLabel, Input, Button, FormControlLabel, Checkbox} from '@mui/material';
import axios from 'axios';
import "./Qualification.css";
import { QualificationList } from '../../helper/table/QualificationList';

export function Qualification() {
    const [QualificationData, setQualificationData] = useState({
        quacod: '',
        soccod: '',
        qualib: '',
        quairpp: ''
        });

    const [SelectedQualification, setSelectedQualification] = useState<any>(null);
    const [qualifications, setQualifications] = useState<any[]>([]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setQualificationData({ ...QualificationData, [id]: value });
    };

    const handlesectionSelect = (qualification: any) => {
        setSelectedQualification(qualification);
        setQualificationData({
            quacod: '',
            soccod: '',
            qualib: '',
            quairpp: qualification.quairpp,
        });
    };


    const addQualification = () => {
        axios.post('https://localhost:7189/api/Qualifs', QualificationData)
            .then(res => console.log(res))
            .catch(err => console.error(err));
        console.log(QualificationData);
    };

    const deleteQualification = () => {
        if (SelectedQualification) {
            axios.delete(`https://localhost:7189/api/Qualifs/${SelectedQualification.soccod}/${SelectedQualification.quacod}`)
                .then(res => {
                    console.log(res);
                    setQualifications(qualifications.filter(qualification => qualification.quacod !== SelectedQualification.quacod));
                    SelectedQualification(null);
                })
                .catch(err => console.error(err));
        }
    };
    

    const editQualification = () => {
        if (SelectedQualification) {
            axios.put(`https://localhost:7189/api/Qualifs/${SelectedQualification.soccod}/${QualificationData.quacod}`, QualificationData)
                .then(res => {
                    console.log(res);
                    setQualifications(qualifications.map(qualification => qualification.quacod === QualificationData.quacod ? QualificationData : qualification));
                    setSelectedQualification(null);
                })
                .catch(err => console.error(err));
        }
    };
 
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setQualificationData({ ...QualificationData, [name]: checked ? '1' : '0' });
    };

    return (    
        <>
            <div className="container">
            <h2>Gestion des qualification</h2>
                <div className="directionContainer">
                    <form className='form'>
                        <FormControl>
                            <InputLabel htmlFor="quacod">Code</InputLabel>
                            <Input id="quacod" value={QualificationData.quacod} onChange={handleInputChange} aria-describedby="my-helper-text" />
                        </FormControl>
                        <FormControl>
                            <InputLabel htmlFor="qualib">Libellé</InputLabel>
                            <Input id="qualib" value={QualificationData.qualib} onChange={handleInputChange} aria-describedby="my-helper-text" />
                        </FormControl>
                      
                        <FormControl>
                            <FormControlLabel
                                control={<Checkbox name="quairpp" checked={QualificationData.quairpp === '1'} onChange={handleCheckboxChange} />}
                                label="Exonoré a de la Retenue a la source"
                            />
                        </FormControl>
                        <div className="actionbtns">

                        <Button variant="outlined" onClick={addQualification}>Enregistrer</Button>
                        {SelectedQualification && (
                            <>
                                <Button variant="outlined" color="warning" onClick={editQualification}>Editer</Button>
                                <Button variant="outlined" color="error" onClick={deleteQualification}>Supprimer</Button>
                            </>
                        )}
                        </div>
                    </form>
                </div>
                <QualificationList onSelectQualification={handlesectionSelect} />
            </div>
        </>
    );
}
