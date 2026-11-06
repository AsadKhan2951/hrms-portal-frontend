import { createContext } from "react";

/** True inside the admin shell, whose top bar already has the bell and search. */
export const AdminShellContext = createContext(false);
