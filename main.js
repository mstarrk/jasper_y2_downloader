const { app, BrowserWindow, clipboard, ipcMain, dialog } = require('electron');
const path = require('path');
const ytdl = require('ytdl-core');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const notifier = require('node-notifier');
const ytpl = require('@distube/ytpl');

let mainWindow;
let lastClipboardText = "";
let userOutputDir = null; // Store user-selected output directory
const downloads = new Map(); // Store active downloads

// Create main application window
function createWindow() {
    console.log('Creating main window...');
    mainWindow = new BrowserWindow({
        width: 450,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'Jasper Y2 Downloader'
    });

    mainWindow.loadFile('index.html');
    
    // For debugging, uncomment this line
    // mainWindow.webContents.openDevTools();
    
    console.log('Main window created and loaded index.html');
}

app.whenReady().then(() => {
    console.log('App is ready, creating window and starting clipboard monitor');
    createWindow();
    setInterval(checkClipboard, 3000); // Check clipboard every 3 seconds
});

// Handle app shutdown
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle app activation (for macOS)
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    } else {
        mainWindow.show();
    }
});

// Monitor clipboard for YouTube links
function checkClipboard() {
    const text = clipboard.readText().trim();
    
    // Only process if text is different from last time and is a YouTube link
    if (text !== lastClipboardText && (ytdl.validateURL(text) || ytpl.validateID(text))) {
        lastClipboardText = text;
        console.log(`YouTube link detected: ${text}`);
        
        // Show notification
        notifier.notify({
            title: 'YouTube Link Detected',
            message: 'Click to download as MP3',
            wait: true
        }, () => {
            // Show the window and send the URL to the renderer
            mainWindow.show();
            console.log('Sending url-detected event to renderer');
            mainWindow.webContents.send('url-detected', text);
        });
    }
}

// Handle download request from the renderer
ipcMain.on('download', async (event, url, quality = 'highestaudio') => {
    console.log(`Download request received for URL: ${url} with quality: ${quality}`);
    
    try {
        if (ytpl.validateID(url)) {
            console.log('URL is a playlist, starting playlist download');
            await downloadPlaylist(url, quality);
        } else {
            console.log('URL is a single video, starting video download');
            await downloadVideo(url, quality);
        }
    } catch (err) {
        console.error('Download error:', err);
        mainWindow.webContents.send('download-error', url, err.message);
    }
});

