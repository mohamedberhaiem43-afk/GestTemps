import { Box } from '@mui/material';
import "./Societe.css";
import { SaisieSociete } from './SaisieSociete';
import { SocieteList } from './SocieteList';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';
import { useState } from 'react';
import { Societe as SocieteModel } from '../../../models/Societe';

export function Societe() {
    const [selectedSociete, setSelectedSociete] = useState<SocieteModel | null>(null);

    return (
        <>
        <Box style={{minWidth:'90vw'}} height={'90vh'}>
                <BreadcrumbNavigation />
                <SaisieSociete 
                    societeToEdit={selectedSociete} 
                    onEditComplete={() => setSelectedSociete(null)} 
                />
                <SocieteList onEdit={(societe) => setSelectedSociete(societe)} />
        </Box>
        </>
    );
}