import { createContext, useContext, useState } from "react";

interface AbsParams {
  absret: boolean;
  absaut: boolean;
  sansPointageInvalide: boolean;
  presNonOpt: boolean;
  radioValue: string;
}

interface AbsParamsContextType {
  absParams: AbsParams;
  setAbsParams: (params: AbsParams) => void;
}

const defaultAbsParams: AbsParams = {
  absret: true,
  absaut: true,
  sansPointageInvalide: true,
  presNonOpt: false,
  radioValue: "1",
};

const AbsenceContext = createContext<AbsParamsContextType | undefined>(undefined);

export const useAbsenceContext = () => {
  const context = useContext(AbsenceContext);
  if (!context) {
    throw new Error("useAbsenceContext must be used within a AbsParamsProvider");
  }
  return context;
};

export const AbsParamsProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [absParams, setAbsParams] = useState<AbsParams>(defaultAbsParams);

  return (
    <AbsenceContext.Provider value={{ absParams, setAbsParams }}>
      {children}
    </AbsenceContext.Provider>
  );
};
