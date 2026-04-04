import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../components/helper/AuthProvider";
import apiInstance from "../../components/API/apiInstance";
import type Employe from "../../models/Employe";

interface UseEmployeeFilterReturn {
    selectedEmpCodes: string[];
    setSelectedEmpCodes: (codes: string[]) => void;
    accessibleEmployees: Employe[];
    filiale: Record<string, string>;
    services: Record<string, string>;
    selectedFiliale: string;
    setSelectedFiliale: (filiale: string) => void;
    selectedService: string;
    setSelectedService: (service: string) => void;
    selectedRegime: string;
    setSelectedRegime: (regime: string) => void;
    effectiveEmpcods: string[];
    hasEffectiveEmployees: boolean;
    effectiveEmployeesLabel: string;
    handleEmployeeSelection: (selected: string[]) => void;
}

export function useEmployeeFilter(): UseEmployeeFilterReturn {
    const { soccod, uticod } = useAuth();

    const [selectedEmpCodes, setSelectedEmpCodes] = useState<string[]>([]);
    const [accessibleEmployees, setAccessibleEmployees] = useState<Employe[]>([]);
    const [filiale, setFiliale] = useState<Record<string, string>>({});
    const [services, setServices] = useState<Record<string, string>>({});
    const [selectedFiliale, setSelectedFiliale] = useState<string>(sessionStorage.getItem('sitcod') ?? '');
    const [selectedService, setSelectedService] = useState<string>('');
    const [selectedRegime, setSelectedRegime] = useState<string>('');

    const effectiveEmpcods = useMemo(() => {
        if (selectedEmpCodes.length > 0) {
            return selectedEmpCodes;
        }

        return accessibleEmployees
            .filter((employee) => employee.actif === 'A')
            .filter((employee) => !selectedFiliale || employee.sitcod === selectedFiliale)
            .filter((employee) => !selectedService || employee.sercod === selectedService)
            .filter((employee) => !selectedRegime || employee.empreg === selectedRegime)
            .map((employee) => employee.empcod);
    }, [accessibleEmployees, selectedEmpCodes, selectedFiliale, selectedService, selectedRegime]);

    const hasEffectiveEmployees = effectiveEmpcods.length > 0;
    const effectiveEmployeesLabel = selectedEmpCodes.length > 0
        ? `${selectedEmpCodes.length} employe(s) selectionne(s)`
        : `${effectiveEmpcods.length} employe(s) filtre(s)`;

    useEffect(() => {
        if (!soccod || !uticod) return;

        apiInstance.get(`/Employes/${soccod}/${uticod}`)
            .then((res) => setAccessibleEmployees(res.data ?? []))
            .catch((err) => console.error(err));
    }, [soccod, uticod]);

    useEffect(() => {
        if (!soccod) return;

        apiInstance.get(`/Sites/get-sitlibs/${soccod}`)
            .then((res) => setFiliale(res.data))
            .catch((err) => console.error(err));
    }, [soccod]);

    useEffect(() => {
        if (!soccod) return;

        apiInstance.get(`/Services/get-servlibs/${soccod}`)
            .then((res) => setServices(res.data))
            .catch((err) => console.error(err));
    }, [soccod]);

    const handleEmployeeSelection = (selected: string[]) => {
        setSelectedEmpCodes(selected);
    };

    return {
        selectedEmpCodes,
        setSelectedEmpCodes,
        accessibleEmployees,
        filiale,
        services,
        selectedFiliale,
        setSelectedFiliale,
        selectedService,
        setSelectedService,
        selectedRegime,
        setSelectedRegime,
        effectiveEmpcods,
        hasEffectiveEmployees,
        effectiveEmployeesLabel,
        handleEmployeeSelection,
    };
}