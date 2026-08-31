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

const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "journal.json");

// ============================================================
// ADMIN PASSWORD
// ============================================================

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "Bira1234_";

// ============================================================
// CREATE DATA DIRECTORY
// ============================================================

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

// ============================================================
// CREATE DATABASE FILE
// ============================================================

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify({
            days: {}
        }, null, 2),
        "utf8"
    );
}

// ============================================================
// DATA HELPERS
// ============================================================

function loadDatabase() {
    try {
        const raw = fs.readFileSync(DATA_FILE, "utf8");

        if (!raw.trim()) {
            return {
                days: {}
            };
        }

        const data = JSON.parse(raw);

        if (!data.days) {
            data.days = {};
        }

        return data;

    } catch (error) {

        console.error(
            "❌ Gagal membaca journal.json:",
            error
        );

        return {
            days: {}
        };
    }
}

function saveDatabase(data) {

    const tempFile = DATA_FILE + ".tmp";

    fs.writeFileSync(
        tempFile,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    fs.renameSync(
        tempFile,
        DATA_FILE
    );
}

function ensureDay(data, date) {

    if (!data.days[date]) {

        data.days[date] = {
            signals: [],
            screenshot: null
        };
    }

    if (!Array.isArray(data.days[date].signals)) {
        data.days[date].signals = [];
    }

    return data.days[date];
}

// ============================================================
// ID GENERATOR
// ============================================================

function generateId() {

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .substring(2, 8)
    );
}

// ============================================================
// APP MIDDLEWARE
// ============================================================

app.use(
    express.json({
        limit: "15mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "15mb"
    })
);

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
// ADMIN AUTH MIDDLEWARE
// ============================================================

