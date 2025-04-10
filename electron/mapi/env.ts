import {BrowserWindow} from "electron";

export const AppEnv = {
    isInit: false,
    appRoot: null as string,
    appData: null as string,
    userData: null as string,
}

export const AppRuntime = {
    splashWindow: null as BrowserWindow,
    mainWindow: null as BrowserWindow,
    fastPanelWindow: null as BrowserWindow,
    windows: {} as Record<string, BrowserWindow>,
}

export const waitAppEnvReady = async () => {
    while (!AppEnv.isInit) {
        await new Promise(resolve => {
            setTimeout(resolve, 1000)
        })
    }
}
