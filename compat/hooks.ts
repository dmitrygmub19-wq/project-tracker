import { useCallback, useEffect, useState } from "react";

export type ThemeSource = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "project-board-theme";
const THEME_CHANGE_EVENT = "project-board-theme-change";

function isThemeSource(value: string | null): value is ThemeSource {
  return value === "system" || value === "light" || value === "dark";
}

function applyTheme(source: ThemeSource, systemPrefersDark: boolean): boolean {
  const isDark = source === "dark" || (source === "system" && systemPrefersDark);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  return isDark;
}

export function useTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    let active = true;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const syncTheme = async () => {
      try {
        const info = await window.glazeAPI.nativeTheme.getInfo();
        const savedSource = localStorage.getItem(THEME_STORAGE_KEY);
        const source = isThemeSource(savedSource) ? savedSource : info.themeSource;

        if (savedSource && !isThemeSource(savedSource)) {
          localStorage.removeItem(THEME_STORAGE_KEY);
        }
        if (source !== info.themeSource) {
          await window.glazeAPI.nativeTheme.setThemeSource(source);
        }

        if (!active) return;
        setIsDark(applyTheme(source, mediaQuery.matches || info.shouldUseDarkColors));
      } catch (error) {
        console.error("[theme] Failed to load theme preference", error);
      }
    };

    const handleThemeChange = () => {
      void syncTheme();
    };

    void syncTheme();
    mediaQuery.addEventListener("change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);

    return () => {
      active = false;
      mediaQuery.removeEventListener("change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, []);

  const setTheme = useCallback(async (source: ThemeSource) => {
    const success = await window.glazeAPI.nativeTheme.setThemeSource(source);
    if (!success) {
      throw new Error("The app did not accept the theme preference.");
    }

    localStorage.setItem(THEME_STORAGE_KEY, source);
    const isDark = applyTheme(
      source,
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    setIsDark(isDark);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  return { isDark, setTheme };
}
export function useConnection() { return { data: true, error: null }; }
export function useEnvironment() { return { data: true, error: null }; }
