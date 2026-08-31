// ============================================================
// AI ASSISTANT GOLD JOURNAL
// server.js
// ============================================================

const express = require("express");
const path = require("path");

// ============================================================
// APP CONFIG
// ============================================================

const app = express();

const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;
const PUBLIC_DIR = ROOT_DIR;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
// HEALTH CHECK
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
        message: "AI Assistant Gold Journal server is running",
        service: "ai-assistant-gold-journal",
        version: "1.0.0",
        node: process.version,
        environment: process.env.NODE_ENV || "production",
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// HOME PAGE
// ============================================================

app.get("/", (req, res) => {
    const indexPath = path.join(ROOT_DIR, "index.html");

    res.sendFile(indexPath, (error) => {
        if (error) {
            console.error("❌ Gagal mengirim index.html:");
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
    });
});

// ============================================================
// SPA FALLBACK
// ============================================================
//
// Jika nanti index.html menggunakan route seperti:
//
// /dashboard
// /journal
// /history
// /portfolio
//
// server akan tetap mengirim index.html.
//
// ============================================================

app.get("*", (req, res, next) => {

    // Jangan fallback untuk endpoint API
    if (req.path.startsWith("/api/")) {
        return next();
    }

    // Jangan fallback untuk file yang memiliki extension
    // tetapi tidak ditemukan.
    if (path.extname(req.path)) {
        return next();
    }

    const indexPath = path.join(ROOT_DIR, "index.html");

    res.sendFile(indexPath, (error) => {
        if (error) {
            next(error);
        }
    });
});

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {

    // Untuk API
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            success: false,
            error: "API endpoint tidak ditemukan",
            path: req.path
        });
    }

    // Untuk halaman biasa
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

    // API error
    if (req.path.startsWith("/api/")) {
        return res.status(500).json({
            success: false,
            error: "Internal Server Error"
        });
    }

    // Website error
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
});

// ============================================================
// START SERVER
// ============================================================

const server = app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("==============================================");
    console.log("🚀 AI ASSISTANT GOLD JOURNAL");
    console.log("==============================================");

    console.log(`🌐 Server     : 0.0.0.0:${PORT}`);
    console.log(`📁 Root       : ${ROOT_DIR}`);
    console.log(`📄 Index      : ${path.join(ROOT_DIR, "index.html")}`);
    console.log(`🟢 Health     : /health`);
    console.log(`🔵 API Status : /api/status`);

    console.log("==============================================");
    console.log("✅ SERVER BERHASIL START");
    console.log("==============================================");
    console.log("");
});

// ============================================================
// SERVER ERROR
// ============================================================

server.on("error", (error) => {

    console.error("");
    console.error("==============================================");
    console.error("❌ SERVER ERROR");
    console.error("==============================================");
    console.error(error);
    console.error("");
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function shutdown(signal) {

    console.log("");
    console.log(`⚠️ ${signal} diterima.`);
    console.log("🛑 Menghentikan server...");

    server.close(() => {

        console.log("✅ Server berhasil dihentikan.");

        process.exit(0);
    });
}

process.on("SIGTERM", () => {
    shutdown("SIGTERM");
});

process.on("SIGINT", () => {
    shutdown("SIGINT");
});

// ============================================================
// UNHANDLED ERRORS
// ============================================================

process.on("uncaughtException", (error) => {

    console.error("");
    console.error("==============================================");
    console.error("❌ UNCAUGHT EXCEPTION");
    console.error("==============================================");

    console.error(error);
});

process.on("unhandledRejection", (reason) => {

    console.error("");
    console.error("==============================================");
    console.error("❌ UNHANDLED PROMISE REJECTION");
    console.error("==============================================");

    console.error(reason);
});
