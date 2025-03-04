const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    onUrlDetected: (callback) => ipcRenderer.on('url-detected', (_, url) => callback(url)),
    download: (url) => ipcRenderer.send('download', url),
    getVideoTitle: (url) => ipcRenderer.invoke('get-video-title', url),
    pauseDownload: (url) => ipcRenderer.send('pauseDownload', url),
    resumeDownload: (url) => ipcRenderer.send('resumeDownload', url),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, title, percent) => callback(title, percent))
});
