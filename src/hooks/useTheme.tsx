import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeVariant = "light-purple" | "light-green" | "dark-purple" | "dark-green";

interface ThemeContextType {
  theme: ThemeVariant;
  setTheme: (theme: ThemeVariant) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light-purple",
  setTheme: () => {},
});

const themeLabels: Record<ThemeVariant, string> = {
  "light-purple": "فاتح بنفسجي",
  "light-green": "فاتح أخضر",
  "dark-purple": "داكن بنفسجي",
  "dark-green": "داكن أخضر",
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeVariant>(() => {
    return (localStorage.getItem("app-theme") as ThemeVariant) || "light-purple";
  });

  useEffect(() => {
    localStorage.setItem("app-theme", theme);
    const root = document.documentElement;
    // Remove all theme classes
    root.classList.remove("dark", "theme-light-purple", "theme-light-green", "theme-dark-purple", "theme-dark-green");
    // Add current theme class
    root.classList.add(`theme-${theme}`);
    if (theme.startsWith("dark")) {
      root.classList.add("dark");
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export { themeLabels };
