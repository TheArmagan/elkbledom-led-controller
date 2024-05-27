const noble = require('./noble');
const { app, BrowserWindow, Tray, ipcMain, Menu } = require('electron');
const path = require('node:path');
const express = require('express');
const eApp = express();
const _ = require('lodash');
const cp = require('child_process');

eApp.use(express.json());
eApp.use(express.static('./led-color-picker/dist'));
eApp.listen(3498);

process.title = "Bluetooth LED Controller";

noble.on('stateChange', (state) => {
  if (state === 'poweredOn') {
    noble.startScanningAsync([], false);
  }
});

function buildColorBuffer(r, g, b) {
  return Buffer.from([0x7e, 0x00, 0x05, 0x03, r, g, b, 0x00, 0xef]);
}

let writer;
let peripheral;
/** @type {BrowserWindow} */
let win;

let lastColor = [0, 0, 0];

noble.on('discover', async (p) => {
  if (p.advertisement.localName.includes("ELK-BLEDOM")) {
    peripheral = p;
    p.addListener('disconnect', () => {
      noble.removeAllListeners("disconnect");
      console.log('disconnected from peripheral: ' + p.uuid);
      noble.startScanningAsync([], true);
    });
    noble.stopScanning();
    await p.connectAsync();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('connected to peripheral: ' + p.uuid);
    const { characteristics } = await p.discoverAllServicesAndCharacteristicsAsync();
    writer = characteristics.find((c) => c.properties.some((p) => p.includes('write')));
    if (writer) {
      console.log('found writer characteristic');
      writer.writeAsync(buildColorBuffer(...lastColor), true);
    }
  }
});

let audioReactive = false;

const audioProc = cp.spawn(`./audio/DesktopAudioFFT.exe`, []);
audioProc.stdout.setEncoding('utf8');
audioProc.stdout.on('data', _.throttle((data) => {
  if (audioReactive) {
    /** @type {number[]} */
    const fftData = data.trim().split(", ").map(Number);
    const bass = Math.floor(fftData.slice(4, 34).reduce((a, b) => a + b, 0) / 30) / 100;
    win.webContents.send("brightness", 5 + Math.min(bass * 45, 45));
  }
}, 50));

function createTrayApp() {
  win = new BrowserWindow({
    width: 450,
    height: 550,
    frame: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  const writeColor = _.throttle((color) => {
    lastColor = color;
    if (writer) {
      writer.writeAsync(buildColorBuffer(...color), true);
    }
  }, 50);

  eApp.get('/color', (req, res) => {
    res.send({ color: lastColor });
  });

  eApp.post('/color', (req, res) => {
    if (typeof req.body.brightness !== "undefined") win.webContents.send("brightness", req.body.brightness);
    if (typeof req.body.color !== "undefined") win.webContents.send("color", req.body.color);
    res.send({ ok: true });
  });

  ipcMain.on("color", (event, color) => {
    writeColor(color);
  });

  win.loadURL('http://localhost:3498');
  win.hide();


  function toggleVisibility() {
    if (!win.isVisible()) {
      win.show();
      win.setPosition(tray.getBounds().x - win.getBounds().width, tray.getBounds().y - win.getBounds().height - 10);
    } else {
      win.hide();
    }
  }

  const tray = new Tray(path.join(__dirname, 'icon.png'));
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Color Wheel',
      click() {
        toggleVisibility();
      }
    },
    {
      label: 'Audio Reactive',
      type: "checkbox",
      click() {
        audioReactive = !audioReactive;
      }
    },
    {
      label: "Color",
      type: "submenu",
      submenu: [
        {
          label: "Red",
          click() {
            win.webContents.send("brightness", 50);
            win.webContents.send("color", [255, 0, 0]);
          }
        },
        {
          label: "Yellow",
          click() {
            win.webContents.send("brightness", 50);
            win.webContents.send("color", [255, 255, 0]);
          }
        },
        {
          label: "Green",
          click() {
            win.webContents.send("brightness", 50);
            win.webContents.send("color", [0, 255, 0]);
          }
        },
        {
          label: "Cyan",
          click() {
            win.webContents.send("brightness", 50);
            win.webContents.send("color", [0, 255, 255]);
          }
        },
        {
          label: "Blue",
          click() {
            win.webContents.send("brightness", 50);
            win.webContents.send("color", [0, 0, 255]);
          }
        },
        {
          label: "Purple",
          click() {
            win.webContents.send("brightness", 50);
            win.webContents.send("color", [255, 0, 255]);
          }
        },
        {
          label: "White",
          click() {
            win.webContents.send("brightness", 100);
            win.webContents.send("color", [255, 255, 255]);
          }
        },
        {
          label: "Black",
          click() {
            win.webContents.send("brightness", 0);
          }
        }
      ]
    },
    {
      label: 'Quit',
      click() {
        app.quit();
      }
    }
  ]));

  tray.setToolTip("Bluetooth LED Controller");

  tray.addListener("click", toggleVisibility);

  win.addListener("blur", () => {
    win.hide();
  });
}

app.whenReady().then(() => {
  createTrayApp()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createTrayApp()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  noble.stopScanning();
  peripheral.disconnectAsync();
});