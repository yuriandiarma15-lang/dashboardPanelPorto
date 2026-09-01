// ============================================================
// AI ASSISTANT GOLD JOURNAL
// server.js
// GOOGLE SHEETS VERSION (TANPA SCREENSHOT)
// VERSION 5.0.0
//
// PERBAIKAN DARI VERSI SEBELUMNYA:
// 1. Field harga hasil (TP1/TP2/SL) yang dikirim frontend
//    sebagai "resultPrice" sekarang benar-benar dipetakan
//    ke kolom F/G/H sesuai nilai "result".
// 2. Response API sekarang menyertakan field turunan
//    "resultPrice" agar frontend bisa langsung menampilkannya.
// 3. Seluruh fitur screenshot (ImgBB, endpoint upload,
//    kolom screenshotUrl) DIHAPUS.
// ============================================================

const express = require("express");
const path = require("path");
const { google } = require("googleapis");

// ============================================================
// APP CONFIG
// ============================================================

const app = express();

const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;
const PUBLIC_DIR = ROOT_DIR;

// ============================================================
// GOOGLE SHEETS CONFIG
// ============================================================

const GOOGLE_SHEET_ID =
    process.env.GOOGLE_SHEET_ID;

const GOOGLE_CLIENT_EMAIL =
    process.env.GOOGLE_CLIENT_EMAIL;

const GOOGLE_PRIVATE_KEY =
    process.env.GOOGLE_PRIVATE_KEY
        ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
        : null;

const SHEET_NAME = "JOURNAL";

// ============================================================
// ADMIN PASSWORD
// ============================================================

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "Bira1234_";

// ============================================================
// GOOGLE SHEETS CLIENT
// ============================================================

let sheets = null;

// ============================================================
// GOOGLE SHEETS INITIALIZATION
// ============================================================

function initializeGoogleSheets() {

    if (
        !GOOGLE_SHEET_ID ||
        !GOOGLE_CLIENT_EMAIL ||
        !GOOGLE_PRIVATE_KEY
    ) {

        console.error(
            "❌ GOOGLE SHEETS CONFIG BELUM LENGKAP."
        );

        console.error(
            "Pastikan Environment Variables memiliki:"
        );

        console.error("GOOGLE_SHEET_ID");
        console.error("GOOGLE_CLIENT_EMAIL");
        console.error("GOOGLE_PRIVATE_KEY");

        return false;
    }

    try {

        const auth =
            new google.auth.GoogleAuth({

                credentials: {
                    client_email: GOOGLE_CLIENT_EMAIL,
                    private_key: GOOGLE_PRIVATE_KEY
                },

                scopes: [
                    "https://www.googleapis.com/auth/spreadsheets"
                ]
            });

        sheets =
            google.sheets({
                version: "v4",
                auth
            });

        console.log(
            "✅ Google Sheets API berhasil diinisialisasi."
        );

        return true;

    } catch (error) {

        console.error(
            "❌ Gagal menginisialisasi Google Sheets:"
        );

        console.error(error);

        return false;
    }
}

// ============================================================
// HEADERS GOOGLE SHEETS
//
// A id | B date | C time | D direction | E entryPrice
// F tp1Price | G tp2Price | H slPrice | I result | J pnl
// K createdAt
// ============================================================

const HEADERS = [
    "id",
    "date",
    "time",
    "direction",
    "entryPrice",
    "tp1Price",
    "tp2Price",
    "slPrice",
    "result",
    "pnl",
    "createdAt"
];

const SHEET_RANGE_FULL = `${SHEET_NAME}!A:K`;
const SHEET_RANGE_HEADER = `${SHEET_NAME}!A1:K1`;
const SHEET_RANGE_DATA = `${SHEET_NAME}!A2:K`;
const SHEET_RANGE_ID_COLUMN = `${SHEET_NAME}!A2:A`;

// ============================================================
// ID GENERATOR
// ============================================================

function generateId() {

    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 8)
    );
}

// ============================================================
// CLEAN PRICE
// ============================================================

function cleanPrice(value) {

    if (value === undefined || value === null) {
        return "";
    }

    const valueString = String(value).trim();

    if (!valueString) {
        return "";
    }

    return valueString;
}

// ============================================================
// ENSURE GOOGLE SHEET HEADER
// ============================================================

