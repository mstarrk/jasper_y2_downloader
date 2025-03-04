const { contextBridge, ipcRenderer } = require('electron');

// Log when preload script runs
console.log('Preload script is running');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
    // Event receivers - from main process to renderer
    onUrlDetected: (callback) => {
        console.log('Setting up url-detected listener');
        ipcRenderer.on('url-detected', (_, url) => {
            console.log('Received url-detected event:', url);
            callback(url);
        });
    },
    
    onDownloadStarted: (callback) => {
        console.log('Setting up download-started listener');
        ipcRenderer.on('download-started', (_, url, title) => {
            console.log('Received download-started event:', url, title);
            callback(url, title);
        });
    },
    
    onDownloadProgress: (callback) => {
        console.log('Setting up download-progress listener');
        ipcRenderer.on('download-progress', (_, url, percent) => {
            callback(url, percent);
        });
    },
    
    onDownloadComplete: (callback) => {
        console.log('Setting up download-complete listener');
        ipcRenderer.on('download-complete', (_, url) => {
            console.log('Received download-complete event:', url);
            callback(url);
        });
    },
    
    onDownloadError: (callback) => {
        console.log('Setting up download-error listener');
        ipcRenderer.on('download-error', (_, url, error) => {
            console.log('Received download-error event:', url, error);
            callback(url, error);
        });
    },
    
    onDownloadPaused: (callback) => {
        console.log('Setting up download-paused listener');
        ipcRenderer.on('download-paused', (_, url) => {
            console.log('Received download-paused event:', url);
            callback(url);
        });
    },
    
    onDownloadResumed: (callback) => {
        console.log('Setting up download-resumed listener');
        ipcRenderer.on('download-resumed', (_, url) => {
            console.log('Received download-resumed event:', url);
            callback(url);
        });
    },
    
    onDownloadCancelled: (callback) => {
        console.log('Setting up download-cancelled listener');
        ipcRenderer.on('download-cancelled', (_, url) => {
            console.log('Received download-cancelled event:', url);
            callback(url);
        });
    },
    
    onPlaylistInfo: (callback) => {
        console.log('Setting up playlist-info listener');
        ipcRenderer.on('playlist-info', (_, url, info) => {
            console.log('Received playlist-info event:', url, info);
            callback(url, info);
        });
    },
    
    onPlaylistComplete: (callback) => {
        console.log('Setting up playlist-complete listener');
        ipcRenderer.on('playlist-complete', (_, url) => {
            console.log('Received playlist-complete event:', url);
            callback(url);
        });
    },
    
    // Event senders - from renderer to main process
    download: (url, quality = 'highestaudio') => {
        console.log(`Sending download event: ${url} with quality: ${quality}`);
        ipcRenderer.send('download', url, quality);
    },
    
    pauseDownload: (url) => {
        console.log('Sending pauseDownload event:', url);
        ipcRenderer.send('pauseDownload', url);
    },
    
    resumeDownload: (url) => {
        console.log('Sending resumeDownload event:', url);
        ipcRenderer.send('resumeDownload', url);
    },
    
    cancelDownload: (url) => {
        console.log('Sending cancelDownload event:', url);
        ipcRenderer.send('cancelDownload', url);
    },
    
    // Invoke handlers - these return promises
    getVideoTitle: (url) => {
        console.log('Invoking getVideoTitle:', url);
        return ipcRenderer.invoke('get-video-title', url);
    },
    
    getOutputDir: () => {
        console.log('Invoking getOutputDir');
        return ipcRenderer.invoke('get-output-dir');
    },
    
    selectDirectory: () => {
        console.log('Invoking selectDirectory');
        return ipcRenderer.invoke('select-directory');
    },
    
    // Settings
    setOutputDir: (dir) => {
        console.log('Sending setOutputDir event:', dir);
        ipcRenderer.send('set-output-dir', dir);
    }
});

console.log('Preload script completed');