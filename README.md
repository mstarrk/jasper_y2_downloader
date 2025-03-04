# Jasper

<img src="https://github.com/user-attachments/assets/f02cfa0b-fcde-4ce1-a104-a139de799a3c" width="400" alt="Jasper Y2 Downloader Screenshot">

Jasper Y2 Downloader is a simple YouTube to MP3 downloader built with **Electron**. It listens for YouTube links copied to the clipboard, provides a notification prompt, and allows easy one-click downloads for individual videos or entire playlists.

## Features

- **Automatic Clipboard Detection** – Detects YouTube links copied to the clipboard and prompts for download.
- **Download YouTube Videos as MP3** – Extracts audio from videos and saves it in high-quality MP3 format.
- **Batch Playlist Downloading** – Supports downloading entire YouTube playlists.
- **Download Queue** – Tracks ongoing downloads with a UI queue and progress indicators.
- **Pause and Resume Downloads** – Allows pausing and resuming downloads as needed.
- **Custom File Naming** – Saves MP3 files using the actual video title.
- **System Notifications** – Alerts when a download starts and completes.

## Installation

### Prerequisites

You need **Node.js** and **npm** installed on your system.

### Clone the Repository

```sh
git clone https://github.com/mstarrk/jasper_y2_downloader.git
cd jasper_y2_downloader
```

### Install Dependencies

```sh
npm install
```

### Run the Application

```sh
npm start
```

## How It Works

1. **Copy a YouTube video or playlist link** – Jasper detects it automatically.
2. **A notification appears** prompting you to download.
3. **Confirm the download** from the UI.
4. **Watch progress** in the UI and find your downloaded MP3 files in your **Downloads** folder.

## Technologies Used

- **Electron** – For the desktop application.
- **ytdl-core** – To extract audio from YouTube videos.
- **@distube/ytpl** – To fetch playlist details.
- **fluent-ffmpeg** – For MP3 conversion.
- **node-notifier** – To provide system notifications.

---
