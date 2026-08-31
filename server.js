// ============================================================
// AI ASSISTANT GOLD JOURNAL
// server.js
// ============================================================

const express = require("express");
const path = require("path");
const fs = require("fs");

// ============================================================
// APP CONFIG
// ============================================================

const app = express();

const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;
const PUBLIC_DIR = ROOT_DIR;

const DATA_FILE = path.join(ROOT_DIR, "journal-data.json");

// ============================================================
// ADMIN PASSWORD
// ============================================================
//
// Bisa diganti melalui Environment Variable:
//
// ADMIN_PASSWORD=Bira1234_
//
// Jika Environment Variable belum dibuat,
// password default = Bira1234_
//

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "Bira1234_";

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ============================================================
// SECURITY HEADERS
// ============================================================

app.use((req, res, next) => {

    res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
    );

    res.setHeader(
        "X-Frame-Options",
        "SAMEORIGIN"
    );

    res.setHeader(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
    );

    next();
});

// ============================================================
// STATIC FILES
// ============================================================

app.use(
    express.static(PUBLIC_DIR, {
        index: false,
        extensions: ["html"],
        maxAge: "1h"
    })
);

// ============================================================
// DATABASE / JSON STORAGE
// ============================================================

function createEmptyDatabase() {
    return {
        days: {}
    };
}

function loadDatabase() {

    try {

        if (!fs.existsSync(DATA_FILE)) {

            const empty = createEmptyDatabase();

            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(empty, null, 2),
                "utf8"
            );

            return empty;
        }

        const raw = fs.readFileSync(
            DATA_FILE,
            "utf8"
        );

        if (!raw.trim()) {
            return createEmptyDatabase();
        }

        const data = JSON.parse(raw);

        if (!data.days || typeof data.days !== "object") {
            data.days = {};
        }

        return data;

    } catch (error) {

        console.error(
            "❌ Gagal membaca journal-data.json:"
        );

        console.error(error);

        return createEmptyDatabase();
    }
}

let database = loadDatabase();

function saveDatabase() {

    try {

        const tempFile = DATA_FILE + ".tmp";

        fs.writeFileSync(
            tempFile,
            JSON.stringify(database, null, 2),
            "utf8"
        );

        fs.renameSync(
            tempFile,
            DATA_FILE
        );

        return true;

    } catch (error) {

        console.error(
            "❌ Gagal menyimpan database:"
        );

        console.error(error);

        return false;
    }
}

// ============================================================
// DATE HELPERS
// ============================================================