async function ensureSheetHeader() {

    if (!sheets) {
        throw new Error("Google Sheets belum terinisialisasi.");
    }

    const response =
        await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: SHEET_RANGE_HEADER
        });

    const values = response.data.values || [];

    if (values.length === 0 || values[0].length === 0) {

        await sheets.spreadsheets.values.update({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: SHEET_RANGE_HEADER,
            valueInputOption: "RAW",
            requestBody: {
                values: [HEADERS]
            }
        });

        console.log("✅ Header JOURNAL berhasil dibuat.");

        return;
    }

    const existingHeaders = values[0];

    const headerMatch =
        HEADERS.every(
            (header, index) => existingHeaders[index] === header
        );

    if (!headerMatch) {

        console.warn(
            "⚠️ Header JOURNAL berbeda dari format yang diharapkan."
        );

        console.warn("Header yang diharapkan:");

        console.warn(HEADERS);
    }
}

// ============================================================
// HITUNG HARGA HASIL (resultPrice) DARI KOLOM TP1/TP2/SL
// ============================================================

function computeResultPrice(row) {

    const result = row.result;

    if (result === "TP1") return row.tp1Price;
    if (result === "TP2") return row.tp2Price;
    if (result === "SL") return row.slPrice;

    // Untuk PENDING, harga yang relevan adalah harga entry
    // (belum ada kolom terpisah untuk harga pending).
    if (result === "PENDING") return row.entryPrice;

    return "";
}

// ============================================================
// GET ALL SIGNALS
// ============================================================

async function getAllSignals() {

    if (!sheets) {
        throw new Error("Google Sheets belum terhubung.");
    }

    await ensureSheetHeader();

    const response =
        await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: SHEET_RANGE_DATA
        });

    const rows = response.data.values || [];

    return rows

        .filter(row => {

            const id = String(row[0] || "").trim();

            if (!id) {
                return false;
            }

            return true;
        })

        .map(row => {

            let numericPnl = 0;

            if (row[9] !== undefined && row[9] !== "") {

                numericPnl = Number(row[9]);

                if (Number.isNaN(numericPnl)) {
                    numericPnl = 0;
                }
            }

            const signal = {

                id: row[0] || "",
                date: row[1] || "",
                time: row[2] || "",
                direction: row[3] || "BUY",

                // E
                entryPrice: cleanPrice(row[4]),

                // F
                tp1Price: cleanPrice(row[5]),

                // G
                tp2Price: cleanPrice(row[6]),

                // H
                slPrice: cleanPrice(row[7]),

                result: row[8] || "",

                pnl: numericPnl,

                createdAt: row[10] || ""
            };

            // Field turunan agar frontend tinggal pakai
            // satu nama field untuk "harga hasil".
            signal.resultPrice = computeResultPrice(signal);

            return signal;
        });
}

// ============================================================
// GET SIGNALS BY DATE
// ============================================================

async function getSignalsByDate(date) {

    const signals = await getAllSignals();

    return signals.filter(
        signal =>
            String(signal.date).trim() === String(date).trim()
    );
}

// ============================================================
// GET DATES
// ============================================================

async function getAvailableDates() {

    const signals = await getAllSignals();

    const dates = new Set();

    signals.forEach(signal => {

        if (signal.date) {
            dates.add(String(signal.date).trim());
        }
    });

    return Array.from(dates).sort();
}

// ============================================================
// FIND SIGNAL ROW
// ============================================================

async function findSignalRow(id) {

    if (!sheets) {
        throw new Error("Google Sheets belum terhubung.");
    }

    const response =
        await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: SHEET_RANGE_ID_COLUMN
        });

    const rows = response.data.values || [];

    for (let i = 0; i < rows.length; i++) {

        const rowId = String(rows[i][0] || "").trim();

        if (rowId === String(id).trim()) {
            return i + 2;
        }
    }

    return null;
}

// ============================================================
// FIND SHEET ID
// ============================================================

async function getJournalSheetId() {

    const metadata =
        await sheets.spreadsheets.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            fields: "sheets.properties"
        });

    const journalSheet =
        metadata.data.sheets.find(
            sheet => sheet.properties.title === SHEET_NAME
        );

    if (!journalSheet) {
        throw new Error(`Sheet "${SHEET_NAME}" tidak ditemukan.`);
    }

    return journalSheet.properties.sheetId;
}

// ============================================================
// EXPRESS JSON
// ============================================================

app.use(express.json({ limit: "5mb" }));

app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ============================================================
// SECURITY HEADERS
// ============================================================

app.use((req, res, next) => {

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
    );

    next();
});

// ============================================================
// STATIC
// ============================================================