// Download a single video
async function downloadVideo(url, quality = 'highestaudio', playlistUrl = null, videoCount = undefined, i = undefined) {
    console.log(`Starting download process for: ${url} with quality: ${quality}`);
    
    try {
        // Get video information
        console.log('Fetching video info...');
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title;
        const sanitizedTitle = title.replace(/[/\\?%*:|"<>]/g, ''); // Remove invalid filename characters
        
        // Use custom output directory if set, otherwise use default Downloads folder
        const downloadsDir = userOutputDir || path.join(os.homedir(), 'Downloads');
        const outputPath = path.join(downloadsDir, `${sanitizedTitle}.mp3`);
        
        console.log(`Video title: ${title}`);
        console.log(`Output path: ${outputPath}`);
        
        // CRITICAL: Send download-started event to renderer BEFORE starting the actual download
        console.log('Sending download-started event to renderer');
        mainWindow.webContents.send('download-started', url, title);
        
        // Create downloads directory if it doesn't exist
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }
        
        // Download audio stream
        console.log(`Creating ytdl stream with quality: ${quality}...`);
        const stream = ytdl(url, { 
            quality: quality,
            filter: 'audioonly'
        });
        
        // Handle stream errors
        stream.on('error', (err) => {
            console.error('ytdl stream error:', err);
            mainWindow.webContents.send('download-error', url, `Stream error: ${err.message}`);
        });
        
        // Set up FFmpeg conversion with appropriate bitrate based on quality
        console.log('Setting up FFmpeg conversion...');
        const bitrate = quality === 'highestaudio' ? 256 : 128;
        
        const ffmpegProcess = ffmpeg(stream)
            .audioCodec('libmp3lame')
            .audioBitrate(bitrate)
            .format('mp3')
            .on('start', (cmd) => {
                console.log(`FFmpeg process started with command: ${cmd}`);
            })
            .on('progress', (progress) => {
                // Calculate progress percentage
                const percent = Math.round(progress.percent || 0);
                console.log(`Download progress for "${title}": ${percent}%`);
                
                // Send progress to renderer
                mainWindow.webContents.send('download-progress', url, percent);
            })
            .on('end', () => {
                console.log(`Download complete: ${title}`);
                
                // For individual videos or the last video in a playlist, show a notification
                // For playlist items, don't show notifications for each one
                if (!playlistUrl || videoCount === undefined || i === videoCount - 1) {
                    notifier.notify({
                        title: 'Download Complete',
                        message: `${title} has been downloaded`
                    });
                }
                
                // Send completion event to renderer
                mainWindow.webContents.send('download-progress', url, 100);
                mainWindow.webContents.send('download-complete', url);
                
                // Remove from active downloads
                downloads.delete(url);
            })
            .on('error', (err) => {
                console.error(`FFmpeg error: ${err.message}`);
                mainWindow.webContents.send('download-error', url, `FFmpeg error: ${err.message}`);
            })
            .save(outputPath);
        
        // Store the download information
        downloads.set(url, {
            process: ffmpegProcess,
            title: title,
            path: outputPath
        });
        
    } catch (err) {
        console.error(`Error in downloadVideo: ${err.message}`);
        mainWindow.webContents.send('download-error', url, err.message);
    }
}

// Download an entire playlist
async function downloadPlaylist(playlistUrl, quality = 'highestaudio') {
    console.log(`Starting playlist download for: ${playlistUrl} with quality: ${quality}`);
    
    try {
        // Get playlist information
        console.log('Fetching playlist info...');
        const playlist = await ytpl(playlistUrl);
        
        if (!playlist || !playlist.items || !playlist.items.length) {
            throw new Error("Playlist is empty or could not be fetched");
        }
        
        const playlistTitle = playlist.title || "YouTube Playlist";
        const videoCount = playlist.items.length;
        
        console.log(`Playlist: "${playlistTitle}" with ${videoCount} videos`);
        
        // Notify the renderer about the playlist
        mainWindow.webContents.send('download-started', playlistUrl, `Playlist: ${playlistTitle} (${videoCount} videos)`);
        
        // Show system notification
        notifier.notify({
            title: 'Playlist Download Started',
            message: `Downloading ${videoCount} videos from "${playlistTitle}"`
        });
        
        // Download each video in the playlist
        for (let i = 0; i < videoCount; i++) {
            const item = playlist.items[i];
            console.log(`Downloading playlist item ${i+1}/${videoCount}: ${item.title}`);
            
            // Wait for each video to download before starting the next
            // Pass playlist information to avoid notification spam
            await downloadVideo(item.url, quality, playlistUrl, videoCount, i);
        }
        
        console.log(`Playlist download complete: ${playlistTitle}`);
        mainWindow.webContents.send('playlist-complete', playlistUrl);
        
    } catch (err) {
        console.error(`Playlist download error: ${err.message}`);
        mainWindow.webContents.send('download-error', playlistUrl, `Playlist error: ${err.message}`);
    }
}

// Get video title (used by renderer before starting download)
ipcMain.handle('get-video-title', async (event, url) => {
    console.log(`Title request for URL: ${url}`);
    
    try {
        if (ytpl.validateID(url)) {
            const playlist = await ytpl(url);
            return playlist ? `Playlist: ${playlist.title} (${playlist.items.length} videos)` : "YouTube Playlist";
        }
        
        const info = await ytdl.getInfo(url);
        return info.videoDetails.title;
    } catch (err) {
        console.error(`Error getting title: ${err.message}`);
        return "Unknown Title";
    }
});

// Pause download
ipcMain.on('pauseDownload', (event, url) => {
    console.log(`Pause request for: ${url}`);
    
    if (downloads.has(url)) {
        const download = downloads.get(url);
        console.log(`Pausing download: ${download.title}`);
        
        try {
            download.process.kill('SIGSTOP');
            mainWindow.webContents.send('download-paused', url);
        } catch (err) {
            console.error(`Error pausing download: ${err.message}`);
        }
    }
});

// Resume download
ipcMain.on('resumeDownload', (event, url) => {
    console.log(`Resume request for: ${url}`);
    
    if (downloads.has(url)) {
        const download = downloads.get(url);
        console.log(`Resuming download: ${download.title}`);
        
        try {
            download.process.kill('SIGCONT');
            mainWindow.webContents.send('download-resumed', url);
        } catch (err) {
            console.error(`Error resuming download: ${err.message}`);
        }
    }
});

// Cancel download
ipcMain.on('cancelDownload', (event, url) => {
    console.log(`Cancel request for: ${url}`);
    
    if (downloads.has(url)) {
        const download = downloads.get(url);
        console.log(`Cancelling download: ${download.title}`);
        
        try {
            download.process.kill();
            
            // Delete partial file if it exists
            if (fs.existsSync(download.path)) {
                fs.unlinkSync(download.path);
            }
            
            downloads.delete(url);
            mainWindow.webContents.send('download-cancelled', url);
        } catch (err) {
            console.error(`Error cancelling download: ${err.message}`);
        }
    }
});

// Get output directory setting
ipcMain.handle('get-output-dir', (event) => {
    return userOutputDir || (os.homedir() + path.sep + 'Downloads');
});

// Select output directory using dialog
ipcMain.handle('select-directory', async (event) => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Select Download Location',
            defaultPath: userOutputDir || (os.homedir() + path.sep + 'Downloads')
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    } catch (error) {
        console.error('Error selecting directory:', error);
        return null;
    }
});

// Set output directory
ipcMain.on('set-output-dir', (event, dir) => {
    console.log(`Output directory changed to: ${dir}`);
    userOutputDir = dir;
});