function isValidDate(date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isValidMonth(month) {
    return /^\d{4}-\d{2}$/.test(month);
}

function ensureDay(date) {

    if (!database.days[date]) {

        database.days[date] = {
            signals: [],
            screenshot: null
        };
    }

    if (!Array.isArray(database.days[date].signals)) {
        database.days[date].signals = [];
    }

    if (!("screenshot" in database.days[date])) {
        database.days[date].screenshot = null;
    }

    return database.days[date];
}

// ============================================================
// ADMIN AUTHENTICATION
// ============================================================

function requireAdmin(req, res, next) {

    const password =
        req.headers["x-admin-password"] || "";

    if (!password) {

        return res.status(401).json({
            success: false,
            error: "Password admin diperlukan"
        });
    }

    if (password !== ADMIN_PASSWORD) {

        return res.status(403).json({
            success: false,
            error: "Password admin salah"
        });
    }

    next();
}

// ============================================================
// ADMIN VERIFY
// ============================================================

app.post(
    "/api/admin/verify",
    (req, res) => {

        const password =
            req.body?.password || "";

        if (
            typeof password !== "string" ||
            password !== ADMIN_PASSWORD
        ) {

            return res.status(401).json({
                ok: false
            });
        }

        return res.json({
            ok: true
        });
    }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/health",
    (req, res) => {

        res.status(200).json({
            status: "ok",
            service: "AI Assistant Gold Journal",
            timestamp: new Date().toISOString()
        });
    }
);

// ============================================================
// API STATUS
// ============================================================

app.get(
    "/api/status",
    (req, res) => {

        res.status(200).json({
            success: true,
            message:
                "AI Assistant Gold Journal server is running",
            service:
                "ai-assistant-gold-journal",
            version: "1.0.0",
            node: process.version,
            environment:
                process.env.NODE_ENV || "production",
            timestamp:
                new Date().toISOString()
        });
    }
);

// ============================================================
// GET DAY
// ============================================================

app.get(
    "/api/day/:date",
    (req, res) => {

        const date = req.params.date;

        if (!isValidDate(date)) {

            return res.status(400).json({
                success: false,
                error: "Format tanggal harus YYYY-MM-DD"
            });
        }

        const day =
            database.days[date] || {
                signals: [],
                screenshot: null
            };

        return res.json({
            date,
            signals: day.signals || [],
            screenshot: day.screenshot || null
        });
    }
);

// ============================================================
// GET LATEST DATE
// ============================================================

app.get(
    "/api/latest",
    (req, res) => {

        const dates =
            Object.keys(database.days)
                .filter(isValidDate)
                .sort();

        if (!dates.length) {

            return res.status(404).json({
                success: false,
                error: "Belum ada data"
            });
        }

        return res.json({
            date: dates[dates.length - 1]
        });
    }
);

// ============================================================
// GET MONTH
// ============================================================

app.get(
    "/api/month/:month",
    (req, res) => {

        const month = req.params.month;

        if (!isValidMonth(month)) {

            return res.status(400).json({
                success: false,
                error: "Format bulan harus YYYY-MM"
            });
        }

        const result = {};

        Object.keys(database.days).forEach(
            (date) => {

                if (date.startsWith(month + "-")) {

                    result[date] = {
                        signals:
                            database.days[date].signals ||
                            [],
                        screenshot:
                            database.days[date].screenshot ||
                            null
                    };
                }
            }
        );

        return res.json(result);
    }
);

// ============================================================
// ADD SIGNAL
// ============================================================

app.post(
    "/api/day/:date/signal",
    requireAdmin,
    (req, res) => {

        const date = req.params.date;

        if (!isValidDate(date)) {

            return res.status(400).json({
                success: false,
                error:
                    "Format tanggal harus YYYY-MM-DD"
            });
        }

        const {
            time,
            direction,
            entryPrice,
            result,
            pnl
        } = req.body || {};

        // ----------------------------------------------------
        // VALIDATION
        // ----------------------------------------------------

        if (!time) {

            return res.status(400).json({
                success: false,
                error: "Jam signal wajib diisi"
            });
        }

        if (
            direction !== "BUY" &&
            direction !== "SELL"
        ) {

            return res.status(400).json({
                success: false,
                error: "Direction harus BUY atau SELL"
            });
        }

        if (!entryPrice) {

            return res.status(400).json({
                success: false,
                error: "Harga entry wajib diisi"
            });
        }

        if (
            result !== "TP1" &&
            result !== "TP2" &&
            result !== "SL"
        ) {

            return res.status(400).json({
                success: false,
                error:
                    "Hasil harus TP1, TP2, atau SL"
            });
        }

        if (
            pnl === undefined ||
            pnl === null ||
            pnl === ""
        ) {

            return res.status(400).json({
                success: false,
                error: "PnL wajib diisi"
            });
        }

        const pnlNumber =
            Number.parseFloat(pnl);

        if (Number.isNaN(pnlNumber)) {

            return res.status(400).json({
                success: false,
                error: "PnL harus berupa angka"
            });
        }

        // ----------------------------------------------------
        // CREATE DAY
        // ----------------------------------------------------

        const day = ensureDay(date);

        // ----------------------------------------------------
        // CREATE ID
        // ----------------------------------------------------

        const id =
            Date.now().toString() +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 8);

        // ----------------------------------------------------
        // SIGNAL OBJECT
        // ----------------------------------------------------

        const signal = {

            id,

            time:
                String(time).trim(),

            direction,

            entryPrice:
                String(entryPrice).trim(),

            result,

            pnl:
                pnlNumber,

            createdAt:
                new Date().toISOString()
        };

        day.signals.push(signal);

        // ----------------------------------------------------
        // SAVE
        // ----------------------------------------------------

        if (!saveDatabase()) {

            return res.status(500).json({
                success: false,
                error:
                    "Signal gagal disimpan"
            });
        }

        console.log(
            `📊 Signal ditambahkan: ${date} ${time} ${direction} ${result} $${pnlNumber}`
        );

        return res.status(201).json({
            success: true,
            signal
        });
    }
);

// ============================================================
// DELETE SIGNAL
// ============================================================

app.delete(
    "/api/day/:date/signal/:id",
    requireAdmin,
    (req, res) => {

        const date = req.params.date;
        const id = req.params.id;

        if (!isValidDate(date)) {

            return res.status(400).json({
                success: false,
                error:
                    "Format tanggal harus YYYY-MM-DD"
            });
        }

        const day =
            database.days[date];

        if (!day) {

            return res.status(404).json({
                success: false,
                error:
                    "Tanggal tidak ditemukan"
            });
        }

        const signals =
            day.signals || [];

        const index =
            signals.findIndex(
                (signal) =>
                    String(signal.id) ===
                    String(id)
            );

        if (index === -1) {

            return res.status(404).json({
                success: false,
                error:
                    "Signal tidak ditemukan"
            });
        }

        const deleted =
            signals.splice(index, 1)[0];

        if (!saveDatabase()) {

            return res.status(500).json({
                success: false,
                error:
                    "Signal gagal dihapus"
            });
        }

        console.log(
            `🗑️ Signal dihapus: ${date} ${id}`
        );

        return res.json({
            success: true,
            deleted
        });
    }
);

