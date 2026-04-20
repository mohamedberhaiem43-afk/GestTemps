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
    isServiceLocked: boolean;
    lockedServiceCode: string;
}

export function useEmployeeFilter(): UseEmployeeFilterReturn {
    const { soccod, uticod, isManager, sercod: managerSercod } = useAuth();
    const isServiceLocked = Boolean(isManager && managerSercod);
    const lockedServiceCode = managerSercod ?? '';

    const [selectedEmpCodes, setSelectedEmpCodes] = useState<string[]>([]);
    const [accessibleEmployees, setAccessibleEmployees] = useState<Employe[]>([]);
    const [filiale, setFiliale] = useState<Record<string, string>>({});
    const [services, setServices] = useState<Record<string, string>>({});
    const [selectedFiliale, setSelectedFiliale] = useState<string>(sessionStorage.getItem('sitcod') ?? '');
    const [selectedService, setSelectedServiceState] = useState<string>(isServiceLocked ? lockedServiceCode : '');
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
            .then((res) => {
                const data = res.data ?? [];
                const scoped = isServiceLocked
                    ? data.filter((employee: Employe) => employee.sercod === lockedServiceCode)
                    : data;
                setAccessibleEmployees(scoped);
            })
            .catch((err) => console.error(err));
    }, [soccod, uticod, isServiceLocked, lockedServiceCode]);

    useEffect(() => {
        if (!soccod) return;

        apiInstance.get(`/Sites/get-sitlibs/${soccod}`)
            .then((res) => setFiliale(res.data))
            .catch((err) => console.error(err));
    }, [soccod]);

    useEffect(() => {
        if (!soccod) return;

        apiInstance.get(`/Services/get-servlibs/${soccod}`)
            .then((res) => {
                const allServices = res.data ?? {};
                if (isServiceLocked && lockedServiceCode) {
                    setServices(
                        allServices[lockedServiceCode]
                            ? { [lockedServiceCode]: allServices[lockedServiceCode] }
                            : {}
                    );
                    return;
                }
                setServices(allServices);
            })
            .catch((err) => console.error(err));
    }, [soccod, isServiceLocked, lockedServiceCode]);

    useEffect(() => {
        if (isServiceLocked && lockedServiceCode) {
            setSelectedServiceState(lockedServiceCode);
        }
    }, [isServiceLocked, lockedServiceCode]);

    const handleEmployeeSelection = (selected: string[]) => {
        setSelectedEmpCodes(selected);
    };

    const setSelectedService = (service: string) => {
        if (isServiceLocked) {
            setSelectedServiceState(lockedServiceCode);
            return;
        }
        setSelectedServiceState(service);
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
        isServiceLocked,
        lockedServiceCode,
    };
}