function requireAdmin(req, res, next) {

    const password =
        req.headers["x-admin-password"];

    if (
        !password ||
        password !== ADMIN_PASSWORD
    ) {

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
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// API STATUS
// ============================================================

app.get("/api/status", (req, res) => {

    res.status(200).json({

        success: true,

        message:
            "AI Assistant Gold Journal server is running",

        service:
            "ai-assistant-gold-journal",

        version:
            "2.0.0",

        node:
            process.version,

        environment:
            process.env.NODE_ENV || "production",

        timestamp:
            new Date().toISOString()
    });
});

// ============================================================
// ADMIN VERIFY
// ============================================================

app.post("/api/admin/verify", (req, res) => {

    const password =
        String(req.body.password || "");

    if (password === ADMIN_PASSWORD) {

        return res.json({
            ok: true
        });
    }

    return res.status(401).json({
        ok: false
    });
});

// ============================================================
// GET DAY
// ============================================================

app.get("/api/day/:date", (req, res) => {

    const date = req.params.date;

    const data = loadDatabase();

    const day = data.days[date];

    if (!day) {

        return res.json({
            date,
            signals: [],
            screenshot: null
        });
    }

    res.json({
        date,
        signals: day.signals || [],
        screenshot: day.screenshot || null
    });
});

// ============================================================
// GET LATEST DATE
// ============================================================

app.get("/api/latest", (req, res) => {

    const data = loadDatabase();

    const dates =
        Object.keys(data.days)
            .filter(date => {

                const day =
                    data.days[date];

                return (
                    (day.signals &&
                        day.signals.length > 0) ||
                    day.screenshot
                );
            })
            .sort();

    if (!dates.length) {

        return res.json({
            date: null
        });
    }

    res.json({
        date: dates[dates.length - 1]
    });
});

// ============================================================
// GET MONTH
// ============================================================

app.get("/api/month/:month", (req, res) => {

    const month = req.params.month;

    const data = loadDatabase();

    const result = {};

    Object.keys(data.days)
        .filter(date =>
            date.startsWith(month)
        )
        .forEach(date => {

            result[date] = data.days[date];
        });

    res.json(result);
});

// ============================================================
// ADD SIGNAL
// ============================================================

app.post(
    "/api/day/:date/signal",
    requireAdmin,
    (req, res) => {

        const date = req.params.date;

        const {
            time,
            direction,
            entryPrice,
            tp1Price,
            tp2Price,
            slPrice,
            result,
            pnl
        } = req.body;

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

        const allowedDirections = [
            "BUY",
            "SELL"
        ];

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

        if (
            !allowedResults.includes(result)
        ) {

            return res.status(400).json({
                success: false,
                error: "Hasil signal tidak valid."
            });
        }

        const data = loadDatabase();

        const day =
            ensureDay(data, date);

        const signal = {

            id: generateId(),

            time:
                String(time).trim(),

            direction:
                direction === "SELL"
                    ? "SELL"
                    : "BUY",

            entryPrice:
                entryPrice
                    ? String(entryPrice).trim()
                    : "",

            tp1Price:
                tp1Price
                    ? String(tp1Price).trim()
                    : "",

            tp2Price:
                tp2Price
                    ? String(tp2Price).trim()
                    : "",

            slPrice:
                slPrice
                    ? String(slPrice).trim()
                    : "",

            result:
                String(result).trim(),

            pnl:
                pnl === "" ||
                pnl === undefined ||
                pnl === null
                    ? 0
                    : Number(pnl),

            createdAt:
                new Date().toISOString()
        };

        if (Number.isNaN(signal.pnl)) {
            signal.pnl = 0;
        }

        day.signals.push(signal);

        saveDatabase(data);

        res.json({
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

        const date =
            req.params.date;

        const id =
            req.params.id;

        const data =
            loadDatabase();

        const day =
            data.days[date];

        if (!day) {

            return res.status(404).json({
                success: false,
                error: "Tanggal tidak ditemukan."
            });
        }

        const before =
            day.signals.length;

        day.signals =
            day.signals.filter(
                signal =>
                    String(signal.id) !==
                    String(id)
            );

        if (
            day.signals.length === before
        ) {

            return res.status(404).json({
                success: false,
                error: "Signal tidak ditemukan."
            });
        }

        saveDatabase(data);

        res.json({
            success: true
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

        const date =
            req.params.date;

        const screenshot =
            req.body.screenshot;

        if (!screenshot) {

            return res.status(400).json({
                success: false,
                error: "Screenshot belum dipilih."
            });
        }

        if (
            typeof screenshot !== "string" ||
            !screenshot.startsWith("data:image/")
        ) {

            return res.status(400).json({
                success: false,
                error: "Format screenshot tidak valid."
            });
        }

        const data =
            loadDatabase();

        const day =
            ensureDay(data, date);

        day.screenshot =
            screenshot;

        saveDatabase(data);

        res.json({
            success: true
        });
    }
);

// ============================================================
// HOME
// ============================================================

app.get("/", (req, res) => {

    const indexPath =
        path.join(
            ROOT_DIR,
            "index.html"
        );

    res.sendFile(
        indexPath,
        error => {

            if (error) {

                console.error(
                    "❌ Gagal mengirim index.html:"
                );

                console.error(error);

                if (!res.headersSent) {

                    res.status(500).send(
                        "index.html tidak ditemukan."
                    );
                }
            }
        }
    );
});

// ============================================================
// SPA FALLBACK
// ============================================================

app.get("*", (req, res, next) => {

    if (
        req.path.startsWith("/api/")
    ) {
        return next();
    }

    if (
        path.extname(req.path)
    ) {
        return next();
    }

    const indexPath =
        path.join(
            ROOT_DIR,
            "index.html"
        );

    res.sendFile(
        indexPath,
        error => {

            if (error) {
                next(error);
            }
        }
    );
});

// ============================================================
// 404
// ============================================================

app.use((req, res) => {

    if (
        req.path.startsWith("/api/")
    ) {

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
<meta name="viewport"
      content="width=device-width, initial-scale=1.0">
<title>404</title>
</head>

<body style="
background:#0b0f14;
color:white;
font-family:Arial;
text-align:center;
padding:80px 20px;
">

<h1>404</h1>

<p>Halaman tidak ditemukan.</p>

<a href="/" style="
color:white;
">
Kembali ke Dashboard
</a>

</body>
</html>
`);
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {

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

<body style="
background:#0b0f14;
color:white;
font-family:Arial;
text-align:center;
padding:60px 20px;
">

<h1>500</h1>

<p>
Terjadi kesalahan pada server.
</p>

<a href="/" style="color:white;">
Kembali
</a>

</body>
</html>
`);
});

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
                `🌐 Server : 0.0.0.0:${PORT}`
            );

            console.log(
                `📁 Root   : ${ROOT_DIR}`
            );

            console.log(
                `💾 Data   : ${DATA_FILE}`
            );

            console.log(
                `🟢 Health : /health`
            );

            console.log(
                `🔵 API    : /api/status`
            );

            console.log(
                "🔐 Admin  : ENABLED"
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

server.on("error", error => {

    console.error(
        "❌ SERVER ERROR"
    );

    console.error(error);
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function shutdown(signal) {

    console.log(
        `⚠️ ${signal} diterima.`
    );

    console.log(
        "🛑 Menghentikan server..."
    );

    server.close(() => {

        console.log(
            "✅ Server berhasil dihentikan."
        );

        process.exit(0);
    });
}

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

// ============================================================
// UNCAUGHT ERRORS
// ============================================================

process.on(
    "uncaughtException",
    error => {

        console.error(
            "❌ UNCAUGHT EXCEPTION"
        );

        console.error(error);
    }
);

process.on(
    "unhandledRejection",
    reason => {

        console.error(
            "❌ UNHANDLED PROMISE REJECTION"
        );

        console.error(reason);
    }
);