// ============================================================
// SAVE SCREENSHOT
// ============================================================

app.post(
    "/api/day/:date/screenshot",
    requireAdmin,
    (req, res) => {

        const date = req.params.date;

        if (!isValidDate(date)) {

            return res.status(400).json({
                success: false,
                error:
                    "Format tanggal harus YYYY-MM-DD"
            });
        }

        const screenshot =
            req.body?.screenshot;

        if (
            typeof screenshot !== "string" ||
            !screenshot
        ) {

            return res.status(400).json({
                success: false,
                error:
                    "Screenshot tidak ditemukan"
            });
        }

        // ----------------------------------------------------
        // LIMIT DATA
        // ----------------------------------------------------

        if (screenshot.length > 15 * 1024 * 1024) {

            return res.status(413).json({
                success: false,
                error:
                    "Ukuran screenshot terlalu besar"
            });
        }

        // ----------------------------------------------------
        // VALIDATE IMAGE DATA
        // ----------------------------------------------------

        if (
            !screenshot.startsWith(
                "data:image/"
            )
        ) {

            return res.status(400).json({
                success: false,
                error:
                    "File harus berupa gambar"
            });
        }

        const day =
            ensureDay(date);

        day.screenshot =
            screenshot;

        if (!saveDatabase()) {

            return res.status(500).json({
                success: false,
                error:
                    "Screenshot gagal disimpan"
            });
        }

        console.log(
            `🖼️ Screenshot disimpan: ${date}`
        );

        return res.json({
            success: true,
            message:
                "Screenshot tersimpan"
        });
    }
);

// ============================================================
// DELETE SCREENSHOT
// ============================================================

app.delete(
    "/api/day/:date/screenshot",
    requireAdmin,
    (req, res) => {

        const date = req.params.date;

        if (!isValidDate(date)) {

            return res.status(400).json({
                success: false,
                error:
                    "Format tanggal harus YYYY-MM-DD"
            });
        }

        const day =
            database.days[date];

        if (!day) {

            return res.status(404).json({
                success: false,
                error:
                    "Tanggal tidak ditemukan"
            });
        }

        day.screenshot = null;

        if (!saveDatabase()) {

            return res.status(500).json({
                success: false,
                error:
                    "Screenshot gagal dihapus"
            });
        }

        return res.json({
            success: true
        });
    }
);

// ============================================================
// HOME PAGE
// ============================================================

