import {AppRuntime} from "../env";
import {ipcMain} from "electron";
import {StrUtil} from "../../lib/util";
import {ManagerWindow} from "../manager/window";


const init = () => {

}

type NameType = 'main' | 'fastPanel' | string
type EventType = 'APP_READY' | 'CALL_PAGE' | 'CHANNEL' | 'BROADCAST'
type BroadcastType = 'ConfigChange' | 'UserChange' | 'DarkModeChange' | 'HotkeyWatch' | 'Notice'

const broadcast = (type: BroadcastType, data: any, option?: {
    limit?: boolean,
    scopes?: string[]
}) => {
    data = data || {}
    option = Object.assign({
        limit: false,
        scopes: []
    }, option)
    if (!option.limit || option.scopes.includes('main')) {
        send('main', 'BROADCAST', {type, data})
    }
    if (!option.limit || option.scopes.includes('pages')) {
        for (let name in AppRuntime.windows) {
            send(name, 'BROADCAST', {type, data})
        }
    }
    if (!option.limit || option.scopes.includes('fastPanel')) {
        send('fastPanel', 'BROADCAST', {type, data})
    }
    if (!option.limit || option.scopes.includes('views')) {
        for (const view of ManagerWindow.listBrowserViews()) {
            view.webContents.send('MAIN_PROCESS_MESSAGE', {
                id: StrUtil.randomString(32),
                type: 'BROADCAST',
                data: {type, data}
            })
        }
    }
    if (!option.limit || option.scopes.includes('detachWindows')) {
        for (const win of ManagerWindow.listDetachWindows()) {
            win.webContents.send('MAIN_PROCESS_MESSAGE', {
                id: StrUtil.randomString(32),
                type: 'BROADCAST',
                data: {type, data}
            })
        }
    }
}

const sendRaw = (webContents: any, type: EventType, data: any = {}, id?: string): boolean => {
    id = id || StrUtil.randomString(32)
    const payload = {id, type, data}
    webContents.send('MAIN_PROCESS_MESSAGE', payload)
    return true
}

const send = (name: NameType, type: EventType, data: any = {}, id?: string): boolean => {
    id = id || StrUtil.randomString(32)
    const payload = {id, type, data}
    if (name === 'main') {
        if (!AppRuntime.mainWindow) {
            return false
        }
        // console.log('send', payload)
        AppRuntime.mainWindow?.webContents.send('MAIN_PROCESS_MESSAGE', payload)
    } else if (name === 'fastPanel') {
        if (!AppRuntime.fastPanelWindow) {
            return false
        }
        AppRuntime.fastPanelWindow?.webContents.send('MAIN_PROCESS_MESSAGE', payload)
    } else {
        if (!AppRuntime.windows[name]) {
            return false
        }
        AppRuntime.windows[name]?.webContents.send('MAIN_PROCESS_MESSAGE', payload)
    }
    return true
}

ipcMain.handle('event:send', async (_, name: NameType, type: EventType, data: any) => {
    send(name, type, data)
})

const callPage = async (name: string, type: string, data: any, option?: {
    waitReadyTimeout?: number,
    timeout?: number
}) => {
    option = Object.assign({
        waitReadyTimeout: 10 * 1000,
        timeout: 10 * 1000
    }, option)
    return new Promise((resolve, reject) => {
        const id = StrUtil.randomString(32)
        const timer = setTimeout(() => {
            ipcMain.removeListener(listenerKey, listener)
            resolve({code: -1, msg: 'timeout'})
        }, option.timeout)
        const listener = (_, result) => {
            clearTimeout(timer)
            resolve(result)
            return true
        }
        const listenerKey = 'event:callPage:' + id
        ipcMain.once(listenerKey, listener)
        const payload = {
            type,
            data,
            option: {
                waitReadyTimeout: option.waitReadyTimeout
            }
        }
        if (!send(name, 'CALL_PAGE', payload, id)) {
            clearTimeout(timer)
            ipcMain.removeListener(listenerKey, listener)
            resolve({code: -1, msg: 'send failed'})
        }
    })
}

ipcMain.handle('event:callPage', async (_, name: string, type: string, data: any, option?: {}) => {
    return callPage(name, type, data, option)
})

let onChannelIsListen = false
let channelOnCallback = {}

const sendChannel = (channel: string, data: any) => {
    send('main', 'CHANNEL', {channel, data})
}

const onChannel = (channel: string, callback: (data: any) => void) => {
    if (!channelOnCallback[channel]) {
        channelOnCallback[channel] = []
    }
    channelOnCallback[channel].push(callback)
    if (!onChannelIsListen) {
        onChannelIsListen = true
        ipcMain.handle('event:channelSend', (event, channel_, data) => {
            if (channelOnCallback[channel_]) {
                channelOnCallback[channel_].forEach((callback: (data: any) => void) => {
                    callback(data)
                })
            }
        })
    }
}

const offChannel = (channel: string, callback: (data: any) => void) => {
    if (channelOnCallback[channel]) {
        channelOnCallback[channel] = channelOnCallback[channel].filter((item: (data: any) => void) => {
            return item !== callback
        })
    }
    if (channelOnCallback[channel].length === 0) {
        delete channelOnCallback[channel]
    }
}

export default {
    init,
    send
}

export const Events = {
    broadcast,
    send,
    sendRaw,
    sendChannel,
    callPage,
    onChannel,
    offChannel,
}