app.use(
    express.static(PUBLIC_DIR, {
        index: false,
        extensions: ["html"],
        maxAge: "1h"
    })
);

// ============================================================
// ADMIN AUTH
// ============================================================

function requireAdmin(req, res, next) {

    const password = req.headers["x-admin-password"];

    if (!password || password !== ADMIN_PASSWORD) {

        return res.status(401).json({
            success: false,
            error: "Akses admin ditolak."
        });
    }

    next();
}

// ============================================================
// HEALTH
// ============================================================

app.get("/health", (req, res) => {

    res.status(200).json({
        status: "ok",
        service: "AI Assistant Gold Journal",
        database: "Google Sheets",
        googleSheets: Boolean(sheets),
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// API STATUS
// ============================================================

app.get("/api/status", (req, res) => {

    res.status(200).json({
        success: true,
        message: "AI Assistant Gold Journal server is running",
        service: "ai-assistant-gold-journal",
        version: "5.0.0",
        database: "Google Sheets",
        sheet: SHEET_NAME,
        node: process.version,
        environment: process.env.NODE_ENV || "production",
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// ADMIN VERIFY
// ============================================================

app.post("/api/admin/verify", (req, res) => {

    const password = String(req.body.password || "");

    if (password === ADMIN_PASSWORD) {
        return res.json({ ok: true });
    }

    return res.status(401).json({ ok: false });
});

// ============================================================
// GET DAY
// ============================================================

app.get("/api/day/:date", async (req, res) => {

    try {

        const date = req.params.date;

        const signals = await getSignalsByDate(date);

        return res.json({
            date,
            signals
        });

    } catch (error) {

        console.error("❌ GET DAY ERROR:");
        console.error(error);

        return res.status(500).json({
            success: false,
            error: "Gagal mengambil data Google Sheets."
        });
    }
});

// ============================================================
// GET LATEST
// ============================================================

app.get("/api/latest", async (req, res) => {

    try {

        const dates = await getAvailableDates();

        if (!dates.length) {
            return res.json({ date: null });
        }

        return res.json({
            date: dates[dates.length - 1]
        });

    } catch (error) {

        console.error("❌ GET LATEST ERROR:");
        console.error(error);

        return res.status(500).json({
            success: false,
            error: "Gagal mengambil tanggal terbaru."
        });
    }
});

// ============================================================
// GET MONTH
// ============================================================

app.get("/api/month/:month", async (req, res) => {

    try {

        const month = req.params.month;

        const signals = await getAllSignals();

        const result = {};

        signals
            .filter(
                signal =>
                    signal.date && signal.date.startsWith(month)
            )
            .forEach(signal => {

                if (!result[signal.date]) {
                    result[signal.date] = { signals: [] };
                }

                result[signal.date].signals.push(signal);
            });

        return res.json(result);

    } catch (error) {

        console.error("❌ GET MONTH ERROR:");
        console.error(error);

        return res.status(500).json({
            success: false,
            error: "Gagal mengambil data bulan."
        });
    }
});

// ============================================================
// ADD SIGNAL
// ============================================================

app.post(
    "/api/day/:date/signal",
    requireAdmin,
    async (req, res) => {

        try {

            const date = String(req.params.date || "").trim();

            let {
                time,
                direction,
                entryPrice,
                resultPrice,
                result,
                pnl
            } = req.body;

            // ------------------------------------------------
            // NORMALISASI
            // ------------------------------------------------

            time = cleanPrice(time);

            direction =
                String(direction || "BUY").trim().toUpperCase();

            result = String(result || "").trim().toUpperCase();

            entryPrice = cleanPrice(entryPrice);

            resultPrice = cleanPrice(resultPrice);

            // ------------------------------------------------
            // VALIDATION
            // ------------------------------------------------

            if (!date) {
                return res.status(400).json({
                    success: false,
                    error: "Tanggal wajib diisi."
                });
            }

            if (!time) {
                return res.status(400).json({
                    success: false,
                    error: "Jam signal wajib diisi."
                });
            }

            if (!result) {
                return res.status(400).json({
                    success: false,
                    error: "Hasil signal wajib diisi."
                });
            }

            const allowedDirections = ["BUY", "SELL"];

            const allowedResults = [
                "TP1",
                "TP2",
                "SL",
                "PENDING",
                "NO SIGNAL"
            ];

            if (
                direction &&
                !allowedDirections.includes(direction)
            ) {
                return res.status(400).json({
                    success: false,
                    error: "Arah signal tidak valid."
                });
            }

            if (!allowedResults.includes(result)) {
                return res.status(400).json({
                    success: false,
                    error: "Hasil signal tidak valid."
                });
            }

            // ------------------------------------------------
            // PEMETAAN HARGA KE KOLOM YANG BENAR
            //
            // ENTRY -> E (selalu dari field "entryPrice")
            // TP1   -> F (hanya diisi jika result === "TP1")
            // TP2   -> G (hanya diisi jika result === "TP2")
            // SL    -> H (hanya diisi jika result === "SL")
            //
            // Frontend mengirim SATU field harga hasil
            // bernama "resultPrice"; di sinilah field itu
            // dipetakan ke kolom F/G/H sesuai "result".
            // ------------------------------------------------

            const finalEntryPrice =
                result === "NO SIGNAL" ? "" : entryPrice;

            const finalTp1Price =
                result === "TP1" ? resultPrice : "";

            const finalTp2Price =
                result === "TP2" ? resultPrice : "";

            const finalSlPrice =
                result === "SL" ? resultPrice : "";

            // ------------------------------------------------
            // PNL
            // ------------------------------------------------

            let numericPnl = 0;

            if (
                pnl !== undefined &&
                pnl !== null &&
                String(pnl).trim() !== ""
            ) {

                numericPnl = Number(pnl);

                if (Number.isNaN(numericPnl)) {
                    numericPnl = 0;
                }
            }

            // ------------------------------------------------
            // CREATE SIGNAL
            // ------------------------------------------------

            const signal = {

                id: generateId(),
                date,
                time,
                direction: direction === "SELL" ? "SELL" : "BUY",

                entryPrice: finalEntryPrice,
                tp1Price: finalTp1Price,
                tp2Price: finalTp2Price,
                slPrice: finalSlPrice,

                result,
                pnl: numericPnl,
                createdAt: new Date().toISOString()
            };

            // ------------------------------------------------
            // LOG UNTUK MEMASTIKAN HARGA
            // ------------------------------------------------

            console.log("==============================================");
            console.log("📥 SIGNAL BARU");
            console.log(`📅 Date   : ${signal.date}`);
            console.log(`⏰ Time   : ${signal.time}`);
            console.log(`📈 Dir    : ${signal.direction}`);
            console.log(`💰 Entry  : ${signal.entryPrice}`);
            console.log(`🎯 TP1    : ${signal.tp1Price}`);
            console.log(`🎯 TP2    : ${signal.tp2Price}`);
            console.log(`🛑 SL     : ${signal.slPrice}`);
            console.log(`🏁 Result : ${signal.result}`);
            console.log("==============================================");

            // ------------------------------------------------
            // SAVE TO GOOGLE SHEETS
            // ------------------------------------------------

            await sheets.spreadsheets.values.append({

                spreadsheetId: GOOGLE_SHEET_ID,
                range: SHEET_RANGE_FULL,
                valueInputOption: "RAW",
                insertDataOption: "INSERT_ROWS",

                requestBody: {
                    values: [[
                        signal.id,
                        signal.date,
                        signal.time,
                        signal.direction,
                        signal.entryPrice,
                        signal.tp1Price,
                        signal.tp2Price,
                        signal.slPrice,
                        signal.result,
                        signal.pnl,
                        signal.createdAt
                    ]]
                }
            });

            console.log(
                `✅ SIGNAL TERSIMPAN: ${signal.date} ${signal.time}`
            );

            signal.resultPrice = computeResultPrice(signal);

            return res.json({
                success: true,
                signal
            });

        } catch (error) {

            console.error("❌ ADD SIGNAL ERROR:");
            console.error(error);

            return res.status(500).json({
                success: false,
                error: "Gagal menyimpan signal ke Google Sheets."
            });
        }
    }
);

// ============================================================
// DELETE SIGNAL
// ============================================================

app.delete(
    "/api/day/:date/signal/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const id = req.params.id;

            const rowNumber = await findSignalRow(id);

            if (!rowNumber) {
                return res.status(404).json({
                    success: false,
                    error: "Signal tidak ditemukan."
                });
            }

            const sheetId = await getJournalSheetId();

            await sheets.spreadsheets.batchUpdate({

                spreadsheetId: GOOGLE_SHEET_ID,

                requestBody: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId,
                                dimension: "ROWS",
                                startIndex: rowNumber - 1,
                                endIndex: rowNumber
                            }
                        }
                    }]
                }
            });

            console.log(`🗑️ SIGNAL DIHAPUS: ${id}`);

            return res.json({ success: true });

        } catch (error) {

            console.error("❌ DELETE SIGNAL ERROR:");
            console.error(error);

            return res.status(500).json({
                success: false,
                error: "Gagal menghapus signal."
            });
        }
    }
);

// ============================================================
// HOME
// ============================================================

app.get("/", (req, res) => {

    const indexPath = path.join(ROOT_DIR, "index.html");

    res.sendFile(indexPath, error => {

        if (error) {

            console.error("❌ Gagal mengirim index.html:");
            console.error(error);

            if (!res.headersSent) {
                res.status(500).send(
                    "index.html tidak ditemukan."
                );
            }
        }
    });
});

// ============================================================
// SPA FALLBACK
// ============================================================

app.get("*", (req, res, next) => {

    if (req.path.startsWith("/api/")) {
        return next();
    }

    if (path.extname(req.path)) {
        return next();
    }

    const indexPath = path.join(ROOT_DIR, "index.html");

    res.sendFile(indexPath, error => {
        if (error) {
            next(error);
        }
    });
});

// ============================================================
// 404
// ============================================================

app.use((req, res) => {

    if (req.path.startsWith("/api/")) {

        return res.status(404).json({
            success: false,
            error: "API endpoint tidak ditemukan",
            path: req.path
        });
    }

    res.status(404).send(`
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>404</title>
</head>
<body style="background:#0b0f14;color:white;font-family:Arial;text-align:center;padding:80px 20px;">
<h1>404</h1>
<p>Halaman tidak ditemukan.</p>
<a href="/" style="color:white;">Kembali ke Dashboard</a>
</body>
</html>
`);
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {

    console.error("==============================================");
    console.error("❌ EXPRESS SERVER ERROR");
    console.error("==============================================");
    console.error(err);

    if (res.headersSent) {
        return next(err);
    }

    if (req.path.startsWith("/api/")) {

        return res.status(500).json({
            success: false,
            error: "Internal Server Error"
        });
    }

    res.status(500).send(`
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>500</title>
</head>
<body style="background:#0b0f14;color:white;font-family:Arial;text-align:center;padding:60px 20px;">
<h1>500</h1>
<p>Terjadi kesalahan pada server.</p>
<a href="/" style="color:white;">Kembali</a>
</body>
</html>
`);
});

// ============================================================
// INITIALIZE GOOGLE SHEETS
// ============================================================

initializeGoogleSheets();

// ============================================================
// START SERVER
// ============================================================

const server = app.listen(PORT, "0.0.0.0", async () => {

    console.log("");
    console.log("==============================================");
    console.log("🚀 AI ASSISTANT GOLD JOURNAL");
    console.log("==============================================");
    console.log(`🌐 Server : 0.0.0.0:${PORT}`);
    console.log(`📁 Root   : ${ROOT_DIR}`);
    console.log("💾 Data   : GOOGLE SHEETS");
    console.log(`📊 Sheet  : ${SHEET_NAME}`);
    console.log("🟢 Health : /health");
    console.log("🔵 API    : /api/status");
    console.log("🔐 Admin  : ENABLED");
    console.log("==============================================");

    if (sheets) {

        try {

            await ensureSheetHeader();

            console.log("✅ GOOGLE SHEETS TERHUBUNG");

        } catch (error) {

            console.error("❌ GOOGLE SHEETS TIDAK BISA DIAKSES");
            console.error(error.message);
        }

    } else {

        console.error("❌ GOOGLE SHEETS BELUM TERKONFIGURASI");
    }

    console.log("==============================================");
    console.log("✅ SERVER BERHASIL START");
    console.log("==============================================");
    console.log("");
});

// ============================================================
// SERVER ERROR
// ============================================================

server.on("error", error => {

    console.error("❌ SERVER ERROR");
    console.error(error);
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function shutdown(signal) {

    console.log(`⚠️ ${signal} diterima.`);
    console.log("🛑 Menghentikan server...");

    server.close(() => {

        console.log("✅ Server berhasil dihentikan.");

        process.exit(0);
    });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ============================================================
// UNCAUGHT ERRORS
// ============================================================

process.on("uncaughtException", error => {

    console.error("❌ UNCAUGHT EXCEPTION");
    console.error(error);
});

process.on("unhandledRejection", reason => {

    console.error("❌ UNHANDLED PROMISE REJECTION");
    console.error(reason);
});
