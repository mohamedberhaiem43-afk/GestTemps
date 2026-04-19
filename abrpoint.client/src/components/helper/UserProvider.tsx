import { createContext, useContext, useState } from "react";

type UserContextType = {
  selectedUser: string | null;
  setSelectedUser: (uticod: string | null) => void;
  selectedRole: number | null;
  setSelectedRole: (roleId: number | null) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);

  return (
    <UserContext.Provider value={{ selectedUser, setSelectedUser, selectedRole, setSelectedRole }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = (): UserContextType => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUserContext must be used inside UserProvider");
  return context;
};
export default UserProvider;