app.get(
    "/",
    (req, res) => {

        const indexPath =
            path.join(
                ROOT_DIR,
                "index.html"
            );

        res.sendFile(
            indexPath,
            (error) => {

                if (error) {

                    console.error(
                        "❌ Gagal mengirim index.html:"
                    );

                    console.error(error);

                    if (!res.headersSent) {

                        res.status(500).send(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <title>Server Error</title>
                            </head>
                            <body>
                                <h1>500 - Server Error</h1>
                                <p>index.html tidak ditemukan.</p>
                            </body>
                            </html>
                        `);
                    }
                }
            }
        );
    }
);

// ============================================================
// SPA FALLBACK
// ============================================================

app.get(
    "*",
    (req, res, next) => {

        // Jangan fallback API
        if (
            req.path.startsWith("/api/")
        ) {
            return next();
        }

        // Jangan fallback file
        if (path.extname(req.path)) {
            return next();
        }

        const indexPath =
            path.join(
                ROOT_DIR,
                "index.html"
            );

        res.sendFile(
            indexPath,
            (error) => {

                if (error) {
                    next(error);
                }
            }
        );
    }
);

// ============================================================
// 404 HANDLER
// ============================================================

app.use(
    (req, res) => {

        if (
            req.path.startsWith("/api/")
        ) {

            return res.status(404).json({
                success: false,
                error:
                    "API endpoint tidak ditemukan",
                path: req.path
            });
        }

        res.status(404).send(`
            <!DOCTYPE html>

            <html lang="id">

            <head>

                <meta charset="UTF-8">

                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                >

                <title>404 - Tidak Ditemukan</title>

                <style>

                    * {
                        box-sizing: border-box;
                    }

                    body {
                        margin: 0;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;

                        background: #0b0f14;
                        color: #ffffff;

                        font-family:
                            Arial,
                            Helvetica,
                            sans-serif;
                    }

                    .container {
                        text-align: center;
                        padding: 40px;
                    }

                    .code {
                        font-size: 80px;
                        font-weight: 800;
                        margin-bottom: 10px;
                    }

                    h1 {
                        margin: 0 0 12px;
                        font-size: 28px;
                    }

                    p {
                        color: #9ca3af;
                        margin-bottom: 30px;
                    }

                    a {
                        display: inline-block;
                        padding: 12px 22px;

                        background: #ffffff;
                        color: #000000;

                        text-decoration: none;
                        border-radius: 8px;

                        font-weight: 600;
                    }

                    a:hover {
                        opacity: 0.85;
                    }

                </style>

            </head>

            <body>

                <div class="container">

                    <div class="code">
                        404
                    </div>

                    <h1>
                        Halaman Tidak Ditemukan
                    </h1>

                    <p>
                        Halaman yang kamu cari tidak tersedia.
                    </p>

                    <a href="/">
                        Kembali ke Dashboard
                    </a>

                </div>

            </body>

            </html>
        `);
    }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
    (err, req, res, next) => {

        console.error(
            "=============================================="
        );

        console.error(
            "❌ EXPRESS SERVER ERROR"
        );

        console.error(
            "=============================================="
        );

        console.error(err);

        if (res.headersSent) {
            return next(err);
        }

        if (
            req.path.startsWith("/api/")
        ) {

            return res.status(500).json({
                success: false,
                error:
                    "Internal Server Error"
            });
        }

        res.status(500).send(`
            <!DOCTYPE html>

            <html lang="id">

            <head>

                <meta charset="UTF-8">

                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                >

                <title>500 - Server Error</title>

            </head>

            <body
                style="
                    background:#0b0f14;
                    color:white;
                    font-family:Arial,sans-serif;
                    text-align:center;
                    padding:60px 20px;
                "
            >

                <h1>500</h1>

                <p>
                    Terjadi kesalahan pada server.
                </p>

                <a
                    href="/"
                    style="
                        color:white;
                        text-decoration:none;
                    "
                >
                    Kembali ke halaman utama
                </a>

            </body>

            </html>
        `);
    }
);

// ============================================================
// START SERVER
// ============================================================

const server =
    app.listen(
        PORT,
        "0.0.0.0",
        () => {

            console.log("");

            console.log(
                "=============================================="
            );

            console.log(
                "🚀 AI ASSISTANT GOLD JOURNAL"
            );

            console.log(
                "=============================================="
            );

            console.log(
                `🌐 Server     : 0.0.0.0:${PORT}`
            );

            console.log(
                `📁 Root       : ${ROOT_DIR}`
            );

            console.log(
                `📄 Index      : ${path.join(ROOT_DIR, "index.html")}`
            );

            console.log(
                `💾 Data       : ${DATA_FILE}`
            );

            console.log(
                "🔐 Admin API  : /api/admin/verify"
            );

            console.log(
                "🟢 Health     : /health"
            );

            console.log(
                "🔵 API Status : /api/status"
            );

            console.log(
                "=============================================="
            );

            console.log(
                "✅ SERVER BERHASIL START"
            );

            console.log(
                "=============================================="
            );

            console.log("");
        }
    );

// ============================================================
// SERVER ERROR
// ============================================================

server.on(
    "error",
    (error) => {

        console.error("");

        console.error(
            "=============================================="
        );

        console.error(
            "❌ SERVER ERROR"
        );

        console.error(
            "=============================================="
        );

        console.error(error);

        console.error("");
    }
);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function shutdown(signal) {

    console.log("");

    console.log(
        `⚠️ ${signal} diterima.`
    );

    console.log(
        "🛑 Menghentikan server..."
    );

    server.close(
        () => {

            console.log(
                "✅ Server berhasil dihentikan."
            );

            process.exit(0);
        }
    );
}

process.on(
    "SIGTERM",
    () => {
        shutdown("SIGTERM");
    }
);

process.on(
    "SIGINT",
    () => {
        shutdown("SIGINT");
    }
);

// ============================================================
// UNHANDLED ERRORS
// ============================================================

process.on(
    "uncaughtException",
    (error) => {

        console.error("");

        console.error(
            "=============================================="
        );

        console.error(
            "❌ UNCAUGHT EXCEPTION"
        );

        console.error(
            "=============================================="
        );

        console.error(error);
    }
);

process.on(
    "unhandledRejection",
    (reason) => {

        console.error("");

        console.error(
            "=============================================="
        );

        console.error(
            "❌ UNHANDLED PROMISE REJECTION"
        );

        console.error(
            "=============================================="
        );

        console.error(reason);
    }
);
