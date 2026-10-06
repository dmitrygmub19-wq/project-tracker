export interface NativeThemeInfo { themeSource: 'system'|'light'|'dark'; shouldUseDarkColors: boolean; }
export type AskForMediaAccessType = 'microphone'|'camera';
export type MediaAccessType = string; export type PermissionStatus = string; export type SystemPreferencesAuthorizationType = string;
export interface OpenDialogOptions { [key:string]: unknown } export interface OpenDialogResult { canceled:boolean; filePaths:string[] }
export interface SaveDialogOptions { [key:string]: unknown } export interface SaveDialogResult { canceled:boolean; filePath?:string }
export interface MessageBoxOptions { [key:string]: unknown } export interface MessageBoxResult { response:number; checkboxChecked:boolean }
export interface DatePickerOptions { [key:string]: unknown } export interface DatePickerResult { canceled:boolean; date?:string }
export interface LocationPosition { coords: unknown; timestamp:number } export interface LocationPositionOptions { [key:string]: unknown }
export interface PermissionDiagnostic { [key:string]: unknown } export interface MenuItemConstructorOptions { [key:string]: unknown }
export interface PopupOptions { [key:string]: unknown } export interface PopupResult { [key:string]: unknown }
