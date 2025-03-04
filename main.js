const { app, BrowserWindow, clipboard, ipcMain } = require('electron');
const path = require('path');
const ytdl = require('ytdl-core');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const notifier = require('node-notifier');
const ytpl = require('@distube/ytpl');

let mainWindow;
let lastClipboardText = "";
const downloads = new Map(); // Store active downloads

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 300,
        height: 150,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');
    
    setInterval(checkClipboard, 5000); // Check clipboard every 5 seconds
});

function checkClipboard() {
    const text = clipboard.readText().trim();
    if (text !== lastClipboardText && (ytdl.validateURL(text) || ytpl.validateID(text))) {
        lastClipboardText = text;
        notifier.notify({
            title: 'YouTube Link Detected',
            message: 'Click to download',
            wait: true
        }, () => {
            mainWindow.show();
            mainWindow.webContents.send('url-detected', text);
        });
    }
}

ipcMain.on('download', async (event, url) => {
    if (ytpl.validateID(url)) {
        await downloadPlaylist(url);
    } else {
        await downloadVideo(url);
    }
});

async function downloadVideo(url) {
    try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[/\\?%*:|"<>]/g, ''); // Remove invalid filename characters
        const outputPath = path.join(os.homedir(), 'Downloads', `${title}.mp3`);

        mainWindow.webContents.send('download-started', title);

        const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });

        const ffmpegProcess = ffmpeg(stream)
            .audioCodec('libmp3lame')
            .toFormat('mp3')
            .save(outputPath)
            .on('progress', (progress) => {
                const percent = Math.round(progress.percent || 0);
                mainWindow.webContents.send('download-progress', title, percent);
            })
            .on('end', () => {
                notifier.notify({
                    title: 'Download Complete',
                    message: `File saved to ${outputPath}`
                });
                downloads.delete(url);
                mainWindow.webContents.send('download-complete', title);
            })
            .on('error', (err) => {
                console.error("FFmpeg error:", err);
            });

        downloads.set(url, ffmpegProcess);
    } catch (err) {
        console.error("Download error:", err);
    }
}


async function downloadPlaylist(playlistUrl) {
    try {
        const playlist = await ytpl(playlistUrl);
        if (!playlist || !playlist.items.length) {
            throw new Error("Playlist is empty or could not be fetched");
        }
        
        notifier.notify({
            title: 'Playlist Detected',
            message: `Downloading ${playlist.items.length} videos...`
        });

        for (const item of playlist.items) {
            await downloadVideo(item.url);
        }
    } catch (err) {
        console.error("Playlist download error:", err);
    }
}

ipcMain.on('pauseDownload', (event, url) => {
    if (downloads.has(url)) {
        downloads.get(url).kill('SIGSTOP');
    }
});

ipcMain.handle('get-video-title', async (event, url) => {
    try {
        if (ytpl.validateID(url)) {
            return "YouTube Playlist"; // Return a generic name for playlists
        }
        const info = await ytdl.getInfo(url);
        return info.videoDetails.title;
    } catch (err) {
        console.error("Error fetching video title:", err);
        return "Unknown Title";
    }
});


ipcMain.on('resumeDownload', (event, url) => {
    if (downloads.has(url)) {
        downloads.get(url).kill('SIGCONT');
    }
});
